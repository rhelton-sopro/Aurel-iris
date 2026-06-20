/**
 * Contrato gateway-agnóstico da camada de pagamentos.
 *
 * Fonte ÚNICA do contrato que `billing.ts` (saída: criar cobrança / estornar) e
 * os webhooks (entrada: evento normalizado) usam, independente do provedor.
 * Hoje há dois adaptadores: Asaas (dormente, atrás da flag) e Mercado Pago
 * (Checkout Pro). A escolha vem de `PAYMENT_PROVIDER` (ver ./index.ts).
 *
 * Puro — SEM 'use server', SEM I/O. Importável de server e client (espelha
 * lib/asaas/types.ts e a higiene de feedback_use_server_export_hygiene).
 *
 * Porquê de cada decisão de shape:
 *   - A camada de crédito (customer_credits/ledger/idempotência) já é quase
 *     agnóstica: ela correlaciona por `asaas_payment_id`/`asaas_installment_id`
 *     OU pela PK da row. Generalizamos a correlação via `creditId`
 *     (= external_reference), que TODO provedor propaga de volta no webhook.
 *   - Asaas e MP diferem em pontos que o contrato precisa absorver SEM vazar:
 *       · Asaas mantém customer persistente (asaas_customer_id em profiles) e o
 *         parcelado vira N cobranças (grupo `installment`). MP não tem customer
 *         obrigatório e o parcelado é UM payment com `installments=N`.
 *       · Asaas entrega o payment inteiro no corpo do webhook; MP manda só
 *         `{type, data.id}` e exige um GET /v1/payments/{id} pra hidratar.
 */

export type PaymentProviderName = 'asaas' | 'mercadopago'

export type PaymentResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }

// ───────────────────────── Saída: criar cobrança ─────────────────────────

export interface ChargePayerAddress {
  cep?: string // só dígitos
  street?: string // logradouro
  number?: string
  complement?: string
  district?: string // bairro
}

export interface ChargePayer {
  profileId: string // profiles.id (UUID)
  name: string
  email: string
  cpf: string // só dígitos
  phone: string // só dígitos
  address?: ChargePayerAddress
}

export interface CreateChargeParams {
  /**
   * UUID da row `customer_credits` pendente. Vira o `external_reference` da
   * cobrança no provedor — é a chave que o webhook usa pra reencontrar a row
   * (idempotência: a coluna é UNIQUE app-level). billing.ts já inseriu a row.
   */
  creditId: string
  sku: string
  packageName: string
  leiturasCount: number
  /** PIX ou cartão — escolhido na NOSSA tela (boleto nunca). */
  billingType: 'PIX' | 'CREDIT_CARD'
  /** Já clampado por billing.ts (regra/limite vêm do servidor). 1 = à vista. */
  installments: number
  /** Valor à vista REALMENTE cobrado (com desconto PIX quando aplicável). */
  chargeBrl: number
  /** Preço cheio (base do parcelado — sem desconto PIX). */
  totalBrl: number
  description: string
  /** URL de retorno pós-pagamento (back_url/callback). */
  successUrl: string
  payer: ChargePayer
  /**
   * Customer persistente do provedor (Asaas: asaas_customer_id de profiles).
   * MP ignora (não usa customer obrigatório). billing.ts passa o atual; o
   * adaptador pode criar um novo e devolvê-lo em CreateChargeResult pra persistir.
   */
  providerCustomerId: string | null
}

export interface CreateChargeResult {
  /**
   * Id que billing.ts grava em `customer_credits.asaas_payment_id` (coluna
   * reaproveitada como "provider payment id", sem renomear — evita migration).
   * Asaas: payment.id (1ª parcela). MP: preference.id — o payment.id real só
   * existe pós-pagamento e é gravado pelo webhook (refund depende dele).
   */
  providerPaymentId: string
  /** Asaas: id do grupo `installment` (parcelado). MP: null. */
  groupId: string | null
  /** Pra onde redirecionar o cliente. Asaas: invoiceUrl. MP: init_point. */
  redirectUrl: string
  status: string | null
  /**
   * Customer do provedor a persistir em profiles, se o adaptador criou um novo
   * (Asaas). null = nada a persistir (MP, ou Asaas reusou o existente).
   */
  providerCustomerId: string | null
}

// ───────────────────────── Saída: estorno ─────────────────────────

export interface RefundChargeParams {
  /** Asaas: payment.id. MP: payment.id real (gravado pelo webhook ao confirmar). */
  providerPaymentId: string
  /** Asaas: id do grupo `installment`. MP: null. */
  groupId: string | null
  /** Asaas parcelado estorna pelo grupo. MP parcelado é 1 payment → false. */
  isInstallment: boolean
  /** undefined = estorno total; com valor = parcial. */
  amountBrl?: number
  description?: string
}

// ──────────────────── Entrada: evento de webhook normalizado ────────────────────

/**
 * Tipo de evento já mapeado pro vocabulário da nossa state machine
 * (apply-payment), independente do provedor. Cada adaptador de webhook traduz
 * o vocabulário nativo (Asaas PAYMENT_*; MP status do payment) pra cá.
 */
export type NormalizedEventKind =
  | 'payment_confirmed' // creditar saldo (Asaas CONFIRMED/RECEIVED; MP approved)
  | 'payment_refunded' // estorno total (status refunded)
  | 'payment_partially_refunded' // débito proporcional (D-13)
  | 'chargeback' // zerar saldo (status charged_back)
  | 'noop' // qualquer outro evento/status — sem efeito

export interface NormalizedPaymentEvent {
  /**
   * Chave de idempotência do provedor (barreira primária no banco).
   * Asaas: event.id. MP: `${paymentId}:${status}` (o MP reenvia
   * created→updated + retries; deduplicar por par payment+status — doc 02).
   */
  idempotencyKey: string
  kind: NormalizedEventKind
  /**
   * Correlação com a row. MP traz só isto (external_reference = creditId).
   * Asaas também o expõe, mas mantemos a correlação dele por payment/grupo
   * (caminho em produção, não mexer) — então pode vir null no Asaas.
   */
  creditId: string | null
  /** Id do payment no provedor (Asaas: payment.id; MP: payment.id real). */
  providerPaymentId: string
  /** Asaas: grupo `installment`. MP: null. */
  groupId: string | null
  /** Status nativo (pra log/auditoria e gravar em asaas_payment_status). */
  status: string
  /** Valor total do payment (BRL). */
  valueBrl: number
  /** Acumulado já devolvido (refund parcial) — base do débito proporcional. */
  refundedValueBrl?: number
  /** Valor líquido (Asaas usa value-netValue como fallback do refund). */
  netValueBrl?: number
  /** Tipo de evento nativo, pra logs (Asaas PAYMENT_x; MP `payment`). */
  rawEventType: string
}

// ───────────────────────── Contrato do provedor ─────────────────────────

export interface PaymentProvider {
  readonly name: PaymentProviderName
  /** Cria a cobrança no provedor e devolve pra onde redirecionar o cliente. */
  createCharge(params: CreateChargeParams): Promise<PaymentResult<CreateChargeResult>>
  /** Estorna (total ou parcial) uma cobrança já confirmada. */
  refundCharge(params: RefundChargeParams): Promise<PaymentResult<void>>
}
