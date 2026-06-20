# Mercado Pago — base de conhecimento (Checkout Pro) · 2026-06-20

Pesquisa dirigida à migração Asaas→Mercado Pago do Iris Codex. Os 5 docs abaixo
são a referência técnica; este README é a síntese executiva + as decisões de
arquitetura que derivam dela.

> ⚠️ As páginas de *reference* do MP renderizam por JS e bloqueiam fetch (403);
> os campos foram confirmados cruzando guias + GitHub oficial + SDKs. As **taxas**
> vieram de calculadoras/parceiros 2026 e **devem ser confirmadas no painel
> logado** antes de hardcodar qualquer valor.

## Índice
- [`01-checkout-pro-preferences.md`](./01-checkout-pro-preferences.md) — criar preference, init_point, parcelas por preference, back_urls
- [`02-webhooks-signature.md`](./02-webhooks-signature.md) — validação x-signature, GET payment, idempotência
- [`03-payments-refunds-chargebacks.md`](./03-payments-refunds-chargebacks.md) — estorno total/parcial, parcelado=1 payment, chargeback
- [`04-installments-pix-fees-br.md`](./04-installments-pix-fees-br.md) — sem-juros (custo do vendedor), PIX, taxas/prazos BR, risco de hold
- [`05-credentials-sandbox-testing.md`](./05-credentials-sandbox-testing.md) — credenciais, test users, cartões de teste, X-Idempotency-Key, SDK vs REST

## Os 7 fatos que moldam o nosso código

1. **Parcelado no MP = 1 ÚNICO `payment` com `installments=N`** (o parcelamento é
   entre cliente e operadora; nós recebemos o valor cheio). NÃO existe grupo
   `installment` — toda a complexidade Asaas de "casar por grupo" (refund/webhook/
   chargeback) **desaparece**. `groupId`/`isInstallment` é Asaas-only.
2. **Correlação por `external_reference`**: setamos `external_reference = creditId`
   (UUID da row pending) na preference; ele propaga até o `payment`. O webhook
   traz só `{type, data.id}` → `GET /v1/payments/{data.id}` → lê `external_reference`
   → casa pela PK da row.
3. **Crédito SÓ em `status === "approved"`** (`status_detail: accredited`).
   `authorized`/`in_process`/`pending` = aguardar; `refunded`/`charged_back` = reverter.
4. **Idempotência**: o MP REENVIA (created→updated + retry a cada 15min até 200).
   Deduplicar por `(payment.id, status)`; responder 200 rápido.
5. **x-signature**: manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` →
   HMAC-SHA256 com a **assinatura secreta do webhook** (≠ Access Token; **distinta
   por ambiente**). Route handler precisa de `runtime = "nodejs"`. Webhooks v2, não IPN.
6. **Refund**: `POST /v1/payments/{id}/refunds` com **`X-Idempotency-Key` obrigatório**.
   Total = `{}`; parcial = `{ amount }` (Asaas usava `value`). Refund de PIX em
   contingência → header `X-Render-In-Process-Refunds: true` p/ receber 201 assíncrono.
   Janela: 180d cartão / ~80d PIX (nosso CDC 7d folga).
7. **PIX só aparece com chave PIX cadastrada na conta** (config da conta, não da API).

## Decisões de arquitetura derivadas
- **REST cru (`fetch`)**, não o SDK `mercadopago` — consistência com o client Asaas
  e controle total. (SDK só se o boilerplate incomodar.)
- **Checkout Pro / redirect** (`init_point`) — troca quase 1:1 com o `invoiceUrl` do
  Asaas. Founder escolheu produção direta (sem sandbox).
- **Asaas dormente atrás de `PAYMENT_PROVIDER`** — não deletar; rollback = flag.
- Limitar parcelas por preference: `payment_methods.installments` = 1/2/3 por SKU +
  `default_installments: 1`. "Sem juros" mora na CONTA (config), não na API.
- Oferecer só PIX **ou** só cartão por preference via `excluded_payment_types`
  (PIX = `bank_transfer`, cartão = `credit_card`).

## ⚠️ Trade-offs materiais (decisão de NEGÓCIO, não de código)
- **Absorver parcelado sem juros é CARO**: plano padrão "na hora" ≈ 1x 4,98% · 2x
  9,90% · **3x 11,28%** → ~R$74 no médio/2x e ~R$134 no grande/3x. Cai muito em
  plano de volume (negociar) ou em prazo D+14/D+30. **Confirmar no painel.**
- **PIX do MP é % (0,49–0,99%)**, não fixo. No ticket alto (R$1191) o Asaas (R$1,99
  fixo ≈ 0,17%) é mais barato — mas o PIX do Asaas já funcionava; o problema era o cartão.
- **Hold de conta nova**: conta recém-criada + ticket alto + parcelado = perfil de
  retenção (até ~90d). Mitigar: aquecer (ticket/volume baixo→subir), KYC, começar em
  D+14/D+30, Asaas como plano B.
- **NF-e**: MP não emite (Asaas emitia nativo). Founder optou por seguir sem NF
  automática agora; emissor externo (NFe.io/eNotas) vira backlog.

## Homework do founder (na conta MP)
- [ ] Access Token de **produção** → `MERCADOPAGO_ACCESS_TOKEN` no `.env.local` (e Vercel)
- [ ] **Assinatura secreta do webhook** (produção) → `MERCADOPAGO_WEBHOOK_SECRET`
- [ ] Ligar **parcelas sem juros até 3x** (Seu negócio → Taxas e parcelamentos → Checkout)
- [ ] Cadastrar **chave PIX** na conta
- [ ] (recomendado) Conferir as **taxas reais** do plano e avaliar D+14/D+30
