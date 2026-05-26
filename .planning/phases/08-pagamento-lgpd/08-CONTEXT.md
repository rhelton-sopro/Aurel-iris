# Phase 8: Pagamento + LGPD - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

**Em scope:** Sistema de monetização baseado em pacote pré-pago de créditos + trial gratuito + cumprimento LGPD core (consentimento biométrico + privacy + deleção+log básicos + copy obrigatória + audit vocab).

**Modelo de cobrança (NÃO subscription):** Pacote pré-pago — terapeuta compra créditos upfront via Asaas, usa quando quiser dentro de 12m de validade. Trial gratuito de 3 leituras OU 60 dias (first-wins) sem cartão upfront.

**Out of scope (deferred):**
- Subscription mensal recorrente → V1.1+
- Add-ons opcionais (PDF brandado, white-label, multi-terapeuta, exportação massa) → fase futura
- LGPD-03 completo (export/delete automático self-service) → Fase 8.1+
- LGPD-04 completo (dashboard de auditoria configurável) → Fase 8.1+
- Validação fiscal CPF via API Receita Federal → V1.1+
- Extensão manual de créditos expirados → caso-a-caso suporte (não-coded)
- Dunning policy (retry/suspend) → N/A pré-pago; reabre quando subscription entrar

</domain>

<decisions>
## Implementation Decisions

### Modelo de cobrança

- **D-01: Pacote pré-pago de créditos via Asaas pagamento avulso.** Cada compra é uma transação única no Asaas (NÃO subscription nem preapproval). Cliente compra → webhook `payment_confirmed` → adiciona créditos ao saldo + define `expires_at = now + 12 meses` + envia email de confirmação. Métodos aceitos: Pix, cartão de crédito, boleto. NF automática emitida pelo Asaas (CNPJ founder ativo confirmado).
- **D-02: 4 SKUs.**
  - Avulsa: R$99,70 por leitura única
  - Pequeno: 5 leituras por R$298,50 (R$59,70/un)
  - Médio: 15 leituras por R$745,50 (R$49,70/un) — badge "Mais escolhido"
  - Grande: 30 leituras por R$1.191,00 (R$39,70/un) — badge "Melhor valor"
- **D-03: Validade 12m em TODOS os pacotes incluindo Avulsa.** Contagem começa em payment confirmed (não data de compra). Cliente pode ter múltiplos pacotes ativos simultaneamente; saldo soma. Emails de aviso de expiração: 30d, 7d, no dia.
- **D-04: Consumo FIFO entre pacotes ativos.** Sistema debita primeiro do pacote mais antigo, depois dos novos. Quando crédito expira (12m), saldo restante daquele pacote é zerado (sem reembolso de expirados, exceto caso-a-caso suporte).
- **D-05: Sem dunning** porque modelo é pré-pago. Sem mensalidade recorrente = sem retry/suspend. Cliente paga upfront → usa o que comprou → sem crédito = sem geração.

### Trial gratuito

- **D-06: Trial = 3 leituras OU 60 dias (first-wins).** Sem cartão de crédito upfront. Cadastro requer email + dados básicos + CPF + telefone (ver D-12 anti-fraud).
- **D-07: Após trial encerrar (qualquer condição):** bloqueia geração de novos relatórios, mostra opções de compra (Avulsa + 3 pacotes). Histórico/relatórios já gerados permanecem visíveis e acessíveis.
- **D-08: Cliente em trial PODE comprar pacote/avulsa antecipado** (qualquer hora, não precisa exaurir trial). Créditos comprados só começam a ser consumidos quando trial encerrar.
- **D-09: Founder/admin flag `internal_use=true`** — acesso ilimitado, não consome créditos nem trial, excluído de métricas de faturamento e analytics de produto. Aplicável a founder, admins, contas de teste interno.

### Reserva temporária de créditos

- **D-10: Verificação de saldo em 3 momentos do fluxo:**
  1. Antes de criar link de captura remota (cliente fotografa em casa)
  2. Antes de iniciar captura no consultório (terapeuta tira fotos na sessão)
  3. Antes de gerar relatório (já previsto)
- **D-11: Reserva 7d nos 2 primeiros momentos.** Quando terapeuta cria link OR inicia captura, sistema decrementa saldo real em 1 e adiciona +1 em "saldo reservado" vinculado àquela `reading_id`. Reserva tem prazo de 7 dias. Se relatório for gerado dentro de 7d: reserva converte em débito definitivo. Se 7d passam sem geração: reserva é liberada (volta pro saldo real). Terapeuta pode cancelar reserva manualmente. UX dashboard mostra "Saldo disponível: X | Reservados: Y | Total: X+Y" + lista "Processos em andamento" com prazo de expiração + botão "cancelar processo". Mesma lógica aplica ao trial (3 leituras). Avulsa também entra como reserva temporária após pagamento confirmado.

### Anti-fraud trial

- **D-12: CPF + telefone obrigatório no signup** com validação básica de formato (regex CPF + DDD). Trial só ativa se CPF E telefone forem únicos na base. Se duplicado: bloqueia novo signup, mostra "já existe cadastro com esse CPF/telefone, faça login". Validação fiscal CPF via API Receita Federal: V1.1+ (se for trabalho não-trivial).

### Arrependimento (CDC 7 dias)

- **D-13: Direito de arrependimento 7 dias após compra do pacote.**
  - Se NENHUMA leitura foi consumida do pacote: reembolso TOTAL
  - Se ≥1 leitura consumida: reembolso PROPORCIONAL sobre saldo restante (= preço unitário do pacote × leituras restantes)
  - Após 7d: sem reembolso de créditos não usados (exceto caso-a-caso suporte via avaliação manual)
  - Reembolso via integração refund endpoint Asaas + zeragem do crédito local
- **D-14: Termos de uso devem explicitar política de validade 12m + arrependimento 7d em destaque** na tela de compra e nos Termos públicos.

### LGPD scope na Fase 8

- **D-15: Inclusos em Fase 8:** LGPD-01 (termo cliente biométrico), LGPD-02 (privacy public), LGPD-03 básico (link "pedir deleção" via email manual), LGPD-04 básico (log simples de eventos críticos no banco), LGPD-05 (copy obrigatória), LGPD-06 (audit vocab — já LIVE em prod).
- **D-16: Movidos pra Fase 8.1+:** LGPD-03 completo (export/delete self-service automático), LGPD-04 completo (dashboard de auditoria configurável).

### LGPD-01 — Termo de consentimento biométrico

- **D-17: Ferramenta = solução nativa Iris Codex.** PDF gerado pelo sistema + tela "aceitar" capturando IP+timestamp+nome+CPF do cliente do terapeuta. Storage assinado em Supabase com hash SHA256 + storage immutable. Sem fornecedor externo (DocuSeal/Clicksign descartados). Aceitar trade-off: valor probatório legalmente menor que ICP-Brasil; mitigado por hash+immutable; vale revisitar quando primeiro questionamento ANPD ou ação civil aparecer.
- **D-18: TOS terapeuta (uso do produto Iris Codex) = checkbox no signup.** Texto "Li e aceito os Termos de Uso e Política de Privacidade" obrigatório antes de criar conta. Storage de timestamp + IP + versão do termo. Reusa `legal/term-v1.md` AI-drafted já existente (trigger ativo de revisão jurídica em memory `project_consent_term_legal_review_debt`).
- **D-19: Termo cliente do terapeuta (foto de íris = biométrico)** assinado ANTES de criar link remoto OR iniciar captura no consultório. Bloqueia o fluxo no ponto onde a foto seria gerada — sem termo assinado, não gera link nem ativa captura. Alinha com mecanismo de reserva (D-10/D-11): verifica saldo E termo nos 2 primeiros momentos.

### Schema esboçado (5 tabelas novas)

- **D-20:** Schema base — final design fica com planner, mas estrutura geral:
  - `credit_packages` (catálogo): id, name, leituras_count, price_brl, active, created_at
  - `customer_credits` (saldo por cliente): id, user_id, package_id, leituras_purchased, leituras_remaining, leituras_reserved, purchase_date, expires_at, status (active/expired/refunded)
  - `credit_transactions` (log): id, user_id, credit_id, type (purchase/consume/refund/expire), amount, asaas_payment_id, created_at
  - `trial_status` (controle de trial): user_id, trial_started_at, trial_expires_at, trial_readings_used, trial_readings_max=3
  - `credit_reservations` (reservas 7d): id, user_id, credit_id, reading_id, reserved_at, expires_at (=reserved_at+7d), status (active/converted/released/expired)

### UI página de compra

- **D-21: 2 grupos visuais** na tela de compra:
  - Grupo 1 "Sem compromisso": Trial (badge "Gratuito" se ainda ativo) + Avulsa R$99,70 (mostra "uso imediato")
  - Grupo 2 "Pacotes com economia": Pequeno + Médio (badge "Mais escolhido") + Grande (badge "Melhor valor")
- **D-22: Cada card mostra:** quantidade de leituras, preço total, preço por leitura, economia em R$ comparada à avulsa, validade de 12 meses (texto pequeno mas visível), botão "Comprar".

### Claude's Discretion

- Implementação técnica do webhook Asaas (Zod schema, idempotência, retries) — planner decide
- Detalhe da migration order, índices, FKs cascateadas — planner decide
- UI specifics de "Processos em andamento" (table vs cards, filtros) — planner decide
- LGPD-04 básico: quais eventos exatamente logar (login, leitura gerada, termo assinado, compra) — planner decide
- LGPD-03 básico: template do email de "pedir deleção" + SLA de resposta — planner decide
- Templates dos 3 emails de aviso de expiração (30d, 7d, day-of) — planner decide

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap + Requirements
- `.planning/ROADMAP.md` §"Fase 8: Pagamento + LGPD" — boundary e success criteria atualizados
- `.planning/REQUIREMENTS.md` §Pagamento (BILLING-01..03) e §LGPD (LGPD-01..06) — requisitos formais (notar que BILLING-01 menciona Stripe + 3 tiers fixos = OBSOLETO; este CONTEXT.md substitui)
- `.planning/PROJECT.md` — valor central + métrica MVP

### Memory (governing decisions desta fase)
- `~/.claude/projects/D--Projetos-Iridologista/memory/project_fase_8_payment_provider_asaas.md` — Asaas locked (será atualizada pra refletir pré-pago, não híbrido subscription)
- `~/.claude/projects/D--Projetos-Iridologista/memory/project_consent_term_legal_review_debt.md` — trigger ativo de revisão jurídica do termo
- `~/.claude/projects/D--Projetos-Iridologista/memory/feedback_ask_before_sonnet_calibration.md` — não aplica a esta fase mas mantém regra durante implementação

### Legal docs existentes
- `legal/term-v1.md` — termo AI-drafted reusado pra TOS terapeuta (checkbox signup) + base pro termo cliente biométrico

### Asaas docs (planner consultar durante implementação)
- https://docs.asaas.com/ — Cobrança avulsa + webhook events + refund endpoint + NF automática

### Schema existente que esta fase amplia
- `apps/web/types/database.ts` — types gerados Supabase (será regen após migrations 0034+)
- Migrations passadas relevantes: 0001 (profiles.subscription_status + trial_ends_at), 0033 (therapist_invites + clients UNIQUE)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `profiles.subscription_status` + `profiles.trial_ends_at` (Fase 1): existem mas semântica vai mudar; trial_ends_at será derivado de trial_status table; subscription_status pode ser deprecated em favor de saldo de créditos
- `apps/web/lib/anthropic/system.md` (Fase 7): geração de relatório que precisa adicionar verificação de saldo no ponto 3 (Verificação 3 — D-10)
- `apps/web/app/api/readings/[id]/analyze/route.ts` (Fase 7): rota que dispara LLM; vai ganhar gate de saldo + conversão de reserva em débito
- `apps/web/app/(auth)/signup/page.tsx` (Fase 2): adiciona CPF + telefone + checkbox TOS
- `apps/web/lib/scripts/audit-vocabulary.mjs` (Fase 6 estendido): LGPD-06 já LIVE, só validar que copy obrigatória + termos novos não introduzem vocabulário proibido
- `apps/web/app/admin/terapeutas/...` (Fase 11.1): convite via signup form — agora gate adicional "tem termo de uso aceito?"

### Established Patterns
- **Webhook idempotência** (Fase 5 Modal + Fase 11.1 Resend): pattern de status guard + atomic UPDATE em status transitions. Aplicar a Asaas `payment_confirmed`.
- **HMAC verification** (Fase 5 `lib/vision/hmac.ts`): pattern pra validar webhooks externos. Reusar pra Asaas webhook (Asaas usa hmac-sha256 access_token).
- **Migration + types regen** (Fase 1+): toda migration aplica via `supabase db push --linked` + `pnpm gen:types` antes do código consumir.
- **Sonner toast em erros UX** (Fase 4+): toast para "saldo insuficiente" / "termo não assinado" / "reserva expirada" / "compra confirmada — créditos adicionados".
- **'use server' files only export async functions** (memory `feedback_use_server_export_hygiene`): server actions de pagamento e termo seguem regra.
- **Atomic update buffer** (memory `feedback_consumer_atomic_update`): pra status do reservation/credit não usar incrementos parciais.

### Integration Points
- **Asaas → Iris Codex webhook**: novo endpoint `app/api/asaas/webhook/route.ts` recebe payment_confirmed (HMAC validated), insere `customer_credits` row + `credit_transactions` row + envia email.
- **Iris Codex → Asaas refund**: server action `refundPackageAction` chama Asaas refund API + zera local credit + log transaction.
- **Captura mobile/upload desktop → reserva**: rotas existentes `/leituras/nova/*` ganham gate de verificação saldo (D-10 #1 e #2) + INSERT em `credit_reservations`.
- **Analyze route → conversão**: `app/api/readings/[id]/analyze/route.ts` (Fase 7) UPDATE reservation status='converted' + UPDATE credit `leituras_remaining` -1.
- **Cron daily** novo: job pra (a) marcar reservas expiradas + liberar saldo + (b) marcar credits expirados aos 12m + zerar saldo + (c) enviar emails de aviso (30d/7d/day-of).

</code_context>

<specifics>
## Specific Ideas

- **Pricing exato locked** em R$99,70 / R$298,50 / R$745,50 / R$1.191,00 — números são finais, não estimativas.
- **Reserva 7d** é número específico (não 3d nem 14d) escolhido pelo founder pra balancear "cliente demora a enviar fotos" vs "terapeuta abusa criando 50 links sem saldo".
- **Validade 12m** é número específico — não 6m nem 24m.
- **Trial 3 leituras OR 60d** — first-wins lógica.
- **CPF + telefone** dedup é primeira camada anti-fraud; RFB API V1.1+.
- **Solução nativa** pro termo (não DocuSeal nem Clicksign) é escolha consciente de controle vs valor probatório formal.
- **Internal_use flag** é a maneira de manter founder + admins fora das métricas — não usar contas-de-teste com email diferente.
- **Reserva avulsa também** — avulsa não é "use ou perde imediato"; segue mesma mecânica de reserva 7d.

</specifics>

<deferred>
## Deferred Ideas

- **Add-ons opcionais** (PDF brandado, white-label leve, exportação em massa, multi-terapeuta) — fase futura, captura individual quando founder decidir priorizar.
- **Subscription mensal recorrente** — V1.1+. Quando entrar, reabre decisão de dunning policy.
- **LGPD-03 completo (export/delete self-service)** — Fase 8.1 ou 8.x dedicada.
- **LGPD-04 completo (dashboard auditoria configurável)** — Fase 8.1 ou 8.x dedicada.
- **Validação fiscal CPF via API Receita Federal** — V1.1+ se trabalho não-trivial; alternativas: 3rd-party Brazilian CPF check APIs (custo $ por consulta).
- **Extensão manual de créditos expirados** — caso-a-caso via suporte humano, não-coded em V1.
- **Notification de trial faltando pouco** (ex: "faltam 2 leituras OU 5 dias") — UX não-coded V1; founder decide se add depois.
- **Cobrança recorrente / assinatura mensal** — V1.1+. Asaas suporta via subscription/preapproval API mas não vamos usar agora.
- **Multi-terapeuta / Escola (white-label leve)** — fase futura quando primeira escola aparecer comprando.

### Reviewed Todos (not folded)
Nenhum dos 6 todos pendentes do projeto matched scope da Fase 8 — match-phase score 0 em todos.

</deferred>

---

*Phase: 08-pagamento-lgpd*
*Context gathered: 2026-05-26*
