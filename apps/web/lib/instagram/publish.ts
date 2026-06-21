import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

import type { SocialPost } from '@/lib/admin/social-posts'
import { getValidToken } from '@/lib/instagram/token'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Fase 12 (Publicação Instagram) — coração do motor de publicação (Plan 03).
 *
 * Um único núcleo (`publishClaimed`) com DOIS entry-points (D-08):
 *   - `publishDuePosts()` — varredura idempotente chamada pelo cron (sweep).
 *   - `publishPost(id)`   — um id, chamada por "publicar agora" no painel.
 *
 * O núcleo monta o container Graph (imagem única / carrossel / reel com poll),
 * publica via `media_publish`, e em sucesso grava ig_media_id + ig_permalink +
 * status 'publicado' (IGPUB-06); em falha classifica o erro (D-03) em
 * retryável (→ 'agendado', sob o cap publish_attempts<3) ou permanente (→ 'erro').
 *
 * Segurança:
 *   - HOST PINADO: `graph.instagram.com/v23.0` (Instagram API with Instagram
 *     Login). NUNCA o domínio Graph do Facebook (host errado com token IG-Login =
 *     spoofing/falha; T-12-11, grep-gate proíbe o host do Facebook neste arquivo).
 *   - ANTI-SSRF (T-12-08): image_url/video_url são montados SOMENTE de
 *     `NEXT_PUBLIC_SITE_URL` + caminho relativo armazenado em `media`. Nunca
 *     aceitamos URL absoluta externa vinda do banco.
 *   - O access_token NUNCA é logado (T-12-09): erros logam só code/message.
 *   - `import 'server-only'` impede vazamento para o bundle client.
 */

// Host pinado: Instagram API with Instagram Login. NUNCA o domínio Graph do Facebook.
const GRAPH = 'https://graph.instagram.com/v23.0'

// Cap de posts reivindicados por varredura do cron.
const SWEEP_CAP = 10

// Carrossel: máximo de slides aceitos pela API (Pattern 3).
const CAROUSEL_MAX = 10

// Reel poll (Pattern 4): a cada 8s até FINISHED, limite ~100s (dentro do maxDuration).
const REEL_POLL_MAX_MS = 100_000
const REEL_POLL_INTERVAL_MS = 8_000

// IG user id (Instagram Business Account) — segredo estável em env Vercel.
const IG_USER_ID = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID

// Códigos de erro RETRYÁVEIS do Graph (D-03 — RESEARCH §"Retryable vs Permanent").
//   9007 — mídia ainda não processada (transient)
//   4    — app/req rate limit (throttled)
const RETRYABLE_GRAPH_CODES = new Set([9007, 4])

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface PublishResult {
  ok: boolean
  mediaId?: string
  permalink?: string
  error?: string
  /** Erro retryável que devolveu o post a 'agendado' (não consumiu além do attempt já contado). */
  retried?: boolean
}

export interface SweepResult {
  published: number
  retried: number
  failed: number
  errors: number
}

/**
 * Erro do Graph carregando o `code` numérico (quando disponível) para a
 * classificação retryável/permanente em `markError`.
 */
class GraphError extends Error {
  code?: number
  status?: number
  constructor(message: string, opts?: { code?: number; status?: number }) {
    super(message)
    this.name = 'GraphError'
    this.code = opts?.code
    this.status = opts?.status
  }
}

/**
 * Erro de autenticação (token null / code 190). NÃO é erro do post: o post volta
 * a 'agendado' e o health-check/notificação (D-07) trata o token.
 */
class IgAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IgAuthError'
  }
}

type ServiceClient = SupabaseClient<Database>

/**
 * Monta a URL absoluta de uma mídia a partir do caminho relativo armazenado no
 * banco + `NEXT_PUBLIC_SITE_URL` (allowlist anti-SSRF, T-12-08). Se o valor já
 * vier como URL absoluta, REJEITA — nunca entregamos à Meta uma URL externa
 * arbitrária vinda do DB.
 */
function absoluteMediaUrl(rel: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL
  if (!base) {
    throw new GraphError('NEXT_PUBLIC_SITE_URL não configurado')
  }
  if (/^https?:\/\//i.test(rel)) {
    throw new GraphError('URL de mídia absoluta não permitida (anti-SSRF)')
  }
  const baseTrim = base.replace(/\/+$/, '')
  const path = rel.startsWith('/') ? rel : `/${rel}`
  return `${baseTrim}${path}`
}

/**
 * Untyped `.rpc` (as RPCs da migration 0049 não estão no Database type gerado
 * até o founder rodar gen:types pós-db-push). Restrito a este módulo server-only.
 */
function rpc(
  service: ServiceClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<{ data: unknown; error: { message: string } | null }> {
  return (
    service.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  )(fn, args)
}

/**
 * POST {GRAPH}/... form-urlencoded; lança GraphError com o code do Graph em falha.
 * NUNCA loga o access_token (T-12-09).
 */
async function graphPost(
  path: string,
  params: Record<string, string>,
): Promise<{ id: string }> {
  const body = new URLSearchParams(params)
  const res = await fetch(`${GRAPH}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !(json as { id?: unknown } | null)?.id) {
    const gErr = (json as { error?: { code?: number; message?: string } } | null)
      ?.error
    throw new GraphError(gErr?.message ?? `HTTP ${res.status}`, {
      code: gErr?.code,
      status: res.status,
    })
  }
  return { id: String((json as { id: string }).id) }
}

/**
 * GET {GRAPH}/...&fields=...; retorna o json parseado. Lança GraphError em !ok.
 */
async function graphGet(
  path: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams(params)
  const res = await fetch(`${GRAPH}/${path}?${qs.toString()}`)
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const gErr = (json as { error?: { code?: number; message?: string } } | null)
      ?.error
    throw new GraphError(gErr?.message ?? `HTTP ${res.status}`, {
      code: gErr?.code,
      status: res.status,
    })
  }
  return (json ?? {}) as Record<string, unknown>
}

/**
 * Reivindica em LOTE os posts agendados vencidos (RPC claim_due_social_posts,
 * migration 0049). Portão de idempotência (IGPUB-02, T-12-01): flipa
 * 'agendado → publicando' com `for update skip locked`. A 2ª passada recebe [].
 */
export async function claimDue(
  service: ServiceClient,
  pLimit: number,
): Promise<SocialPost[]> {
  const { data, error } = await rpc(service, 'claim_due_social_posts', {
    p_limit: pLimit,
  })
  if (error) {
    throw new Error(`claimDue(${pLimit}): ${error.message}`)
  }
  return (data ?? []) as SocialPost[]
}

/**
 * Publica um container e retorna o mediaId publicado.
 */
async function mediaPublish(token: string, creationId: string): Promise<string> {
  const { id } = await graphPost(`${IG_USER_ID}/media_publish`, {
    creation_id: creationId,
    access_token: token,
  })
  return id
}

/**
 * Após publicar, lê o permalink (IGPUB-06, Pattern 5).
 */
async function fetchPermalink(
  token: string,
  mediaId: string,
): Promise<string | undefined> {
  const data = await graphGet(mediaId, {
    fields: 'id,permalink',
    access_token: token,
  })
  const permalink = data.permalink
  return typeof permalink === 'string' ? permalink : undefined
}

/**
 * Monta o container de IMAGEM ÚNICA (Pattern 2) → containerId.
 */
async function buildImageContainer(
  token: string,
  imageRel: string,
  caption: string,
): Promise<string> {
  const { id } = await graphPost(`${IG_USER_ID}/media`, {
    image_url: absoluteMediaUrl(imageRel),
    caption,
    access_token: token,
  })
  return id
}

/**
 * Monta o container de CARROSSEL (Pattern 3, IGPUB-03): N child containers
 * (is_carousel_item=true) na ordem → 1 parent CAROUSEL com children + caption.
 */
async function buildCarouselContainer(
  token: string,
  slides: string[],
  caption: string,
): Promise<string> {
  const capped = slides.slice(0, CAROUSEL_MAX)
  const childIds: string[] = []
  for (const slide of capped) {
    const { id } = await graphPost(`${IG_USER_ID}/media`, {
      image_url: absoluteMediaUrl(slide),
      is_carousel_item: 'true',
      access_token: token,
    })
    childIds.push(id)
  }
  const { id: parentId } = await graphPost(`${IG_USER_ID}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
    access_token: token,
  })
  return parentId
}

/**
 * Monta o container de REEL (Pattern 4, IGPUB-04): cria media_type=REELS, então
 * POLLA `status_code` até FINISHED antes de devolver o containerId. ERROR/EXPIRED
 * → lança GraphError permanente. IN_PROGRESS → continua até o limite de tempo.
 */
async function buildReelContainer(
  token: string,
  videoRel: string,
  caption: string,
): Promise<string> {
  const { id: containerId } = await graphPost(`${IG_USER_ID}/media`, {
    media_type: 'REELS',
    video_url: absoluteMediaUrl(videoRel),
    caption,
    access_token: token,
  })

  const deadline = Date.now() + REEL_POLL_MAX_MS
  // poll obrigatório: NUNCA publicar antes de FINISHED (T-12-10).
  for (;;) {
    const data = await graphGet(containerId, {
      fields: 'status_code',
      access_token: token,
    })
    const statusCode = String(data.status_code ?? '')
    if (statusCode === 'FINISHED') {
      return containerId
    }
    if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
      throw new GraphError(`reel container ${statusCode}`, { code: 2207001 })
    }
    // IN_PROGRESS (ou desconhecido) → continua até o limite.
    if (Date.now() + REEL_POLL_INTERVAL_MS > deadline) {
      // estourou a janela: trata como retryável (próxima passada continua).
      throw new GraphError('reel ainda processando (poll timeout)', { code: 9007 })
    }
    await new Promise((r) => setTimeout(r, REEL_POLL_INTERVAL_MS))
  }
}

/**
 * NÚCLEO de publicação (D-08). Monta o container correto pelo `media.kind`,
 * publica via media_publish, lê o permalink e grava o sucesso. Lança em falha
 * (capturado por markError pelos entry-points).
 */
async function publishClaimed(
  service: ServiceClient,
  post: SocialPost,
): Promise<PublishResult> {
  const token = await getValidToken()
  if (!token) {
    throw new IgAuthError('sem token de publicação')
  }
  if (!IG_USER_ID) {
    throw new GraphError('INSTAGRAM_BUSINESS_ACCOUNT_ID não configurado')
  }

  const media = post.media
  const caption = post.caption ?? ''
  let containerId: string

  if (media && 'kind' in media && media.kind === 'carrossel') {
    containerId = await buildCarouselContainer(token, media.slides, caption)
  } else if (media && 'kind' in media && media.kind === 'reel') {
    containerId = await buildReelContainer(token, media.video, caption)
  } else if (media && 'kind' in media && media.kind === 'post') {
    containerId = await buildImageContainer(token, media.image, caption)
  } else {
    throw new GraphError(`mídia sem kind reconhecível (post ${post.id})`)
  }

  const mediaId = await mediaPublish(token, containerId)
  const permalink = await fetchPermalink(token, mediaId)

  const now = new Date().toISOString()
  const { error } = await service
    .from('social_posts')
    .update({
      status: 'publicado',
      ig_media_id: mediaId,
      ig_permalink: permalink ?? null,
      ig_container_id: containerId,
      published_at: now,
      publish_error: null,
      updated_at: now,
    } as never)
    .eq('id', post.id)
  if (error) {
    // gravar sucesso falhou: trata como retryável (não perdemos a publicação real,
    // mas a row precisa ser reconciliada na próxima passada).
    throw new GraphError(`gravação do sucesso falhou: ${error.message}`, {
      code: 4,
    })
  }

  return { ok: true, mediaId, permalink }
}

/**
 * Classifica a falha (D-03 — RESEARCH §"Retryable vs Permanent") e grava o estado.
 *   - AUTH (IgAuthError / code 190): NÃO marca erro do post → volta a 'agendado'
 *     e loga AUTH (o health-check/notificação D-07 trata o token).
 *   - retryável (9007 / rate / 5xx) E publish_attempts < 3 → volta a 'agendado'
 *     (publish_error informativo). retried:true.
 *   - permanente (24 / 2207xxx / reel ERROR/EXPIRED) OU attempts >= 3 → 'erro'.
 * NUNCA loga token/secret (T-12-09).
 */
async function markError(
  service: ServiceClient,
  post: SocialPost,
  err: unknown,
): Promise<PublishResult> {
  const now = new Date().toISOString()

  // AUTH: não queima a tentativa como erro do post.
  const code = err instanceof GraphError ? err.code : undefined
  const status = err instanceof GraphError ? err.status : undefined
  if (err instanceof IgAuthError || code === 190) {
    console.error('[instagram-publish] AUTH — post devolvido a agendado', post.id)
    await service
      .from('social_posts')
      .update({ status: 'agendado', updated_at: now } as never)
      .eq('id', post.id)
    return { ok: false, error: 'auth', retried: true }
  }

  const message =
    err instanceof Error ? err.message : 'erro desconhecido na publicação'

  const isRetryableCode =
    (typeof code === 'number' && RETRYABLE_GRAPH_CODES.has(code)) ||
    (typeof status === 'number' && status >= 500)

  // O claim (RPC) JÁ incrementou publish_attempts → a row reflete o nº pós-claim.
  const attempts = post.publish_attempts ?? 0
  const canRetry = isRetryableCode && attempts < 3

  if (canRetry) {
    console.error(
      `[instagram-publish] retryável (code=${code ?? status}) post=${post.id} → agendado`,
    )
    await service
      .from('social_posts')
      .update({
        status: 'agendado',
        publish_error: message,
        updated_at: now,
      } as never)
      .eq('id', post.id)
    return { ok: false, error: message, retried: true }
  }

  // permanente OU tentativas esgotadas → erro terminal.
  console.error(
    `[instagram-publish] permanente/esgotado (code=${code ?? status}) post=${post.id} → erro`,
  )
  await service
    .from('social_posts')
    .update({
      status: 'erro',
      publish_error: message,
      updated_at: now,
    } as never)
    .eq('id', post.id)
  return { ok: false, error: message }
}

/**
 * VARREDURA do cron (sweep). Reaper de presos → claim em lote → publica cada um.
 * Idempotente: o claim atômico garante que dois runs sobrepostos não colidem.
 */
export async function publishDuePosts(): Promise<SweepResult> {
  const service = createServiceClient() as unknown as ServiceClient

  // 1. recupera rows presas em 'publicando' há >15min (crash recovery).
  await rpc(service, 'reap_stuck_publishing', {}).catch((e) =>
    console.error(
      '[instagram-publish] reap_stuck_publishing falhou',
      e instanceof Error ? e.message : e,
    ),
  )

  // 2. claim em lote.
  const claimed = await claimDue(service, SWEEP_CAP)

  // 3. publica cada um, agregando contadores.
  const result: SweepResult = { published: 0, retried: 0, failed: 0, errors: 0 }
  for (const post of claimed) {
    const r = await publishClaimed(service, post).catch((e) =>
      markError(service, post, e),
    )
    if (r.ok) result.published += 1
    else if (r.retried) result.retried += 1
    else result.failed += 1
  }
  return result
}

/**
 * "Publicar agora" (D-08): claim de UM id → mesmo núcleo. Retorna não-publicável
 * se a RPC não devolver row (já publicado ou em andamento).
 */
export async function publishPost(id: string): Promise<PublishResult> {
  if (!UUID_RE.test(id)) {
    return { ok: false, error: 'id inválido' }
  }
  const service = createServiceClient() as unknown as ServiceClient

  const { data, error } = await rpc(service, 'claim_one_social_post', { p_id: id })
  if (error) {
    return { ok: false, error: error.message }
  }
  const rows = (data ?? []) as SocialPost[]
  const post = rows[0]
  if (!post) {
    return {
      ok: false,
      error: 'não-publicável (já publicado ou em andamento)',
    }
  }

  return publishClaimed(service, post).catch((e) => markError(service, post, e))
}
