'use server'

import 'server-only'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { signBiometricTerm } from '@/lib/consent/sign'
import { notifyClientConsentCopy } from '@/lib/notifications/notify-consent-copy'
import { logAuditEvent } from '@/lib/audit/log'

import {
  signTermSchema,
  type SignTermInput,
  type SignTermResult,
} from './consent.schemas'

/**
 * signTermAction — server action de assinatura do termo biométrico (LGPD-01).
 *
 * Fluxo: gera PDF (POST /api/consent/generate-pdf) → INSERT client_consents
 * (append-only) → atualiza current-pointer em clients → logAuditEvent.
 *
 * NOTA DE SCHEMA (deviation Rule 1): a migration 0019 DROPOU
 * clients.consent_signed_at + consent_document_url (eram letra morta). O
 * current-pointer LIVE é consent_current_version + consent_last_at (0019/0020).
 * A URL do PDF não tem coluna em clients — fica persistida no audit_events
 * (metadata.pdf_path) e é retornada ao caller pra exibição/download imediato.
 *
 * Auth: exige sessão de terapeuta. O path remote_link (cliente sem sessão) usa
 * o componente/rota públicos que validam token e chamam /api/consent/generate-pdf
 * diretamente com x-invite-token — não esta action.
 */
export async function signTermAction(
  input: SignTermInput,
): Promise<SignTermResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: 'Não autenticado.' }
  }

  const parsed = signTermSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Input inválido.' }

  const h = await headers()
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    null
  const ua = h.get('user-agent') ?? null

  // 1. Gera o PDF do termo. O endpoint reusa a sessão do terapeuta via cookie.
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const cookieHeader = h.get('cookie') ?? ''
  const pdfRes = await fetch(
    `${baseUrl.replace(/\/$/, '')}/api/consent/generate-pdf`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        client_id: parsed.data.client_id,
        reading_id: parsed.data.reading_id,
        cliente_nome: parsed.data.cliente_nome,
        cliente_cpf: parsed.data.cliente_cpf ?? null,
        consent_channel: parsed.data.consent_channel,
      }),
    },
  )
  if (!pdfRes.ok) {
    console.error(`[consent] PDF generation failed ${pdfRes.status}`)
    return { ok: false, error: 'Falha ao gerar PDF do termo.' }
  }
  const { pdf_url, pdf_path } = (await pdfRes.json()) as {
    pdf_url: string | null
    pdf_path: string
  }

  // 2. INSERT client_consents (append-only / trilha de auditoria)
  const sign = await signBiometricTerm({
    client_id: parsed.data.client_id,
    reading_id: parsed.data.reading_id,
    consent_channel: parsed.data.consent_channel,
    ip,
    user_agent: ua,
    cpf_titular: parsed.data.cliente_cpf ?? null,
  })
  if (!sign.ok) return { ok: false, error: sign.error }

  // 3. Atualiza o current-pointer em clients (consent_current_version +
  //    consent_last_at — colunas LIVE; ver nota de schema acima).
  const service = createServiceClient()
  await service
    .from('clients')
    .update({
      consent_current_version: sign.term_version,
      consent_last_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.client_id)
    .eq('therapist_id', user.id) // defensivo

  await logAuditEvent({
    event_type: 'consent.term_signed',
    actor_user_id: user.id,
    actor_email: user.email,
    target_type: 'consent',
    target_id: sign.consent_id,
    metadata: {
      client_id: parsed.data.client_id,
      reading_id: parsed.data.reading_id,
      term_version: sign.term_version,
      consent_channel: parsed.data.consent_channel,
      ip,
      pdf_path,
    },
  })

  // Cópia ao titular (LGPD art. 9 — transparência). Reforça o office_handoff,
  // onde o cliente assina no aparelho do terapeuta: ele recebe no próprio
  // e-mail a evidência do que aceitou. Best-effort — falha de email NÃO
  // invalida o consentimento (trilha legal = client_consents append-only).
  try {
    await notifyClientConsentCopy(
      parsed.data.client_id,
      pdf_url,
      sign.term_version,
    )
  } catch (err) {
    console.error('[consent] envio de cópia ao cliente falhou (non-fatal):', err)
  }

  revalidatePath(`/clientes/${parsed.data.client_id}`)
  return { ok: true, consent_id: sign.consent_id, pdf_url }
}
