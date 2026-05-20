/**
 * Geração e validação de tokens de convite (client_invite_tokens — 0025).
 *
 * Token format: 32 chars URL-safe base64url (256 bits efetivos — sobra
 * pra resistir colisão/bruteforce no horizonte do beta). `crypto.
 * randomBytes(24)` → 32 chars base64url (24 * 4 / 3 = 32). Cabe na URL
 * tipo `iriscodex.com/convite/abc...` sem ficar feio.
 *
 * Validação: SELECT por token + cheques (used_at IS NULL E expires_at >
 * now()). Não fazemos UPDATE de used_at aqui — só na finalização da
 * captura (rota /api/convite/[token]/finalize). Single-use é enforced
 * pela mesma checagem no path crítico: se used_at não-null, retorna
 * inválido e a UI volta 404.
 *
 * Service-role: este módulo é server-only e SEMPRE usa service client
 * para bypassar RLS — o path público não tem sessão.
 */
import 'server-only'

import { randomBytes } from 'node:crypto'

import { createServiceClient } from '@/lib/supabase/service'

export interface InviteTokenRow {
  id: string
  token: string
  therapist_id: string
  client_id: string | null
  created_at: string
  expires_at: string
  used_at: string | null
  used_by_client_id: string | null
  used_by_reading_id: string | null
}

export type ValidateResult =
  | { status: 'ok'; token: InviteTokenRow }
  | { status: 'not_found' }
  | { status: 'expired' }
  | { status: 'already_used' }

/** Gera 32 chars URL-safe base64url. Não-encontrável por força bruta. */
export function generateToken(): string {
  return randomBytes(24)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Lookup + cheques semânticos. NÃO faz UPDATE — chamado em todo request
 * público (GET na page, POST nas APIs); marcação de used_at vive na
 * finalização da captura.
 */
export async function validateToken(token: string): Promise<ValidateResult> {
  if (!token || token.length < 16 || token.length > 64) {
    return { status: 'not_found' }
  }
  const service = createServiceClient()
  const { data, error } = await service
    .from('client_invite_tokens' as never)
    .select(
      'id, token, therapist_id, client_id, created_at, expires_at, used_at, used_by_client_id, used_by_reading_id',
    )
    .eq('token', token)
    .maybeSingle<InviteTokenRow>()
  if (error || !data) return { status: 'not_found' }
  if (data.used_at) return { status: 'already_used' }
  if (new Date(data.expires_at) <= new Date()) return { status: 'expired' }
  return { status: 'ok', token: data }
}

/**
 * Marca o token como usado e vincula client_id + reading_id. Chamado UMA
 * vez por convite, na finalização da captura. Idempotente — se já marcado
 * (used_at != NULL), não sobrescreve (evita race condition entre 2
 * requests de finalize concorrentes).
 */
export async function markTokenUsed(
  tokenId: string,
  clientId: string,
  readingId: string,
): Promise<{ error?: string }> {
  const service = createServiceClient()
  // .update + .is('used_at', null) garante que se outro request já
  // marcou, este falha silencioso (count=0, sem erro).
  const { error } = await service
    .from('client_invite_tokens' as never)
    .update({
      used_at: new Date().toISOString(),
      used_by_client_id: clientId,
      used_by_reading_id: readingId,
    } as never)
    .eq('id', tokenId)
    .is('used_at', null)
  if (error) return { error: error.message }
  return {}
}

/** Resolve o URL completo do convite a partir do token. */
export function buildInviteUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/convite/${token}`
}
