/**
 * POST /api/consent/generate-pdf
 *
 * Gera o PDF do termo de consentimento biométrico (LGPD-01, D-17) via
 * Gotenberg (HTML→PDF, Chromium em Render) e faz upload no bucket privado
 * `client-consents` no Supabase Storage. Retorna a signed URL + sha256.
 *
 * Espelha o padrão de apps/web/app/api/readings/[id]/pdf/route.tsx:
 *   - Gotenberg /forms/chromium/convert/html
 *   - AbortController timeout
 *   - GOTENBERG_URL + GOTENBERG_BASIC_AUTH
 *
 * Auth (T-08-08-03 — BLOCKER-6): 2 caminhos.
 *   Path A — sessão de terapeuta logado (RLS confirma ownership na query).
 *   Path B — invite token público (cliente em casa, sem sessão): o token DEVE
 *     ser válido (validateToken → status 'ok') E token.client_id === body.client_id.
 *     Sem isso, atacante enviaria x-invite-token + client_id arbitrário e
 *     receberia PDF de qualquer cliente. validateToken já cobre not_found /
 *     expired / already_used (não existe coluna `status` em client_invite_tokens).
 */
import { NextResponse, type NextRequest } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { hydrateTerm } from '@/lib/consent/hydrate-term'
import { operatorIdentity } from '@/lib/consent/operator'
import { renderTermoHtml } from '@/lib/consent/pdf-template'
import { validateToken } from '@/lib/invite/tokens'

export const runtime = 'nodejs'
export const maxDuration = 30 // single PDF, sem merge

const RENDER_TIMEOUT_MS = 20_000

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const { client_id, reading_id, cliente_nome, cliente_cpf } = body as Record<
    string,
    string | undefined
  >
  // reading_id é OPCIONAL: consultório assina a nível de cliente (sem leitura
  // ainda). client_id + nome bastam pra hidratar + persistir o termo.
  if (!client_id || !cliente_nome) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const inviteToken = request.headers.get('x-invite-token')

  let authOk = false
  let authChannel: 'session' | 'invite_token' = 'session'

  if (user) {
    // Path A: terapeuta logado. A query de clients abaixo usa service-role,
    // então confirmamos ownership explicitamente (defesa: token de outro
    // terapeuta não basta).
    authOk = true
    authChannel = 'session'
  } else if (inviteToken) {
    // Path B: invite token. DEVE bater contra client_invite_tokens (válido +
    // não usado + não expirado) E casar com body.client_id.
    const v = await validateToken(inviteToken)
    if (v.status !== 'ok') {
      console.warn(`[consent-pdf] AUTH_REJECTED token status=${v.status}`)
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    // O token pode estar pré-vinculado (token.client_id) OU já ter sido
    // consumido com used_by_client_id. Ambos devem casar com body.client_id.
    const tokenClientId = v.token.client_id ?? v.token.used_by_client_id
    if (tokenClientId && tokenClientId !== client_id) {
      console.warn(
        `[consent-pdf] AUTH_REJECTED token.client_id mismatch (token=${tokenClientId} body=${client_id})`,
      )
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    authOk = true
    authChannel = 'invite_token'
  }

  if (!authOk) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  console.info(`[consent-pdf] AUTH_OK channel=${authChannel} client=${client_id}`)

  const service = createServiceClient()

  // 1. Carrega client + terapeuta (profiles) + termo vigente
  const [{ data: client }, { data: term }] = await Promise.all([
    service
      .from('clients')
      .select('therapist_id, full_name, profiles!inner(full_name, cpf)')
      .eq('id', client_id)
      .maybeSingle(),
    service
      .from('consent_terms')
      .select('version, body')
      .eq('is_current', true)
      .maybeSingle(),
  ])
  if (!client || !term) {
    return NextResponse.json(
      { error: 'client or term not found' },
      { status: 404 },
    )
  }

  // Defesa Path A: terapeuta logado só gera PDF de cliente PRÓPRIO.
  if (authChannel === 'session' && user && client.therapist_id !== user.id) {
    console.warn(
      `[consent-pdf] AUTH_REJECTED session therapist mismatch (client.therapist=${client.therapist_id} user=${user.id})`,
    )
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const consentTimestampBR =
    now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' BRT'
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  const ua = request.headers.get('user-agent') ?? null

  // 2. Hidrata o termo
  const therapist = (
    client as { profiles: { full_name: string; cpf: string | null } }
  ).profiles
  const { hydrated, sha256 } = hydrateTerm(term.body, {
    ...operatorIdentity(),
    TERAPEUTA_RESPONSAVEL: therapist.full_name,
    TERAPEUTA_CNPJ_CPF: therapist.cpf ?? '',
    TITULAR_NOME: cliente_nome,
    TITULAR_CPF: cliente_cpf ?? '',
    DATA_ACEITE_BR: consentTimestampBR,
    IP_ACEITE: ip ?? '',
  })

  // 3. Render HTML
  const html = renderTermoHtml({
    hydratedMarkdown: hydrated,
    clienteNome: cliente_nome,
    clienteCpf: cliente_cpf ?? null,
    terapeutaNome: therapist.full_name,
    terapeutaCnpjCpf: therapist.cpf ?? null,
    consentTimestampBR,
    consentIp: ip,
    consentUserAgent: ua,
    contentSha256: sha256,
    termVersion: term.version,
  })

  // 4. Gotenberg
  const gotenbergUrl = process.env.GOTENBERG_URL
  if (!gotenbergUrl) {
    console.error('[consent-pdf] GOTENBERG_URL não configurado')
    return NextResponse.json(
      { error: 'PDF service not configured' },
      { status: 503 },
    )
  }

  const form = new FormData()
  form.append('files', new Blob([html], { type: 'text/html' }), 'index.html')

  const headers: Record<string, string> = {}
  const basicAuth = process.env.GOTENBERG_BASIC_AUTH
  if (basicAuth) {
    headers.Authorization = `Basic ${Buffer.from(basicAuth).toString('base64')}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RENDER_TIMEOUT_MS)
  let pdfBuffer: ArrayBuffer
  try {
    const res = await fetch(
      `${gotenbergUrl.replace(/\/$/, '')}/forms/chromium/convert/html`,
      { method: 'POST', body: form, headers, signal: controller.signal },
    )
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error(
        `[consent-pdf] Gotenberg ${res.status}`,
        detail.slice(0, 300),
      )
      return NextResponse.json(
        { error: `PDF render failed (${res.status})` },
        { status: 502 },
      )
    }
    pdfBuffer = await res.arrayBuffer()
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    console.error(
      '[consent-pdf] Gotenberg fetch failed:',
      aborted ? `timeout ${RENDER_TIMEOUT_MS}ms` : err,
    )
    return NextResponse.json({ error: 'PDF render failed' }, { status: 502 })
  } finally {
    clearTimeout(timer)
  }

  // 5. Upload no Supabase Storage (bucket privado client-consents).
  //    Path per-therapist: <therapist_id>/<client_id>/<reading_id>.pdf
  //    upsert:false → immutable (T-08-08-01); re-aceite re-gera (já existe → ok).
  //    reading-level: <therapist>/<client>/<reading>.pdf (imutável).
  //    client-level (consultório, sem reading): <therapist>/<client>/consent.pdf.
  const path = reading_id
    ? `${client.therapist_id}/${client_id}/${reading_id}.pdf`
    : `${client.therapist_id}/${client_id}/consent.pdf`
  const { error: upErr } = await service.storage
    .from('client-consents')
    .upload(path, pdfBuffer, {
      contentType: 'application/pdf',
      // reading-level = imutável (T-08-08-01); client-level sobrescreve pra
      // refletir o re-aceite mais recente (PDF é cópia de conveniência; a
      // trilha legal é client_consents append-only).
      upsert: !reading_id,
    })
  if (upErr && !/already exists/i.test(upErr.message)) {
    console.error('[consent-pdf] upload failed:', upErr.message)
    return NextResponse.json(
      { error: 'storage upload failed' },
      { status: 500 },
    )
  }

  const { data: signed } = await service.storage
    .from('client-consents')
    .createSignedUrl(path, 60 * 60 * 24 * 365) // 1 ano TTL

  return NextResponse.json({
    ok: true,
    pdf_url: signed?.signedUrl ?? null,
    pdf_path: path,
    content_sha256: sha256,
    term_version: term.version,
  })
}
