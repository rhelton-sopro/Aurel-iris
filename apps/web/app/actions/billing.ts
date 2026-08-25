'use server'
import 'server-only'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPaymentProvider } from '@/lib/payments'
import { computeRefundValue } from '@/lib/billing/refund-policy'
import { maxInstallmentsFor, pixPriceBrl } from '@/lib/billing/pricing'
import { creditExpiresAt } from '@/lib/billing/config'
import { logAuditEvent } from '@/lib/audit/log'
import { notifyRefundProcessed } from '@/lib/notifications/notify-refund-processed'
import { notifyRefundRequest } from '@/lib/notifications/notify-refund-request'
import { cpfDigits } from '@/lib/auth/cpf'
import { phoneDigits } from '@/lib/auth/phone'
import { cepDigits } from '@/lib/profile/fields'

import {
  createChargeSchema,
  refundPackageSchema,
  type CreateChargeInput,
  type CreateChargeResult,
  type RefundPackageInput,
  type RefundPackageResult,
} from './billing.schemas'

/**
 * Compra de pacote (D-01/D-02). INSERT customer_credits status='pending' → cria
 * a cobrança no provedor ATIVO (PAYMENT_PROVIDER: Asaas dormente / Mercado Pago)
 * usando a row como externalReference (idempotência do webhook) → retorna a URL
 * de redirect (invoiceUrl Asaas / init_point MP).
 *
 * leituras_remaining fica 0 até o webhook confirmar o pagamento (A1=confirmed):
 * créditos só liberam após pagamento confirmado.
 */
export async function createChargeAction(
  input: CreateChargeInput,
): Promise<CreateChargeResult> {
  // 1. Session gate (T-08-06-01)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado.' }

  // 2. Zod
  const parsed = createChargeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'SKU inválido.' }

  // 3. Package (preço vem do DB — T-08-06-02, nunca do client) + profile
  const [pkgRes, profileRes] = await Promise.all([
    supabase
      .from('credit_packages')
      .select('id, sku, name, leituras_count, price_brl')
      .eq('sku', parsed.data.sku)
      .eq('active', true)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select(
        'id, asaas_customer_id, full_name, cpf, phone, cep, address, address_number, address_complement, district',
      )
      .eq('id', user.id)
      .maybeSingle(),
  ])
  if (!pkgRes.data) return { ok: false, error: 'Pacote não encontrado.' }
  if (!profileRes.data) return { ok: false, error: 'Perfil não encontrado.' }
  const pkg = pkgRes.data
  const profile = profileRes.data
  if (!profile.cpf || !profile.phone) {
    return { ok: false, error: 'Complete CPF + telefone no seu perfil antes de comprar.' }
  }
  // Defesa em profundidade: a TELA de compra já desvia pra completar o endereço
  // (ele saiu do portão de entrada em 2026-08-25 — ver lib/gates/therapist-
  // profile.ts). Este guarda existe pro caminho que não passa pela tela: sem
  // endereço a nota fiscal não emite e a operadora do cartão recusa, e falhar
  // aqui com mensagem clara é melhor do que criar uma cobrança que morre depois.
  if (!profile.cep || !profile.address_number) {
    return {
      ok: false,
      error:
        'Falta o endereço para a nota fiscal. Complete no seu perfil e tente de novo.',
    }
  }

  const service = createServiceClient()

  // 4. INSERT customer_credits pending ANTES da cobrança — precisa do id como
  //    externalReference (idempotência do webhook). expires_at é placeholder
  //    (12m); o webhook reseta a partir de confirmed_at quando ativa (D-03).
  //    Reordenado vs. a versão Asaas-inline: o customer persistente (Asaas) agora
  //    é criado dentro do adaptador; a compensação (delete) cobre falha lá.
  const { data: pendingCredit, error: insErr } = await service
    .from('customer_credits')
    .insert({
      user_id: profile.id,
      package_id: pkg.id,
      leituras_purchased: pkg.leituras_count,
      leituras_remaining: 0, // vira pkg.leituras_count quando o webhook confirma
      leituras_reserved: 0,
      expires_at: creditExpiresAt(new Date()).toISOString(),
      status: 'pending',
    })
    .select('id')
    .single()
  if (insErr || !pendingCredit) {
    console.error('[billing] pending credit insert failed:', insErr?.message)
    return { ok: false, error: 'Erro interno ao registrar compra.' }
  }

  // 5. Preço de venda. Clamp server-side — regra/limite NUNCA vêm do client
  //    (espelha o preço, que também vem do DB). Parcelamento sem juros: cartão
  //    médio até 2x, grande até 3x (lib/billing/pricing); PIX e demais 1x à vista.
  const maxInstallments =
    parsed.data.billingType === 'CREDIT_CARD' ? maxInstallmentsFor(pkg.sku) : 1
  const installmentCount = Math.min(
    Math.max(parsed.data.installments ?? 1, 1),
    maxInstallments,
  )
  // Desconto PIX (5% médio+grande); cartão (à vista/parcelado) paga o cheio.
  // `paidBrl` = valor REALMENTE cobrado → paid_brl (reembolso/receita).
  const isPix = parsed.data.billingType === 'PIX'
  const chargeBrl = isPix ? pixPriceBrl(pkg.sku, pkg.price_brl) : pkg.price_brl
  const paidBrl = installmentCount > 1 ? pkg.price_brl : chargeBrl

  // Retorno pós-pagamento (D-23): se veio de uma leitura (banner "sem créditos"),
  // volta pra ESSA leitura; senão pra /assinatura. `||` (não `??`): env vazio
  // também cai no apex.
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://iriscodex.com').replace(
    /\/$/,
    '',
  )
  const successUrl = parsed.data.reading_id
    ? `${siteUrl}/leituras/${parsed.data.reading_id}`
    : `${siteUrl}/assinatura`

  // 6. Cria a cobrança no provedor ativo. Asaas e Mercado Pago atrás do mesmo
  //    contrato (lib/payments) — o adaptador cuida das diferenças (customer
  //    persistente + endereço no Asaas; preference no MP). PIX/cartão é a escolha
  //    da nossa tela; o adaptador restringe os métodos do checkout.
  const provider = getPaymentProvider()
  const charge = await provider.createCharge({
    creditId: pendingCredit.id,
    sku: pkg.sku,
    packageName: pkg.name,
    leiturasCount: pkg.leituras_count,
    billingType: parsed.data.billingType,
    installments: installmentCount,
    chargeBrl,
    totalBrl: pkg.price_brl,
    description: `Iris Codex — ${pkg.name} (${pkg.leituras_count} ${
      pkg.leituras_count === 1 ? 'leitura' : 'leituras'
    })`,
    successUrl,
    payer: {
      profileId: profile.id,
      // CPF/telefone NUNCA logados (T-08-06-04). cpfDigits/phoneDigits são
      // sanitizadores próprios e desacoplados (CR-01).
      name: profile.full_name ?? user.email ?? 'Terapeuta',
      email: user.email ?? '',
      cpf: cpfDigits(profile.cpf),
      phone: phoneDigits(profile.phone),
      address: profile.cep
        ? {
            cep: cepDigits(profile.cep),
            street: profile.address ?? undefined,
            number: profile.address_number ?? undefined,
            complement: profile.address_complement ?? undefined,
            district: profile.district ?? undefined,
          }
        : undefined,
    },
    providerCustomerId: profile.asaas_customer_id ?? null,
  })
  if (!charge.ok) {
    // Compensação: provedor rejeitou → remove a row pendente órfã.
    await service.from('customer_credits').delete().eq('id', pendingCredit.id)
    return { ok: false, error: charge.error }
  }

  // 7. Liga a cobrança à row (asaas_payment_id UNIQUE — idempotência webhook).
  //    Colunas `asaas_*` reaproveitadas como "provider_*" (sem renomear — evita
  //    migration). Asaas: providerPaymentId = payment.id (1ª parcela), groupId =
  //    grupo installment. MP: providerPaymentId = preference.id (o payment.id
  //    real chega no webhook), groupId = null. Persistir o customer do provedor
  //    em profiles se o adaptador criou um novo (Asaas 1ª compra).
  await service
    .from('customer_credits')
    .update({
      asaas_payment_id: charge.data.providerPaymentId,
      asaas_installment_id: charge.data.groupId,
      asaas_invoice_url: charge.data.redirectUrl,
      asaas_payment_status: charge.data.status,
      paid_brl: paidBrl,
    })
    .eq('id', pendingCredit.id)
    .eq('user_id', profile.id) // defensive

  if (charge.data.providerCustomerId) {
    await service
      .from('profiles')
      .update({ asaas_customer_id: charge.data.providerCustomerId })
      .eq('id', profile.id)
  }

  await logAuditEvent({
    event_type: 'credit.purchase_initiated',
    actor_user_id: profile.id,
    actor_email: user.email,
    target_type: 'credit',
    target_id: pendingCredit.id,
    metadata: {
      sku: pkg.sku,
      asaas_payment_id: charge.data.providerPaymentId,
      value_brl: pkg.price_brl,
      provider: provider.name,
    },
  })

  console.info(
    `[billing] CHARGE_CREATED user=${profile.id} sku=${pkg.sku} payment=${charge.data.providerPaymentId} provider=${provider.name}`,
  )
  // NÃO revalidar /assinatura aqui: o crédito ainda é 'pending' (nada muda no
  // saldo) e o cliente é redirecionado JÁ pro checkout. Quem revalida o saldo é
  // o webhook ao confirmar (pós-pagamento).
  return {
    ok: true,
    credit_id: pendingCredit.id,
    invoice_url: charge.data.redirectUrl,
    asaas_payment_id: charge.data.providerPaymentId,
  }
}

/**
 * Reembolso por arrependimento CDC 7d (D-13). SELECT via session client
 * (RLS bloqueia cross-tenant — T-08-06-05) → computeRefundValue → refund no
 * provedor ativo (total/parcial) → estado local + ledger.
 */
export async function refundPackageAction(
  input: RefundPackageInput,
): Promise<RefundPackageResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado.' }

  const parsed = refundPackageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Input inválido.' }

  // 1. SELECT via session client — RLS garante user_id = auth.uid()
  const { data: credit, error: selErr } = await supabase
    .from('customer_credits')
    .select(
      'id, user_id, asaas_payment_id, asaas_installment_id, paid_brl, purchase_date, leituras_purchased, leituras_remaining, leituras_reserved, status, credit_packages(name, price_brl)',
    )
    .eq('id', parsed.data.credit_id)
    .maybeSingle()
  if (selErr || !credit) return { ok: false, error: 'Crédito não encontrado.' }

  // 2. Política de refund (pura). Base = valor REALMENTE pago (paid_brl, que pode
  //    ter desconto PIX); compras antigas sem paid_brl caem no preço de tabela.
  const listPriceBrl = (
    credit as unknown as { credit_packages: { price_brl: number } }
  ).credit_packages.price_brl
  const paidBaseBrl = credit.paid_brl ?? listPriceBrl
  const policy = computeRefundValue({
    purchase_date: credit.purchase_date,
    price_brl: paidBaseBrl,
    leituras_purchased: credit.leituras_purchased,
    leituras_remaining: credit.leituras_remaining,
    leituras_reserved: credit.leituras_reserved,
    status: credit.status,
  })
  if (!policy.eligible) {
    const msg =
      policy.reason === 'window_expired'
        ? 'Janela de arrependimento expirada (7 dias).'
        : policy.reason === 'no_balance'
          ? 'Pacote já foi totalmente consumido.'
          : 'Pacote não pode ser reembolsado neste estado.'
    return { ok: false, error: msg }
  }

  const service = createServiceClient()
  const pkgName = (credit as unknown as { credit_packages: { name: string } })
    .credit_packages.name

  // 3. PARCIAL (cliente já usou leituras): NÃO executa o estorno. Calcula o
  //    demonstrativo e envia ao suporte (suporte@iriscodex.com); o suporte
  //    estorna manual no MP e o webhook PARTIALLY_REFUNDED reconcilia o crédito
  //    (founder 2026-06-20). Só o TOTAL (0 usadas) segue self-service via API.
  if (policy.kind === 'partial') {
    const usadas = credit.leituras_purchased - policy.leituras_to_refund
    const { data: prof } = await service
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    await logAuditEvent({
      event_type: 'credit.refund_requested',
      actor_user_id: user.id,
      actor_email: user.email,
      target_type: 'credit',
      target_id: credit.id,
      metadata: {
        kind: 'partial',
        value_brl: policy.value_brl,
        leituras_to_refund: policy.leituras_to_refund,
        leituras_usadas: usadas,
      },
    })
    // Email ao suporte — best-effort, não bloqueia o retorno.
    void notifyRefundRequest({
      therapistName: prof?.full_name ?? null,
      therapistEmail: user.email!,
      packageName: pkgName,
      paidBrl: paidBaseBrl,
      leiturasPurchased: credit.leituras_purchased,
      leiturasUsed: usadas,
      leiturasToRefund: policy.leituras_to_refund,
      refundValueBrl: policy.value_brl,
      unitPriceBrl: policy.unit_price_brl,
      paymentId: credit.asaas_payment_id,
      purchaseDate: credit.purchase_date,
      creditId: credit.id,
    }).catch((err) =>
      console.warn(
        '[billing] notify refund request failed (non-fatal):',
        err instanceof Error ? err.message : err,
      ),
    )
    console.info(
      `[billing] REFUND_REQUESTED credit=${credit.id} value=${policy.value_brl} leituras=${policy.leituras_to_refund}`,
    )
    return {
      ok: true,
      mode: 'requested',
      value_brl: policy.value_brl,
      leituras_to_refund: policy.leituras_to_refund,
    }
  }

  // 4. TOTAL (0 usadas) → estorno na hora via API do provedor ativo. O webhook
  //    PAYMENT_REFUNDED também reconcilia; aqui é proativo.
  if (!credit.asaas_payment_id) {
    return { ok: false, error: 'Pagamento não associado.' }
  }
  const provider = getPaymentProvider()
  const refund = await provider.refundCharge({
    providerPaymentId: credit.asaas_payment_id,
    groupId: credit.asaas_installment_id,
    isInstallment: !!credit.asaas_installment_id,
    amountBrl: undefined, // total
  })
  if (!refund.ok) return { ok: false, error: refund.error }

  await service
    .from('customer_credits')
    .update({ status: 'refunded', leituras_remaining: 0, leituras_reserved: 0 })
    .eq('id', credit.id)
    .eq('user_id', user.id)
  await service.from('credit_transactions').insert({
    user_id: user.id,
    credit_id: credit.id,
    type: 'refund',
    amount: -policy.leituras_to_refund,
    asaas_payment_id: credit.asaas_payment_id,
    notes: `D-13 arrependimento total; valor R$ ${policy.value_brl.toFixed(2)}`,
  })
  await logAuditEvent({
    event_type: 'credit.refunded',
    actor_user_id: user.id,
    actor_email: user.email,
    target_type: 'credit',
    target_id: credit.id,
    metadata: {
      kind: 'total',
      value_brl: policy.value_brl,
      leituras_refunded: policy.leituras_to_refund,
      manual: true,
    },
  })
  console.info(
    `[billing] REFUND_PROCESSED credit=${credit.id} kind=total value=${policy.value_brl}`,
  )

  // Email recibo ao cliente — BEST-EFFORT, fire-and-forget.
  void (async () => {
    const { data: prof } = await service
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    await notifyRefundProcessed({
      userEmail: user.email!,
      userName: prof?.full_name ?? null,
      packageName: pkgName,
      refundValueBrl: policy.value_brl,
      kind: 'total',
      leiturasRefunded: policy.leituras_to_refund,
    })
  })().catch((err) =>
    console.warn(
      '[billing] notify refund failed (non-fatal):',
      err instanceof Error ? err.message : err,
    ),
  )

  revalidatePath('/assinatura')
  return {
    ok: true,
    mode: 'refunded',
    refunded_value_brl: policy.value_brl,
    kind: 'total',
  }
}
