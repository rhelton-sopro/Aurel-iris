import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { createServiceClient } from '@/lib/supabase/service'

/**
 * `app_settings` não está no Database type gerado (tabela auxiliar — evitamos
 * regenerar tipos por ela; ver lib/admin/client-report-config.ts). Acessamos a
 * tabela por um cliente untyped de propósito, restrito a este módulo server-only.
 */
function appSettingsDb(): SupabaseClient {
  return createServiceClient() as unknown as SupabaseClient
}

/**
 * Fase 12 (Publicação Instagram) — módulo de token do Instagram (IGPUB-01).
 *
 * O token de longa duração (~60d) NÃO pode morar em env Vercel: ele rotaciona em
 * runtime (refresh programático) e env Vercel é imutável em runtime. Por isso ele
 * vive em `app_settings` (migration 0048), chave `instagram_token`, acessível só
 * via service-role (a tabela tem RLS ligado e SEM policies → invisível para
 * clientes autenticados). O IG user id + app secret/id ficam em env Vercel
 * (segredos estáveis que nunca rotacionam).
 *
 * Três responsabilidades:
 *   1. `getValidToken()`        — lê o access_token armazenado (ou null).
 *   2. `refreshInstagramTokenIfNeeded()` — refresha quando faltam <10 dias para
 *      expirar (chamado pelo cron diário; nunca lança — o cron faz `.catch`).
 *   3. `instagramHealthCheck()` — confirma que dá pra publicar (GET /me); falha
 *      é DETECTÁVEL (não-silenciosa) para alimentar o sinal de notificação.
 *
 * Segurança (T-12-04/05/06):
 *   - O valor do access_token NUNCA é logado nem retornado ao client. Erros logam
 *     só code/message do Graph.
 *   - Host PINADO no domínio Instagram Graph (Instagram API with Instagram Login).
 *     NUNCA o domínio Graph do Facebook — host errado com token IG-Login =
 *     spoofing/falha (grep-gate proíbe o host do Facebook neste arquivo).
 *   - `import 'server-only'` impede vazamento para o bundle client.
 */

export const INSTAGRAM_TOKEN_KEY = 'instagram_token'

// Host pinado: Instagram API with Instagram Login (domínio Instagram Graph).
// NUNCA o domínio Graph do Facebook. v23.0 é a versão estável atual no changelog Meta.
const GRAPH = 'https://graph.instagram.com/v23.0'

// Refresha quando faltam <10 dias para expirar. Um cron diário com buffer de 10d
// está muito dentro da janela de 60d → nunca deixa o token lapsar (T-12-07).
const REFRESH_BUFFER_MS = 10 * 24 * 3600 * 1000

/**
 * Formato do valor jsonb armazenado em `app_settings.instagram_token`.
 */
interface StoredToken {
  access_token: string
  expires_at: string // ISO
  obtained_at: string // ISO
  last_refresh_at: string | null
}

/**
 * Lê e valida o StoredToken bruto do app_settings. Retorna null se ausente ou
 * com shape inválido. NUNCA loga o valor do token.
 */
async function readStoredToken(): Promise<StoredToken | null> {
  const db = appSettingsDb()
  const { data } = await db
    .from('app_settings')
    .select('value')
    .eq('key', INSTAGRAM_TOKEN_KEY)
    .maybeSingle()
  const value = (data as { value?: unknown } | null)?.value
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).access_token === 'string' &&
    typeof (value as Record<string, unknown>).expires_at === 'string'
  ) {
    const v = value as Record<string, unknown>
    return {
      access_token: v.access_token as string,
      expires_at: v.expires_at as string,
      obtained_at: typeof v.obtained_at === 'string' ? v.obtained_at : '',
      last_refresh_at:
        typeof v.last_refresh_at === 'string' ? (v.last_refresh_at as string) : null,
    }
  }
  return null
}

/**
 * Retorna o access_token armazenado, ou null se ausente/inválido/erro de leitura.
 * NUNCA loga o valor do token. Em catch, loga só a mensagem de erro (sem o valor).
 */
export async function getValidToken(): Promise<string | null> {
  try {
    const stored = await readStoredToken()
    return stored?.access_token ?? null
  } catch (err) {
    console.error('[instagram-token] leitura falhou', err)
    return null
  }
}

/**
 * Refresha o token quando faltam <10 dias para expirar e regrava o app_settings
 * com o novo token + novo expires_at. NÃO lança — o cron diário faz `.catch`.
 *
 * - sem token configurado → { refreshed: false, error: 'sem token configurado' }
 * - ainda longe de expirar (>10d) → { refreshed: false } (não chama a rede)
 * - <10d → GET refresh_access_token, upsert o novo StoredToken → { refreshed: true }
 * - erro HTTP/parse → { refreshed: false, error } (sem vazar o token)
 */
export async function refreshInstagramTokenIfNeeded(): Promise<{
  refreshed: boolean
  error?: string
}> {
  let stored: StoredToken | null
  try {
    stored = await readStoredToken()
  } catch (err) {
    console.error('[instagram-token] leitura falhou no refresh', err)
    return { refreshed: false, error: 'leitura do token falhou' }
  }

  if (!stored) {
    return { refreshed: false, error: 'sem token configurado' }
  }

  const msToExpiry = new Date(stored.expires_at).getTime() - Date.now()
  if (Number.isNaN(msToExpiry) || msToExpiry > REFRESH_BUFFER_MS) {
    // Ainda longe de expirar (ou expires_at ilegível mas longe o suficiente): não refresha.
    if (Number.isNaN(msToExpiry)) {
      return { refreshed: false, error: 'expires_at inválido' }
    }
    return { refreshed: false }
  }

  try {
    const url = `${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(stored.access_token)}`
    const res = await fetch(url)
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      const code = (body as { error?: { code?: number; message?: string } } | null)?.error
      const reason = code?.message ?? code?.code ?? `HTTP ${res.status}`
      console.error('[instagram-token] refresh falhou', reason)
      return { refreshed: false, error: String(reason) }
    }
    const body = (await res.json()) as { access_token?: unknown; expires_in?: unknown }
    if (typeof body.access_token !== 'string' || typeof body.expires_in !== 'number') {
      console.error('[instagram-token] refresh: resposta sem access_token/expires_in')
      return { refreshed: false, error: 'resposta de refresh inválida' }
    }

    const now = new Date()
    const next: StoredToken = {
      access_token: body.access_token,
      expires_at: new Date(now.getTime() + body.expires_in * 1000).toISOString(),
      obtained_at: stored.obtained_at || now.toISOString(),
      last_refresh_at: now.toISOString(),
    }

    const db = appSettingsDb()
    const { error } = await db
      .from('app_settings')
      .upsert(
        { key: INSTAGRAM_TOKEN_KEY, value: next, updated_at: now.toISOString() },
        { onConflict: 'key' },
      )
    if (error) {
      console.error('[instagram-token] gravação do token refreshado falhou', error.message)
      return { refreshed: false, error: error.message }
    }
    return { refreshed: true }
  } catch (err) {
    console.error('[instagram-token] refresh exception', err instanceof Error ? err.message : err)
    return { refreshed: false, error: 'exceção no refresh' }
  }
}

/**
 * Health-check leve da conexão: GET /me?fields=id com o token armazenado. Falha é
 * DETECTÁVEL (não-silenciosa) para alimentar o sinal de notificação do admin.
 *
 * - sem token → { ok: false, error: 'sem token' }
 * - GET /me 200 com id → { ok: true }
 * - falha → { ok: false, error: <code/message do Graph, SEM o token> }
 */
export async function instagramHealthCheck(): Promise<{ ok: boolean; error?: string }> {
  const token = await getValidToken()
  if (!token) {
    return { ok: false, error: 'sem token' }
  }
  try {
    const url = `${GRAPH}/me?fields=id&access_token=${encodeURIComponent(token)}`
    const res = await fetch(url)
    const body = await res.json().catch(() => null)
    if (res.ok && (body as { id?: unknown } | null)?.id) {
      return { ok: true }
    }
    const graphErr = (body as { error?: { code?: number; message?: string } } | null)?.error
    const reason = graphErr?.message ?? graphErr?.code ?? `HTTP ${res.status}`
    console.error('[instagram-token] health-check falhou', reason)
    return { ok: false, error: String(reason) }
  } catch (err) {
    console.error('[instagram-token] health-check exception', err instanceof Error ? err.message : err)
    return { ok: false, error: 'exceção no health-check' }
  }
}
