/**
 * Configuração global da "Versão do cliente" do relatório (2026-06-21).
 *
 * O terapeuta entrega ao cliente uma versão CONDENSADA do relatório completo —
 * um subconjunto de seções. QUAIS seções entram é decisão GLOBAL do founder,
 * editável em /admin/relatorio-cliente (sem deploy). A seleção fica em
 * app_settings (migration 0048), chave 'client_report_sections', como array de
 * heading-numbers INTERNOS ('0' = "Em poucas palavras"; '1'..'15' = numeradas).
 *
 * Acesso só via service-role (a tabela tem RLS ligado e sem policies). Por isso
 * tanto a leitura (PDF route + tela admin) quanto a escrita (action do admin)
 * passam por aqui. server-only — nunca importar no client.
 */
import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { NUMBERED_SECTION_HEADINGS } from '@/lib/anthropic/types'

export const CLIENT_REPORT_SECTIONS_KEY = 'client_report_sections'

/**
 * Default = "enxuto" aprovado pelo founder: §0 Em poucas palavras +
 * §9 Recursos e Forças + §14 Mensagem para o Cliente + §15 Síntese Rápida.
 * (heading-numbers INTERNOS de geração; a numeração que o cliente vê é
 * renumerada por posição no render.)
 */
export const CLIENT_REPORT_SECTIONS_DEFAULT: readonly string[] = ['0', '9', '14', '15']

/** Headings selecionáveis: §0 (abertura) + as 15 numeradas. */
export const ALL_CLIENT_SELECTABLE_HEADINGS: readonly string[] = ['0', ...NUMBERED_SECTION_HEADINGS]

// Cliente untyped de propósito: app_settings ainda não está no Database type
// gerado (evita regenerar tipos por uma tabela auxiliar). O acesso é restrito a
// este módulo server-only.
function serviceDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

/**
 * Seleção global de seções da versão-cliente. Fallback para o default quando a
 * linha não existe, está vazia, ou a leitura falha (nunca quebra a geração do
 * PDF — pior caso, entrega o enxuto).
 */
export async function getClientReportSections(): Promise<string[]> {
  try {
    const db = serviceDb()
    const { data } = await db
      .from('app_settings')
      .select('value')
      .eq('key', CLIENT_REPORT_SECTIONS_KEY)
      .maybeSingle()
    const value = (data as { value?: unknown } | null)?.value
    if (Array.isArray(value)) {
      const arr = value
        .filter((v): v is string => typeof v === 'string')
        .filter((h) => ALL_CLIENT_SELECTABLE_HEADINGS.includes(h))
      if (arr.length > 0) return arr
    }
  } catch (err) {
    console.error('[client-report-config] leitura falhou, usando default', err)
  }
  return [...CLIENT_REPORT_SECTIONS_DEFAULT]
}

/**
 * Grava a seleção global (upsert). Deduplica, descarta valores inválidos e
 * exige pelo menos uma seção (uma versão-cliente vazia não faz sentido).
 */
export async function setClientReportSections(headings: string[]): Promise<void> {
  const clean = [...new Set(headings)].filter((h) => ALL_CLIENT_SELECTABLE_HEADINGS.includes(h))
  if (clean.length === 0) throw new Error('Selecione pelo menos uma seção.')
  const db = serviceDb()
  const { error } = await db
    .from('app_settings')
    .upsert(
      { key: CLIENT_REPORT_SECTIONS_KEY, value: clean, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    )
  if (error) throw new Error(error.message)
}
