# Mercado Pago — Payments API, Refunds e Chargebacks (referência técnica)

> Documento de pesquisa para a integração de pagamentos do **Iris Codex**.
> Foco: estornar compras por arrependimento (CDC 7 dias) — **total e parcial** — e
> reagir a **chargebacks**, espelhando o que hoje fazemos no Asaas (refund total =
> body vazio; refund parcial = body com `value`).
>
> Fontes oficiais: `mercadopago.com.br/developers` (docs + reference). URLs citadas
> por seção. Pesquisa realizada em 2026-06-20.

---

## 0. Resumo executivo (o essencial para o nosso uso)

| Operação | Como fazer no MP |
|---|---|
| Descobrir o `payment.id` | Webhook `topic=payment` (`type: "payment"`) → `GET /v1/payments/{id}` |
| **Refund TOTAL** | `POST /v1/payments/{id}/refunds` **com body vazio** (`{}`) |
| **Refund PARCIAL** | `POST /v1/payments/{id}/refunds` com `{ "amount": <valor> }` |
| Refund parcial múltiplo | Permitido (soma ≤ `transaction_amount`); cada um gera um refund próprio |
| Prazo para estornar | **até 180 dias** da data de aprovação (cartão/boleto/débito); **Pix: até ~80 dias** |
| Cartão **parcelado** | **1 ÚNICO `payment`** com `installments: N` — NÃO são N pagamentos (≠ Asaas) |
| Refund de parcelado | Estorna o **valor da compra** (total ou amount parcial), não "parcela a parcela" |
| Chargeback | Webhook `topic=chargebacks` → payment vira `status: "charged_back"` → reverter crédito |
| Idempotência | Header **`X-Idempotency-Key`** obrigatório no POST de refund |

**Diferença-chave vs. Asaas:** no Asaas, parcelar cria N cobranças (e por isso casamos
webhook/refund/chargeback pelo grupo `installment`). No **Mercado Pago, parcelar é UM
pagamento só** — o parcelamento é um acordo entre o cliente e a operadora do cartão; o
lojista recebe o valor cheio. Logo, **não há grupo de parcelas para casar**: um `payment.id`
= uma compra. Isso simplifica drasticamente o modelo de estorno em relação ao Asaas.

---

## 1. GET /v1/payments/{id} — o objeto `payment`

Após o cliente pagar via **Checkout Pro** (criado a partir de uma `preference`), o pagamento
vira um objeto **`payment`** com `id` próprio. Esse `id` **não é conhecido na criação da
preference** — ele chega no **webhook** (`type: "payment"`, `data.id`). Com ele, consultamos:

```
GET https://api.mercadopago.com/v1/payments/{id}
Authorization: Bearer <ACCESS_TOKEN>
```

### Exemplo de resposta (campos relevantes)

```json
{
  "id": 1234567890,
  "date_created": "2026-06-20T11:26:38.000-03:00",
  "date_approved": "2026-06-20T11:26:40.000-03:00",
  "date_last_updated": "2026-06-20T11:26:40.000-03:00",
  "money_release_date": "2026-07-04T11:26:38.000-03:00",
  "status": "approved",
  "status_detail": "accredited",
  "payment_method_id": "master",
  "payment_type_id": "credit_card",
  "currency_id": "BRL",
  "description": "Iris Codex — Pacote 30 leituras",
  "collector_id": 2,
  "external_reference": "iriscodex_order_abc123",
  "transaction_amount": 1191.00,
  "transaction_amount_refunded": 0,
  "transaction_details": {
    "net_received_amount": 1145.00,
    "total_paid_amount": 1191.00,
    "overpaid_amount": 0,
    "installment_amount": 397.00,
    "payment_method_reference_id": null
  },
  "installments": 3,
  "fee_details": [
    { "type": "mercadopago_fee", "amount": 46.00, "fee_payer": "collector" }
  ],
  "charges_details": [
    {
      "id": "1234567890-001",
      "name": "mercadopago_fee",
      "type": "fee",
      "amounts": { "original": 46.00, "refunded": 0 }
    }
  ],
  "refunds": [],
  "payer": {
    "id": 987654321,
    "email": "cliente@example.com",
    "identification": { "type": "CPF", "number": "12345678909" },
    "type": "customer"
  },
  "metadata": {},
  "additional_info": {}
}
```

### Campos que mais importam para nós

| Campo | Significado / uso |
|---|---|
| `id` | id do pagamento (chave para refund e reconciliação) |
| `status` | estado macro: `approved`, `pending`, `in_process`, `rejected`, `refunded`, `charged_back`, `cancelled`, `in_mediation`, `authorized` |
| `status_detail` | detalhe do estado (`accredited`, `cc_rejected_*`, `partially_refunded`, `refunded`, etc.) |
| `transaction_amount` | valor original da compra (o que o cliente comprou) |
| `transaction_amount_refunded` | **acumulado já estornado** — usar para saber quanto resta estornar |
| `transaction_details.net_received_amount` | líquido que cai pra gente (descontada a taxa MP) |
| `transaction_details.total_paid_amount` | total efetivamente pago pelo cliente (inclui juros de parcelamento quando o cliente assume) |
| `transaction_details.installment_amount` | valor de **cada** parcela (informativo) |
| `installments` | **número de parcelas** (1 = à vista). **Confirma: 1 payment, N parcelas** |
| `payment_method_id` | bandeira/meio: `master`, `visa`, `pix`, `bolbradesco`, ... |
| `payment_type_id` | tipo: `credit_card`, `debit_card`, `bank_transfer` (Pix), `ticket` (boleto) |
| `external_reference` | **nosso** id de pedido — usar para amarrar o payment ao pedido/crédito no nosso banco |
| `date_approved` | data de aprovação — **base para o prazo de 180 dias** de refund |
| `refunds[]` | lista de estornos já feitos neste payment (id, amount, status) |
| `fee_details[]` | taxas cobradas pelo MP |
| `charges_details[]` | detalhamento de encargos com `amounts.original` / `amounts.refunded` |

> ⚠️ **Recomendação para o Iris Codex:** sempre setar `external_reference` na criação da
> preference com o nosso id de pedido. É o elo confiável entre o `payment.id` (que só
> descobrimos no webhook) e o registro de compra/crédito no nosso banco — equivalente ao
> que fazemos no Asaas. Não confiar só no `data.id` do webhook para reconciliar.

**Fontes §1:**
- GET payment (reference): https://www.mercadopago.com.br/developers/en/reference/payments/_payments_id/get
- Exemplo de resposta GET payment: https://www.mercadopago.com.mx/developers/en/reference/online-payments/checkout-pro/get-payment/get
- Search payments: https://www.mercadopago.com.br/developers/en/reference/payments/_payments_search/get

---

## 2. Refunds — POST /v1/payments/{id}/refunds

Endpoint único para **total** e **parcial**. A diferença é só o body.

### 2.1 Refund TOTAL (body vazio)

```bash
curl -X POST \
  'https://api.mercadopago.com/v1/payments/{id}/refunds' \
  -H 'Authorization: Bearer ACCESS_TOKEN' \
  -H 'X-Idempotency-Key: <uuid-único-por-tentativa>' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Sem `amount` → estorna **o valor total restante** do pagamento.

### 2.2 Refund PARCIAL (body com `amount`)

```bash
curl -X POST \
  'https://api.mercadopago.com/v1/payments/{id}/refunds' \
  -H 'Authorization: Bearer ACCESS_TOKEN' \
  -H 'X-Idempotency-Key: <uuid-único-por-tentativa>' \
  -H 'Content-Type: application/json' \
  -d '{ "amount": 397.00 }'
```

> Espelha exatamente o nosso padrão Asaas (total = vazio; parcial = com valor), apenas o
> nome do campo muda: Asaas usa `value`, **Mercado Pago usa `amount`**.

### 2.3 Resposta do refund

```json
{
  "id": 1242469925,
  "payment_id": 1234567890,
  "amount": 397.00,
  "source": { "id": 783789745, "name": "Test Test", "type": "collector" },
  "date_created": "2026-06-20T08:48:06.768-03:00",
  "unique_sequence_number": null,
  "refund_mode": "standard",
  "adjustment_amount": 0,
  "status": "approved",
  "reason": null
}
```

| Campo da resposta | Uso |
|---|---|
| `id` | id do refund (guardar para `GET refunds` e auditoria) |
| `payment_id` | volta o id do pagamento estornado |
| `amount` | valor efetivamente estornado |
| `status` | `approved` (ok), `in_process` (contingência — ver Pix), `pending`, `cancelled`/`rejected` |
| `source` | quem originou (collector = lojista) |
| `refund_mode` | `standard` |

### 2.4 Consultar refunds

```
GET https://api.mercadopago.com/v1/payments/{payment_id}/refunds          (lista todos)
GET https://api.mercadopago.com/v1/payments/{payment_id}/refunds/{refund_id}   (específico)
```

Também aparecem embutidos em `payment.refunds[]` no GET do payment.

### 2.5 Idempotência — `X-Idempotency-Key`

- Header **fortemente recomendado/obrigatório** no POST de refund.
- Permite **repetir a requisição com segurança** sem criar dois estornos idênticos.
- **Gerar um UUID por intenção de estorno** e reusá-lo em retries. Se a chamada cair/der
  timeout, repetir com a **mesma** chave → MP devolve o mesmo refund, não cria outro.
- Para um estorno parcial **novo e distinto** sobre o mesmo payment, usar uma **chave nova**.

### 2.6 Limites, prazos e saldo

- **Prazo máximo:** estorno possível **até 180 dias** da `date_approved` (cartão de crédito,
  boleto e débito). **Pix:** não é possível estornar após ~**80 dias** do pagamento.
  → O nosso caso (CDC 7 dias) está **muito** dentro da janela em qualquer meio. ✅
- **Saldo necessário:** é preciso **saldo suficiente na conta MP** para concluir o estorno.
  Se não houver saldo, o refund pode falhar/ficar pendente. (Mesma lógica do Asaas.)
- **Estorno parcial múltiplo:** permitido. Pode-se estornar em várias chamadas, desde que a
  **soma** não ultrapasse `transaction_amount`. `transaction_amount_refunded` acumula; quando
  iguala o total, o payment vai para `refunded` (parciais deixam `status_detail: partially_refunded`).
- **Pix em contingência:** o refund pode ficar `in_process` por falha de comunicação com o
  Bacen. Enviar o header **`X-Render-In-Process-Refunds: true`** para receber `201 Created`
  com `status: "in_process"` (em vez de `400`) e tratar a pendência de forma assíncrona,
  acompanhando o `e2e_id`.

**Fontes §2:**
- Create refund (reference): https://www.mercadopago.com.mx/developers/en/reference/chargebacks/_payments_id_refunds/post
- Get specific refund: https://www.mercadopago.com.mx/developers/en/reference/chargebacks/_payments_id_refunds_refund_id/get
- Cancelamentos e estornos (docs, prazo 180 dias / saldo): https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/payment-management/cancellations-and-refunds
- Refund de Pix (contingência, header X-Render-In-Process-Refunds): https://www.mercadopago.com.br/developers/pt/docs/checkout-api/payment-management/cancellations-and-refunds/refund-pix
- Refund parcial (exemplo de resposta): https://www.mercadopago.com.ar/developers/en/docs/wallet-connect/payment-flow/refund-payment/refund-partial-amount

---

## 3. Parcelamento — confirmação: 1 payment com `installments: N`

**Confirmado pela documentação oficial.** No Mercado Pago:

- Cartão parcelado gera **UM único objeto `payment`** com o campo `installments` = N.
- "A cobrança das parcelas é responsabilidade da operadora do cartão, e o valor da venda já
  é repassado ao seu negócio" — ou seja, o **parcelamento é um acordo entre o cliente e a
  operadora**; o lojista **recebe o valor cheio** (sem juros, se o lojista assumir, ou com
  juros repassados ao cliente). Não existem N pagamentos.

> Isso é **diferente do Asaas**, onde parcelar cria N cobranças (`installment` group). Por
> isso, no MP **não há "grupo de parcelas" para casar** em webhook/refund/chargeback: um
> `payment.id` representa a compra inteira.

### Como o refund se comporta num payment parcelado

- O refund opera sobre o **valor da compra** (o `transaction_amount`), **não** "parcela a
  parcela".
- **Refund total** num parcelado → estorna a compra inteira; a operadora reverte/ajusta as
  parcelas na fatura do cliente (pode aparecer como crédito proporcional nas próximas
  faturas, conforme o emissor).
- **Refund parcial** num parcelado → estorna o `amount` informado (ex.: devolver R$397 de uma
  compra de R$1191 em 3x); a operadora reverte proporcionalmente. **Não** se "cancela uma
  parcela específica" — pensa-se sempre em valor, não em número de parcela.
- O tempo do crédito aparecer na fatura do cartão **varia por banco emissor (até ~60 dias)**.

**Fontes §3:**
- Parcelamento / operadora assume cobrança (blog oficial MP): https://www.mercadopago.com.br/blog/guia-completo-parcelamento-sem-juros
- Configurar parcelamento (docs): https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/card-payment-brick/advanced-features/configure-installments
- Campo `installments` no objeto payment: https://www.mercadopago.com.mx/developers/en/reference/online-payments/checkout-pro/get-payment/get

---

## 4. Chargebacks (contestações)

Chargeback = o cliente contesta a compra junto ao **emissor do cartão** (não é um pedido de
refund pra gente). O MP nos **notifica** e o pagamento muda de estado.

### 4.1 Como o MP notifica

- **Tópico de webhook:** `chargebacks` (ativar "Webhooks > Configurar notificações" no
  painel; gera uma **secret key** para validar a assinatura `x-signature`).
- **Action:** `"action": "order.charged_back"`.
- Entregue como **JSON via HTTPS POST** na URL configurada.
- Quando o chargeback é iniciado, o **payment** associado passa a:
  - `status: "charged_back"`
  - `status_detail: "in_process"` (em andamento) → pode evoluir para `settled` (encerrado).

### 4.2 Estrutura da notificação / objeto chargeback

```json
{
  "id": "chargeback-notification-id",
  "type": "topic_chargebacks_wh",
  "action": "order.charged_back",
  "api_version": "v1",
  "date_created": "2026-06-20T12:00:00.000-03:00",
  "user_id": 123456,
  "data": {
    "id": "order-or-payment-id",
    "status": "charged_back",
    "total_amount": 1191.00,
    "transactions": {
      "payments": [ { "id": 1234567890, "amount": 1191.00 } ]
    },
    "chargebacks": [
      {
        "id": 9876543,
        "transaction_id": 1234567890,
        "case_id": "CASE-001",
        "amount": 1191.00,
        "currency": "BRL",
        "status": "in_process",
        "coverage_applied": false,
        "coverage_elegible": true,
        "date_documentation": "2026-06-27",
        "documentation": []
      }
    ]
  }
}
```

Campos do objeto **chargeback**: `id`, `transaction_id`/`payments`, `case_id`, `amount`,
`currency`, `status` (`in_process` → `settled`), `coverage_applied`/`coverage_elegible`
(se o MP cobre o prejuízo), `date_documentation` (prazo para enviar documentação de defesa),
`documentation[]`.

> Também existe o GET de chargeback (reference "chargebacks") para consultar o caso por id.

### 4.3 O que fazer (reação no Iris Codex)

1. **Receber o webhook `chargebacks`** → validar assinatura `x-signature`.
2. Pegar o `payment_id` (`transaction_id` / `transactions.payments[].id`).
3. **`GET /v1/payments/{id}`** → confirmar `status: "charged_back"`.
4. **Reverter o crédito** concedido por aquela compra no nosso ledger (espelha o que já
   fazemos no Asaas para chargeback). Idempotente: se o crédito já foi revertido, não reverter
   de novo.
5. Opcional: se `coverage_elegible` e quisermos contestar, enviar **documentação** dentro do
   prazo `date_documentation` (para nós, B2B leitura digital, geralmente não vale a briga;
   tratar como perda e bloquear/zerar o crédito).
6. Acompanhar o `status` do chargeback até `settled`.

> **Diferença importante de chargeback vs. refund:** chargeback é **involuntário** (vem do
> cliente/emissor) e chega por **webhook**; refund é **voluntário** (nós disparamos via API).
> Ambos derrubam crédito, mas o gatilho e o fluxo são diferentes. No parcelado, como é 1
> payment, o chargeback bate na compra inteira (sem "casar parcelas").

**Fontes §4:**
- Notificações de chargeback (docs): https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-management/chargebacks/notifications
- Gerenciar chargebacks (Checkout Pro): https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/chargebacks/manage
- Create cancellation / chargebacks (reference): https://www.mercadopago.com.br/developers/en/reference/chargebacks/_payments_payment_id/put
- Como prevenir chargeback: https://www.mercadopago.com.co/developers/en/docs/checkout-api/additional-content/chargebacks/how-to-prevent

---

## 5. Estados do payment e `status_detail`

### 5.1 `status` (estado macro) e transições

| `status` | Significado |
|---|---|
| `pending` | Aguardando pagamento/processamento (Pix não pago, boleto não compensado, contingência) |
| `authorized` | (Cartão em 2 passos) **autorizado mas não capturado** — reserva de limite, ainda não creditado |
| `in_process` | Em análise (ex.: revisão antifraude manual) |
| `approved` | **Pago e aprovado** → creditar |
| `rejected` | Recusado (ver `status_detail` `cc_rejected_*`) — terminal; cliente tenta de novo gera novo payment |
| `cancelled` | Cancelado (expirou ou cancelado antes de aprovar) |
| `refunded` | **Estornado integralmente** |
| `charged_back` | **Chargeback** (contestação) |
| `in_mediation` | Em disputa/mediação |

**Transições típicas (cartão):** `pending`/`in_process` → `approved` → (opcional) `refunded`
ou `charged_back`. Recusa: `pending`/`in_process` → `rejected`.
**Transições típicas (Pix):** `pending` → `approved` → (opcional) `refunded`.

### 5.2 `status_detail` mais comuns

**Aprovação / pendência:**
| `status_detail` | Significado |
|---|---|
| `accredited` | Aprovado e creditado (o "feliz" do `approved`) |
| `pending_contingency` | Em contingência; aguardar (pode virar `approved`) |
| `pending_review_manual` | Em revisão manual antifraude |
| `pending_waiting_payment` | Aguardando o cliente pagar (Pix/boleto gerado, não pago) |
| `partially_refunded` | Houve estorno **parcial** (payment segue `approved`) |
| `refunded` | Estornado integralmente |

**Recusas de cartão (`status` = `rejected`):**
| `status_detail` | Significado |
|---|---|
| `cc_rejected_bad_filled_card_number` | Número do cartão incorreto |
| `cc_rejected_bad_filled_date` | Validade incorreta |
| `cc_rejected_bad_filled_security_code` | CVV incorreto |
| `cc_rejected_bad_filled_other` | Outro dado de preenchimento incorreto |
| `cc_rejected_insufficient_amount` | Saldo/limite insuficiente |
| `cc_rejected_high_risk` | Recusado por risco/antifraude (suspeita) |
| `cc_rejected_blacklist` | Cartão em blacklist de fraude |
| `cc_rejected_call_for_authorize` | Emissor exige autorização do titular |
| `cc_rejected_card_disabled` | Cartão desabilitado para compras online |
| `cc_rejected_duplicated_payment` | Pagamento duplicado detectado |
| `cc_rejected_invalid_installments` | Nº de parcelas inválido para o cartão/emissor |
| `cc_rejected_max_attempts` | Excedeu o nº de tentativas |
| `cc_rejected_other_reason` | Recusa do emissor sem motivo específico |

**Fontes §5:**
- Possible status (query results): https://www.mercadopago.com.ar/developers/en/docs/checkout-api/response-handling/query-results
- Transaction status: https://www.mercadopago.com.ar/developers/en/docs/checkout-api-orders/payment-management/status/transaction-status
- Razões de rejeição (`cc_rejected_*`): https://www.mercadopago.com.co/developers/en/docs/subscriptions/how-tos/improve-payment-approval/reasons-for-rejection
- Payment status (woocommerce, mapa de status): https://www.mercadopago.com.ar/developers/en/docs/woocommerce/payment-status

---

## 6. PIX vs. Cartão no ciclo de vida

| Aspecto | **Pix** | **Cartão de crédito** |
|---|---|---|
| Aprovação | Aprova **na hora** assim que o cliente paga (`pending` → `approved`) | Geralmente `approved` direto; pode passar por `in_process` (antifraude) ou `authorized` (auth+capture em 2 passos) |
| `payment_type_id` | `bank_transfer` | `credit_card` |
| `payment_method_id` | `pix` | `master`, `visa`, `elo`, ... |
| Parcelamento | Não (à vista) — exceto "Pix no crédito", fora do nosso escopo | `installments` = N (1 payment) |
| Estorno (destino) | Volta para a **conta bancária** do pagador (mesma chave/conta) | Crédito na **fatura** do cartão (até ~60 dias, depende do emissor) |
| Prazo de refund | até ~**80 dias** | até **180 dias** |
| Contingência | Pode ficar `pending`/`in_process` por falha com o Bacen; refund idem (`in_process`) | Raramente |

- **`approved` vs `authorized` (cartão):** `authorized` = limite **reservado mas não
  capturado** (fluxo auth/capture em duas etapas); o dinheiro **não** foi creditado ainda.
  `approved`/`accredited` = capturado e creditado. No Checkout Pro padrão, normalmente já cai
  `approved`. **Só creditar leitura quando `status === "approved"`** (igual ao
  `PAYMENT_CONFIRMED` que usamos no Asaas).

**Fontes §6:**
- Refund de Pix: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/payment-management/cancellations-and-refunds/refund-pix
- Cancelamentos e estornos (180 dias, destino do estorno): https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/payment-management/cancellations-and-refunds

---

## 7. Gotchas / pitfalls reais de refund

1. **O `payment.id` só chega no webhook — guarde `external_reference`.** A preference (Checkout
   Pro) não devolve o `payment.id`. Sem amarrar `external_reference` ao nosso pedido, fica
   difícil reconciliar qual compra estornar. **Sempre setar `external_reference` na preference.**

2. **Idempotência de verdade:** sem `X-Idempotency-Key`, um retry após timeout pode criar **dois
   estornos**. Gerar um UUID por intenção de estorno e reusar em retries; chave nova só para um
   parcial **adicional** legítimo. (Mesmo cuidado que já temos com webhooks idempotentes no Asaas.)

3. **Saldo da conta MP:** estorno exige **saldo suficiente**. Em conta nova/com pouco giro, o
   refund pode falhar/ficar pendente por falta de saldo — checar `status` da resposta, não
   assumir sucesso.

4. **Pix em contingência:** sem o header `X-Render-In-Process-Refunds: true`, um refund Pix em
   contingência retorna **`400`** (parece erro, mas o estorno pode estar `in_process`). Com o
   header, vem `201` + `status: "in_process"` → tratar de forma assíncrona (acompanhar `e2e_id`).
   Não reverter crédito duas vezes nem reenviar cegamente.

5. **Refund parcial não é "cancelar parcela":** num parcelado pensa-se em **valor** (`amount`),
   nunca em número de parcela. Estornar parcial deixa o payment `approved` com
   `status_detail: partially_refunded` e incrementa `transaction_amount_refunded` — usar esse
   acumulado para não estornar além do total.

6. **`refunded` ≠ dinheiro na conta do cliente na hora:** o MP marca `refunded`/`approved`
   imediatamente, mas o crédito no cartão pode levar **até ~60 dias** (emissor) e Pix alguns
   dias úteis. Não prometer "já caiu" na UI; comunicar prazo.

7. **Chargeback é outro caminho:** não é refund. Não tente estornar via API um payment já
   `charged_back` — ele já saiu do seu controle pelo emissor. Apenas **reverta o crédito** no
   nosso ledger e acompanhe o caso.

**Fontes §7:** todas as URLs das seções 2, 4 e 6 acima.

---

## 8. Mapa rápido para a camada `lib/payments` (Iris Codex)

| Caso de uso | Chamada |
|---|---|
| Webhook de pagamento | `type: "payment"`, ler `data.id` → `GET /v1/payments/{data.id}`; creditar só se `status === "approved"` |
| Arrependimento total (CDC) | `POST /v1/payments/{id}/refunds` body `{}` + `X-Idempotency-Key` |
| Arrependimento parcial | `POST /v1/payments/{id}/refunds` body `{ "amount": N }` + `X-Idempotency-Key` |
| Conferir estorno | `GET /v1/payments/{id}/refunds` ou `payment.transaction_amount_refunded` |
| Webhook de chargeback | `topic: chargebacks` → reverter crédito do `external_reference`/`payment_id` (idempotente) |
| Parcelado | tratar como **1 payment**; sem grupo `installment` (≠ Asaas) |

---

## Apêndice — URLs-fonte consolidadas

**Payments / objeto payment**
- https://www.mercadopago.com.br/developers/en/reference/payments/_payments_id/get
- https://www.mercadopago.com.mx/developers/en/reference/online-payments/checkout-pro/get-payment/get
- https://www.mercadopago.com.br/developers/en/reference/payments/_payments_search/get

**Refunds**
- https://www.mercadopago.com.mx/developers/en/reference/chargebacks/_payments_id_refunds/post
- https://www.mercadopago.com.mx/developers/en/reference/chargebacks/_payments_id_refunds_refund_id/get
- https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/payment-management/cancellations-and-refunds
- https://www.mercadopago.com.br/developers/pt/docs/checkout-api/payment-management/cancellations-and-refunds/refund-pix
- https://www.mercadopago.com.ar/developers/en/docs/wallet-connect/payment-flow/refund-payment/refund-partial-amount

**Parcelamento**
- https://www.mercadopago.com.br/blog/guia-completo-parcelamento-sem-juros
- https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/card-payment-brick/advanced-features/configure-installments

**Chargebacks**
- https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/payment-management/chargebacks/notifications
- https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/chargebacks/manage
- https://www.mercadopago.com.br/developers/en/reference/chargebacks/_payments_payment_id/put

**Status / status_detail**
- https://www.mercadopago.com.ar/developers/en/docs/checkout-api/response-handling/query-results
- https://www.mercadopago.com.ar/developers/en/docs/checkout-api-orders/payment-management/status/transaction-status
- https://www.mercadopago.com.co/developers/en/docs/subscriptions/how-tos/improve-payment-approval/reasons-for-rejection
- https://www.mercadopago.com.ar/developers/en/docs/woocommerce/payment-status

**Webhooks**
- https://www.mercadopago.com.br/developers/en/docs/checkout-pro/payment-notifications
- https://www.mercadopago.com.co/developers/en/docs/your-integrations/notifications/additional-info
