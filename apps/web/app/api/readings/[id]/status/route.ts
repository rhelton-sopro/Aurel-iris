/**
 * GET /api/readings/[id]/status
 *
 * Endpoint leve pro client reconciliar estado da reading quando o stream
 * de /analyze é interrompido (iOS background-kill, aba fechada, network
 * drop, etc.). Sem isso, o catch do analise-client mostra "Geração
 * interrompida: Load failed" mesmo quando o backend completou a análise
 * e marcou status=ready — UX confuso, terapeuta queima regen sem
 * necessidade.
 *
 * Contract:
 *   - 401 sem sessão
 *   - 404 se reading não pertence ao therapist (RLS via session client)
 *   - 200 com { status, regeneration_count, has_report }
 *
 * Sem revalidate; cliente decide se chama router.refresh() baseado no
 * status retornado. has_report=true quando report_generated tem chaves
 * suficientes pra renderizar (heurística leve — server parser é
 * autoritativo via /leituras/[id] RSC).
 *
 * v2.4.5 (Frente A — Camada 1)
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: readingId } = await params

  if (!/^[0-9a-f-]{36}$/i.test(readingId)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // RLS via session client garante que terapeuta só lê suas readings.
  const { data, error } = await supabase
    .from('readings')
    .select('status, regeneration_count, report_generated')
    .eq('id', readingId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  // has_report = report_generated não-vazio com pelo menos 1 chave de
  // seção numerada. Heurística leve pra client decidir se router.refresh
  // vai mostrar conteúdo ou só "aguardando".
  const report =
    typeof data.report_generated === 'object' && data.report_generated !== null
      ? (data.report_generated as Record<string, unknown>)
      : null
  const hasReport = report !== null && Object.keys(report).length > 0

  return NextResponse.json({
    status: data.status,
    regeneration_count: data.regeneration_count ?? 0,
    has_report: hasReport,
  })
}
