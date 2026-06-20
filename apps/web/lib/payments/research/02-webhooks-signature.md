# Mercado Pago — Webhooks/Notificações + Validação da Assinatura `x-signature`

> Documento de referência técnico para o Iris Codex (SaaS, Next.js App Router, Node runtime, Supabase service-role).
> No nosso uso o webhook do MP é a **única** forma de creditar o saldo do cliente após o pagamento.
> Pesquisa: junho/2026. Fontes oficiais `mercadopago.com.br/.com.ar/developers`. O algoritmo de assinatura foi confirmado em ≥2 fontes (doc oficial + SDK community), por ser o ponto mais crítico.

---

## 0. TL;DR — o modelo mental (MP ≠ Asaas)

| | **Asaas (atual)** | **Mercado Pago (novo)** |
|---|---|---|
| Corpo do webhook | objeto `payment` INTEIRO | apenas um **aviso**: `{ type, action, data: { id } }` |
| Para saber o valor/status | já vem no corpo | **GET `/v1/payments/{data.id}`** na API |
| Correlação com a nossa row | id no corpo | `external_reference` (UUID nosso) no payment buscado |
| Autenticidade | token no header / segredo | **HMAC SHA256** sobre manifest com `x-signature` |

Fluxo MP no Iris Codex:

```
1. Cliente paga
2. MP → POST na nossa notification_url  (corpo: {type:"payment", data:{id:"123"}}, query: ?data.id=123&type=payment)
3. Validar x-signature (HMAC SHA256)  ← rejeitar com 401 se falhar
4. GET https://api.mercadopago.com/v1/payments/123  (Bearer access_token)
5. Ler payment.external_reference → achar a nossa row (UUID)
6. payment.status === "approved" → creditar (idempotente, dedup por payment.id)
7. Responder 200/201 RÁPIDO (< ~22s)
```

---

## 1. Formato da notificação Webhook

Fontes:
- https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
- https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
- https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/additional-info

### 1.1 Método e entrega
- Sempre **HTTP POST** para a `notification_url` configurada.
- Vem com **corpo JSON** E **query params** (`?data.id=...&type=...`). A query é o que se usa na assinatura.

### 1.2 Corpo JSON (exemplo oficial)

```json
{
  "id": 12345,
  "live_mode": true,
  "type": "payment",
  "date_created": "2015-03-25T10:04:58.396-04:00",
  "user_id": 44444,
  "api_version": "v1",
  "action": "payment.created",
  "data": {
    "id": "999999999"
  }
}
```

Campos:
- `type` — o **tópico** do evento. Para nós interessa `"payment"` (e possivelmente `"merchant_order"`). Outros tópicos do painel: `orders`, `subscription_authorized_payment`, `subscription_preapproval`, `topic_merchant_order_wh`, `topic_chargebacks_wh`, `point_integration_wh`, etc.
- `action` — a ação específica: `payment.created`, `payment.updated`. **Importante:** o MP pode mandar várias notificações para o mesmo pagamento (created → updated). Ver §5 idempotência.
- `data.id` — **o ID do recurso** (o payment id). É **isto** que você usa no GET da API e no manifest da assinatura. **NÃO** é o `id` raiz do envelope (esse é o id da *notificação*).
- `live_mode` — `true` em produção, `false` em teste.
- `user_id` — o collector (vendedor) MP.

> ⚠️ Atenção à dualidade: `id` (raiz) = id da notificação; `data.id` = id do PAGAMENTO. Use **sempre `data.id`**.

### 1.3 Webhooks (v2) × IPN (legado)

Fonte: https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/additional-content/your-integrations/notifications/ipn

- **IPN** é o sistema legado. URL no formato `?topic=payment&id=123456789`. Tópicos: `payment`, `chargebacks`, `merchant_order`, `point_integration_ipn`.
- Citação oficial: *"IPN notifications will be discontinued. Additionally, despite receiving the `x-Signature` header, they do not allow validation through the secret key to confirm they were sent by Mercado Pago."*
- **Decisão para o Iris Codex:** usar **Webhooks (v2)**, pois só ele permite validar autenticidade via `secret`/HMAC. Não usar IPN.
- Note a diferença de param: IPN usa `topic`+`id`; Webhooks v2 usa `type`+`data.id`.

---

## 2. Validação `x-signature` — PASSO A PASSO EXATO ⭐ (ponto mais crítico)

Fontes (confirmação cruzada):
- https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
- https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/additional-info
- https://github.com/mercadopago/sdk-nodejs/discussions/318 (community, casos reais de falha prod×teste)

### 2.1 Headers recebidos

```
x-signature:  ts=1704908010,v1=618c85345248dd820d5fd456117c2ab2ef8eda45a0282ff693eac24131a5e839
x-request-id: bb56a2f1-6aae-46ac-982e-9dcd3581d08e
```

- `x-signature` tem dois campos separados por vírgula:
  - `ts` = timestamp (usado no manifest E você pode usá-lo para rejeitar notificações velhas/replay).
  - `v1` = o HMAC SHA256 em hex que você precisa reproduzir.
- `x-request-id` = entra no manifest.

### 2.2 O manifest (template) — formato EXATO

```
id:<data.id>;request-id:<x-request-id>;ts:<ts>;
```

Forma literal documentada:

```
id:[data.id];request-id:[x-request-id];ts:[ts];
```

Exemplo concreto preenchido:

```
id:123456;request-id:bb56a2f1-6aae-46ac-982e-9dcd3581d08e;ts:1742505638683;
```

Regras do manifest:
- Atenção ao **`;` final** (cada par termina com `;`, inclusive o último).
- **Se algum dos valores não estiver presente na notificação, REMOVA aquele segmento inteiro** do template (não deixe `request-id:;`). Ex.: sem `x-request-id` → `id:123456;ts:1742505638683;`.
- `<data.id>` deve vir da **query string** (`req.nextUrl.searchParams.get("data.id")`), não do corpo.
- **Lowercase para data.id alfanumérico:** quando o `data.id` for alfanumérico (alguns recursos retornam id com letras), o valor deve ser passado em **minúsculas** no manifest. Para payment id numérico isso é indiferente, mas trate sempre como string e em lowercase por segurança.

### 2.3 O algoritmo

```
hmac = HMAC_SHA256(key = secret, message = manifest)
hex  = hmac.hexdigest()
válido  ⇔  hex === v1   (comparação em tempo constante)
```

- `secret` = **a "assinatura secreta" do webhook**, obtida no painel: *"selecione a aplicação em Suas integrações, clique em **Webhooks > Configurar notificação** e revele a chave gerada."* (https://www.mercadopago.com.br/developers/panel/app)
- **NÃO** é o Access Token. É uma chave separada, por aplicação, distinta entre **modo teste e produção** — esta é a causa #1 de "valida em teste e falha em prod" (§7).

### 2.4 Pseudo-código / Node (`node:crypto`, sem SDK)

```ts
// app/api/webhooks/mercadopago/route.ts  (Node runtime!)
import crypto from "node:crypto";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs"; // node:crypto exige Node runtime, não Edge

function isValidSignature(req: Request, url: URL): boolean {
  const xSignature = req.headers.get("x-signature") ?? "";
  const xRequestId = req.headers.get("x-request-id") ?? "";
  // data.id SEMPRE da query string:
  const dataId = (url.searchParams.get("data.id") ?? "").toLowerCase();

  // 1. parse do x-signature: "ts=...,v1=..."
  let ts = "", v1 = "";
  for (const part of xSignature.split(",")) {
    const [k, v] = part.split("=").map((s) => s.trim());
    if (k === "ts") ts = v;
    if (k === "v1") v1 = v;
  }
  if (!ts || !v1 || !dataId) return false;

  // 2. montar o manifest (remover segmentos ausentes; manter ';' final)
  let manifest = `id:${dataId};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;

  // 3. HMAC SHA256 hex com o SECRET do webhook (prod!)
  const secret = process.env.MP_WEBHOOK_SECRET!;
  const computed = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  // 4. comparar em tempo constante
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);

  // (opcional anti-replay: rejeitar se Math.abs(Date.now() - Number(ts)) > 5min)
}
```

> Alternativa oficial com SDK (`mercadopago` ≥ v2): `WebhookSignatureValidator.validate({ xSignature, xRequestId, dataId, secret })` lança `InvalidWebhookSignatureError`. Mas, como já temos `node:crypto`, a verificação manual é trivial e sem dependência extra.

---

## 3. Buscar o pagamento após a notificação

Fonte: https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-pro/get-payment/get

```
GET https://api.mercadopago.com/v1/payments/{data.id}
Authorization: Bearer <ACCESS_TOKEN>   ← token de PRODUÇÃO da aplicação
```

Campos do retorno relevantes para creditar:

| Campo | Uso |
|---|---|
| `id` | id do pagamento → **chave de idempotência** (§5) |
| `status` | decide creditar/estornar (§4) |
| `status_detail` | detalhe (`accredited`, `cc_rejected_*`, etc.) |
| `external_reference` | **UUID da nossa row** → correlação ⭐ |
| `transaction_amount` | valor pago (gravar, igual fazemos no Asaas) |
| `currency_id` | ex. `"BRL"` |
| `payment_method_id` | ex. `"visa"`, `"pix"`, `"master"` |
| `payment_type_id` | ex. `"credit_card"`, `"bank_transfer"` (PIX), `"ticket"` |
| `installments` | nº de parcelas (relevante p/ nosso pacote grande 3x) |
| `date_approved` | data de aprovação (null até aprovar) |
| `transaction_details.net_received_amount` | líquido após taxas |

> **Correlação:** definimos `external_reference = <UUID da nossa row>` na CRIAÇÃO do pagamento/preference. No webhook, lemos `payment.external_reference` para achar exatamente qual cobrança creditar. (É o análogo do que hoje resolvemos pelo grupo `installment` no Asaas.)

---

## 4. Mapeamento status do payment → ação

Fontes:
- https://mercadopago.github.io/sdk-java/com/mercadopago/resources/payment/PaymentStatus.html
- https://www.mercadopago.com.ar/developers/en/docs/checkout-api-orders/notifications

| `status` | Significado | Ação no Iris Codex |
|---|---|---|
| `approved` | pago e **creditado** pelo MP | ✅ **CREDITAR** (idempotente) |
| `authorized` | autorizado mas **não capturado** (2-step) | ⏳ não creditar ainda; só ao virar `approved`. Para nós, usar captura automática → vem direto `approved`. |
| `in_process` | em análise/revisão | ⏳ aguardar próxima notificação |
| `pending` | aguardando (ex. PIX não pago, boleto) | ⏳ aguardar |
| `rejected` | recusado | ❌ não creditar (registrar motivo via `status_detail`) |
| `cancelled` | cancelado (timeout/parte) | ❌ não creditar / encerrar |
| `refunded` | estornado (total ou parcial) | 🔻 **REVERTER crédito** (se já creditado) |
| `charged_back` | chargeback (contestação do cartão) | 🔻 **REVERTER crédito** + flag risco |

`status_detail` relevantes:
- `accredited` → confirma `approved` (creditar).
- `cc_rejected_insufficient_amount`, `cc_rejected_bad_filled_security_code`, `cc_rejected_bad_filled_date`, `cc_rejected_call_for_authorize`, `cc_rejected_card_disabled`, `cc_rejected_duplicated_payment` → motivos de recusa (cartão) — útil para UX/log, não credita.
- `pending_contingency` / `pending_review_manual` → fica em `in_process`/`pending`.

> Regra prática: **credita só `approved`**; **reverte em `refunded`/`charged_back`**; todo o resto é aguardar ou ignorar.

---

## 5. Idempotência (não creditar duas vezes)

Fonte (retries/timeout IPN, aplicável): https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/additional-content/your-integrations/notifications/ipn

- **O MP REENVIA notificações.** Você recebe múltiplas para o mesmo pagamento:
  - `payment.created` e depois `payment.updated` (mudança de status);
  - retries se você não responder 200/201 a tempo (**retry a cada 15 min** até confirmar; receptor deve responder em **< ~22s**).
- Logo: **NUNCA** assuma "1 notificação = 1 evento único".

**Estratégia de dedupe (recomendada):**
1. Chave natural = **`payment.id`** (do GET, não do envelope). Combinada com o **status final**.
2. Tabela `mp_processed_events` (ou reaproveitar o padrão idempotente do Asaas): `UNIQUE (payment_id, status)` — assim `approved` só credita 1×; `refunded` só reverte 1×.
3. Antes de creditar: `INSERT ... ON CONFLICT DO NOTHING`; se conflito → já processado → **responder 200 e sair** (não recreditar).
4. O crédito em si deve ser uma transação atômica no banco (service-role): checar saldo/ledger + inserir crédito + marcar evento, tudo ou nada.

> O `x-request-id`/`id` da notificação também servem de dedupe, mas o par `(payment.id, status)` é mais robusto porque sobrevive a retries que mudam o request-id. O webhook idempotente que já protege o parcelado do Asaas é o modelo a seguir.

**Resposta HTTP:** responda **200 (ou 201)** o mais rápido possível. Se o processamento for pesado, valide+enfileire e responda 200; o crédito pode ser concluído de forma assíncrona. Erros/exceptions → deixe o MP reenviar (retorne 5xx só se quiser retry; assinatura inválida → 401).

---

## 6. Configuração da `notification_url` e teste no painel

Fontes:
- https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
- https://www.mercadopago.com.ar/developers/en/news/2024/08/19/Configuring-and-keeping-track-of-your-notifications-is-now-easier

Dois modos de configurar:
1. **Por aplicação (painel) — recomendado p/ nós:** *Suas integrações → [app] → Webhooks → Configurar notificações.* Define-se **URLs separadas para teste e produção** e seleciona-se os **eventos** (marcar `Pagamentos`). É aqui que você **revela a "assinatura secreta"** (o `secret` do §2.3) — uma para teste, outra para produção.
2. **Por preference/pagamento:** passar `notification_url` no momento de criar a preference/pagamento (sobrescreve, útil para roteamento por cobrança). Pode incluir query própria, ex. `?source_news=webhooks`.

**Simular/testar:** o painel tem um botão **"Simular notificação"** na tela de configuração — escolhe o tópico (ex. `payment`), informa um `data.id` e dispara um POST de teste para a sua URL (já assinado com o secret de teste). Use para validar end-to-end o handler antes de produção.

---

## 7. Gotchas / pitfalls reais de `x-signature` ⚠️

Confirmados em doc oficial + casos reais (sdk-nodejs discussion #318):

1. **Secret errado (teste × produção).** Causa #1 de "valida em teste, falha em prod". O `secret` é **por aplicação E por modo**. Em prod, use o secret de produção (revelado no painel em modo produção). No nosso caso isso casa com a memória "Vercel env TODAS Sensitive" → garantir `MP_WEBHOOK_SECRET` (prod) setado no Vercel, não o de teste.
2. **Usar `id` do corpo em vez de `data.id` da query.** O manifest exige o `data.id` da **query string**. Pegar o `id` raiz do envelope (= id da notificação) gera HMAC errado.
3. **Manifest mal montado:** faltar o **`;` final**, espaços extras, ordem trocada (`id` → `request-id` → `ts`), ou **não remover** o segmento `request-id` quando o header `x-request-id` está ausente (deixar `request-id:;` quebra). Também: alfanumérico **não convertido para lowercase**.

Outros pontos de atenção:
- **Body parsing no Next.js:** ler `data.id` da query (`req.nextUrl.searchParams`) — não depender do body parseado para a assinatura.
- **Runtime Node, não Edge:** `node:crypto` exige `export const runtime = "nodejs"` no route handler.
- **Comparação em tempo constante** (`crypto.timingSafeEqual`) em vez de `===` de strings.
- **Anti-replay opcional:** rejeitar se `ts` for muito antigo (> 5 min) para mitigar replay.

---

## Fontes (URLs)

- Webhooks (oficial, EN): https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
- Webhooks (oficial, PT): https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
- Webhooks (oficial, AR/EN — exemplo x-signature): https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks
- Additional info notificações: https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/additional-info
- IPN (legado, x-signature não validável): https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/additional-content/your-integrations/notifications/ipn
- GET payment (campos): https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-pro/get-payment/get
- Payment status (SDK Java enum): https://mercadopago.github.io/sdk-java/com/mercadopago/resources/payment/PaymentStatus.html
- Notificações Checkout API Orders (status): https://www.mercadopago.com.ar/developers/en/docs/checkout-api-orders/notifications
- Painel novo de notificações: https://www.mercadopago.com.ar/developers/en/news/2024/08/19/Configuring-and-keeping-track-of-your-notifications-is-now-easier
- Caso real x-signature prod×teste (SDK Node #318): https://github.com/mercadopago/sdk-nodejs/discussions/318
- Configure payment notifications: https://www.mercadopago.com.co/developers/en/docs/checkout-pro/payment-notifications
