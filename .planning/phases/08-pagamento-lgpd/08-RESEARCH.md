# Phase 8: Pagamento (Asaas pacote pré-pago) + LGPD core — Research

**Researched:** 2026-05-26
**Domain:** Brazilian payments (Asaas API), credit ledger architecture, LGPD biometric consent, Postgres concurrency, Vercel Cron + pg_cron
**Confidence:** HIGH (Asaas endpoints verified contra docs.asaas.com; credit ledger pattern verificado contra padrões públicos; LGPD assinatura digital com caveats explícitos)

---

## Summary

Phase 8 ergue o esqueleto de monetização do Iris Codex sobre dois pilares já estabelecidos no stack (Supabase + Next.js + Vercel) e introduz uma única dependência externa nova (Asaas). As 22 decisões em CONTEXT.md fecham praticamente todo o quê — pacote pré-pago de créditos, 4 SKUs, trial 3-OR-60d first-wins, reserva 7d, validade 12m, FIFO, arrependimento 7d, termo biométrico nativo via Gotenberg. O que sobra é o **como**, e aqui a research empírica revelou três áreas críticas:

1. **Asaas é simples na superfície (um POST + um webhook) mas tem armadilhas operacionais não-óbvias** — timeout de 10s no receptor, fila pausa após 15 falhas consecutivas, retries acumulados disparam em sequência ao reativar (avalanche), `event.id` é a chave de idempotência canônica (não `payment.id`), e fluxos de eventos diferem por método (PIX = 2 estados, BOLETO/CARTÃO = 3+ estados com `PAYMENT_CONFIRMED` ≠ `PAYMENT_RECEIVED` por 30 dias no cartão).
2. **Credit ledger com FIFO + reservation + concurrent consumption é exatamente o lugar onde projetos perdem 6 meses reescrevendo** — padrão validado é "append-only transactions table + denormalized balance cache + advisory lock no consume". `SELECT ... FOR UPDATE` em row da `customer_credits` é suficiente pra evitar double-spend; PG row locks são pesados o suficiente sem precisar de Redis.
3. **Termo biométrico click-through tem valor probatório explicitamente MENOR que ICP-Brasil** — a mitigação (hash SHA256 + immutable storage + IP + timestamp + audit trail) é jurisprudência aceita mas vale ESCRITO no termo + na decisão de produto. Founder já fez essa escolha consciente (D-17); research apenas confirma + flagga o trigger de revisão.

**Primary recommendation:** Estruturar a fase em 5 ondas — (1) Migrations + Asaas client lib + schemas Zod; (2) Webhook handler + idempotency table; (3) Credit ledger consume/reserve com `FOR UPDATE`; (4) UI compra + termo biométrico + trial gate; (5) Cron daily (1 endpoint Vercel Cron, 1 chamada por dia, suficiente pra todas as 3 tarefas em sequência: liberar reservas expiradas + expirar créditos 12m + enviar emails de aviso).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Asaas webhook receipt + HMAC | API (Next.js route handler) | Database (idempotency table) | Webhook signature precisa raw body antes de parse — só servidor; idempotency dedupe via UNIQUE constraint |
| Credit reserve / consume / expire | Database (Postgres) | API (server actions chamam SQL) | Transação atômica com `FOR UPDATE` em row tem que viver no DB; server action é só wrapper |
| Trial state evaluation | API (server action) | Database (read trial_status) | `is_in_trial(now)` é computado em runtime read; nada material grava em trial_status exceto signup/exhaust |
| Compra de pacote (criar charge Asaas) | API (server action) | External (Asaas) | Backend faz fetch out para Asaas + redireciona invoiceUrl |
| Termo biométrico PDF render | API (Gotenberg fetch) | Storage (Supabase signed URLs) | Mesmo pattern do `/api/readings/[id]/pdf` já estabelecido — reusar |
| Assinatura digital click-through | API (server action) | Database (client_consents append) | Já existe infra Fase 4 (`client_consents` + `consent_terms`) — Phase 8 NÃO inventa nada novo |
| Anti-fraud CPF/telefone dedup | Database (UNIQUE constraint) | API (validation + 23505 handling) | Constraint no banco é primeira linha; app trata erro amigável |
| Cron daily (3 jobs) | API (Vercel Cron → /api/cron/daily) | Database (job logic em SQL/server action) | Vercel Cron 1× dia 02:00 BRT, chama 1 endpoint que faz tudo |
| Audit log (LGPD-04 básico) | Database (audit_events table) | API (server actions INSERT) | Append-only event-sourced — mesma filosofia do `client_consents` |
| LGPD-03 manual deletion link | API (mailto: + form) | Manual (founder responde via email) | Sem self-service — link `/privacidade#deletar-dados` + email pre-formatado |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | ^3.x (já no projeto) | Validar payload webhook Asaas + body server actions | Já é o validador único do codebase; Pattern reusado de Fase 5 vision webhook | [VERIFIED: package.json existente do projeto] |
| `@supabase/supabase-js` (já) | já no projeto | DB + service client pra cron | Já estabelecido; service-role bypass RLS pra cron |
| `node:crypto` | nativo Node | HMAC validation (já usado pra Modal) | Padrão; sem dep externa | [VERIFIED: apps/web/lib/vision/hmac.ts] |

**NÃO instalar:** SDK oficial Asaas. Não existe SDK oficial mantido. Há SDKs comunitários (`npm i asaas`, `eduardobernardo/asaas`) mas Asaas API é só REST simples — `fetch()` direto reduz superfície de bug e mantém controle do retry/timeout/error handling. [CITED: https://www.npmjs.com/package/asaas — comunitário não-oficial]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `validation-br` ou implementação inline | ^1.x ou inline | Validar CPF módulo-11 | Inline é melhor (50 linhas, zero dep, sem risco de mudança breaking) — D-12 |
| `react-input-mask` ou inline mask | (já temos `formatPhoneBR` em `lib/profile/fields.ts`) | Mask CPF + telefone | Reusar pattern existente |

**Installation:** Nenhuma instalação NOVA obrigatória. Reusar tudo do stack existente.

**Version verification (executado durante research):** N/A — sem pacotes novos.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Asaas REST direto via `fetch()` | npm `asaas` SDK comunitário | SDK adiciona dep não-oficial; `fetch()` direto = ~80 linhas pra cobrir create-customer/create-payment/refund — preferível |
| Vercel Cron (escolhido) | Supabase pg_cron | pg_cron é mais barato e tem mais frequência granular, mas precisa de connection pool dedicado pra HTTP calls. Vercel Cron é 1 endpoint chamado 1× dia = simples; ver "Cron Daily Jobs" abaixo |
| `validation-br` npm package | Inline CPF validator | Inline tem zero dep, 50 linhas, ownership claro — preferível pra algoritmo estável de 30 anos |
| Termo via DocuSeal/Clicksign | Solução nativa (locked D-17) | Founder LOCKED em D-17 — research apenas confirma trade-off |

---

## Asaas Integration

### Environments + Auth

| Item | Sandbox | Production |
|------|---------|------------|
| Base URL | `https://api-sandbox.asaas.com/v3` | `https://api.asaas.com/v3` |
| API key prefix | `$aact_hmlg_...` | `$aact_prod_...` |
| Header | `access_token: $aact_hmlg_...` | `access_token: $aact_prod_...` |
| Rate limit | 25.000 req / 12h / conta | 25.000 req / 12h / conta |
| Concurrent GET | até 50 | até 50 |
| Webhook idempotency timeout | 10s | 10s |
| Webhook queue pause threshold | 15 falhas consecutivas | 15 falhas consecutivas |

[VERIFIED: https://docs.asaas.com/docs/authentication-2, https://docs.asaas.com/docs/api-limits-1, https://docs.asaas.com/docs/erro-read-timed-out]

**Env vars Vercel sugeridos:**
- `ASAAS_API_BASE_URL` — `https://api.asaas.com/v3` (override pra sandbox em PR previews via `https://api-sandbox.asaas.com/v3`)
- `ASAAS_API_KEY` — `$aact_prod_...` (em sandbox: `$aact_hmlg_...`)
- `ASAAS_WEBHOOK_TOKEN` — string aleatória 32-255 chars sem whitespace nem números sequenciais; configurada no painel Asaas + no env

### POST /v3/customers — Criar customer

**Quando chamar:** No primeiro POST `/v3/payments` do terapeuta. Cache `asaas_customer_id` em `profiles` pra reusar nas próximas compras (D-20 schema é extensível). [CITED: https://docs.asaas.com/reference/criar-novo-cliente]

**Body obrigatório (mínimo viável):**
```json
{
  "name": "Nome Completo do Terapeuta",
  "cpfCnpj": "12345678901",
  "email": "terapeuta@email.com",
  "mobilePhone": "47999999999",
  "externalReference": "<profiles.id UUID>"
}
```

**Response (200):**
```json
{
  "id": "cus_000005219613",
  "name": "...",
  "cpfCnpj": "12345678901",
  "email": "...",
  "dateCreated": "2026-05-26"
}
```

Persistir `id` em `profiles.asaas_customer_id` (nova coluna). `externalReference` recomendado pra reconciliação. [CITED: https://docs.asaas.com/docs/how-to-provide-customer-data — "Whenever possible, send the externalReference field, as this attribute facilitates reconciliation"]

⚠️ **Pitfall:** Asaas permite criar customers duplicados. **Dedupe é responsabilidade do app** — checar `profiles.asaas_customer_id` antes de POST. [CITED: https://docs.asaas.com/docs/criando-um-cliente]

### POST /v3/payments — Criar cobrança avulsa

**Endpoint:** `POST https://api.asaas.com/v3/payments`

**Body (single-shot, sem parcelas):**
```json
{
  "customer": "cus_000005219613",
  "billingType": "UNDEFINED",
  "value": 298.50,
  "dueDate": "2026-06-02",
  "description": "Iris Codex — Pacote Pequeno (5 leituras)",
  "externalReference": "<credit_packages_purchase.id UUID>"
}
```

**Campos críticos:**
- `billingType`: `"UNDEFINED"` permite cliente escolher PIX/BOLETO/CARTÃO no checkout do Asaas — usar isso (D-01 menciona "Pix, cartão de crédito, boleto"). Alternativas: `"PIX"`, `"BOLETO"`, `"CREDIT_CARD"`.
- `value`: número decimal em reais (não centavos). R$298,50 → `298.50`.
- `dueDate`: ISO date `YYYY-MM-DD`. Asaas exige data válida; `now + 7 days` é seguro pra cobertura PIX.
- `externalReference`: **CRÍTICO** — id da nossa row de compra pendente. Volta no webhook payload, permite mapear sem grep por valor.

[VERIFIED: https://docs.asaas.com/reference/criar-nova-cobranca, https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito]

**Response (200):**
```json
{
  "id": "pay_5749285741",
  "customer": "cus_000005219613",
  "value": 298.50,
  "netValue": 296.43,
  "billingType": "UNDEFINED",
  "status": "PENDING",
  "dueDate": "2026-06-02",
  "description": "...",
  "externalReference": "<credit_packages_purchase.id UUID>",
  "invoiceUrl": "https://www.asaas.com/i/056472974281",
  "bankSlipUrl": null,
  "dateCreated": "2026-05-26"
}
```

**Fluxo UI:** Redirecionar terapeuta para `invoiceUrl` (o checkout hospedado do Asaas trata PIX QR + cartão + boleto + email recebido). [CITED: https://docs.asaas.com/docs/creating-a-payment-link]

### POST /v3/payments/{id}/refund — Estornar cobrança

**Endpoint:** `POST https://api.asaas.com/v3/payments/{id}/refund`

**Body (refund parcial):**
```json
{
  "value": 119.40,
  "description": "Arrependimento 7d - 3 leituras restantes × R$ 39.80"
}
```

**Body (refund total):** Omitir `value` completamente.
```json
{
  "description": "Arrependimento 7d - pacote não consumido"
}
```

**Importante:**
- **Total** = body sem `value` → estorna o valor cheio da cobrança.
- **Parcial** = body com `value` numérico → estorna `value` reais.
- PIX permite múltiplos refunds parciais (soma ≤ original).
- Cartão também permite parcial.
- Boleto: full refund only (PAYMENT_REFUND_DENIED se tentar parcial).
- Asaas NÃO reembolsa as taxas próprias.

[VERIFIED: https://docs.asaas.com/reference/refund-payment, https://docs.asaas.com/docs/estornos]

**Cálculo proporcional D-13:**
```
preço_unitário_pacote = price_brl / leituras_count
leituras_restantes = leituras_purchased - leituras_reserved - leituras_consumed
refund_value = preço_unitário_pacote × leituras_restantes
```
Ex: Pacote Pequeno R$298,50 com 5 leituras, 2 consumidas → restantes=3 → refund = 59,70 × 3 = R$179,10.

### Webhook events — payloads reais

**Headers que Asaas envia:**
- `asaas-access-token: <ASAAS_WEBHOOK_TOKEN>` — STRING configurada por nós quando criamos o webhook
- `content-type: application/json`

**Payload base (qualquer evento):**
```json
{
  "id": "evt_05b708f961d739ea7eba7e4db318f621&368604920",
  "event": "PAYMENT_RECEIVED",
  "dateCreated": "2026-05-26 16:45:03",
  "payment": {
    "id": "pay_5749285741",
    "customer": "cus_000005219613",
    "value": 298.50,
    "netValue": 296.43,
    "billingType": "PIX",
    "status": "RECEIVED",
    "externalReference": "<credit_packages_purchase.id>",
    "paymentDate": "2026-05-26",
    "clientPaymentDate": "2026-05-26",
    ...
  }
}
```

[VERIFIED: https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook, https://docs.asaas.com/docs/payment-events]

**Eventos relevantes pra Phase 8 (lista completa):**

| Evento | Quando | Ação Iris Codex |
|--------|--------|-----------------|
| `PAYMENT_CREATED` | Cobrança criada | NO-OP (já criamos local antes) |
| `PAYMENT_CONFIRMED` | Pago mas saldo não disponível (cartão/boleto) | NO-OP — esperar PAYMENT_RECEIVED |
| `PAYMENT_RECEIVED` | Pago + saldo disponível | **Adicionar créditos + email** (canonical event D-01) |
| `PAYMENT_OVERDUE` | Vencido | NO-OP (não temos dunning, modelo pré-pago) |
| `PAYMENT_DELETED` | Cobrança removida | NO-OP (terapeuta cancelou antes de pagar) |
| `PAYMENT_REFUNDED` | Estornado total | **Zerar créditos do pacote** + transaction log |
| `PAYMENT_PARTIALLY_REFUNDED` | Estornado parcial | **Decrementar `leituras_remaining`** proporcional |
| `PAYMENT_CHARGEBACK_REQUESTED` | Chargeback recebido | Suspender créditos + alerta founder |

[VERIFIED: https://docs.asaas.com/docs/payment-events]

**Decisão crítica:** Listener escuta **`PAYMENT_RECEIVED`** como evento canônico de "creditar". `PAYMENT_CONFIRMED` é só notificação intermediária e NÃO deve disparar crédito (cartão pode ter 30 dias entre confirmed → received; queremos pagamento liquidado).

**Fluxos por método (confirma que dispatch deve ser idempotente):**
- **PIX:** `CREATED → RECEIVED` (2 eventos)
- **BOLETO:** `CREATED → CONFIRMED → RECEIVED` (3 eventos)
- **CARTÃO:** `CREATED → CONFIRMED → RECEIVED (30 dias depois)` ⚠️
- **CARTÃO em análise de risco:** `CREATED → AWAITING_RISK_ANALYSIS → APPROVED/REPROVED → CONFIRMED → RECEIVED`

[VERIFIED: https://docs.asaas.com/docs/webhook-para-cobrancas]

⚠️ **Cartão tem 30d delay entre CONFIRMED e RECEIVED** — terapeuta paga no cartão mas não vê créditos até 30 dias depois? **NÃO**: founder LOCKED em D-01 "Cliente compra → webhook payment_confirmed → adiciona créditos". Re-decisão necessária: ou (a) confiar em PAYMENT_CONFIRMED no cartão e aceitar risco de chargeback estornando créditos, ou (b) creditar só em PAYMENT_RECEIVED e aceitar 30d wait em cartão. **Recomendação pra planner:** `[ASSUMED]` que founder quer (a) — UX-first, chargebacks são raros e o credit ledger já tem mecanismo de zeragem via PAYMENT_REFUNDED. Confirmar com founder em discuss-phase final ou na execução.

### HMAC / Token Validation Pattern

⚠️ Asaas NÃO usa HMAC-SHA256 como o webhook do Modal. Usa **shared secret simples** no header `asaas-access-token`.

**Implementação:**
```typescript
const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN
const provided = request.headers.get('asaas-access-token')
if (!expectedToken || !provided) return new Response('missing token', { status: 401 })
// timing-safe compare to avoid timing attacks
const a = Buffer.from(provided)
const b = Buffer.from(expectedToken)
if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
  return new Response('invalid token', { status: 401 })
}
```

Asaas exige token 32-255 chars, sem whitespace, sem números sequenciais. [VERIFIED: https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook]

**NÃO reusar `lib/vision/hmac.ts`** — contratos diferentes. Criar `lib/asaas/webhook-auth.ts` separado.

### Idempotency — chave canônica é `event.id`

[VERIFIED: https://docs.asaas.com/docs/como-implementar-idempotencia-em-webhooks]

> "Os events enviados pelo Asaas Webhooks têm IDs únicos e, mesmo que sejam enviados mais de uma vez, você sempre receberá o mesmo ID."

**Padrão recomendado pelo Asaas (Strategy 2 — pós-processamento):**
1. Receber evento
2. Verificar se `event.id` existe na tabela `asaas_webhook_events` (UNIQUE constraint)
3. Se existe → retornar 200 imediatamente (idempotent skip)
4. Senão → processar evento + INSERT no log + retornar 200

**Schema sugerido (Plan-driven):**
```sql
create table asaas_webhook_events (
  event_id     text primary key,        -- "evt_05b708...&368604920"
  event_type   text not null,           -- "PAYMENT_RECEIVED"
  payment_id   text,                    -- "pay_5749285741" (para grep)
  payload      jsonb not null,
  received_at  timestamptz default now(),
  processed_at timestamptz,
  status       text default 'received'  -- received|processed|failed
);
create index asaas_webhook_events_payment_id_idx on asaas_webhook_events (payment_id);
```

⚠️ **Pitfall #1:** "Out-of-order events" — Asaas garante "at least once", NÃO "in order". Em prática raríssimo, mas pra ser defensivo: ao receber `PAYMENT_REFUNDED` sem antes ter visto `PAYMENT_RECEIVED`, ainda processar (idempotência por estado: "se já existe credit row pra esse payment_id, refunding zera; se não existe, criar como refunded direto e log warn"). Decisão melhor: state machine no `customer_credits.status` ('pending'/'active'/'refunded'/'expired') e cada handler de evento sabe pra que transições legitimar.

### Retry Policy do Asaas

[VERIFIED: https://docs.asaas.com/docs/erros-comuns-copy-3, https://docs.asaas.com/docs/erro-read-timed-out]

- **Timeout receptor:** 10 segundos. Se demorar mais → "Read Time Out" no log.
- **Frequência de sync:** A cada 30 segundos.
- **Threshold de pausa:** 15 falhas consecutivas → fila **interrompida** pelo Asaas (eventos acumulam mas não são entregues até reativar manualmente no painel).
- **Reativação:** Manual via painel Asaas ("Reabilitar fila de webhooks").
- **Avalanche pós-reativação:** Quando reativada, **todos os eventos acumulados são enviados em sequência** — pode bater 100+ eventos em 30s. Idempotência DEVE ser robusta.

**Implicações pro handler:**
1. Responder 200 em < 10s **sempre** — adiar trabalho pesado pra processamento assíncrono se necessário (em prática, INSERT em customer_credits + email enqueue é < 1s, não há razão pra adiar).
2. **NUNCA** retornar 5xx pra "evento já processado" — usar 200 + log de skip.
3. **Errar fail-open**: se DB tá fora, retornar 5xx é OK (vai retry); se evento tá malformado, retornar 200 + log warn é melhor que entrar em loop.

### NF (nota fiscal) automática

[VERIFIED: https://docs.asaas.com/docs/emitindo-notas-fiscais-de-servico, https://docs.asaas.com/docs/webhook-para-notas-fiscais]

Asaas pode emitir NFS-e automaticamente se configurado no painel + CNPJ válido + município habilitado. D-01 confirma "CNPJ founder ativo confirmado".

**Eventos NF:**
- `INVOICE_CREATED` — NF criada (drafted)
- `INVOICE_SYNCHRONIZED` — Enviada à prefeitura
- `INVOICE_AUTHORIZED` — NF autorizada (PDF/XML disponível)
- `INVOICE_UPDATED` — Alterada
- `INVOICE_CANCELED` — Cancelada

**Decisão pro planner:**
- Phase 8 NÃO precisa processar eventos INVOICE_*. Founder configura NF automática no painel; PDF NF fica no Asaas; terapeuta recebe por email do próprio Asaas.
- **OPCIONAL futura V1.1:** Plug NF — adicionar handler de `INVOICE_AUTHORIZED` que salva `asaas_invoice_pdf_url` em `customer_credits` para "Baixar NF" no dashboard. NÃO escopo Phase 8.

⚠️ **Caveat:** Não verificado se NF automática emite ANTES ou DEPOIS de PAYMENT_RECEIVED. Founder deve configurar `effectiveDatePeriod` no painel Asaas. `[ASSUMED]` que default funciona. Confirmar no smoke test sandbox.

---

## Credit Ledger Architecture

### Schema (D-20 expandido com detalhes técnicos)

```sql
-- 0034_phase_8_billing_lgpd.sql (esboço, planner decide order/index final)

-- Catálogo imutável dos 4 SKUs
create table credit_packages (
  id              uuid primary key default gen_random_uuid(),
  sku             text unique not null,          -- 'avulsa' | 'pequeno' | 'medio' | 'grande'
  name            text not null,
  leituras_count  int not null check (leituras_count > 0),
  price_brl       numeric(10,2) not null check (price_brl > 0),
  badge           text,                          -- 'mais_escolhido' | 'melhor_valor' | null
  display_order   int not null default 0,
  active          boolean not null default true,
  created_at      timestamptz default now()
);

-- Compras/saldos por terapeuta
create table customer_credits (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references profiles(id) on delete cascade not null,
  package_id          uuid references credit_packages(id) not null,
  leituras_purchased  int not null check (leituras_purchased > 0),
  leituras_remaining  int not null check (leituras_remaining >= 0),
  leituras_reserved   int not null default 0 check (leituras_reserved >= 0),
  purchase_date       timestamptz default now(),
  expires_at          timestamptz not null,            -- = payment_confirmed + 12 months (D-03)
  status              text not null default 'pending', -- 'pending'|'active'|'expired'|'refunded'
  asaas_payment_id    text unique,                     -- 'pay_5749285741' (preenchido no webhook)
  asaas_invoice_url   text,                            -- 'https://www.asaas.com/i/...' do checkout
  asaas_payment_status text,                           -- snapshot do webhook
  created_at          timestamptz default now(),
  -- Defense-in-depth: leituras_remaining + reserved + consumed = purchased
  check (leituras_remaining + leituras_reserved <= leituras_purchased)
);
create index customer_credits_user_active_idx on customer_credits (user_id, status, expires_at) where status = 'active';

-- Log imutável de operações (event-sourced)
create table credit_transactions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references profiles(id) on delete cascade not null,
  credit_id          uuid references customer_credits(id) on delete cascade,
  reading_id         uuid,                                -- sem FK (vida própria, mirror report_generations.reading_id)
  type               text not null check (type in ('purchase','reserve','consume','release','refund','expire','adjust')),
  amount             int not null,                        -- + ou -
  asaas_payment_id   text,                                -- pra link em refund
  notes              text,
  created_at         timestamptz default now()
);
create index credit_transactions_user_idx on credit_transactions (user_id, created_at desc);
create index credit_transactions_credit_idx on credit_transactions (credit_id);

-- Reservas ativas (snapshot — log de eventos em credit_transactions)
create table credit_reservations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references profiles(id) on delete cascade not null,
  credit_id       uuid references customer_credits(id) on delete cascade not null,
  reading_id      uuid not null,                          -- (sem FK pelo mesmo motivo)
  reserved_at     timestamptz default now(),
  expires_at      timestamptz not null,                   -- = reserved_at + 7 days (D-11)
  status          text not null default 'active',         -- 'active'|'converted'|'released'|'expired'
  released_at     timestamptz,
  created_at      timestamptz default now()
);
create unique index credit_reservations_one_active_per_reading
  on credit_reservations (reading_id) where status = 'active';
create index credit_reservations_expires_idx on credit_reservations (expires_at) where status = 'active';

-- Estado de trial por terapeuta
create table trial_status (
  user_id              uuid primary key references profiles(id) on delete cascade,
  trial_started_at     timestamptz not null default now(),
  trial_expires_at     timestamptz not null,                -- = started + 60 days (D-06)
  trial_readings_used  int not null default 0,
  trial_readings_max   int not null default 3,
  ended_at             timestamptz,                          -- preenchido quando expirou (first-wins)
  ended_reason         text                                  -- 'days_elapsed'|'readings_exhausted'
);

-- Audit log LGPD-04 básico
create table audit_events (
  id          uuid primary key default gen_random_uuid(),
  actor_user_id uuid,                                       -- quem fez a ação (NULL = system)
  actor_email   text,                                       -- snapshot pra resiliência
  event_type    text not null,                              -- ver "Event List" abaixo
  target_type   text,                                       -- 'reading'|'client'|'credit'|'consent'
  target_id     uuid,
  metadata      jsonb,                                      -- ip, user_agent, extras
  created_at    timestamptz default now()
);
create index audit_events_actor_idx on audit_events (actor_user_id, created_at desc);
create index audit_events_target_idx on audit_events (target_type, target_id, created_at desc);

-- Webhook idempotency dedup
create table asaas_webhook_events (
  event_id     text primary key,
  event_type   text not null,
  payment_id   text,
  payload      jsonb not null,
  received_at  timestamptz default now(),
  processed_at timestamptz,
  status       text default 'received'
);

-- Profile additions (alter table)
alter table profiles add column if not exists asaas_customer_id text;
alter table profiles add column if not exists internal_use boolean default false;  -- D-09
alter table profiles add column if not exists cpf text;                            -- D-12
alter table profiles add column if not exists tos_accepted_at timestamptz;         -- D-18
alter table profiles add column if not exists tos_version text;                    -- D-18 (v1, v2…)
create unique index profiles_cpf_unique_idx on profiles (cpf) where cpf is not null;
create unique index profiles_asaas_customer_unique_idx on profiles (asaas_customer_id) where asaas_customer_id is not null;
```

[ASSUMED] schema acima é esboço — planner refina order de migrations + RLS policies.

### FIFO Consumption SQL (CRITICAL PATTERN)

**Padrão validado:** Append-only credit_transactions + denormalized `leituras_remaining` cache em `customer_credits`. SELECT-FOR-UPDATE no consume garante atomicidade.

[CITED: https://colorwhistle.com/saas-credits-system-guide/ — "PostgreSQL serves as the primary choice for credit ledgers due to its ACID compliance and support for row-level locking"]

**FIFO consume (server action atômica):**
```sql
-- Em transação:
begin;

-- 1. Lock pacotes ativos do user em ordem FIFO (purchase_date asc)
with locked_credits as (
  select id, leituras_remaining, leituras_reserved
  from customer_credits
  where user_id = $1
    and status = 'active'
    and expires_at > now()
    and (leituras_remaining - leituras_reserved) > 0
  order by purchase_date asc
  limit 1
  for update                                  -- pessimistic lock; safe under concurrent consume
)
update customer_credits
set leituras_remaining = leituras_remaining - 1,
    leituras_reserved  = leituras_reserved  - 1   -- estava reservado, agora consumido
where id = (select id from locked_credits)
returning id;

-- 2. Log
insert into credit_transactions (user_id, credit_id, reading_id, type, amount)
values ($1, $credit_id, $reading_id, 'consume', -1);

-- 3. Reservation status='converted'
update credit_reservations
set status='converted'
where reading_id = $reading_id and status='active';

commit;
```

**Por que SELECT FOR UPDATE e não advisory lock:**
- `pg_advisory_xact_lock` é mais leve mas requer escolher chave (user_id hash) — risco de colisão.
- `SELECT FOR UPDATE` em row específica é semanticamente preciso ("estou alterando ESTA linha"), bloqueio termina em commit, e tem comportamento explícito sob `serializable` transaction se virmos a precisar.
- Para Phase 8 (~10 terapeutas concorrendo, 1-3 leituras/dia/cada), pessimistic lock é zero overhead.

⚠️ **Pitfall — race condition no reserve:**
Cenário: terapeuta tem 1 leitura no trial + 0 créditos. Clica "criar link" + "iniciar captura" simultaneamente em 2 abas. Ambas leem `leituras_remaining=1`, ambas decrementam, viram `-1`. **Mitigação:** `CHECK (leituras_remaining >= 0)` na tabela (defense-in-depth) + `SELECT FOR UPDATE` na server action que reserva.

⚠️ **Pitfall — trial vs credit:** Trial não tem row em `customer_credits` (modelo D-20 separa em `trial_status`). Reserva durante trial decrementa `trial_status.trial_readings_used` + INSERT em `credit_reservations` com `credit_id = NULL`. Schema acima precisa `credit_reservations.credit_id` nullable. Planner ajusta.

### Reservation lifecycle

**Estados:**
- `active` — reserva criada, aguardando geração de relatório dentro de 7d
- `converted` — relatório gerado, virou consumo definitivo (lifecycle terminal)
- `released` — terapeuta cancelou manualmente (saldo volta)
- `expired` — 7 dias passaram, cron diário libera (saldo volta)

**Transições válidas:**
```
active → converted (analyze route grava relatório)
active → released  (terapeuta clica "cancelar processo" no dashboard)
active → expired   (cron daily: WHERE expires_at < now() AND status='active')
```

**Cron daily — release expired:**
```sql
-- Roda 1x/dia 02:00 BRT
with expired as (
  update credit_reservations
  set status='expired'
  where status='active' and expires_at < now()
  returning id, credit_id, user_id, reading_id
)
update customer_credits cc
set leituras_reserved = leituras_reserved - 1
from expired e
where cc.id = e.credit_id;

-- Log
insert into credit_transactions (user_id, credit_id, reading_id, type, amount, notes)
select user_id, credit_id, reading_id, 'release', 1, 'expired_after_7d' from expired;
```

---

## LGPD-01 Termo Biométrico (nativo)

### Reuso de infra Fase 4 + decisões D-17/D-18/D-19

A boa notícia: **infra já existe** em `supabase/migrations/0020_consent_infra.sql`:
- `consent_terms` (versionado, immutable, `content_sha256` integridade)
- `client_consents` (event-log append-only, NUNCA UPDATE/DELETE pra terapeuta — IP + user_agent + consented_at + event_type)
- RLS já configurado
- `term-v1.md` em `apps/web/lib/consent/term-v1.md` AI-drafted, AINDA não seedado em `consent_terms`

**Phase 8 adiciona:**
1. **Seed do termo v1** em `consent_terms` (não-feito ainda; founder via script de seed)
2. **Geração de PDF do termo** via Gotenberg (placeholder substituído: `{{TERAPEUTA_RESPONSAVEL}}` etc.)
3. **Tela `/convite/[token]/termo`** ou step inline no `/convite/[token]/capturar` antes do upload, com checkbox + nome + CPF do cliente + assinatura click-through
4. **Storage do PDF preenchido** em bucket privado por terapeuta (signed URL TTL longo, p.ex. 1 ano)
5. **Gate em rotas de captura** — bloqueio `created_at` se `client_consents.event_type='initial'` não existe pro `client_id`

### Geração de PDF — reuse Gotenberg

Pattern idêntico ao `/api/readings/[id]/pdf` (linhas 137-280):

```typescript
const props = {
  termoMarkdown: hydrateTerm(termV1Md, { TERAPEUTA_RESPONSAVEL, MODALIDADE_ATIVA, ... }),
  clienteNome: clientName,
  clienteCPF: clientCpf,
  consentTimestamp: now,
  consentIp: ip,
  consentUserAgent: ua,
  contentSha256: hash,
}
const termoHtml = renderTermoHtml(props)
const form = new FormData()
form.append('files', new Blob([termoHtml]), 'index.html')
form.append('paperWidth', '8.27'); form.append('paperHeight', '11.69')
const res = await fetch(`${GOTENBERG_URL}/forms/chromium/convert/html`, { method:'POST', body: form, headers: { Authorization: `Basic ${...}` } })
const pdfBuffer = await res.arrayBuffer()
// Upload pra Supabase Storage
await supabase.storage.from('client-consents').upload(`${therapistId}/${clientId}/${consentId}.pdf`, pdfBuffer)
```

### Assinatura digital click-through — captura

**Dados gravados no `client_consents`:**
```typescript
{
  client_id: clientId,
  reading_id: readingId,
  term_version: 'v1',
  event_type: 'initial',
  consent_channel: 'remote_link' | 'office_handoff' | 'office_qr' | 'therapist_created',
  ip: request.ip,
  user_agent: request.headers.get('user-agent'),
  consented_at: now,
}
```

Plus em `clients` (já existe):
- `consent_signed_at: now()`
- `consent_document_url: signed_url(...)` (referência pro PDF gerado)

### Versionamento (D-17 — content_sha256)

`consent_terms` já tem `content_sha256`. Pattern:
1. Founder edita `apps/web/lib/consent/term-v1.md`
2. Script de seed calcula SHA256 do arquivo
3. INSERT em `consent_terms` com `version='v1'`, `content_sha256=...`, `is_current=true` (flip transacional)
4. A migration `0020_consent_infra` GARANTE máximo 1 vigente (índice parcial)
5. Mudança de termo = nova row `version='v2'` + flip de `is_current` + força reconfirmação clientes via `event_type='reconfirm_version'`

### Valor probatório — caveats LGPD

[CITED: https://supersign.com.br/blog/validade-juridica-assinatura-digital/, https://x-apps.com.br/assinatura-eletronica-vs-assinatura-digital-icp-brasil/, https://cryptoid.com.br/...]

**A escolha de D-17 é LEGÍTIMA mas tem trade-off explícito:**

| Tipo | Valor probatório | Stack atual? |
|------|------------------|--------------|
| **Assinatura ICP-Brasil** | Presunção legal de autenticidade (MP 2.200-2/2001) — peso máximo em juízo | ❌ — exige certificado A1/A3 |
| **Assinatura eletrônica avançada (SHA256 + audit trail)** | Aceita se não contestada vigorosamente; juiz pode acolher como prova | ✅ — D-17 implementa |
| **Click-through simples (só timestamp)** | Aceita com risco moderado de contestação | ❌ — não é o que estamos fazendo |

**Mitigações já contempladas em D-17:**
- ✅ Hash SHA256 do conteúdo exato exibido (já existe em `consent_terms.content_sha256`)
- ✅ Storage imutável (Supabase Storage + bucket privado)
- ✅ Audit trail (IP + user_agent + timestamp em `client_consents`)
- ✅ Versionamento explícito (term_version)

**Recomendação adicional pro planner (D-17 reforço):**
- PDF final inclui no rodapé: "Aceite registrado em DD/MM/AAAA HH:MM BRT a partir do IP X.X.X.X — hash SHA256 do documento: ...". Imprime a "audit trail" DENTRO do PDF.
- Founder revisitar trigger: 1º questionamento ANPD/PJ (já no memory `project_consent_term_legal_review_debt`).

⚠️ **Pitfall — biometria de menores:** Termo cliente é assinado por terapeuta antes do cliente preencher? Ou pelo cliente final? D-19 fala "cliente do terapeuta" — assumir que **é o titular biométrico** (cliente final) quem assina, não o terapeuta. Se cliente <18, BLOQUEAR (alinhado com `MIN_AGE=18` da Fase 11 11-02 já LIVE). Termo já contém isso em §1 ("Este serviço está disponível apenas para pessoas com 18 anos completos ou mais"). Reusar `profile-completeness.ts` MIN_AGE em validation da signup do cliente.

---

## Trial + Anti-Fraud

### Trial gating (D-06, D-07, D-08, D-09)

**Estado em `trial_status` (D-20):**
- `trial_started_at` — `now()` ao signup
- `trial_expires_at` — `now() + interval '60 days'`
- `trial_readings_used` — incrementa quando cria reservation (não quando consome) pra evitar exploit de "criar reading + cancelar 1000x"
- `trial_readings_max` — 3 (default; founder pode bumpar caso-a-caso via SQL)
- `ended_at` + `ended_reason` — populated quando first-wins dispara

**Function helper `is_in_trial(user_id) returns boolean`:**
```sql
create or replace function public.is_in_trial(p_user_id uuid)
returns boolean
language sql stable
as $$
  select coalesce(
    (
      select t.ended_at is null
        and t.trial_expires_at > now()
        and t.trial_readings_used < t.trial_readings_max
      from trial_status t
      where t.user_id = p_user_id
    ),
    false
  )
$$;
```

**Gating em rotas (D-10):**
1. `createReadingAction` (já existe `lib/beta/config.ts` com BETA_READING_CAP=3 — substituir pelo trial+credit check)
2. `triggerInviteLinkAction` (cria token convite) — NOVO gate de saldo
3. `startCaptureSessionAction` (consultório) — NOVO gate de saldo
4. `analyze route` (já existe) — converte reservation em consume

**Lógica unificada (`reserveCreditForReading(user_id, reading_id)`):**
```typescript
// 1. Se internal_use → return { ok: true, source: 'internal' }
// 2. Se is_in_trial → INSERT credit_reservations (credit_id=NULL) + UPDATE trial_status set trial_readings_used = trial_readings_used + 1
// 3. Else → SELECT FOR UPDATE oldest active credit with available, decrement leituras_remaining, increment leituras_reserved, INSERT reservation
// 4. Else (no credits, no trial) → return { ok: false, code: 'no_balance' }
```

### Anti-fraud CPF + telefone (D-12)

**Algoritmo CPF módulo-11 (inline, ~50 linhas TypeScript):**

[CITED: https://gist.github.com/joaohcrangel/8bd48bcc40b9db63bef7201143303937, https://www.devmedia.com.br/validar-cpf-com-javascript/23916]

```typescript
export function isValidCpf(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '')
  if (clean.length !== 11) return false
  if (/^(\d)\1{10}$/.test(clean)) return false   // 11111111111, 22222222222, etc.

  // Primeiro dígito verificador
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(clean[i]) * (10 - i)
  let mod = (sum * 10) % 11
  if (mod === 10) mod = 0
  if (mod !== parseInt(clean[9])) return false

  // Segundo dígito verificador
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(clean[i]) * (11 - i)
  mod = (sum * 10) % 11
  if (mod === 10) mod = 0
  if (mod !== parseInt(clean[10])) return false

  return true
}
```

**Telefone BR (já existe em `lib/profile/fields.ts`):** `formatPhoneBR` + `phoneIsValidBR` — reusar.

**Dedup constraint:**
- `profiles.cpf` (já SUGERI alter table acima) UNIQUE WHERE cpf IS NOT NULL
- `profiles.phone` JÁ existe; verificar se há UNIQUE — provavelmente não, adicionar via migration

**Race condition (2 signups simultâneos com mesmo CPF):**
- UNIQUE constraint resolve atomicamente — segundo INSERT recebe `23505 unique violation`
- App handle: "Já existe cadastro com esse CPF/telefone, faça login" (D-12)
- Pattern já estabelecido em Fase 11.1: `createClientAction` trata 23505. Reusar abordagem.

### "First-wins" trial expiration

**Não usar trigger** — usar check em runtime + cron de cleanup:

```typescript
// runtime — reserveCreditForReading
if (trial.trial_readings_used >= trial.trial_readings_max) {
  // first-wins: marcar trial como ended
  await sb.from('trial_status').update({ ended_at: now, ended_reason: 'readings_exhausted' }).eq('user_id', uid)
  // ... cair pro próximo gate (cobrar créditos)
}
```

**Cron daily (mesmo cron):**
```sql
update trial_status
set ended_at = now(), ended_reason = 'days_elapsed'
where ended_at is null and trial_expires_at < now();
```

---

## LGPD-03 + LGPD-04 Básico

### LGPD-03 básico — link "pedir deleção" via email (D-15, D-16)

**NÃO escopo Phase 8 self-service (D-16 deferred 8.1+).**

**Phase 8 entrega:**
- Página pública `/privacidade` com seção "Como solicitar exclusão dos seus dados"
- Botão "Solicitar exclusão" → `mailto:` pré-preenchido pra `{{OPERADOR_EMAIL}}` com subject "[Iris Codex] Pedido de exclusão LGPD - {{nome}}" + body padrão
- SLA documentado: "Responderemos em até 15 dias úteis" (LGPD art. 19 §3º permite 15 dias)
- Founder responde manualmente, executa SQL de delete + log no `audit_events`

**Sugestão template email pré-formatado:**
```
Olá,

Solicito a exclusão dos meus dados pessoais armazenados no Iris Codex,
incluindo:
- Meu cadastro (terapeuta)
- Todos os relatórios gerados
- Imagens de íris

Nome completo: ___________________
E-mail cadastrado: ________________
CPF (para confirmação): ___________

Aguardo confirmação por email em até 15 dias úteis.
```

⚠️ **Decisão pendente — terapeuta vs cliente final:**
- Terapeuta self-service exclusão? → fora escopo Phase 8 (V1 B2B, terapeuta entra em contato).
- Cliente final (titular biométrico) exclusão? → Termo v1 §8 diz "junto ao controlador (terapeuta)" — fluxo via terapeuta, ou via operador se Modalidade B / sem contato. **Implementar botão "Solicitar exclusão" no relatório enviado ao cliente** (futuro, V1.1+) — Phase 8 só documenta link na `/privacidade`.

### LGPD-04 básico — log eventos críticos (D-15, D-16)

**Schema `audit_events` (proposto acima).**

**Eventos pra logar (PLANNER decide lista final — Claude's Discretion D-15):**

Sugestão de baseline empírica:

| Event Type | Trigger | Metadata mínima |
|------------|---------|-----------------|
| `auth.login` | Supabase auth callback OK | `ip`, `user_agent` |
| `auth.signup` | profile criado | `ip`, `tos_version`, `cpf_validated` |
| `consent.term_signed` | client_consents INSERT | `client_id`, `term_version`, `consent_channel` |
| `reading.created` | createReadingAction | `reading_id`, `client_id` |
| `reading.images_uploaded` | finalize captura | `reading_id`, `image_count` |
| `reading.analyzed` | analyze route ok | `reading_id`, `model`, `regen_count` |
| `reading.delivered` | markReadingDeliveredAction | `reading_id` |
| `credit.purchase_initiated` | server action createCharge | `package_id`, `asaas_payment_id` |
| `credit.purchase_confirmed` | webhook PAYMENT_RECEIVED | `payment_id`, `leituras_purchased` |
| `credit.consumed` | reserveCreditForReading | `credit_id`, `reading_id` |
| `credit.refunded` | refundAction | `credit_id`, `refund_value`, `refund_proportion` |
| `credit.expired` | cron daily | `credit_id`, `leituras_remaining_lost` |
| `lgpd.deletion_requested` | mailto: click trackable? | `email_link_clicked_at` (se trackable) |

**LGPD-04 dashboard básico (D-15, D-16):**
- Phase 8 NÃO escopo dashboard. Sugestão: founder consulta via SQL direto + (opcional) página `/admin/audit-log` read-only com filtros básicos por `event_type` + `actor_user_id` + range de datas. Fica em discreção do planner.

---

## Cron Daily Jobs

### Recomendação: Vercel Cron com 1 endpoint compostor

[CITED: https://vercel.com/docs/cron-jobs/usage-and-pricing — Pro = até 40 jobs]

**Por quê NÃO pg_cron:**
- pg_cron exige fazer HTTP request a partir do Postgres (`http` extension) pra enfileirar emails — adiciona complexidade
- Logs de pg_cron ficam em `cron.job_run_details` separado da observabilidade Vercel
- O time já está acostumado a debugar logs Vercel

**Por quê Vercel Cron:**
- Já estamos em Pro (~ 40 jobs); 1 endpoint ≪ limite
- CRON_SECRET pattern documentado: header `Authorization: Bearer ${CRON_SECRET}` injetado automaticamente
- Logs em Vercel UI com a mesma function calls
- Easy local dev (chamar manualmente o endpoint)

[CITED: https://vercel.com/docs/cron-jobs/manage-cron-jobs, https://vercel.com/docs/cron-jobs]

**1 endpoint compositor — `/api/cron/daily/route.ts`:**

```typescript
// vercel.json — adicionar
{
  "crons": [{ "path": "/api/cron/daily", "schedule": "0 5 * * *" }]  // 05:00 UTC = 02:00 BRT
}
```

```typescript
// /api/cron/daily/route.ts
export async function GET(request: NextRequest) {
  // Vercel injeta Authorization: Bearer ${CRON_SECRET}
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  await releaseExpiredReservations()       // libera reservas > 7d
  await expireOldCredits()                  // marca créditos > 12m como expired
  await expireOldTrials()                   // marca trials > 60d como ended
  await sendExpirationWarnings()            // emails 30d/7d/day-of
  return NextResponse.json({ ok: true })
}
```

**maxDuration:** Pro plan permite até 800s (já bumpamos no analyze route). Cron daily deve completar em < 60s.

⚠️ **Pitfall — Vercel Cron NÃO é "executa exatamente naquele horário":**
- Pode atrasar até alguns minutos sob load. Lógica deve ser idempotente (re-rodar é seguro).
- Hobby plan = 1× dia max; Pro = qualquer frequência. Estamos em Pro.

⚠️ **Pitfall — Cron pode falhar silenciosamente:**
- Vercel mostra exec log mas não envia alerta automático. Adicionar `log_cron_runs` table com `started_at`, `completed_at`, `error`, ou simplesmente confiar em audit_events.

---

## Migrations + Types

### Ordem de migração sugerida

```
0034_phase_8_billing_lgpd.sql
  ├── credit_packages (catálogo)
  ├── alter profiles add asaas_customer_id, cpf, internal_use, tos_accepted_at, tos_version
  ├── customer_credits
  ├── credit_transactions
  ├── credit_reservations
  ├── trial_status
  ├── audit_events
  └── asaas_webhook_events

0035_phase_8_rls_policies.sql
  └── RLS policies pra cada tabela acima (terapeuta sees own data)

0036_phase_8_helper_functions.sql
  └── is_in_trial(uuid), fifo_consume_credit(uuid, uuid), etc.

0037_phase_8_seed_packages.sql
  └── INSERT INTO credit_packages (4 SKUs)
```

Planner pode consolidar em menos arquivos; a divisão acima espelha o pattern Fase 1 (schema vs grants vs functions).

### RLS pattern

**Padrão estabelecido — terapeuta vê próprios dados:**
```sql
alter table customer_credits enable row level security;

create policy "customer_credits_self_read"
  on customer_credits for select to authenticated
  using (user_id = auth.uid());

create policy "customer_credits_self_insert"
  on customer_credits for insert to authenticated
  with check (user_id = auth.uid());

-- founder bypass — padrão 0011/0017/0020
create policy "founder_full_access"
  on customer_credits for all to authenticated
  using ((auth.jwt() ->> 'email') = 'rhelton@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'rhelton@gmail.com');
```

**Para `audit_events` e `asaas_webhook_events`:**
- `audit_events` → INSERT via server-role (cron + server actions); SELECT só founder (terapeuta nãso vê próprios eventos no MVP). Política: NO authenticated policies = bloqueio total + founder policy.
- `asaas_webhook_events` → 100% service-role. Bloqueio total + founder bypass.

### `pnpm gen:types` regen

Pattern Fase 1+: toda migration `supabase db push --linked` + `pnpm gen:types` + commit `types/database.ts`.

---

## UI Surfaces (for downstream UI-SPEC if any)

Listagem para o planner (sem produzir UI-SPEC):

| Página | Rota | Notas |
|--------|------|-------|
| Comprar créditos | `/assinatura/comprar` (D-21) | 4 cards SKUs + badges "Mais escolhido" / "Melhor valor" |
| Status assinatura | `/assinatura` (existente, refatorar) | Mostra saldo, lista pacotes ativos, "Processos em andamento" widget |
| Processos em andamento widget | Componente em `/dashboard` + `/assinatura` | Lista reservas active com prazo expiração + botão cancelar |
| Termo biométrico | Inline em `/convite/[token]/capturar` step 0 OR `/convite/[token]/termo` separado | Checkbox + nome + CPF cliente + IP captured |
| Signup form | `/signup` (existente, expandir) | + CPF + telefone (já tem) + dedup feedback |
| LGPD-03 link deletion | `/privacidade#deletar-dados` | Mailto: pre-formatado |
| Cobrança histórico | `/assinatura/historico` | Lista compras + status + link NF (futuro) |
| Audit log (admin) | `/admin/audit-log` (founder-only) | Filtros básicos por event_type/actor/range |

**Sonner toasts (pattern já estabelecido):**
- "Cobrança criada — redirecionando…" (createCharge action OK, antes do window.location)
- "Compra confirmada — N créditos adicionados" (post-webhook page load)
- "Saldo insuficiente — comprar pacote" (gate violation)
- "Termo do cliente não assinado" (gate violation)
- "Reserva cancelada — saldo liberado"
- "Reembolso solicitado — R$X estornado em até 5 dias úteis"

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (já em uso) |
| Config file | `apps/web/vitest.config.ts` (existente) |
| Quick run command | `pnpm test:run apps/web/lib/billing apps/web/app/api/asaas/webhook` |
| Full suite command | `pnpm test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| BILLING-01 | Webhook PAYMENT_RECEIVED → customer_credits row | integration | `pnpm test:run app/api/asaas/webhook/__tests__/route.test.ts` | ❌ Wave 0 |
| BILLING-01 | Webhook HMAC token mismatch → 401 | unit | `pnpm test:run lib/asaas/webhook-auth.test.ts` | ❌ Wave 0 |
| BILLING-01 | Webhook event.id duplicate → 200 no-op (idempotent) | integration | (same file) | ❌ Wave 0 |
| BILLING-01 | createChargeAction → POST Asaas + INSERT customer_credits pending | integration | `pnpm test:run lib/billing/actions/__tests__/create-charge.test.ts` | ❌ Wave 0 |
| BILLING-01 | refundAction parcial proporcional → POST Asaas + UPDATE credit | integration | `pnpm test:run lib/billing/actions/__tests__/refund.test.ts` | ❌ Wave 0 |
| BILLING-02 | Trial start at signup (60d, 3 leituras) | unit | `pnpm test:run lib/billing/__tests__/trial.test.ts` | ❌ Wave 0 |
| BILLING-02 | Trial first-wins: 3 leituras consumidas → ended | unit | (same file) | ❌ Wave 0 |
| BILLING-02 | Trial first-wins: 60d passados → ended | unit | (same file) | ❌ Wave 0 |
| BILLING-03 | reserveCreditForReading FIFO consume | integration (SQL) | `pnpm test:run lib/billing/__tests__/reserve.test.ts` | ❌ Wave 0 |
| BILLING-03 | Reservation 7d expiry: cron releases | integration | `pnpm test:run app/api/cron/daily/__tests__/route.test.ts` | ❌ Wave 0 |
| BILLING-03 | Concurrent reserve race → only 1 succeeds | integration (SQL) | `pnpm test:run lib/billing/__tests__/race.test.ts` | ❌ Wave 0 |
| BILLING-03 | Anti-fraud CPF dup → 23505 → friendly msg | unit | `pnpm test:run lib/auth/__tests__/cpf-dedup.test.ts` | ❌ Wave 0 |
| BILLING-03 | isValidCpf rejects 111.111.111-11 + invalid checksums | unit | `pnpm test:run lib/auth/__tests__/cpf.test.ts` | ❌ Wave 0 |
| LGPD-01 | hydrateTerm substitui placeholders + content_sha256 stable | unit | `pnpm test:run lib/consent/__tests__/hydrate.test.ts` | ❌ Wave 0 |
| LGPD-01 | signTermAction INSERT client_consents + UPDATE clients.consent_signed_at | integration | `pnpm test:run lib/consent/__tests__/sign.test.ts` | ❌ Wave 0 |
| LGPD-01 | Termo PDF gerado via Gotenberg + uploaded to storage | smoke manual | (founder Gotenberg sandbox) | — manual |
| LGPD-02 | `/privacidade` + `/termos` pages renderizam pt-BR + copy obrigatória | unit | `pnpm test:run app/(public)/__tests__/legal.test.ts` | ❌ Wave 0 |
| LGPD-03 | mailto: link pre-formatado em /privacidade | unit | (same) | ❌ Wave 0 |
| LGPD-04 | audit_events INSERT em login/signup/reading.created/credit.purchased | integration | `pnpm test:run lib/audit/__tests__/log.test.ts` | ❌ Wave 0 |
| LGPD-05 | Audit-vocabulary CI gate continua green (forbidden_terms.json novos termos não emergem) | CI | `node scripts/audit-vocabulary.mjs` | ✅ already passes |
| LGPD-06 | Audit-vocabulary scan diagnóstico/tratamento/cura ausentes em copy nova | CI | (same) | ✅ already passes |

### Smoke tests (manual, founder)

| Cenário | Quando | Comando |
|---------|--------|---------|
| Asaas sandbox criar customer + payment + webhook | Após Plan 02 (lib/asaas/client) | `curl POST sandbox.asaas.com` + ngrok/Vercel preview |
| Asaas sandbox refund parcial | Após Plan refund | Painel Asaas sandbox |
| Termo biométrico PDF render fim-a-fim | Após Plan termo | `curl /api/consent/generate-pdf` → abre PDF, valida hash |
| E2E flow trial → exhaust → buy → reserve → generate → consume | Após todas as 5 ondas | Founder simula em sandbox + clone reading |

### Sampling Rate
- **Per task commit:** `pnpm test:run lib/billing lib/asaas lib/consent lib/audit app/api/asaas app/api/cron`
- **Per wave merge:** `pnpm test:run` (full suite)
- **Phase gate:** Full suite green + smoke manual founder validado

### Wave 0 Gaps

(Lista de stubs a criar antes de implementação)

- [ ] `apps/web/lib/asaas/__tests__/client.test.ts` — Asaas REST client (POST customer, payment, refund)
- [ ] `apps/web/lib/asaas/__tests__/webhook-auth.test.ts` — token timing-safe compare
- [ ] `apps/web/app/api/asaas/webhook/__tests__/route.test.ts` — handler integration (HMAC + idempotency + state machine)
- [ ] `apps/web/lib/billing/__tests__/trial.test.ts` — trial state machine
- [ ] `apps/web/lib/billing/__tests__/reserve.test.ts` — FIFO consume + reservation lifecycle
- [ ] `apps/web/lib/billing/__tests__/race.test.ts` — concurrent reserve race
- [ ] `apps/web/lib/billing/actions/__tests__/create-charge.test.ts`
- [ ] `apps/web/lib/billing/actions/__tests__/refund.test.ts`
- [ ] `apps/web/lib/auth/__tests__/cpf.test.ts` — CPF módulo-11
- [ ] `apps/web/lib/auth/__tests__/cpf-dedup.test.ts` — 23505 handling
- [ ] `apps/web/lib/consent/__tests__/hydrate.test.ts` — placeholder substitution
- [ ] `apps/web/lib/consent/__tests__/sign.test.ts` — server action signTerm
- [ ] `apps/web/lib/audit/__tests__/log.test.ts` — emitter
- [ ] `apps/web/app/api/cron/daily/__tests__/route.test.ts` — CRON_SECRET auth + idempotência
- [ ] `apps/web/app/(public)/__tests__/legal.test.ts` — copy obrigatória LGPD-05

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Supabase Auth (existing) + CPF validation backend (D-12) |
| V3 Session Management | yes | Supabase session cookies (existing); cron tem CRON_SECRET header |
| V4 Access Control | yes | RLS policies em todas as novas tabelas + service-role pra webhook/cron |
| V5 Input Validation | yes | Zod schemas pra todos os bodies (webhook, server actions); CPF regex + checksum |
| V6 Cryptography | yes | SHA256 pra term hash (já existente); HMAC-equivalent via timing-safe token compare; **NÃO hand-roll crypto** |
| V8 Data Protection | yes | LGPD-01..06 cobertos; biometric data = sensible category (LGPD art. 11) |
| V13 API & Web Service | yes | Webhook Asaas validated via shared secret; rate limits respeitadas |
| V14 Configuration | yes | Env vars Vercel; secrets nunca em git |

### Known Threat Patterns for Iris Codex stack (Phase 8 additions)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Webhook spoofing (atacante envia PAYMENT_RECEIVED falso) | Spoofing | `asaas-access-token` shared secret + timing-safe compare; reject 401 |
| Double-spend (2 reserves simultâneas) | Tampering | `SELECT ... FOR UPDATE` + `CHECK (remaining + reserved <= purchased)` |
| Replay attack webhook | Tampering | `asaas_webhook_events.event_id PRIMARY KEY` (UNIQUE) — INSERT dup falha |
| CPF brute-force (cadastrar com CPFs aleatórios) | Spoofing | Algoritmo módulo-11 rejeita 99.9% de invalid; futura V1.1 API RFB |
| LGPD-01 termo manipulation pós-assinatura | Tampering | `content_sha256` no `consent_terms` + immutable storage (já implementado) |
| Refund fraud (terapeuta solicita refund após consumir) | Repudiation | Cálculo proporcional D-13 + arrependimento ≤ 7d guard + audit_events |
| Cron endpoint exposed (atacante chama /api/cron/daily) | Elevation | `Authorization: Bearer ${CRON_SECRET}` header obrigatório |
| Webhook race (eventos out-of-order) | Tampering | State machine em `customer_credits.status` aceita transições idempotentes |
| Cliente <18 assinando termo (biométrico minor) | Spoofing | MIN_AGE=18 já bloqueia (Fase 11 11-02 LIVE); reusar gate |
| Trial farming (1 pessoa cria múltiplas contas via emails diferentes) | Spoofing | UNIQUE(cpf) + UNIQUE(phone) em profiles — D-12 |
| PDF termo com PII em metadata | Information Disclosure | Aceito (terapeuta owns data); ainda assim, Gotenberg config sem extra metadata |
| Payment_id leak via query string | Information Disclosure | Sempre POST + body, nunca GET com payment_id em URL |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Crypto signatures | Custom HMAC | `node:crypto.timingSafeEqual` | Timing attacks; código já existe (lib/vision/hmac.ts) |
| PDF generation | @react-pdf, Puppeteer local, jsPDF | Gotenberg (já LIVE) | Times-Roman + Standard-14 AFM crashes (memory `feedback_pdf_times_roman_winansi`); Gotenberg pattern já estabelecido |
| Postgres concurrency | Mutex em JS | `SELECT FOR UPDATE` + CHECK constraint | DB é a única autoridade; lock JS não atravessa instâncias Vercel |
| Cron scheduling | setInterval no server | Vercel Cron + CRON_SECRET | Vercel functions são stateless; setInterval morre no warm-cold |
| Asaas SDK | npm `asaas` comunitário | `fetch()` direto | SDK comunitário não-mantido; superfície menor |
| Brazilian phone formatting | Inline novo | `lib/profile/fields.ts` (já existe) | Reuso |
| Email transactional | Nodemailer/SES | Resend (já LIVE) | Domínio iriscodex.com já verified (memory `project_resend_domain_unverified_launch_gate` RESOLVED) |
| LGPD consent infrastructure | Tabelas novas | `consent_terms` + `client_consents` (0020 LIVE) | Já implementado — só adicionar seed + UI |
| Audit vocabulary CI gate | Novo script | `scripts/audit-vocabulary.mjs` (já LIVE) | Forbidden terms JSON já tem 3 categorias; só adicionar termos se necessário |
| Webhook idempotency dedup | Custom locking | UNIQUE constraint em event_id | Postgres gives this for free |

**Key insight:** A maioria do peso desta fase é **schema + integração externa + flow control**, não invenção. Infra de consent + audit vocab + PDF + email + HMAC já existem — Phase 8 só adiciona Asaas e o conceito de "saldo".

---

## Runtime State Inventory

> Phase 8 é greenfield (cria 7 tabelas novas + 5 colunas em profiles). NÃO é rename/refactor. Esta seção poderia ser omitida; preenchida defensivamente.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `profiles.subscription_status` + `profiles.trial_ends_at` (Fase 1) — semântica MUDA (não rename) | Não dropar colunas; deprecate-by-disuse (deixar populated mas não read em V1; remove em V1.1+ migration) |
| Live service config | Asaas painel: webhook URL + access_token + NF automática config | Founder configura no painel Asaas após Plan webhook estar deployed em sandbox + prod |
| OS-registered state | Vercel Cron schedule em vercel.json | Add `crons` array — Vercel re-cria schedule no próximo deploy |
| Secrets/env vars | NOVOS: `ASAAS_API_KEY` (sandbox + prod), `ASAAS_WEBHOOK_TOKEN`, `CRON_SECRET` | Founder cria via Vercel UI; valores únicos por env |
| Build artifacts | Nenhum identificado — pure Next.js code | None |

**Nothing found in category — não aplica (greenfield).**

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Asaas account | BILLING-01..03 | [ASSUMED] yes (founder CNPJ ativo) | — | None — blocking |
| Asaas sandbox API key | smoke tests | [ASSUMED] no | — | Founder cria conta sandbox 5min |
| Vercel Pro plan | cron + maxDuration | ✓ | confirmed (memory) | — |
| Resend domain verified | email confirmação | ✓ | iriscodex.com verified | — |
| Gotenberg on Render | PDF termo | ✓ | LIVE (PDF leituras) | Reusar URL existente |
| Supabase Pro | DB connections + RLS | ✓ | confirmed | — |
| `node:crypto` | HMAC + timing-safe | ✓ | Node 20+ on Vercel | — |
| CRON_SECRET env var | Vercel Cron auth | ✗ (novo) | — | Founder gera 32-char random |

**Missing dependencies with no fallback:**
- Conta Asaas (sandbox + production). Founder DEVE criar antes do Plan 02 (Asaas client lib) executar.

**Missing dependencies with fallback:**
- CRON_SECRET — trivial, founder gera durante Plan cron.

---

## Common Pitfalls

### Pitfall 1: Cartão de Crédito 30-day delay entre CONFIRMED e RECEIVED
**What goes wrong:** Cliente paga no cartão, vê "Compra confirmada" no Asaas, espera créditos no Iris Codex — não recebe.
**Why it happens:** Asaas só faz settlement de cartão em D+30. PAYMENT_RECEIVED só dispara após settlement.
**How to avoid:** Listener trata `PAYMENT_CONFIRMED` como evento de "creditar" (assumindo founder concorda — D-01 sugere isto). Trade-off: chargeback estorna pelos eventos PAYMENT_REFUNDED.
**Warning signs:** Smoke test sandbox usar cartão de teste e esperar 1m+ — PAYMENT_RECEIVED não vem em sandbox (só em prod real após 30d). Founder confirma decisão antes de prod.

### Pitfall 2: Webhook queue paused por 15 falhas → avalanche pós-reativação
**What goes wrong:** DB down 5 min, 15 webhooks falham, fila paused, eventos acumulam, founder reativa, 200+ eventos chegam em 30s.
**Why it happens:** Asaas docs explicitam threshold de 15 + reativação manual + entrega em sequência.
**How to avoid:** Idempotência via `event_id` UNIQUE é OBRIGATÓRIA. Garantir handler completa em < 10s sempre (sem await pesado em I/O bloqueante). Email pode adiar pra fila (Resend é async já).
**Warning signs:** Painel Asaas mostra "fila pausada"; logs Vercel mostram timeouts.

### Pitfall 3: SELECT FOR UPDATE em row inexistente NÃO faz nada — race ainda possível
**What goes wrong:** Reservar primeiro pacote ativo → SELECT FOR UPDATE locks. Mas se 2 reserves disputam o "primeiro" e ainda não há row (trial), ambos passam o gate.
**Why it happens:** FOR UPDATE só lock rows existentes; SELECT-not-found NÃO bloqueia.
**How to avoid:** Trial usa `trial_status.trial_readings_used` com `CHECK (... <= max)` + serializable transaction ou advisory lock no user_id.
**Warning signs:** Race test (Wave 0) deve simular 5 reserves concorrentes ao mesmo time → exatamente N passam, resto rejeitado.

### Pitfall 4: PDF do termo é "estado fixo" mas template é "ao vivo"
**What goes wrong:** Founder edita `term-v1.md` em dia X, novo cliente assina, PDF gerado tem texto NOVO mas `client_consents.term_version='v1'`. Versionamento broken.
**Why it happens:** Hot-reload sem flip de `is_current`.
**How to avoid:** PDF render DEVE ler corpo de `consent_terms.body` (não do arquivo .md), e o seed só insere nova row com novo version (v2). Migration documenta isso.
**Warning signs:** SHA256 hash do PDF não bate com `consent_terms.content_sha256` em audit.

### Pitfall 5: `externalReference` não é uma chave única do Asaas
**What goes wrong:** Dois `customer_credits` rows com mesmo externalReference (bug do app) → Asaas aceita ambos → webhook não sabe qual creditar.
**Why it happens:** Asaas trata externalReference como label, não constraint.
**How to avoid:** App-level UNIQUE em `customer_credits.asaas_payment_id` (preenchido no webhook); checar `externalReference` casa com expected antes de update.
**Warning signs:** 2 rows com mesmo `external_reference` em customer_credits.

### Pitfall 6: Refund de cartão tem janela de tempo limitada
**What goes wrong:** Founder pede refund de cartão 9 meses depois — Asaas rejeita.
**Why it happens:** Bandeiras de cartão (Visa/Master/Elo) impõem janela de chargeback (~120 dias).
**How to avoid:** D-13 fixa arrependimento ≤ 7d; após 7d "caso-a-caso suporte" — Phase 8 NÃO precisa cobrir janelas longas. PIX permite full refund a qualquer tempo (até saldo Asaas).
**Warning signs:** refundPayment endpoint retorna 4xx com mensagem "out of window".

### Pitfall 7: Trial readings_used contado em consume vs reserve
**What goes wrong:** Terapeuta cria 100 links convite + cancela todos → trial não decrementa → infinito.
**Why it happens:** Se incrementar só no consume (post-analyze), reserve fica "free".
**How to avoid:** Incrementar `trial_readings_used` no **RESERVE** (D-11 já diz reserva 7d aplica ao trial). Reserva expirada/cancelada faz ROLLBACK do `trial_readings_used` (decrement).
**Warning signs:** trial_readings_used > 0 mas leitura nunca foi gerada — verificar credit_reservations.status.

### Pitfall 8: vercel.json crons em monorepo
**What goes wrong:** Crons em `apps/web/vercel.json` não são detectadas porque Vercel root é raiz do repo.
**Why it happens:** Vercel project root path. Verificar settings do project.
**How to avoid:** Confirmar `Root Directory: apps/web` no Vercel project settings. `vercel.json` em `apps/web/vercel.json` é o efetivo.
**Warning signs:** Deploy succeeds mas cron não aparece em Vercel UI > Cron Jobs.

### Pitfall 9: Service-role client em webhook bypassa RLS — vazamento se mal-usado
**What goes wrong:** Webhook handler usa `createServiceClient()` (necessário, sem session de terapeuta) mas pode acidentalmente SELECT em rows de OUTRO terapeuta se filtro errado.
**Why it happens:** Service-role ignora RLS.
**How to avoid:** Filter EXPLÍCITO `.eq('user_id', externalReference_user_id)` em todas as queries. Code review específico nesse arquivo.
**Warning signs:** Webhook handler sem .eq() ou .filter().

---

## Implementation Pitfalls + Open Questions

### Open Questions

1. **PAYMENT_CONFIRMED vs PAYMENT_RECEIVED como evento de "creditar"**
   - What we know: D-01 diz "payment_confirmed → adiciona créditos". Cartão tem 30d delay entre os dois.
   - What's unclear: Founder está ciente do trade-off (UX vs chargeback risk)?
   - Recommendation: Planner perguntar antes da implementação OU implementar default em PAYMENT_RECEIVED e oferecer flag pra mudar (`ASAAS_CREDIT_EVENT=PAYMENT_CONFIRMED|PAYMENT_RECEIVED` env var). Smoke test em sandbox usa PIX (não tem este problema), então decisão pode esperar até primeiro pagamento real de cartão.

2. **`is_in_trial` enquanto tem créditos ativos**
   - What we know: D-08 "Cliente em trial PODE comprar pacote antecipado. Créditos comprados só começam a ser consumidos quando trial encerrar."
   - What's unclear: "Quando trial encerrar" = first-wins (3 leituras OR 60d)? Ou quando trial é manualmente encerrado?
   - Recommendation: Implementar `is_in_trial` como "trial_status.ended_at IS NULL"; trial "encerra" quando o first-wins gate dispara. Reserve durante trial NÃO TOCA `customer_credits`. Reserve pós-trial vai pro FIFO de credits.

3. **Termo cliente — assinado pelo terapeuta em nome do cliente ou pelo próprio cliente?**
   - What we know: D-19 "Termo cliente do terapeuta (foto de íris = biométrico) assinado ANTES de criar link remoto OR iniciar captura no consultório."
   - What's unclear: Quem clica "Aceito" — terapeuta no consultório dando o tablet pro cliente, ou cliente em casa via link?
   - Recommendation: Suportar AMBOS via `consent_channel`: `office_handoff` (terapeuta pede pro cliente clicar antes) ou `remote_link` (cliente clica no convite). Schema `client_consents` já tem este campo (0020). UI distingue.

4. **CPF dedup em b2c clientes ou só em profiles (terapeutas)?**
   - What we know: D-12 "CPF + telefone obrigatório no signup" — signup é terapeuta. Tabela `clients` não tem CPF.
   - What's unclear: Cliente final precisa CPF pra termo biométrico?
   - Recommendation: Termo v1 §2 menciona "{{TITULAR_NOME}}", não CPF. Adicionar CPF cliente no termo é OPCIONAL (eleva valor probatório). Planner decide; sugestão: SIM (campo `clients.cpf_titular` nullable + dedup só dentro do mesmo therapist_id se necessário).

5. **NF automática timing — pre-emit ou post-payment?**
   - What we know: Asaas docs falam de `effectiveDatePeriod` pra subscriptions. Para cobrança avulsa, NF é configurada no painel.
   - What's unclear: NF é emitida quando? Pre-payment (vai no email do checkout)? Post-payment (vai depois)?
   - Recommendation: Founder configura no painel Asaas; Phase 8 NÃO precisa processar eventos NF. V1.1 polish.

6. **LGPD-04 dashboard básico — UI ou SQL?**
   - What we know: D-15 "log simples de eventos críticos no banco". Não fala em UI.
   - What's unclear: Founder consulta via Supabase SQL editor ou via página /admin?
   - Recommendation: SQL editor é suficiente V1. Página /admin/audit-log se houver appetite no planner — leve, 1 task.

7. **Internal_use flag — só founder ou também team members?**
   - What we know: D-09 "founder, admins, contas de teste interno".
   - What's unclear: Como "admin" é definido? Por email allowlist (founder hard-coded) ou flag em `profiles`?
   - Recommendation: Pattern existente (memory `feedback_supabase_rls_no_auth_users`) usa `auth.jwt() ->> 'email' = 'rhelton@gmail.com'` — bypass founder via JWT. `internal_use` em profiles é OUTRO eixo (testes de QA, ex-funcionários). Implementar como flag em `profiles` + email founder = bypass automático.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stripe BR (BILLING-01..03 antigo) | Asaas (D-01) | 2026-05-26 (CONTEXT.md) | Pricing tiers != monthly subscription; webhook contract diferente; NF automática Brazilian native |
| `subscription_status` + `trial_ends_at` em `profiles` (Fase 1) | `customer_credits` + `trial_status` tabelas dedicadas | Phase 8 | Schema mais expressivo; legacy colunas deprecated-by-disuse V1 |
| `legal/term-v1.md` (caminho assumido em CONTEXT.md) | `apps/web/lib/consent/term-v1.md` (real path) | Já existente | CONTEXT.md tem typo de path; research confirma path real |
| @react-pdf/renderer | Gotenberg on Render | Phase 7.4 | Reusado pra termo biométrico em Phase 8 |

**Deprecated/outdated:**
- `profiles.subscription_status` — semântica muda (legacy 'trial' não mais autoritativo). Deprecate-by-disuse V1, drop em migration futura.
- `profiles.trial_ends_at` — substituído por `trial_status.trial_expires_at`. Same fate.
- BILLING-01 ementa antiga (Stripe + 3 tiers) — explicitamente substituída por CONTEXT.md D-01..D-22. REQUIREMENTS.md line 68 deve ser updated.

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md não existe na raiz do projeto (verificado). Constraints relevantes vêm de `.planning/PROJECT.md` + memory:

| Constraint | Origem | Aplicação Phase 8 |
|------------|--------|---------------------|
| Linguagem hipotética + vocabulário proibido | PROJECT.md "Posicionamento" | Audit-vocabulary CI gate continua green ao adicionar páginas |
| Idioma pt-BR para UI, prompts, docs | PROJECT.md | Toda copy nova em pt-BR |
| Pre-existing test failures não bloqueiam push | memory `feedback_quality_scoring_test_gate` | Phase 8 testes novos são gating; legacy failures não |
| Run pnpm lint before pushing | memory `feedback_run_lint_before_push` | Pattern adoption |
| 'use server' files only export async functions | memory `feedback_use_server_export_hygiene` | Server actions Asaas/credit/termo seguem regra |
| Atomic update (não incrementar mid-stream) | memory `feedback_consumer_atomic_update` | Credit ledger UPDATE em uma transação |
| Worktree cleanup Windows (bash rm -rf) | memory `feedback_worktree_cleanup_windows` | Aplica se planner usar worktrees pra paralelismo |
| Verify Supabase schema, not migration list | memory `feedback_verify_supabase_schema_not_migration_list` | Após `supabase db push`, validar via `information_schema` |
| Auto-block expensive escalation | memory `feedback_auto_block_expensive_branches` | Não escalar pra Stripe ou third-party CPF check API sem aprovação founder |
| MIN_AGE=18 (Fase 11 11-02 LIVE) | memory `project_min_age_beta_revert_before_ga` | Termo cliente reusa gate; clientes <18 bloqueados |
| NO auto-push | memory `feedback_repo_autopush` | Founder push manual após verify |
| Não usar git config (memory) | memory canonical | Aplica |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Founder quer creditar em PAYMENT_CONFIRMED (não PAYMENT_RECEIVED) — UX-first vs cartão 30d delay | Asaas Integration | Cliente paga cartão, espera 30d sem créditos. Decisão de produto. |
| A2 | NF automática Asaas funciona com `effectiveDatePeriod` default + CNPJ founder ativo | Asaas Integration | NF não é emitida; precisa intervenção manual no painel Asaas. |
| A3 | Founder usará pattern de incrementar trial_readings_used no RESERVE (não no consume) | Trial + Anti-Fraud | "Trial farming" via reserve+cancel se incrementar só no consume. |
| A4 | Vercel Cron root directory aponta para apps/web | Cron Daily Jobs | Cron não dispara se project root != apps/web. |
| A5 | profiles.subscription_status pode ser deprecated-by-disuse (não-DROP em V1) | State of the Art | Se algo legacy lê esta coluna, breaks. Verificar grep antes de execution. |
| A6 | Cliente final (titular biométrico) clica "Aceito" — não terapeuta em nome dele | LGPD-01 | Termo assinado por proxy enfraquece valor probatório. |
| A7 | Termo PDF rendering reusa pattern Gotenberg `/api/readings/[id]/pdf` sem customização major | LGPD-01 | Estilização específica do termo (cabeçalho oficial, logo SOPRO) pode exigir trabalho extra. |
| A8 | Asaas sandbox account é trivial de criar (founder pode em 5 min) | Environment | Phase delay se sandbox account demora ou exige documentação. |
| A9 | LGPD audit log dashboard /admin/audit-log NÃO é escopo Phase 8 (SQL editor suficiente) | LGPD-03 + LGPD-04 | Se founder quer UI dedicada, +1 task ao plan. |
| A10 | Trigger de revisão jurídica do termo continua deferred (Path B trigger ATIVO via memory `project_consent_term_legal_review_debt`) | LGPD-01 | Termo v1 expõe Iris Codex juridicamente até revisão. Founder consciente. |
| A11 | Cliente <18 bloqueado via reuso de Fase 11 11-02 MIN_AGE — sem código novo | LGPD-01 | Se gate antigo não cobre fluxo termo, menor pode assinar. |
| A12 | Schema sugerido (credit_packages, customer_credits, etc.) é viable; planner refinará indices/RLS | Credit Ledger Architecture | Erros estruturais surgem na execução; rework de migration. |
| A13 | Refund de cartão funciona dentro de 7d (bandeiras de crédito aceitam refund within ~120d) | Asaas Integration | Edge case: terapeuta pediu refund no dia 6 de cartão emitido — Asaas aceita normalmente. |
| A14 | Asaas API key pode ser rotacionada sem disruptar webhook (webhook usa secret separado) | Asaas Integration | Rotation flow ainda não validado. |
| A15 | Webhook URL pública sem rate limit no Vercel (founder traffic baixo) | Common Pitfalls | DDoS no webhook = bill alto. Mitigação: Vercel WAF (Pro plan) se necessário. |

**A1, A2, A6 são CRÍTICOS — recomendar planner perguntar founder antes da execução.**

---

## Sources

### Primary (HIGH confidence)

**Asaas (oficial docs):**
- [Criar nova cobrança](https://docs.asaas.com/reference/criar-nova-cobranca) — POST /v3/payments contract
- [Refund payment](https://docs.asaas.com/reference/refund-payment) — POST /v3/payments/{id}/refund contract
- [Criar novo cliente](https://docs.asaas.com/reference/criar-novo-cliente) — POST /v3/customers
- [Receba eventos do Asaas no seu endpoint de Webhook](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook) — header `asaas-access-token`, payload shape
- [Payment events](https://docs.asaas.com/docs/payment-events) — lista completa eventos PAYMENT_*
- [Como implementar idempotência em Webhooks](https://docs.asaas.com/docs/como-implementar-idempotencia-em-webhooks) — event.id como idempotency key
- [Authentication](https://docs.asaas.com/docs/authentication-2) — sandbox vs prod URLs, API key prefixes
- [API Limits](https://docs.asaas.com/docs/api-limits-1) — 25k req/12h, 50 concurrent
- [Erros de Webhook (queue paused)](https://docs.asaas.com/docs/erros-comuns-copy-3) — 15 falhas → fila pausada
- [Erro Read Timed Out](https://docs.asaas.com/docs/erro-read-timed-out) — 10s timeout receptor
- [Webhook para cobranças (event flows)](https://docs.asaas.com/docs/webhook-para-cobrancas) — fluxos PIX/BOLETO/CARTÃO
- [Webhook para notas fiscais](https://docs.asaas.com/docs/webhook-para-notas-fiscais) — INVOICE_AUTHORIZED etc.
- [Estornos](https://docs.asaas.com/docs/estornos) — partial vs total refund regras

**Vercel + Supabase:**
- [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs) — schedule + CRON_SECRET
- [Vercel Cron Usage & Pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) — Pro plan 40 jobs
- [Supabase pg_cron](https://supabase.com/docs/guides/database/extensions/pg_cron) — alternativa não-recomendada pra este caso

**Internal codebase (HIGH confidence, verified):**
- `apps/web/lib/vision/hmac.ts` — HMAC pattern (Modal, NÃO Asaas)
- `apps/web/app/api/vision/webhook/route.ts` — webhook idempotency + status guard pattern
- `apps/web/app/api/readings/[id]/pdf/route.tsx` — Gotenberg pattern (split+merge)
- `apps/web/lib/consent/term-v1.md` — termo AI-drafted, AINDA não seedado
- `apps/web/lib/consent/tos.ts` — TOS_VERSION constant pattern
- `supabase/migrations/0020_consent_infra.sql` — consent_terms + client_consents LIVE
- `supabase/migrations/0033_therapist_invites_and_client_email_unique.sql` — UNIQUE pattern
- `apps/web/scripts/audit-vocabulary.mjs` — CI vocab gate LIVE
- `apps/web/lib/profile/fields.ts` — phoneIsValidBR + formatPhoneBR reusable

### Secondary (MEDIUM confidence)

- [SaaS Credits System Guide 2026](https://colorwhistle.com/saas-credits-system-guide/) — FIFO + PG row-locking patterns
- [Modern Treasury — Ledgers with Optimistic Locking](https://www.moderntreasury.com/journal/designing-ledgers-with-optimistic-locking) — concurrency tradeoffs
- [Validade jurídica assinatura digital — SuperSign](https://supersign.com.br/blog/validade-juridica-assinatura-digital/) — SHA256 + audit trail vs ICP-Brasil
- [Assinatura eletrônica vs digital — X-Apps](https://x-apps.com.br/assinatura-eletronica-vs-assinatura-digital-icp-brasil/) — valor probatório eletrônica avançada
- [Como validar CPF em JavaScript — DEV.to](https://dev.to/gerador-br/como-validar-cpf-em-javascript-guia-simples-para-desenvolvedores-11b3) — algoritmo módulo-11
- [Validar CPF TypeScript gist](https://gist.github.com/joaohcrangel/8bd48bcc40b9db63bef7201143303937) — implementação inline

### Tertiary (LOW confidence — needs verification)

- npm `asaas` package — comunitário, não-mantido, NÃO recomendado
- "PAYMENT_CONFIRMED como evento de creditar em cartão" — A1, founder decide

---

## Metadata

**Confidence breakdown:**
- Asaas API contract: HIGH — official docs verified line by line for create/refund/webhook endpoints
- Credit ledger pattern: HIGH — established SaaS pattern, Postgres FOR UPDATE is canonical
- Concurrency safety: MEDIUM — pattern is correct, but race tests required to validate in this stack
- LGPD-01 click-through valor probatório: MEDIUM — jurisprudência aceita, mas não absoluta sem caso real
- LGPD-04 event list: MEDIUM — depende de discreção planner + founder appetite por audit log dashboard
- Vercel Cron Pro: HIGH — official docs
- pg_cron alternative: HIGH — official docs (mas não recomendado pro caso)
- Schema details (column types, indices): MEDIUM — esboço; planner refina

**Research date:** 2026-05-26
**Valid until:** 2026-06-25 (30 days — Asaas docs estáveis; LGPD jurisprudência estável; padrão FIFO estável)
**Anchored decisions:** D-01 to D-22 (CONTEXT.md) — research NÃO relitiga, apenas explora COMO

---

*Phase 8 research: 2026-05-26*
*Researcher: Claude (Opus 4.7 1M context) under /gsd-research-phase orchestration*
