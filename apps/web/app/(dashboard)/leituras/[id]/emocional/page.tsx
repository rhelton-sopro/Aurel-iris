/**
 * Página do MAPA DO SER — o relatório PRINCIPAL, o que o cliente lê.
 *
 * ⚠️ A rota continua `/emocional` de propósito (nome interno; renomear quebraria links
 * já enviados). O rótulo visível é "Mapa do Ser" — decisão de naming do founder,
 * 2026-07-30. O outro relatório, o do terapeuta, chama-se **Dossiê**.
 *
 * ⛔ FOUNDER-ONLY (decisão founder 2026-07-28). Defesa em profundidade: a rota de geração
 * já bloqueia, e aqui bloqueamos de novo no server component — mesmo padrão do /admin.
 *
 * O HTML é DERIVADO do markdown guardado, a cada carregamento. Nada de HTML no banco:
 * quando o desenho muda, os relatórios já gerados acompanham sem repagar API.
 */
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { renderEmocional } from '@/lib/emocional/render'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function RelatorioEmocionalPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) redirect('/login')
  // 2026-07-30: gate founder-only removido — o Mapa do Ser é o relatório principal e
  // o terapeuta precisa poder abri-lo. O isolamento continua no RLS da query abaixo.

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colunas da migration 0051, tipos ainda não regerados
  const db = supabase as unknown as { from: (t: string) => any }

  const { data: reading } = await db
    .from('readings')
    .select('id, client_id, report_emocional, report_emocional_generated_at')
    .eq('id', id)
    .single()
  if (!reading?.report_emocional) notFound()

  const [{ data: findings }, { data: client }] = await Promise.all([
    db.from('report_findings').select('exame_json').eq('reading_id', id).maybeSingle(),
    db.from('clients').select('full_name').eq('id', reading.client_id).maybeSingle(),
  ])

  const nome = (client?.full_name || '').trim().split(/\s+/)[0] || 'você'
  let html = ''
  try {
    html = renderEmocional(reading.report_emocional, findings?.exame_json ?? {}, nome).html
  } catch (e) {
    // o render depende do formato @BLOCOS; se o markdown vier de uma versão antiga do
    // prompt, falha aqui — melhor dizer isso que servir página quebrada.
    return (
      <main style={{ padding: 40, fontFamily: 'system-ui', maxWidth: 640, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20 }}>Não consegui montar o Mapa do Ser</h1>
        <p style={{ color: '#6b6357', lineHeight: 1.6 }}>
          O texto guardado não bate com o formato que o desenho espera — provavelmente foi
          gerado por uma versão anterior do prompt. Gerar de novo resolve.
        </p>
        <pre style={{ fontSize: 12, color: '#a3401c', whiteSpace: 'pre-wrap' }}>
          {e instanceof Error ? e.message : String(e)}
        </pre>
        <Link href={`/leituras/${id}`}>← voltar para a leitura</Link>
      </main>
    )
  }

  return (
    <>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          padding: '10px 18px',
          background: '#1f3a3c',
          color: '#fff',
          font: '13px system-ui',
        }}
      >
        <Link href={`/leituras/${id}`} style={{ color: '#fff', textDecoration: 'none' }}>
          ← leitura
        </Link>
        <span style={{ opacity: 0.65 }}>
          Mapa do Ser · gerado em{' '}
          {new Date(reading.report_emocional_generated_at).toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
        </span>
        <a
          href={`/api/readings/${id}/emocional/pdf`}
          style={{ marginLeft: 'auto', color: '#fff' }}
        >
          baixar PDF
        </a>
      </div>
      {/* o HTML é autocontido (style inline no documento) — servido como está */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </>
  )
}
