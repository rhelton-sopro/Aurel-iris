'use server'

import 'server-only'

import { headers } from 'next/headers'

import { createServiceClient } from '@/lib/supabase/service'
import { signBiometricTerm } from '@/lib/consent/sign'
import { logAuditEvent } from '@/lib/audit/log'
import { validateToken } from '@/lib/invite/tokens'

import {
  signInviteTermSchema,
  type SignInviteTermInput,
  type SignInviteTermResult,
} from './invite-consent.schemas'

/**
 * signInviteTermAction — assinatura do termo biométrico no fluxo PÚBLICO de
 * convite (remote_link), onde NÃO existe sessão de terapeuta.
 *
 * BILLING-03 + LGPD-01 (D-19) — Decisão A+ (founder 2026-05-28). Este é o ponto
 * onde o CLIENTE (em casa, sem login) assina o termo ANTES de iniciar a captura
 * das fotos de íris. O token do convite é o mecanismo de autenticação.
 *
 * Por que NÃO reusa signTermAction (08-08): signTermAction exige
 * `supabase.auth.getUser()` (sessão de terapeuta). O cliente do convite não tem
 * sessão. Esta action espelha a lógica de signTermAction mas autentica via
 * validateToken + match de client_id, e chama /api/consent/generate-pdf com o
 * header `x-invite-token` (Path B do route — T-08-08-03).
 *
 * Fluxo: valida token → gera PDF (x-invite-token) → INSERT client_consents
 * (append-only) → atualiza current-pointer clients.consent_last_at +
 * consent_current_version → logAuditEvent. consent_channel='remote_link'.
 */
export async function signInviteTermAction(
  input: SignInviteTermInput,
): Promise<SignInviteTermResult> {
  const parsed = signInviteTermSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Dados inválidos.' }

  // 1. Auth: token DEVE ser válido E casar com o client_id passado.
  const v = await validateToken(parsed.data.token)
  if (v.status !== 'ok') {
    return { ok: false, error: 'Convite inválido ou expirado.' }
  }
  const tokenClientId = v.token.client_id ?? v.token.used_by_client_id
  if (tokenClientId && tokenClientId !== parsed.data.client_id) {
    return { ok: false, error: 'Convite não corresponde a este cliente.' }
  }
  // Defesa em profundidade: o cliente deve pertencer ao terapeuta do token.
  const service = createServiceClient()
  const { data: client } = await service
    .from('clients')
    .select('id, therapist_id')
    .eq('id', parsed.data.client_id)
    .maybeSingle()
  if (!client || client.therapist_id !== v.token.therapist_id) {
    return { ok: false, error: 'Convite não corresponde a este cliente.' }
  }

  const h = await headers()
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    null
  const ua = h.get('user-agent') ?? null

  // 2. Gera o PDF via Path B (x-invite-token). O route valida token + client_id
  //    match novamente (defesa server-side independente do client).
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  let pdfPath: string | null = null
  let pdfUrl: string | null = null
  try {
    const pdfRes = await fetch(
      `${baseUrl.replace(/\/$/, '')}/api/consent/generate-pdf`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-invite-token': parsed.data.token,
        },
        body: JSON.stringify({
          client_id: parsed.data.client_id,
          reading_id: parsed.data.reading_id,
          cliente_nome: parsed.data.cliente_nome,
          cliente_cpf: parsed.data.cliente_cpf ?? null,
          consent_channel: 'remote_link',
        }),
        cache: 'no-store',
      },
    )
    if (!pdfRes.ok) {
      console.error(`[invite-consent] PDF generation failed ${pdfRes.status}`)
      return { ok: false, error: 'Falha ao gerar o termo. Tente novamente.' }
    }
    const j = (await pdfRes.json()) as {
      pdf_url: string | null
      pdf_path: string
    }
    pdfUrl = j.pdf_url
    pdfPath = j.pdf_path
  } catch (err) {
    console.error(
      '[invite-consent] PDF fetch threw:',
      err instanceof Error ? err.message : err,
    )
    return { ok: false, error: 'Falha ao gerar o termo. Tente novamente.' }
  }

  // 3. INSERT client_consents (append-only / trilha de auditoria jurídica).
  const sign = await signBiometricTerm({
    client_id: parsed.data.client_id,
    reading_id: parsed.data.reading_id,
    consent_channel: 'remote_link',
    ip,
    user_agent: ua,
    cpf_titular: parsed.data.cliente_cpf ?? null,
  })
  if (!sign.ok) {
    return { ok: false, error: 'Falha ao registrar o aceite. Tente novamente.' }
  }

  // 4. Atualiza o current-pointer LIVE em clients (o que o termo-gate lê).
  //    Sem sessão: service-role + filtro pelo therapist_id do token (defensivo).
  await service
    .from('clients')
    .update({
      consent_current_version: sign.term_version,
      consent_last_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.client_id)
    .eq('therapist_id', v.token.therapist_id)

  // 5. Audit (best-effort). actor = terapeuta dono do token (não há user logado).
  await logAuditEvent({
    event_type: 'consent.term_signed',
    actor_user_id: v.token.therapist_id,
    target_type: 'consent',
    target_id: sign.consent_id,
    metadata: {
      client_id: parsed.data.client_id,
      reading_id: parsed.data.reading_id,
      term_version: sign.term_version,
      consent_channel: 'remote_link',
      ip,
      pdf_path: pdfPath,
      entry_point: 'invite_capture',
    },
  })

  return { ok: true, consent_id: sign.consent_id, pdf_url: pdfUrl }
}
