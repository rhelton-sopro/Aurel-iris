/**
 * Builder do bloco de contexto recente injetado no user content da
 * Etapa 2 — anti-repetição inter-leituras (v2.3.0 Caminho 1).
 *
 * Funcionamento:
 *   1. Antes da chamada Sonnet Etapa 2, query as 10 últimas leituras
 *      do MESMO therapist_id em report_phrases (filtrando
 *      `superseded_at IS NULL` — só current).
 *   2. Monta bloco XML `<relatorios_recentes_deste_terapeuta>` com as
 *      frases-chave de cada uma + idade relativa ("2 dias atrás").
 *   3. Inclui instrução LITERAL do founder: "NÃO repita estas frases
 *      nem variações próximas. Mantenha o MESMO TOM, a MESMA VOZ, o
 *      MESMO REGISTRO — varie só a SINTAXE e a IMAGEM CONCRETA."
 *   4. Injeta como text block antes das 6 imagens no user content
 *      (orquestrador é responsável pela injeção; este módulo só monta).
 *
 * Se o terapeuta tem 0 leituras (primeira leitura ever), retorna
 * string vazia — orquestrador detecta e omite o bloco do user content.
 * Sem memória inter-leituras na primeira; a partir da segunda começa.
 *
 * Best-effort: se a query Supabase falhar (tabela ausente, conexão
 * caída, RLS estranha), retorna empty + console.warn — pipeline NÃO
 * bloqueia. Memória inter-leituras é enhancement, não requirement.
 *
 * v2.3.0 Caminho 1 | Sonnet 2x architecture
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

const RECENT_PHRASES_LIMIT = 10

/**
 * Forma esperada do campo `phrases` em report_phrases.
 * Espelha o output de extract-phrases.ts:ExtractedPhrases.
 */
interface PhrasesPayload {
  sintese_inicial?: string[]
  abertura_secao_10?: string[]
  abertura_secao_14?: string[]
  perfil_secao_15?: string
  em_poucas_palavras?: string
}

interface RecentPhrasesRow {
  reading_id: string
  generated_at: string
  phrases: PhrasesPayload
}

/**
 * Constrói o bloco de contexto pra injetar no user content da Etapa 2.
 * Retorna string vazia se terapeuta não tem leituras anteriores OU se
 * a query falhou (degradação graciosa).
 */
export async function buildRecentPhrasesContext(
  therapistId: string,
): Promise<string> {
  const rows = await fetchRecentPhrases(therapistId)
  if (rows.length === 0) return ''
  return formatContextBlock(rows)
}

async function fetchRecentPhrases(
  therapistId: string,
): Promise<RecentPhrasesRow[]> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('report_phrases')
      .select('reading_id, generated_at, phrases')
      .eq('therapist_id', therapistId)
      .is('superseded_at', null)
      .order('generated_at', { ascending: false })
      .limit(RECENT_PHRASES_LIMIT)

    if (error) {
      console.warn(
        '[recent-phrases-context] query failed; injecting empty context',
        { therapist_id: therapistId, error: error.message },
      )
      return []
    }
    return (data as unknown as RecentPhrasesRow[]) ?? []
  } catch (err) {
    console.warn(
      '[recent-phrases-context] unexpected error; injecting empty context',
      { therapist_id: therapistId, error: (err as Error).message },
    )
    return []
  }
}

function formatContextBlock(rows: RecentPhrasesRow[]): string {
  const now = new Date()
  const sections = rows.map((row, idx) => formatOneRelatorio(row, idx + 1, now))

  const intro = [
    'Aqui estão aberturas e sínteses dos seus relatórios mais recentes',
    'pra este terapeuta. **NÃO repita estas frases nem variações próximas',
    'neste novo relatório.** Mantenha o MESMO TOM, a MESMA VOZ, o MESMO REGISTRO.',
    '',
    'Sobre VARIAÇÃO ESTRUTURAL — atenção máxima:',
    '',
    '- Se uma abertura anterior usou a fórmula "Alguém que aprendeu [verbo],',
    '  a [verbo], a [verbo]...", a nova abertura DEVE ter estrutura sintática',
    '  diferente. Não basta trocar as palavras dentro da mesma fórmula.',
    '- Se uma abertura anterior usou "Esta íris carrega o tema de [X]", a nova',
    '  abertura DEVE começar diferente. Pode ser uma imagem direta, uma pergunta,',
    '  uma afirmação corporal, uma observação visual.',
    '- Se uma abertura anterior usou "[Nome], o que a sua íris me trouxe hoje',
    '  é...", a nova abertura DEVE começar de outro modo.',
    '',
    'REGRA DURA: leia as aberturas anteriores como FÓRMULAS A EVITAR, não como',
    'palavras a substituir. Se a estrutura é igual, não é variação — é repetição',
    'disfarçada.',
  ].join('\n')

  return [
    '<relatorios_recentes_deste_terapeuta>',
    intro,
    sections.join('\n\n'),
    '</relatorios_recentes_deste_terapeuta>',
  ].join('\n\n')
}

function formatOneRelatorio(
  row: RecentPhrasesRow,
  ordinal: number,
  now: Date,
): string {
  const days = daysSince(new Date(row.generated_at), now)
  const ago = formatAgo(days)
  const p = row.phrases ?? {}

  const lines: string[] = [`## Relatório ${ordinal} (${ago})`]
  if (p.sintese_inicial?.length) {
    lines.push(`§1 Síntese inicial — abertura: "${p.sintese_inicial.join(' ')}"`)
  }
  if (p.abertura_secao_10?.length) {
    lines.push(`§10 abertura: "${p.abertura_secao_10.join(' ')}"`)
  }
  if (p.abertura_secao_14?.length) {
    lines.push(`§14 abertura: "${p.abertura_secao_14.join(' ')}"`)
  }
  if (p.perfil_secao_15) {
    lines.push(`🧭 Perfil §15: "${p.perfil_secao_15}"`)
  }
  if (p.em_poucas_palavras) {
    lines.push(`Em poucas palavras: "${p.em_poucas_palavras}"`)
  }
  return lines.join('\n')
}

function daysSince(then: Date, now: Date): number {
  const ms = now.getTime() - then.getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function formatAgo(days: number): string {
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `${days} dias atrás`
  if (days < 14) return '1 semana atrás'
  if (days < 30) return `${Math.floor(days / 7)} semanas atrás`
  if (days < 60) return '1 mês atrás'
  return `${Math.floor(days / 30)} meses atrás`
}
