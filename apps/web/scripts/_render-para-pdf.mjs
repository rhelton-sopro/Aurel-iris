/**
 * Puxa markdown + exame de produção e renderiza o HTML do Mapa do Ser, do jeito que a
 * rota do PDF faz (inclusive removendo o @page, que é o que a rota faz antes de mandar
 * pro Gotenberg). Usado por scripts/pdf-local.mjs.
 */
import { readFileSync } from 'node:fs'
import { renderHTML } from '../_motor-lab/render-novo.mjs'

const RE_AT_PAGE = /@page\s*\{[^}]*\}/g

export async function renderEmocionalStandalone(readingId) {
  const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
  )
  const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY
  const H = { apikey: K, Authorization: `Bearer ${K}` }
  const q = async (p) => (await fetch(`${U}/rest/v1/${p}`, { headers: H })).json()

  const [reading] = await q(`readings?select=report_emocional,client:clients(full_name)&id=eq.${readingId}`)
  if (!reading?.report_emocional) throw new Error('leitura sem Mapa do Ser')
  // superseded_at IS NULL — leitura regerada tem várias linhas (ver DECISOES/memória)
  const [findings] = await q(`report_findings?select=exame_json&reading_id=eq.${readingId}&superseded_at=is.null`)
  const nome = (reading.client?.full_name || 'cliente').trim().split(/\s+/)[0]

  const { html } = renderHTML(reading.report_emocional, findings?.exame_json ?? {}, nome)
  // a rota tira o @page para as bandas de header/footer do Gotenberg caberem nas margens
  return html.replace(RE_AT_PAGE, '')
}
