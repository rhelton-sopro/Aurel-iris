'use server'
import 'server-only'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  createAsaasCustomer,
  createAsaasPayment,
  refundAsaasPayment,
} from '@/lib/asaas/client'
import { computeRefundValue } from '@/lib/billing/refund-policy'
import { creditExpiresAt } from '@/lib/billing/config'
import { logAuditEvent } from '@/lib/audit/log'
import { notifyRefundProcessed } from '@/lib/notifications/notify-refund-processed'
import { cpfDigits } from '@/lib/auth/cpf'
import { phoneDigits } from '@/lib/auth/phone'

import {
  createChargeSchema,
  refundPackageSchema,
  type CreateChargeInput,
  type CreateChargeResult,
  type RefundPackageInput,
  type RefundPackageResult,
} from './billing.schemas'

/**
 * Compra de pacote (D-01/D-02). Cria customer Asaas (1ª vez) → INSERT
 * customer_credits status='pending' → cria payment Asaas com a row como
 * externalReference (idempotência do webhook 08-04) → retorna invoiceUrl.
 *
 * leituras_remaining fica 0 até o webhook PAYMENT_CONFIRMED ativar (A1=confirmed):
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
      .select('id, asaas_customer_id, full_name, cpf, phone')
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

  const service = createServiceClient()

  // 4. Asaas customer — criar se ausente (CPF/phone NUNCA logados — T-08-06-04)
  let asaasCustomerId = profile.asaas_customer_id
  if (!asaasCustomerId) {
    const cust = await createAsaasCustomer({
      name: profile.full_name ?? user.email ?? 'Terapeuta',
      cpfCnpj: cpfDigits(profile.cpf),
      email: user.email ?? '',
      // CR-01: telefone tem sanitizador próprio (strip não-dígitos), NUNCA
      // reusa cpfDigits — desacopla dois campos não relacionados (mudança futura
      // em cpfDigits, ex. validar 11 dígitos de CPF, corromperia o telefone).
      mobilePhone: phoneDigits(profile.phone),
      externalReference: profile.id,
    })
    if (!cust.ok) {
      console.error('[billing] createAsaasCustomer failed:', cust.error)
      return { ok: false, error: 'Falha ao criar cliente Asaas: ' + cust.error }
    }
    asaasCustomerId = cust.data.id
    await service
      .from('profiles')
      .update({ asaas_customer_id: asaasCustomerId })
      .eq('id', profile.id)
  }

  // 5. INSERT customer_credits pending ANTES do payment — precisa do id como
  //    externalReference. expires_at é placeholder (12m); webhook reseta a
  //    partir de confirmed_at quando ativa (D-03).
  const { data: pendingCredit, error: insErr } = await service
    .from('customer_credits')
    .insert({
      user_id: profile.id,
      package_id: pkg.id,
      leituras_purchased: pkg.leituras_count,
      leituras_remaining: 0, // vira pkg.leituras_count no webhook PAYMENT_CONFIRMED
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

  // 6. Asaas payment
  const dueDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  // Retorno pós-pagamento (D-23): se a compra veio de uma leitura (banner "sem
  // créditos"), o cliente volta pra ESSA leitura — pronta pra gerar. Senão, volta
  // pra /assinatura (saldo). autoRedirect=true: Asaas devolve sozinho ao confirmar.
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://iriscodex.com').replace(
    /\/$/,
    '',
  )
  const successUrl = parsed.data.reading_id
    ? `${siteUrl}/leituras/${parsed.data.reading_id}`
    : `${siteUrl}/assinatura`

  // B-lite (founder 2026-05-31): o cliente escolheu PIX ou cartão na NOSSA tela;
  // passamos o billingType específico. Boleto NUNCA é oferecido (não existe
  // billingType "PIX+cartão", e o painel Asaas não tem toggle p/ conta de API —
  // pesquisa 2026-05-31). O checkout hospedado mostra só o método escolhido. O
  // webhook credita em PAYMENT_CONFIRMED **ou** PAYMENT_RECEIVED, então cartão
  // (confirma na autorização, instantâneo) credita na hora — sem mudar o webhook.
  const paymentInput = {
    customer: asaasCustomerId,
    billingType: parsed.data.billingType,
    value: pkg.price_brl,
    dueDate,
    description: `Iris Codex — ${pkg.name} (${pkg.leituras_count} ${
      pkg.leituras_count === 1 ? 'leitura' : 'leituras'
    })`,
    externalReference: pendingCredit.id,
  }

  // Callback de auto-retorno pós-pagamento (item 3): só é enviado se o domínio
  // do successUrl estiver cadastrado na conta Asaas (Configurações → Integrações).
  // Sem cadastro, o Asaas rejeita a cobrança INTEIRA com invalid_object ("nenhum
  // domínio configurado"). Gated por ASAAS_CALLBACK_ENABLED (runtime, sem prefixo
  // NEXT_PUBLIC — lê em call-time, liga sem rebuild): default OFF → 1 chamada só,
  // sem callback, compra direta. Quando o founder cadastrar o domínio, seta a
  // flag=true na Vercel e o auto-retorno liga (successUrl intacto, só destravado).
  const callbackEnabled = process.env.ASAAS_CALLBACK_ENABLED === 'true'
  const payment = await createAsaasPayment(
    callbackEnabled
      ? { ...paymentInput, callback: { successUrl, autoRedirect: true } }
      : paymentInput,
  )
  if (!payment.ok) {
    // Compensação: Asaas rejeitou → remove a row pendente órfã
    await service.from('customer_credits').delete().eq('id', pendingCredit.id)
    return { ok: false, error: 'Falha ao criar cobrança: ' + payment.error }
  }

  // 7. Liga o payment à row (asaas_payment_id UNIQUE — idempotência webhook)
  await service
    .from('customer_credits')
    .update({
      asaas_payment_id: payment.data.id,
      asaas_invoice_url: payment.data.invoiceUrl ?? null,
      asaas_payment_status: payment.data.status ?? null,
    })
    .eq('id', pendingCredit.id)
    .eq('user_id', profile.id) // defensive

  await logAuditEvent({
    event_type: 'credit.purchase_initiated',
    actor_user_id: profile.id,
    actor_email: user.email,
    target_type: 'credit',
    target_id: pendingCredit.id,
    metadata: { sku: pkg.sku, asaas_payment_id: payment.data.id, value_brl: pkg.price_brl },
  })

  console.info(
    `[billing] CHARGE_CREATED user=${profile.id} sku=${pkg.sku} payment=${payment.data.id}`,
  )
  revalidatePath('/assinatura')
  return {
    ok: true,
    credit_id: pendingCredit.id,
    invoice_url: payment.data.invoiceUrl ?? '',
    asaas_payment_id: payment.data.id,
  }
}

/**
 * Reembolso por arrependimento CDC 7d (D-13). SELECT via session client
 * (RLS bloqueia cross-tenant — T-08-06-05) → computeRefundValue → Asaas
 * refund (body vazio = total, com value = parcial) → estado local + ledger.
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
      'id, user_id, asaas_payment_id, purchase_date, leituras_purchased, leituras_remaining, leituras_reserved, status, credit_packages(name, price_brl)',
    )
    .eq('id', parsed.data.credit_id)
    .maybeSingle()
  if (selErr || !credit) return { ok: false, error: 'Crédito não encontrado.' }

  // 2. Política de refund (pura)
  const policy = computeRefundValue({
    purchase_date: credit.purchase_date,
    price_brl: (credit as unknown as { credit_packages: { price_brl: number } }).credit_packages
      .price_brl,
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

  // 3. Asaas refund — body undefined = total, com value = parcial (D-13)
  if (!credit.asaas_payment_id) {
    return { ok: false, error: 'Pagamento Asaas não associado.' }
  }
  const refundBody =
    policy.kind === 'total'
      ? undefined
      : {
          value: policy.value_brl,
          description: `Iris Codex — arrependimento 7d (${policy.leituras_to_refund} leituras restantes)`,
        }
  const refund = await refundAsaasPayment(credit.asaas_payment_id, refundBody)
  if (!refund.ok) return { ok: false, error: 'Falha no Asaas: ' + refund.error }

  // 4. Estado local — webhook PAYMENT_REFUNDED/PARTIALLY_REFUNDED também
  //    reconcilia (08-04); aqui é proativo. .eq('user_id') defensive.
  const service = createServiceClient()
  if (policy.kind === 'total') {
    await service
      .from('customer_credits')
      .update({ status: 'refunded', leituras_remaining: 0, leituras_reserved: 0 })
      .eq('id', credit.id)
      .eq('user_id', user.id)
  } else {
    // Parcial: zera o saldo (terapeuta perde direito ao restante)
    await service
      .from('customer_credits')
      .update({ leituras_remaining: 0, leituras_reserved: 0 })
      .eq('id', credit.id)
      .eq('user_id', user.id)
  }
  await service.from('credit_transactions').insert({
    user_id: user.id,
    credit_id: credit.id,
    type: 'refund',
    amount: -policy.leituras_to_refund,
    asaas_payment_id: credit.asaas_payment_id,
    notes: `D-13 arrependimento ${policy.kind}; valor R$ ${policy.value_brl.toFixed(2)}`,
  })

  await logAuditEvent({
    event_type: 'credit.refunded',
    actor_user_id: user.id,
    actor_email: user.email,
    target_type: 'credit',
    target_id: credit.id,
    metadata: {
      kind: policy.kind,
      value_brl: policy.value_brl,
      leituras_refunded: policy.leituras_to_refund,
      manual: true,
    },
  })

  console.info(
    `[billing] REFUND_PROCESSED credit=${credit.id} kind=${policy.kind} value=${policy.value_brl}`,
  )

  // Email recibo — BEST-EFFORT, fire-and-forget. Falha não bloqueia o retorno
  // da action nem afeta o estado do refund (já aplicado acima).
  void (async () => {
    const { data: prof } = await service
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    await notifyRefundProcessed({
      userEmail: user.email!,
      userName: prof?.full_name ?? null,
      packageName: (credit as unknown as { credit_packages: { name: string } })
        .credit_packages.name,
      refundValueBrl: policy.value_brl,
      kind: policy.kind,
      leiturasRefunded: policy.leituras_to_refund,
    })
  })().catch((err) =>
    console.warn(
      '[billing] notify refund failed (non-fatal):',
      err instanceof Error ? err.message : err,
    ),
  )

  revalidatePath('/assinatura')
  return { ok: true, refunded_value_brl: policy.value_brl, kind: policy.kind }
}
