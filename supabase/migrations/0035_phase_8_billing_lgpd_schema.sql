-- 0035_phase_8_billing_lgpd_schema.sql
--
-- Fase 8: Pagamento + LGPD — esqueleto de banco (Wave 1, Plano 08-01).
--
-- CONTEXTO:
--   Erguimento do DDL base para o sistema de monetização por pacote pré-pago
--   de créditos (Asaas) + trial gratuito + cumprimento LGPD core. Sem este
--   DDL, nenhum plano subsequente (Waves 2-6) pode rodar.
--
-- DECISÕES CONTEXT.md vinculadas:
--   D-01: Pacote pré-pago de créditos via Asaas (NÃO subscription)
--   D-02: 4 SKUs com pricing locked (avulsa/pequeno/medio/grande)
--   D-03: Validade 12 meses em todos os pacotes
--   D-04: Consumo FIFO entre pacotes ativos (mais antigo primeiro)
--   D-06: Trial = 3 leituras OU 60 dias (first-wins)
--   D-07: Após trial, histórico permanece visível
--   D-08: Trial e créditos convivem (trial primeiro, crédito ao esgotar)
--   D-09: internal_use=true = bypass total de créditos/trial
--   D-10: Verificação de saldo em 3 momentos do fluxo
--   D-11: Reserva 7d nos 2 primeiros momentos (link remoto + captura)
--   D-12: CPF + telefone obrigatório no signup (anti-fraud)
--   D-15: Audit log básico de eventos críticos (LGPD-04 básico)
--   D-18: TOS terapeuta via checkbox no signup
--   D-19: Termo cliente biométrico antes de criar link ou capturar
--   D-20: Schema base — 8 tabelas novas + ALTER profiles
--
-- PITFALLS DO RESEARCH (prevenção inline):
--   #2: credit_reservations.credit_id NULLABLE (trial/internal têm credit_id NULL)
--   #3: CHECK constraint (remaining + reserved <= purchased) — defense-in-depth
--   #7: CHECK em trial_status (used >= 0 and used <= max)
--
-- Strictly additive (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- Zero DROP. Idempotente: rodar 2x é no-op na segunda execução.
-- Forward-only. RLS habilitada em 0036 (migration separada — ordem explícita).
-- Divisão de trabalho: Claude autorou; founder aplica (supabase db push --linked).

begin;

-- ============================================================================
-- 1) credit_packages — catálogo imutável de SKUs (D-02)
-- ============================================================================
create table if not exists public.credit_packages (
  id            uuid        primary key default gen_random_uuid(),
  sku           text        unique not null,                            -- 'avulsa' | 'pequeno' | 'medio' | 'grande'
  name          text        not null,
  leituras_count int        not null check (leituras_count > 0),
  price_brl     numeric(10,2) not null check (price_brl > 0),
  badge         text,                                                    -- 'mais_escolhido' | 'melhor_valor' | null
  display_order int         not null default 0,
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);

comment on table public.credit_packages is
  'Fase 8 D-02: catálogo imutável de SKUs de pacotes. Linhas seedadas em 0038. NUNCA deletar/alterar pricing — criar novo sku com versão (v2). display_order controla ordem na tela de compra (D-21/D-22).';
comment on column public.credit_packages.sku is
  'D-02: identificador canônico do pacote. Valores: avulsa | pequeno | medio | grande. UNIQUE. Usado em ON CONFLICT do seed 0038.';
comment on column public.credit_packages.leituras_count is
  'D-02: quantidade de leituras incluídas no pacote. CHECK (> 0). Avulsa = 1, Pequeno = 5, Médio = 15, Grande = 30.';
comment on column public.credit_packages.price_brl is
  'D-02: preço em BRL, centavos representados como decimais. Locked: 99.70 / 298.50 / 745.50 / 1191.00. CHECK (> 0).';
comment on column public.credit_packages.badge is
  'D-22: badge de destaque do card na UI. NULL = sem badge. mais_escolhido (Médio), melhor_valor (Grande).';
comment on column public.credit_packages.active is
  'Se false, não exibido na tela de compra (RLS filtra active=true para authenticated). Founder usa para descontinuar SKU sem deletar histórico.';

-- ============================================================================
-- 2) customer_credits — saldo por compra (D-20 + D-03 + D-04)
-- ============================================================================
create table if not exists public.customer_credits (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references public.profiles(id) on delete cascade,
  package_id           uuid        not null references public.credit_packages(id),
  leituras_purchased   int         not null check (leituras_purchased > 0),
  leituras_remaining   int         not null check (leituras_remaining >= 0),
  leituras_reserved    int         not null default 0 check (leituras_reserved >= 0),
  purchase_date        timestamptz not null default now(),
  expires_at           timestamptz not null,                            -- purchase_date + 12m, setado no webhook handler
  status               text        not null default 'pending'
                         check (status in ('pending','active','expired','refunded')),
  asaas_payment_id     text        unique,                              -- idempotência: 1 row por payment
  asaas_invoice_url    text,
  asaas_payment_status text,
  created_at           timestamptz not null default now(),
  -- Defense-in-depth (D-04 + RESEARCH pitfall #3): remaining + reserved nunca
  -- supera purchased. Barreira final caso bug app-level tente over-reservar.
  constraint customer_credits_balance_check
    check (leituras_remaining + leituras_reserved <= leituras_purchased)
);

comment on table public.customer_credits is
  'Fase 8 D-20: saldo de créditos por compra. Uma row por pagamento Asaas confirmado. leituras_remaining + leituras_reserved ≤ leituras_purchased (CHECK defense-in-depth). FIFO via purchase_date asc (D-04). Validade 12m por row (D-03). asaas_payment_id UNIQUE garante idempotência do webhook (RESEARCH §Idempotency).';
comment on column public.customer_credits.leituras_remaining is
  'D-04: saldo disponível para nova reserva. FIFO: fifo_reserve_credit() seleciona row com menor purchase_date. Decrementado na conversão de reserva em débito definitivo (analyze/route.ts).';
comment on column public.customer_credits.leituras_reserved is
  'D-11: saldo reservado (em janela de 7d). Reservas expiradas sem conversão devolvem +1 aqui via release_reservation(). Soma com remaining ≤ purchased (CHECK).';
comment on column public.customer_credits.expires_at is
  'D-03: purchase_date + 12 meses. Setado no handler do webhook payment_confirmed. Saldo restante ao expirar é zerado sem reembolso (D-04), exceto caso-a-caso suporte.';
comment on column public.customer_credits.status is
  'D-20: pending = aguardando confirmação de pagamento | active = créditos disponíveis | expired = 12m expirados | refunded = reembolsado (D-13 CDC 7d).';
comment on column public.customer_credits.asaas_payment_id is
  'RESEARCH §Idempotency: chave de idempotência do webhook. UNIQUE garante que mesmo se o Asaas mandar o evento 2x, só 1 row é criada. Preenchido no handler payment_confirmed (Plano 08-04).';

-- Índice hot-path: buscar créditos ativos do usuário pra FIFO reserve (D-04)
create index if not exists customer_credits_user_active_idx
  on public.customer_credits (user_id, status, expires_at)
  where status = 'active';

-- ============================================================================
-- 3) credit_transactions — log append-only (D-20, imutabilidade)
-- ============================================================================
create table if not exists public.credit_transactions (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references public.profiles(id) on delete cascade,
  credit_id        uuid        references public.customer_credits(id) on delete cascade, -- NULL para trial
  reading_id       uuid,                                                -- SEM FK — vida própria
  type             text        not null
                     check (type in ('purchase','reserve','consume','release','refund','expire','adjust')),
  amount           int         not null,                               -- + ou −, signed
  asaas_payment_id text,                                               -- link em refund/purchase
  notes            text,
  created_at       timestamptz not null default now()
);

comment on table public.credit_transactions is
  'Fase 8 D-20: log append-only de todas as movimentações de crédito. NUNCA UPDATE/DELETE por terapeuta (imutável — sem policy UPDATE/DELETE para authenticated em 0036). credit_id NULL para transações de trial (D-06). reading_id SEM FK — desacoplado do ciclo de vida da leitura (mesmo padrão de 0017/0028).';
comment on column public.credit_transactions.credit_id is
  'RESEARCH pitfall #2: NULLABLE. NULL = transação de trial (D-06) ou internal (D-09). FK com ON DELETE CASCADE pra créditos comprados.';
comment on column public.credit_transactions.type is
  'purchase=compra confirmada | reserve=reserva criada | consume=conversão final | release=reserva liberada | refund=reembolso | expire=expiração 12m | adjust=ajuste manual founder.';
comment on column public.credit_transactions.amount is
  'Signed: positivo = entrada (purchase, release, adjust+), negativo = saída (reserve, consume, expire, refund). Soma de amount por credit_id + type é o ledger auditável.';

-- Índice de auditoria por usuário
create index if not exists credit_transactions_user_idx
  on public.credit_transactions (user_id, created_at desc);

-- ============================================================================
-- 4) credit_reservations — snapshot de reservas ativas, 7d (D-11)
-- ============================================================================
create table if not exists public.credit_reservations (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  credit_id   uuid        references public.customer_credits(id) on delete cascade, -- NULLABLE — trial/internal
  reading_id  uuid        not null,                                    -- SEM FK — vida própria
  expires_at  timestamptz not null,                                    -- reserved_at + 7d, setado no INSERT
  status      text        not null default 'active'
                check (status in ('active','converted','released','expired')),
  released_at timestamptz,
  created_at  timestamptz not null default now()
);

comment on table public.credit_reservations is
  'Fase 8 D-11: reservas temporárias de 7d. 1 reserva ativa por reading_id (índice único parcial abaixo). credit_id NULL para trial (D-06) e internal_use (D-09) — RESEARCH pitfall #2. Cron diário libera expiradas (expires_at < now() AND status=active). UI mostra "Reservados: N" via COUNT WHERE status=active.';
comment on column public.credit_reservations.credit_id is
  'RESEARCH pitfall #2: NULLABLE. NULL = reserva de trial (D-06) ou conta internal_use (D-09).';
comment on column public.credit_reservations.reading_id is
  'D-11: leitura vinculada à reserva. SEM FK — reading pode ser deletada sem invalidar o log de reserva. Índice único parcial (status=active) garante 1 reserva ativa por reading.';
comment on column public.credit_reservations.expires_at is
  'D-11: criado_at + 7 dias. Setado na função fifo_reserve_credit() (0037). Cron diário chama release_reservation(reading_id, expired) para linhas onde expires_at < now().';
comment on column public.credit_reservations.status is
  'active=reserva em andamento | converted=leitura gerada (débito definitivo em customer_credits) | released=cancelada pelo terapeuta ou manualmente | expired=7d sem geração.';

-- Pitfall de 1 reserva ativa por reading: índice único parcial (D-11)
create unique index if not exists credit_reservations_one_active_per_reading
  on public.credit_reservations (reading_id)
  where status = 'active';

-- Hot-path: cron diário varre expiradas
create index if not exists credit_reservations_expires_active_idx
  on public.credit_reservations (expires_at)
  where status = 'active';

-- ============================================================================
-- 5) trial_status — controle do trial gratuito (D-06)
-- ============================================================================
create table if not exists public.trial_status (
  user_id              uuid        primary key references public.profiles(id) on delete cascade,
  trial_started_at     timestamptz not null default now(),
  trial_expires_at     timestamptz not null default (now() + interval '60 days'),
  trial_readings_used  int         not null default 0,
  trial_readings_max   int         not null default 3,
  ended_at             timestamptz,
  ended_reason         text,
  -- Defense-in-depth (D-06 + RESEARCH pitfall #7): used nunca negativo nem > max
  constraint trial_status_readings_check
    check (trial_readings_used >= 0 and trial_readings_used <= trial_readings_max)
);

comment on table public.trial_status is
  'Fase 8 D-06: 1 row por terapeuta no trial. trial_expires_at = now() + 60 dias (default). trial_readings_max = 3. Termina no que vier primeiro: readings_used = max OU expires_at < now(). Função is_in_trial() (0037) encapsula a lógica. ended_at/reason setados quando trial é encerrado (compra, expiração, ou limite de leituras).';
comment on column public.trial_status.trial_expires_at is
  'D-06: now() + 60 dias. Depois deste timestamp, is_in_trial() retorna false mesmo se used < max.';
comment on column public.trial_status.trial_readings_max is
  'D-06: default 3. Coluna permite ajuste por-usuário pelo founder (ex: conta de demo estendida) sem código novo.';
comment on column public.trial_status.ended_reason is
  'Enum soft: purchase | expired_60d | readings_exhausted | manual_admin. Rastreia por que o trial terminou para analytics.';

-- ============================================================================
-- 6) asaas_webhook_events — idempotência de webhooks (D-01)
-- ============================================================================
create table if not exists public.asaas_webhook_events (
  event_id      text        primary key,                               -- "evt_05b708...&368604920"
  event_type    text        not null,
  payment_id    text,                                                  -- asaas payment id (ex: pay_xxxxx)
  payload       jsonb       not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  status        text        not null default 'received'
                  check (status in ('received','processed','failed','ignored'))
);

comment on table public.asaas_webhook_events is
  'Fase 8 D-01 RESEARCH §Idempotency: tabela de idempotência para eventos do Asaas. event_id PK garante exatamente-uma-vez mesmo se Asaas remandar. Handler (Plano 08-04): SELECT 1 WHERE event_id = $1; se existir → 200 OK sem reprocessar; senão INSERT + processar. Service-role apenas (sem policies authenticated).';
comment on column public.asaas_webhook_events.event_id is
  'RESEARCH §Idempotency: chave única do evento Asaas. Formato: "evt_{uuid}&{payment_id}" ou equivalente. PK garante idempotência mesmo em retries do Asaas.';
comment on column public.asaas_webhook_events.status is
  'received = recebido mas não processado | processed = processado com sucesso | failed = erro durante processamento | ignored = evento irrelevante (ex: payment_overdue em pré-pago).';

-- Índice para grep por payment_id (debug + refund lookup)
create index if not exists asaas_webhook_events_payment_idx
  on public.asaas_webhook_events (payment_id);

-- ============================================================================
-- 7) audit_events — log de eventos críticos LGPD-04 básico (D-15)
-- ============================================================================
create table if not exists public.audit_events (
  id            uuid        primary key default gen_random_uuid(),
  actor_user_id uuid,                                                  -- SEM FK — actor pode ter sido deletado
  actor_email   text,
  event_type    text        not null,
  target_type   text,                                                  -- 'reading' | 'client' | 'credit' | 'profile' | 'term'
  target_id     uuid,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

comment on table public.audit_events is
  'Fase 8 D-15 LGPD-04 básico: log de eventos críticos para auditoria. Append-only (sem policies UPDATE/DELETE para authenticated — 0036). actor_user_id SEM FK: actor pode ter sido deletado mas o log permanece (LGPD art. 16). Service-role para INSERT (via audit emitter). Founder lê via dashboard (RLS Pattern C em 0036). Fase 8.1+ adiciona dashboard configurável.';
comment on column public.audit_events.actor_user_id is
  'UUID do usuário que disparou o evento. SEM FK para resiliência — se actor for deletado, o evento permanece anonimizado. Casado com actor_email para correlação.';
comment on column public.audit_events.event_type is
  'Vocab de eventos: trial_started | credit_purchased | credit_reserved | credit_consumed | credit_released | credit_expired | report_delivered | term_accepted | client_deletion_requested | profile_data_export_requested.';
comment on column public.audit_events.target_type is
  'Tipo do objeto afetado. Valores: reading | client | credit | profile | term | trial. Combinado com target_id para lookup.';

-- Índice de auditoria por ator (quem fez o quê)
create index if not exists audit_events_actor_idx
  on public.audit_events (actor_user_id, created_at desc);

-- Índice de auditoria por objeto (o que aconteceu com X)
create index if not exists audit_events_target_idx
  on public.audit_events (target_type, target_id, created_at desc);

-- ============================================================================
-- 8) ALTER profiles — colunas da Fase 8 (D-09, D-12, D-18)
-- ============================================================================

-- asaas_customer_id: ID do customer no Asaas (criado no primeiro pagamento)
alter table public.profiles
  add column if not exists asaas_customer_id text;

create unique index if not exists profiles_asaas_customer_id_unique_idx
  on public.profiles (asaas_customer_id)
  where asaas_customer_id is not null;

comment on column public.profiles.asaas_customer_id is
  'Fase 8 D-01: ID do customer no Asaas. NULL até o primeiro pagamento. UNIQUE parcial (where not null) garante 1 conta Asaas por terapeuta. Preenchido no handler payment_confirmed (Plano 08-04).';

-- internal_use: bypass total de créditos e trial (D-09)
alter table public.profiles
  add column if not exists internal_use boolean not null default false;

comment on column public.profiles.internal_use is
  'Fase 8 D-09: se true, conta bypassa créditos e trial (ilimitado). Aplica ao founder, admins e contas de teste interno. Excluído de métricas de faturamento. Setado manualmente pelo founder via Supabase dashboard.';

-- cpf: CPF do terapeuta — anti-fraud trial (D-12)
alter table public.profiles
  add column if not exists cpf text;

create unique index if not exists profiles_cpf_unique_idx
  on public.profiles (cpf)
  where cpf is not null;

comment on column public.profiles.cpf is
  'Fase 8 D-12: CPF do terapeuta (anti-fraud trial). UNIQUE parcial (where not null). Validação de formato (regex) no app; validação fiscal via API Receita Federal = V1.1+. NULL em contas antigas pré-Fase 8.';

-- tos_accepted_at: já existe desde 0022_beta_signup_fields.sql — não recriado.
-- tos_version: já existe desde 0022_beta_signup_fields.sql — não recriado.

commit;
