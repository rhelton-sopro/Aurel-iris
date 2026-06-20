# Mercado Pago — Credenciais, Sandbox, Usuários de Teste, Cartões de Teste e Idempotência

> Documento de referência para a integração do **Checkout Pro** (preferences + webhook) no Iris Codex.
> Foco: validar TUDO em sandbox antes de produção — criar preference de teste, pagar PIX e cartão de teste,
> testar **parcelamento sem juros (2x/3x)**, receber webhook de teste e estornar.
> Stack: Next.js + REST (`fetch`) — com avaliação do SDK oficial `mercadopago` (Node v2).
> Data da pesquisa: 2026-06-20. Fontes oficiais `mercadopago.com.br/developers` citadas por seção.

---

## TL;DR operacional (o caminho feliz)

1. Em **Suas integrações → [sua aplicação] → Credenciais de teste**, pegue o **Access Token de TESTE** (`TEST-...`) e a **Public Key de teste**.
2. Crie **contas de teste** (usuários de teste): pelo menos **1 vendedor** e **1 comprador** (em Suas integrações → Contas de teste, ou via `POST /users/test`). Você NÃO consegue pagar com sua própria conta.
3. **Logue no painel de developers como o VENDEDOR de teste**, crie uma aplicação nele e use o **Access Token de teste DELE** para criar a preference.
4. Crie a preference → use `init_point` (Checkout Pro moderno) e **logue no checkout como o COMPRADOR de teste**.
5. **Cartão**: use um cartão de teste + nome do titular `APRO` (aprova) ou `OTHE` (recusa) + CPF `12345678909`. Parcelamento se testa escolhendo 2x/3x na própria tela do checkout.
6. **PIX**: gera QR de teste, mas **não há pagamento real**; aprove pelo saldo fictício / fluxo de conta de teste (limitação conhecida — ver §4).
7. **Webhook**: configure a URL de teste + pegue a **assinatura secreta** (secret) e valide o `x-signature`. Use o **simulador** no painel para disparar uma notificação.
8. **Estorno / pagamentos**: sempre envie `X-Idempotency-Key` (UUID v4) — obrigatório nas APIs de Payments e Refunds.

---

## 1. Credenciais: TESTE vs PRODUÇÃO

### O que são
Toda aplicação no Mercado Pago gera automaticamente **dois pares de credenciais** assim que é criada:

| | Credenciais de TESTE (Sandbox) | Credenciais de PRODUÇÃO |
|---|---|---|
| **Access Token** (backend) | prefixo `TEST-...` | prefixo `APP_USR-...` |
| **Public Key** (frontend) | prefixo `TEST-...` | prefixo `APP_USR-...` |
| Também inclui | — | Client ID, Client Secret |
| Ativação | nenhuma — disponível imediatamente | exige preencher dados do negócio (ramo, URL do site, aceite de termos, reCAPTCHA) |
| Movimenta dinheiro real? | Não (simulado) | Sim |

- **Public Key**: usada no frontend, identifica sua conta e cria elementos visuais (tokeniza cartão no client).
- **Access Token**: usado no backend para operações sensíveis (criar preference, consultar pagamento, estornar).

### Onde pegar no painel
`Suas integrações` → selecione a aplicação → menu à esquerda:
- **Produção → Credenciais de produção**
- **Testes → Credenciais de teste**

### Relação com "usuários de teste"
- As **credenciais de teste da SUA aplicação** servem para chamadas administrativas (ex.: criar usuários de teste via `POST /users/test`).
- Mas para **criar a preference que o comprador vai pagar**, a recomendação oficial é usar o **Access Token de TESTE do USUÁRIO DE TESTE VENDEDOR** (não o da sua conta real). Você loga no painel como o vendedor de teste, cria uma aplicação nele, e usa o token de teste dessa aplicação. Isso isola completamente o fluxo (vendedor de teste cobra → comprador de teste paga).

**Fontes:**
- https://www.mercadopago.com.br/developers/pt/docs/your-integrations/credentials
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/best-practices/credentials-best-practices/secure-credentials
- https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-test/go-to-production-requirements

---

## 2. Usuários de teste (test users / contas de teste)

### Por que são necessários
Você **não pode pagar uma cobrança sua com a sua própria conta** (vendedor = comprador é bloqueado). Por isso o MP fornece "contas de teste": réplicas de contas reais do Mercado Pago, sem dinheiro real, para simular o fluxo completo vendedor↔comprador.

### Tipos de conta
- **Vendedor (seller)**: configura a aplicação/credenciais e **cobra**. É o dono da preference.
- **Comprador (buyer)**: **paga** no checkout.
- **Integrador (integrator)**: só para modelos marketplace (opcional, não é o nosso caso).

> Recomendação: crie **no mínimo 1 vendedor e 1 comprador**.

### Como criar — via painel (recomendado)
`Suas integrações` → selecione a aplicação → **Contas de teste** → **+ Criar conta de teste**:
1. Escolha o país da operação (Brasil → não pode mudar depois).
2. Descrição identificadora.
3. Tipo (Vendedor / Comprador / Integrador).
4. (Opcional) adicione saldo fictício — útil para aprovar pagamentos sem cartão.
5. Aceite os termos → **Criar**.

Limites: até **15 contas de teste simultâneas** por aplicação. **Não há exclusão** atualmente. No login dessas contas, o MP fornece um **código de verificação de 6 dígitos** para autenticar o e-mail.

### Como criar — via API
Use o **Access Token de PRODUÇÃO da sua aplicação** (ou o de teste — a doc usa `APP_USR-...` no exemplo) no header `Authorization`:

```bash
curl -X POST 'https://api.mercadopago.com/users/test' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer APP_USR-8*...*64' \
  -d '{"site_id": "MLB", "description": "Vendedor de teste Iris Codex"}'
```

- `site_id`: **`MLB`** (Mercado Livre/Pago Brasil).
- Resposta: `{ id, nickname, password, email, site_status, site_id, date_created, date_last_updated }`.
- Guarde **email + password** — são as credenciais de login dessas contas no checkout e no painel.

### Qual Access Token usar para criar a PREFERENCE de teste
O **Access Token de TESTE do usuário de teste VENDEDOR**. Fluxo:
1. Logue no `mercadopago.com.br/developers` com o **email/senha do vendedor de teste**.
2. Crie uma aplicação nessa conta.
3. Pegue o **Access Token de teste** dela → é esse token que vai no backend para criar a preference.

> Gotcha confirmado na prática: **a conta COMPRADORA de teste também precisa de uma aplicação registrada** no painel de developers — sem isso, os pagamentos não funcionam corretamente no checkout.

**Fontes:**
- https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/accounts
- https://www.mercadopago.com.br/developers/pt/reference/test_user/_users_test/post
- https://dev.to/tadeubdev/integrando-mercado-pago-checkout-pro-com-contas-de-teste-problemas-reais-e-como-resolvi-343c

---

## 3. Cartões de teste

Use o número de um cartão de teste + os dados especiais do **titular** para forçar o resultado.

### Números de cartão (Brasil — MLB)

| Tipo | Bandeira | Número | CVV | Validade |
|---|---|---|---|---|
| Crédito | Mastercard | `5031 4332 1540 6351` | `123` | `11/30` |
| Crédito | Visa | `4235 6477 2802 5682` | `123` | `11/30` |
| Crédito | American Express | `3753 651535 56885` | `1234` | `11/30` |
| Débito | Elo | `5067 7667 8388 8311` | `123` | `11/30` |

> A validade `11/30` é a usada nos exemplos atuais da doc; qualquer data futura costuma funcionar, mas siga a da doc.

### Status forçado pelo NOME do titular + CPF
Coloque o "código" no campo **Nome do titular** e o CPF `12345678909`:

| Nome do titular | Resultado |
|---|---|
| `APRO` | **Aprovado** |
| `OTHE` | Recusado por erro geral |
| `CONT` | Pagamento **pendente** |
| `CALL` | Recusado — validação para autorizar |
| `FUND` | Recusado — valor insuficiente (saldo/limite) |
| `SECU` | Recusado — código de segurança (CVV) inválido |
| `EXPI` | Recusado — problema na data de validade |
| `FORM` | Recusado — erro no formulário |
| `CARD`,`INST`,`DUPL`,`LOCK`,`CTNA`,`ATTE`,`BLAC`,`UNSU`,`TEST` | Diversos cenários de recusa |

- **CPF**: `12345678909` (CPF de teste padrão).

### Como testar PARCELAMENTO (2x/3x sem juros) com cartão de teste
O parcelamento **não depende do cartão** — é uma propriedade da preference + da escolha no checkout:

1. Na **preference**, em `payment_methods`, garanta que o crédito não esteja excluído e configure `installments` (máximo de parcelas) e, se quiser, `default_installments`.
2. Quem define **se há juros** é a configuração de **"taxas/custo de parcelamento"** da conta vendedora (no Mercado Pago, "parcelamento sem juros" = vendedor assume o custo) — confirme isso na conta de teste vendedor.
3. No checkout, com um **cartão de CRÉDITO de teste + nome `APRO`**, **selecione 2x ou 3x** na tela. O pagamento aprovado retornará `installments: 2/3` e o detalhamento de juros (`installment_amount`, `total_paid_amount`).
4. Valide no webhook/consulta do pagamento se `installments` e `transaction_details.total_paid_amount` batem com o esperado (sem acréscimo = sem juros).

> Para o nosso caso (Iris Codex): replicar a regra do Asaas de "sem juros só no pacote grande, clamp server-side" — o clamp de `installments` deve ser feito na **criação da preference** no backend.

**Fontes:**
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/integration-test/test-purchases
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/integration-test/test-cards
- https://www.mercadopago.com.br/developers/pt/docs/checkout-api/additional-content/your-integrations/test/cards

---

## 4. Testar PIX em sandbox

**Limitação importante:** com credenciais de teste, o MP **gera o QR Code de PIX de teste, mas não há liquidação/pagamento real de PIX** — você não escaneia e paga de verdade num banco.

Formas de validar o fluxo PIX sem pagamento real:
- **Saldo fictício / "Account Balance"** na conta de teste: ao criar a conta de teste compradora, adicione saldo fictício; isso permite simular aprovação sem cartão e sem PIX real.
- **Confirmação manual de e-mail** da conta de teste pode ser necessária antes de operar.
- Para validar especificamente a **transição de status do PIX** (`pending` → `approved`), o fluxo confiável é: criar o pagamento PIX de teste, e usar os mecanismos de conta de teste / simulador de webhook (§5) para exercitar o handler de `approved`. **Não confie em "pagar o QR de teste" funcionando como em produção.**

> Conclusão prática para o Iris Codex: o **caminho crítico do PIX (gerar cobrança + processar webhook `approved` + creditar leituras)** deve ser validado via **simulador de webhook** e/ou conta com saldo fictício. O "pagar o QR" de verdade só é 100% testável em **produção** com valor real baixo.

**Fontes:**
- https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/accounts
- https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-configuration/integrate-with-pix
- https://www.mercadopago.com.br/developers/pt/blog/passo-a-passo-testar-meios-pagamento-negocio

---

## 5. Webhook em teste (notificações + x-signature)

### Configurar
`Suas integrações → [aplicação] → Webhooks → Configurar notificações`:
- **URL modo de teste**: para a fase de desenvolvimento (com credenciais de teste).
- **URL modo de produção**: para a integração ao vivo.
- Selecione os **tópicos** (eventos). Para o nosso caso: **`payment`** (e `orders` no Checkout Pro novo). Outros: `subscription_*`, `wallet_connect`, etc.
- Após salvar, o MP gera uma **assinatura secreta** (secret) **única por aplicação** e **separada por ambiente** (teste ≠ produção). Tem botão **Resetar** (sem expiração; renovar é opcional).

### Simular notificação (o "teste" do painel)
No painel de Webhooks há o **Simulador**: você escolhe o tipo de evento e um `data.id`, e o MP **dispara uma notificação real para a sua URL**. Use isso para exercitar o handler sem precisar de um pagamento de verdade. O painel também mostra o **histórico de eventos** (status de entrega, detalhes) depois de configurado.

### Validação do `x-signature` (HMAC-SHA256)
O MP envia o header `x-signature` no formato:
```
ts=1704908010,v1=618c85345248dd820d5fd456117c2ab2ef8eda45a0282ff693eac24131a5e839
```
E o header `x-request-id`.

**Passos de validação:**
1. **Separe o `x-signature` por vírgula** → obtenha `ts=<timestamp>` e `v1=<hash>`.
2. **Monte o manifest** (template exato, com `;` final):
   ```
   id:[data.id];request-id:[x-request-id];ts:[ts];
   ```
   - `[data.id]` = o `data.id` da notificação (query param `data.id` ou body). Se for alfanumérico, use minúsculo.
   - `[x-request-id]` = valor do header `x-request-id`.
   - `[ts]` = o `ts` extraído do `x-signature`.
3. **Calcule HMAC-SHA256** em **hexadecimal**, usando a **assinatura secreta (secret)** como **chave** e o `manifest` como **mensagem**.
4. **Compare** o hash calculado com o `v1`. Se igual → notificação legítima.

> **Teste vs Produção:** cada ambiente tem seu **próprio secret** em Suas integrações. Usar o secret de teste para validar webhook de produção (ou vice-versa) é uma causa comum de "assinatura inválida".

Exemplo Node (cru, sem SDK):
```js
import crypto from "node:crypto";

function validateMpSignature({ xSignature, xRequestId, dataId, secret }) {
  const parts = Object.fromEntries(
    xSignature.split(",").map((kv) => kv.split("=").map((s) => s.trim()))
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmac = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(v1));
}
```

**Fontes:**
- https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
- https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks
- https://www.mercadopago.com.pe/developers/en/news/2024/01/11/Webhooks-Notifications-Simulator-and-Secret-Signature

---

## 6. X-Idempotency-Key

### Obrigatório
O header **`X-Idempotency-Key` é OBRIGATÓRIO** nas APIs de **Payments** e **Refunds** (estornos). Garante que requisições duplicadas (retry, timeout, double-click) sejam reconhecidas e **apenas a primeira seja processada** — o servidor retorna a mesma resposta da original.

### Formato
- **UUID v4** é o recomendado (ex.: `550e8400-e29b-41d4-a716-446655440000`).
- Há limitação no valor: o formato `"prefixo" + "_"` **não é permitido**. Ex.: `payment192839qw8sd7db-2xx2s-23wds` é válido; algo com `_` no estilo prefixo, não.
- Mesma key → mesma resposta (idempotente). Key nova → nova operação.

### Onde aplicar no nosso fluxo
- **Criar pagamento** (`POST /v1/payments` ou `Order`): use uma key **determinística** por intenção de compra (ex.: derivada do `external_reference`/pedido) para que retries não criem cobrança dupla.
- **Estorno** (`POST /v1/payments/{id}/refunds`): a key garante que um retry não estorne duas vezes. O SDK gera uma UUID aleatória por padrão, mas pode ser customizada.
- **Criar preference**: não exige idempotency, mas pode ser usada.

**Fontes:**
- https://www.mercadopago.com.br/developers/en/news/2023/01/04/Idempotency-key-usage-will-be-mandatory
- https://www.mercadopago.com.co/developers/en/docs/checkout-api-payments/integration-configuration/other-payment-methods

---

## 7. SDK Node `mercadopago` (v2) vs REST puro

### Versão atual (2026)
- Pacote npm: **`mercadopago`** — versão **3.1.0** (jun/2026). Requer **Node 18+**.
- Há também `@mercadopago/sdk-js` (SDK de **frontend/browser** para tokenizar cartão / Bricks) — diferente do SDK de backend.

### Instalação e init
```bash
npm install --save mercadopago
```
```js
import { MercadoPagoConfig, Preference, Payment, PaymentRefund } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN, // TEST-... em sandbox, APP_USR-... em prod
  options: {
    timeout: 5000,
    idempotencyKey: "<opcional-default-global>",
  },
});
```

### Métodos principais
```js
// Criar preference (Checkout Pro)
const preference = new Preference(client);
const pref = await preference.create({
  body: {
    items: [{ title: "Pacote grande", quantity: 1, unit_price: 1191, currency_id: "BRL" }],
    payment_methods: { installments: 3 }, // teto de parcelas (clamp server-side aqui)
    external_reference: "pedido_123",
    notification_url: "https://iriscodex.com/api/mp/webhook",
    back_urls: { success: "...", failure: "...", pending: "..." },
  },
});
// usar pref.init_point (produção) — ver §8

// Consultar pagamento (no webhook)
const payment = new Payment(client);
const p = await payment.get({ id: paymentId });

// Estornar (idempotência por requestOptions)
const refund = new PaymentRefund(client);
await refund.create({
  payment_id: paymentId,
  requestOptions: { idempotencyKey: crypto.randomUUID() },
});
```
Idempotência por chamada: `client`-level (`options.idempotencyKey`) ou por request (`requestOptions: { idempotencyKey }`). Prefira **por request** para refunds/payments.

### Prós e contras vs `fetch` cru

| | SDK `mercadopago` v2 | REST cru (`fetch`) |
|---|---|---|
| Tipagem TS | Sim (tipos inclusos) | Você escreve os tipos |
| Idempotency-Key | Gerencia via `requestOptions` | Você seta o header manualmente |
| Validação `x-signature` | Não automatiza no webhook server-side (a doc cita SDKs ajudando, mas o handler costuma ser manual) | Manual (já temos o snippet, §5) |
| Tamanho/deps | +1 dependência | Zero deps |
| Acompanhar mudanças de API | SDK abstrai | Você acompanha endpoints |
| Controle fino / Next.js Edge | Menos previsível (depende do runtime/fetch interno) | Total controle, ótimo em route handlers |

**Recomendação para o Iris Codex:**
- O fluxo é **pequeno e bem definido** (criar preference + consultar payment + estornar + validar webhook). O **REST cru com `fetch`** dá controle total, zero dependência e casa com o padrão já existente (integração Asaas é via fetch). A validação de `x-signature` é manual de qualquer jeito.
- **Mas** o SDK v2 é leve, tipado e cuida do header de idempotência — vale usar **apenas o SDK de backend para criar preference/payment/refund** se quisermos menos boilerplate, mantendo o **webhook handler manual** (fetch + HMAC).
- **Sugestão concreta:** começar com **REST cru** (consistência com Asaas + controle), encapsulado em `lib/payments/mercadopago.ts`. Migrar para o SDK só se o boilerplate de tipos/idempotência incomodar.

**Fontes:**
- https://github.com/mercadopago/sdk-nodejs
- https://www.npmjs.com/package/mercadopago
- https://deepwiki.com/mercadopago/sdk-nodejs/5-preference-api

---

## 8. Gotchas (armadilhas que custam horas)

1. **Confundir token de teste e de produção.** `TEST-...` só funciona com contas/cartões de teste; `APP_USR-...` cobra de verdade. Erro silencioso comum: criar preference com token de prod e tentar pagar com cartão de teste (recusa) — ou vice-versa.
2. **`init_point` vs `sandbox_init_point`.** A preference retorna ambos. No Checkout Pro **moderno**, a prática atual é usar **`init_point`** mesmo em teste (o ambiente é definido pelo **token de teste** usado para criar a preference, não pela URL). O `sandbox_init_point` é legado e pode levar a comportamento inconsistente — confirme qual o checkout abre o fluxo de teste corretamente para a sua conta. Teste os dois se o pagamento não aparecer.
3. **Pagar com a própria conta não funciona.** Vendedor ≠ comprador é obrigatório → use usuários de teste.
4. **O comprador precisa LOGAR no checkout** com a conta de teste compradora (email + senha gerados). Sem login, o fluxo de pagamento de teste não completa direito.
5. **A conta compradora de teste também precisa de uma aplicação** registrada no painel de developers (gotcha confirmado na prática).
6. **Secret do webhook é por ambiente.** Validar `x-signature` de produção com o secret de teste = "assinatura inválida". Guarde os dois separados (env vars distintas).
7. **PIX de teste não liquida.** Não dá para "pagar o QR" de verdade em sandbox — use saldo fictício / simulador de webhook para exercitar `approved` (§4).
8. **Idempotency-Key obrigatório** em payments/refunds e **não pode** ter formato `"prefixo_"`. Use UUID v4.
9. **Limites do sandbox:** até **15 contas de teste** por aplicação, **sem exclusão**; código de **6 dígitos** para verificar e-mail no login das contas de teste; Bricks não suporta contas de teste para teste de integração (não é o nosso caso — usamos Checkout Pro).
10. **`site_id` = `MLB`** para Brasil em todas as chamadas relevantes.

**Fontes:**
- https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/accounts
- https://dev.to/tadeubdev/integrando-mercado-pago-checkout-pro-com-contas-de-teste-problemas-reais-e-como-resolvi-343c
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/integration-test/test-purchases

---

## Apêndice — comandos curl úteis

```bash
# 1) Criar usuário de teste VENDEDOR (token da sua app; site MLB)
curl -X POST 'https://api.mercadopago.com/users/test' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer APP_USR-...' \
  -d '{"site_id":"MLB","description":"Vendedor teste Iris Codex"}'

# 2) Criar usuário de teste COMPRADOR
curl -X POST 'https://api.mercadopago.com/users/test' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer APP_USR-...' \
  -d '{"site_id":"MLB","description":"Comprador teste Iris Codex"}'

# 3) Criar preference (use o TEST-... do VENDEDOR de teste)
curl -X POST 'https://api.mercadopago.com/checkout/preferences' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer TEST-...(vendedor de teste)' \
  -d '{
    "items":[{"title":"Pacote grande","quantity":1,"unit_price":1191,"currency_id":"BRL"}],
    "payment_methods":{"installments":3},
    "external_reference":"pedido_123",
    "notification_url":"https://iriscodex.com/api/mp/webhook"
  }'
# -> abra "init_point" da resposta e pague logado como COMPRADOR de teste

# 4) Consultar pagamento (no webhook)
curl -X GET 'https://api.mercadopago.com/v1/payments/{PAYMENT_ID}' \
  -H 'Authorization: Bearer TEST-...'

# 5) Estornar com idempotência
curl -X POST 'https://api.mercadopago.com/v1/payments/{PAYMENT_ID}/refunds' \
  -H 'Authorization: Bearer TEST-...' \
  -H 'X-Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000' \
  -H 'Content-Type: application/json' -d '{}'
```
