# Mercado Pago — Checkout Pro / Preferences API (mercado: Brasil)

> Documento de referência técnica para a integração de pagamentos do **Iris Codex**.
> Foco: criar uma *preference* no servidor → redirecionar o cliente pro checkout hospedado (`init_point`) → pagar PIX/cartão → MP redireciona de volta (`back_urls`) e notifica (`notification_url`).
> Stack-alvo: Next.js App Router, server actions, runtime Node, `fetch`/REST direto (sem SDK). Mercado pt-BR, BRL.
> Verificado em junho/2026 contra fontes oficiais `mercadopago.com.br/.ar/.co/developers`. Onde a doc oficial é renderizada por JS e não retorna campos via fetch, cruzei com versões `.md` estáticas, com o reference em domínios espelho e com issues/discussions oficiais do GitHub do MP.

---

## 0. TL;DR do nosso fluxo

1. **POST** `https://api.mercadopago.com/checkout/preferences` com `Authorization: Bearer <ACCESS_TOKEN>`.
2. Corpo: `items` (BRL), `external_reference` (UUID da nossa row pendente), `back_urls` + `auto_return`, `notification_url`, `payment_methods` (limita parcelas), `statement_descriptor`, `expires`+janela.
3. Resposta: `id`, `init_point` (produção), `sandbox_init_point` (teste). Redireciona o cliente pro `init_point`.
4. Cliente paga. MP chama o `notification_url` (webhook `payment.created`/`payment.updated`) → fazemos `GET /v1/payments/{id}` → o objeto payment traz `external_reference` → casamos com a row pendente e creditamos.

---

## 1. Endpoint POST /checkout/preferences — corpo completo

**Endpoint:** `POST https://api.mercadopago.com/checkout/preferences`
**Auth:** header `Authorization: Bearer <ACCESS_TOKEN>` (token da conta MP, produção ou teste).
**Content-Type:** `application/json`.

Fontes:
- Reference: https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-pro/preferences/create-preference/post
- Reference (espelho .co, mesmo schema): https://www.mercadopago.com.co/developers/en/reference/preferences/_checkout_preferences/post
- Guia de personalização (campos): https://www.mercadopago.com.br/developers/en/docs/checkout-bricks/wallet-brick/advanced-features/preferences

### 1.1 `items[]` (obrigatório)

Array de produtos. Cada item:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | identificador do item no nosso sistema (opcional, mas útil) |
| `title` | string | nome do produto — aparece no checkout |
| `description` | string | descrição |
| `picture_url` | string (URL) | imagem do produto (opcional) |
| `category_id` | string | categoria MP (ex.: `services`, `virtual_goods`); opcional |
| `quantity` | integer | quantidade |
| `currency_id` | string | **`"BRL"`** no Brasil |
| `unit_price` | float | preço unitário |

> O valor total da preference = soma de `quantity * unit_price`. Para nossos pacotes, o mais simples é **1 item** com `quantity: 1` e `unit_price` = preço do pacote.

### 1.2 `payer` (opcional, recomendado)

| Campo | Tipo | Notas |
|---|---|---|
| `name` | string | nome |
| `surname` | string | sobrenome |
| `email` | string | e-mail do cliente — pré-preenche o checkout |
| `phone` | object | `{ area_code, number }` |
| `identification` | object | `{ type, number }` — no Brasil `type: "CPF"`, `number: "<cpf só dígitos>"` |
| `address` | object | `{ street_name, street_number, zip_code }` |

> Pré-preencher `payer.email` + `identification` (CPF) reduz atrito e é relevante pra PIX/cartão e emissão fiscal posterior.

### 1.3 `back_urls` (obrigatório se usar `auto_return`)

```json
"back_urls": {
  "success": "https://app.iriscodex.com/billing/retorno/sucesso",
  "pending": "https://app.iriscodex.com/billing/retorno/pendente",
  "failure": "https://app.iriscodex.com/billing/retorno/falha"
}
```

- Três URLs por status do pagamento.
- **MP devolve por GET nos back_urls os parâmetros** `payment_id`, `status`, `external_reference` e `merchant_order_id` — dá pra exibir confirmação imediata, **mas o crédito definitivo deve vir do webhook** (back_url não é confiável: usuário pode fechar a aba).

Fonte: https://www.mercadopago.com.br/developers/en/docs/checkout-pro/configure-back-urls.md

### 1.4 `auto_return`

- Valores: **`"approved"`** (redireciona automaticamente quando aprovado) ou `"all"`.
- Redirect automático em até ~40s após aprovação.
- **Exige que `back_urls.success` esteja definido** (senão erro `invalid_auto_return` / "auto_return invalid. back_url.success must be defined").

Fonte: https://www.mercadopago.com.br/developers/en/docs/checkout-pro/configure-back-urls.md ·
issue oficial demonstrando o erro: https://github.com/odoo/odoo/issues/213287

### 1.5 `external_reference` (CRÍTICO pra nós)

- String livre. É o nosso identificador de correlação.
- **Coloque aqui o UUID da row pendente** (`billing_orders.id` ou equivalente).
- Propaga até o objeto `payment` e até os back_urls (ver §4).

### 1.6 `notification_url` (webhook)

- URL HTTPS pública que recebe as notificações de pagamento (ex.: `https://app.iriscodex.com/api/webhooks/mercadopago`).
- Pode levar querystring própria (ex.: `?source=preference`).

### 1.7 `statement_descriptor` (fatura)

- String que aparece na **fatura do cartão** do comprador (varia conforme a bandeira).
- Use algo curto e reconhecível, ex.: `"IRISCODEX"`.

Fonte: https://www.mercadopago.com.br/developers/en/docs/checkout-bricks/wallet-brick/advanced-features/preferences

### 1.8 Expiração da preference

Dois conceitos distintos — não confundir:

| Campo | O que controla |
|---|---|
| `expires` (boolean) + `expiration_date_from` + `expiration_date_to` | janela de validade **da preference** (link do checkout). Fora da janela o link não abre. |
| `date_of_expiration` | prazo do **meio de pagamento offline/PIX** (boleto/PIX). Ex.: até quando o QR PIX é pagável. |

- Formato ISO 8601: `yyyy-MM-dd'T'HH:mm:ssz` → ex.: `"2026-06-20T23:59:59.000-03:00"` (note o offset `-03:00` do Brasil).
- Recomendação oficial: deixar `date_of_expiration` com folga (≥ ~3 dias / ao menos algumas horas) porque há atraso de processamento de até ~2h em alguns métodos.
- Se o pagamento cair **após** a expiração, o valor é estornado pra conta MP do pagador.

Fontes:
- https://www.mercadopago.com.br/developers/en/docs/checkout-pro/additional-settings/expiration-date
- https://www.mercadopago.com.br/developers/en/docs/checkout-bricks/wallet-brick/advanced-features/preferences

### 1.9 `metadata` (opcional)

- Objeto JSON livre que **acompanha a preference e propaga pro payment**. Bom pra carregar dados extras de correlação (ex.: `{ "therapist_id": "...", "package_sku": "grande" }`).
- Use como **reforço** do `external_reference`, não substituto.

### 1.10 `binary_mode` (opcional)

- `true` → o pagamento só assume `approved` ou `rejected` (sem estado `in_process`/`pending`).
- Trade-off oficial: simplifica o fluxo, **mas reduz a taxa de aprovação** (pendentes/em-análise viram rejeitados). Para pacotes pré-pagos com cartão, normalmente **deixar `false`** (default) e tratar `pending` é mais seguro pra conversão.

Fonte: https://www.mercadopago.com.br/developers/en/docs/checkout-bricks/wallet-brick/advanced-features/preferences

---

## 2. `payment_methods` — limitar parcelas e excluir métodos

Objeto `payment_methods` dentro da preference:

| Campo | Tipo | Efeito |
|---|---|---|
| `installments` | integer | **máximo de parcelas** oferecidas nesta preference |
| `default_installments` | integer | nº de parcelas pré-selecionado no checkout |
| `excluded_payment_methods` | array `[{ "id": "..." }]` | remove **bandeiras/métodos específicos** (ex.: `master`, `visa`) |
| `excluded_payment_types` | array `[{ "id": "..." }]` | remove **tipos inteiros** de pagamento |
| `default_payment_method_id` | string | método pré-selecionado (opcional) |

Fontes:
- https://www.mercadopago.com.co/developers/en/reference/preferences/_checkout_preferences/post
- https://www.mercadopago.com.br/developers/en/docs/checkout-bricks/wallet-brick/advanced-features/preferences

### 2.1 Limitar parcelas POR preference (nosso caso)

`installments` = teto de parcelas **daquela preference**. Como criamos uma preference por compra, basta setar por pacote:

- Pacote pequeno/demais → `"installments": 1` (à vista).
- Pacote médio → `"installments": 2`.
- Pacote grande → `"installments": 3`.

```json
"payment_methods": {
  "installments": 3,
  "default_installments": 1
}
```

> `installments` é o **máximo**; o cliente ainda pode escolher menos. `default_installments: 1` evita pré-selecionar parcelado.

### 2.2 IDs de `excluded_payment_types` (pra oferecer SÓ um método)

Tipos comuns no Brasil:
- `credit_card` — cartão de crédito
- `debit_card` — cartão de débito
- `bank_transfer` — **PIX** entra aqui (transferência bancária)
- `ticket` — boleto/pagamento em lotérica
- `account_money` — saldo em conta MP

**Oferecer SÓ PIX** (excluir o resto):
```json
"payment_methods": {
  "excluded_payment_types": [
    { "id": "credit_card" },
    { "id": "debit_card" },
    { "id": "ticket" }
  ]
}
```

**Oferecer SÓ cartão** (excluir PIX/boleto):
```json
"payment_methods": {
  "installments": 3,
  "default_installments": 1,
  "excluded_payment_types": [
    { "id": "bank_transfer" },
    { "id": "ticket" }
  ]
}
```

> ⚠️ Confirme os IDs exatos em produção via `GET /v1/payment_methods` (reference: https://www.mercadopago.com.ar/developers/en/reference/payment_methods/_payment_methods/get). O ID textual do PIX como *método* costuma ser `"pix"`, mas o **tipo** é `bank_transfer` — para excluir PIX por completo, exclua o **tipo** `bank_transfer` (mais robusto que excluir por method id).

---

## 3. Resposta da criação: `id`, `init_point`, `sandbox_init_point`

```json
{
  "id": "1234567890-abc...",
  "init_point": "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=1234567890-abc...",
  "sandbox_init_point": "https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=1234567890-abc..."
}
```

| Campo | Quando usar |
|---|---|
| `id` | ID da preference. Guarde na row pendente (correlação extra + permite `PUT` depois). |
| `init_point` | **URL de produção** (`www.mercadopago.com.br`). É pra onde redirecionamos o cliente real. |
| `sandbox_init_point` | **URL de teste** (`sandbox.mercadopago.com.br`). Usar só com credenciais/contas de teste pra simular o fluxo. |

Regra prática: **token de produção → use `init_point`; token de teste → use `sandbox_init_point`.** Não misturar (token de teste com `init_point` não fecha pagamento real).

Fontes:
- discussion oficial sandbox: https://github.com/mercadopago/sdk-js/discussions/60
- reference create-preference (response): https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-pro/preferences/create-preference/post

---

## 4. Propagação do `external_reference` até o payment (correlação no webhook)

O `external_reference` definido na preference aparece em **três** lugares:

1. **Nos back_urls** (GET): `?payment_id=...&status=approved&external_reference=<UUID>&merchant_order_id=...`
   (Fonte: https://www.mercadopago.com.br/developers/en/docs/checkout-pro/configure-back-urls.md)
2. **No objeto `payment`** retornado por `GET https://api.mercadopago.com/v1/payments/{id}` — campo `external_reference`.
   (Fonte: https://www.mercadopago.com.br/developers/en/reference/payments/_payments_search/get e get-payment)
3. **No `merchant_order`** associado.

### Fluxo de correlação (o que implementamos)

1. Recebe webhook (ver §6) com `data.id` = ID do payment.
2. `GET /v1/payments/{data.id}` com Bearer token.
3. Lê do payment: `status` (`approved`/`pending`/`rejected`), `status_detail` (ex.: `accredited`), `transaction_amount`, `external_reference`, `metadata`.
4. Casa `external_reference` com a row pendente → credita **idempotentemente** (mesmo `payment.id` não credita duas vezes).

> O `payment` também traz `metadata` (se enviado na preference) — fonte secundária de correlação.

---

## 5. Headers e autenticação

### 5.1 Autenticação
- `Authorization: Bearer <ACCESS_TOKEN>` em **todas** as chamadas (criar preference e `GET /v1/payments`).
- Token vem de *Suas integrações* → credenciais de **produção** ou **teste**.
- **Nunca** expor o access token no client; a preference é criada no **server action / route handler (runtime Node)**.

### 5.2 `X-Idempotency-Key`
- A doc do MP destaca `X-Idempotency-Key` (UUID) como **obrigatório na Orders API** e **recomendado em criação de recursos**.
- Para `POST /checkout/preferences` o reference **não lista como obrigatório**, mas **enviar é boa prática** (evita preferences duplicadas em retry). Use um UUID estável por tentativa (ex.: derivado do nosso `order.id`).
- Header: `X-Idempotency-Key: <uuid>`.

Fonte: https://www.mercadopago.com.co/developers/en/reference/preferences/_checkout_preferences/post (e Orders API reference para o uso do header).

---

## 6. PIX no Checkout Pro hospedado

- **Nada de especial na preference** é necessário pra "ligar" PIX (não precisa flag específica): o Checkout Pro hospedado exibe PIX automaticamente **se a conta MP tiver uma chave PIX cadastrada**.
- **Requisito crítico (conta, não código):** sem chave PIX cadastrada na conta Mercado Pago, **a opção PIX não aparece** pro comprador.
- Para **controlar** se PIX aparece ou não numa preference específica, use `excluded_payment_types` com `bank_transfer` (§2.2).
- Expiração do QR PIX: `date_of_expiration` (§1.8).

Fontes:
- https://conteudo.mercadopago.com.br/passo-a-passo-cadastre-agora-sua-chave-pix-no-mercado-pago
- https://www.mercadopago.com.br/ferramentas-para-vender/aceitar-pix

---

## 7. Gotchas / pitfalls reais

1. **`auto_return` exige `back_urls.success`.** Sem a success url definida → erro `invalid_auto_return` ("back_url.success must be defined"). Sempre enviar os três back_urls + success obrigatório quando `auto_return` está presente.
   (https://github.com/odoo/odoo/issues/213287)

2. **Proibido `localhost`/`127.0.0.1` em `back_urls` (e em `notification_url`).** Com domínio local o checkout mostra "Algo deu errado" ao finalizar. Em dev, use túnel (ngrok) ou domínio nomeado. Em produção, domínio HTTPS real.
   (https://www.mercadopago.com.br/developers/en/docs/checkout-pro/configure-back-urls.md)

3. **`init_point` vs `sandbox_init_point` casam com o tipo do token.** Token de teste + `init_point` (produção) = pagamento não conclui. Token de produção + `sandbox_init_point` idem. Selecionar a URL pela credencial em uso.
   (https://github.com/mercadopago/sdk-js/discussions/60)

4. **PIX não aparece sem chave PIX na conta** — é configuração da conta, não da API. Validar com o founder antes de prometer PIX no checkout.

5. **Back_url não é fonte de verdade do crédito.** O usuário pode fechar a aba antes do redirect, ou o redirect só dispara com cartão aprovado. **Crédito = webhook → `GET /v1/payments` → `status == approved`.** Implementar idempotência por `payment.id`.

6. **Dois "expires" diferentes.** `expiration_date_from/to` (validade do link) ≠ `date_of_expiration` (prazo do PIX/boleto). Misturar gera link que expira cedo demais ou QR PIX impagável.

7. **`installments` é só teto** — não força parcelar. Combine com `default_installments: 1` pra não pré-selecionar parcelado. E o limite vale por preference (perfeito pro nosso "2x médio / 3x grande / 1x demais").

8. **Excluir PIX:** prefira excluir o **tipo** `bank_transfer` em `excluded_payment_types` (robusto) a excluir o method id `pix` em `excluded_payment_methods`. Confirme IDs vivos via `GET /v1/payment_methods`.

---

## 8. Exemplo de payload completo (pacote GRANDE — cartão até 3x + PIX, BRL)

```json
{
  "items": [
    {
      "id": "pkg-grande",
      "title": "Iris Codex — Pacote Grande (30 leituras)",
      "description": "Créditos pré-pagos para relatórios de iridologia",
      "category_id": "services",
      "quantity": 1,
      "currency_id": "BRL",
      "unit_price": 1191.00
    }
  ],
  "payer": {
    "email": "terapeuta@exemplo.com.br",
    "identification": { "type": "CPF", "number": "12345678909" }
  },
  "payment_methods": {
    "installments": 3,
    "default_installments": 1,
    "excluded_payment_types": [
      { "id": "ticket" }
    ]
  },
  "back_urls": {
    "success": "https://app.iriscodex.com/billing/retorno/sucesso",
    "pending": "https://app.iriscodex.com/billing/retorno/pendente",
    "failure": "https://app.iriscodex.com/billing/retorno/falha"
  },
  "auto_return": "approved",
  "notification_url": "https://app.iriscodex.com/api/webhooks/mercadopago",
  "external_reference": "8f3c2b1a-0d4e-4c2a-9b1f-7e6d5c4b3a21",
  "statement_descriptor": "IRISCODEX",
  "metadata": {
    "therapist_id": "1e02831f",
    "package_sku": "grande"
  },
  "expires": true,
  "expiration_date_from": "2026-06-20T00:00:00.000-03:00",
  "expiration_date_to": "2026-06-27T23:59:59.000-03:00"
}
```

### 8.1 Esqueleto da chamada (Node `fetch`, sem SDK)

```ts
const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
    "X-Idempotency-Key": orderId, // UUID estável por tentativa
  },
  body: JSON.stringify(preferenceBody),
});
const pref = await res.json();
// pref.id, pref.init_point (prod), pref.sandbox_init_point (teste)
// redirect(pref.init_point)  // em prod
```

### 8.2 Exemplo "SÓ PIX" (pacote sem cartão)

```json
"payment_methods": {
  "excluded_payment_types": [
    { "id": "credit_card" },
    { "id": "debit_card" },
    { "id": "ticket" }
  ]
}
```

---

## 9. Fontes principais (oficiais)

- Create preference (reference): https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-pro/preferences/create-preference/post
- Create preference (espelho .co, schema): https://www.mercadopago.com.co/developers/en/reference/preferences/_checkout_preferences/post
- Preference fields (guia Wallet/Bricks, mesmos campos): https://www.mercadopago.com.br/developers/en/docs/checkout-bricks/wallet-brick/advanced-features/preferences
- back_urls + auto_return: https://www.mercadopago.com.br/developers/en/docs/checkout-pro/configure-back-urls.md
- Expiração: https://www.mercadopago.com.br/developers/en/docs/checkout-pro/additional-settings/expiration-date
- Webhooks (notificações): https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
- Get payment: https://www.mercadopago.com.br/developers/en/reference/payments/_payments_search/get
- Payment methods (IDs): https://www.mercadopago.com.ar/developers/en/reference/payment_methods/_payment_methods/get
- PIX (cadastro de chave): https://conteudo.mercadopago.com.br/passo-a-passo-cadastre-agora-sua-chave-pix-no-mercado-pago
- Issue auto_return/back_url.success: https://github.com/odoo/odoo/issues/213287
- Discussion sandbox_init_point: https://github.com/mercadopago/sdk-js/discussions/60
