import { notFound } from 'next/navigation'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { isFounderEmail } from '@/lib/auth/founder'
import {
  fetchTherapistsMap,
  fetchFunnel,
  fetchQuality,
  fetchCost,
  fetchThroughput,
  resolveRange,
  type RangePreset,
} from '@/lib/admin/reports'

// Cache off — relatório precisa refletir capturas/leituras do minuto.
export const dynamic = 'force-dynamic'

const PRESETS: Array<{ key: RangePreset; label: string }> = [
  { key: 'hoje', label: 'Hoje' },
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: 'tudo', label: 'Tudo' },
]

type SearchParams = Promise<{
  preset?: string
  from?: string
  to?: string
}>

export default async function RelatoriosAdminPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  // Defense-in-depth founder gate (espelha admin/layout.tsx).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isFounderEmail(user.email)) {
    notFound()
  }

  const sp = await searchParams
  const presetParam = isPreset(sp.preset) ? sp.preset : undefined
  const customFrom = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : undefined
  const customTo = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : undefined
  const hasCustom = customFrom && customTo
  const activePreset: RangePreset | undefined = hasCustom ? undefined : (presetParam ?? '7d')
  const range = resolveRange(activePreset, hasCustom ? { from: customFrom, to: customTo } : undefined)

  // Fetch tudo em paralelo. fetchThroughput precisa do mapa de terapeutas.
  const therapistsMap = await fetchTherapistsMap()
  const [funnel, quality, cost, throughput] = await Promise.all([
    fetchFunnel(range),
    fetchQuality(range),
    fetchCost(range),
    fetchThroughput(range, therapistsMap),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-medium">Relatórios</h2>
        <p className="text-sm text-muted-foreground">
          Métricas gerenciais do beta. Período: {formatRange(range)}.
        </p>
      </div>

      {/* Filtro de período */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => {
            const isActive = activePreset === p.key
            return (
              <Link
                key={p.key}
                href={`/admin/relatorios?preset=${p.key}`}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-card hover:bg-muted/40'
                }`}
              >
                {p.label}
              </Link>
            )
          })}
          <form method="GET" className="ml-2 flex items-center gap-2">
            <label className="text-xs text-muted-foreground">De</label>
            <input
              type="date"
              name="from"
              defaultValue={customFrom ?? ''}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs"
            />
            <label className="text-xs text-muted-foreground">até</label>
            <input
              type="date"
              name="to"
              defaultValue={customTo ?? ''}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs"
            />
            <button
              type="submit"
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted/40"
            >
              Aplicar
            </button>
          </form>
        </div>
      </section>

      {/* KPI tiles */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile
          label="Leituras"
          value={funnel.total.toLocaleString('pt-BR')}
          hint={`${funnel.delivered_pct.toFixed(0)}% entregues`}
        />
        <KpiTile
          label="Aproveitamento captura"
          value={
            quality.haiku
              ? `${quality.haiku.aproveitamento_pct.toFixed(1)}%`
              : '—'
          }
          hint={
            quality.haiku
              ? `${quality.haiku.accepted}/${quality.haiku.total} fotos`
              : 'migration 0023 pendente'
          }
        />
        <KpiTile
          label="$ total"
          value={`$${cost.total_usd.toFixed(2)}`}
          hint={
            cost.cost_per_reading_avg != null
              ? `≈ $${cost.cost_per_reading_avg.toFixed(3)} / leitura`
              : 'sem leituras'
          }
        />
        <KpiTile
          label="Autoexame"
          value={`${funnel.self_exam_pct.toFixed(0)}%`}
          hint={`${funnel.self_exam} de ${funnel.total}`}
        />
      </section>

      {/* Bloco 1: Funil */}
      <Block title="Funil de leituras + entrega + autoexame">
        <div className="grid gap-4 sm:grid-cols-2">
          <SimpleTable
            headers={['Status', 'Qtd']}
            rows={
              Object.keys(funnel.by_status).length === 0
                ? [['—', '0']]
                : Object.entries(funnel.by_status)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => [statusLabel(k), v.toLocaleString('pt-BR')])
            }
          />
          <SimpleTable
            headers={['Métrica', 'Valor']}
            rows={[
              ['Leituras no período', funnel.total.toLocaleString('pt-BR')],
              [
                'Entregues ao cliente',
                `${funnel.delivered.toLocaleString('pt-BR')} (${funnel.delivered_pct.toFixed(1)}%)`,
              ],
              [
                'Autoexame (is_self)',
                `${funnel.self_exam.toLocaleString('pt-BR')} (${funnel.self_exam_pct.toFixed(1)}%)`,
              ],
            ]}
          />
        </div>
      </Block>

      {/* Bloco 2: Qualidade */}
      <Block title="Qualidade das fotos">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Haiku gate */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Gate Haiku (pré-upload)
            </h4>
            {quality.haiku ? (
              <SimpleTable
                headers={['Métrica', 'Valor']}
                rows={[
                  ['Tentativas totais', quality.haiku.total.toLocaleString('pt-BR')],
                  [
                    'Aceitas',
                    `${quality.haiku.accepted.toLocaleString('pt-BR')} (${quality.haiku.aproveitamento_pct.toFixed(1)}%)`,
                  ],
                  [
                    'Recusadas',
                    `${quality.haiku.rejected.toLocaleString('pt-BR')} (${(100 - quality.haiku.aproveitamento_pct).toFixed(1)}%)`,
                  ],
                ]}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Migration 0023 ainda não aplicada — sem dados de capture_attempts.
              </p>
            )}
            {quality.haiku && Object.keys(quality.haiku.by_reason).length > 0 && (
              <div className="pt-2">
                <h5 className="mb-1 text-xs text-muted-foreground">Top reasons</h5>
                <SimpleTable
                  headers={['Reason', 'Qtd']}
                  rows={Object.entries(quality.haiku.by_reason)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([k, v]) => [k, v.toLocaleString('pt-BR')])}
                />
              </div>
            )}
          </div>

          {/* Quality_score + canonicalization */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Fotos persistidas + canonicalização
            </h4>
            <SimpleTable
              headers={['Métrica', 'Valor']}
              rows={[
                ['Fotos persistidas', quality.images.total.toLocaleString('pt-BR')],
                [
                  'Quality score médio',
                  quality.images.avg_quality_score != null
                    ? quality.images.avg_quality_score.toFixed(3)
                    : '—',
                ],
                [
                  'Distribuição',
                  `low ${quality.images.bucket_low} · mid ${quality.images.bucket_mid} · high ${quality.images.bucket_high}`,
                ],
                ['—', '—'],
                ['Relatórios gerados', quality.canonicalization.total_reports.toLocaleString('pt-BR')],
                [
                  'Fallbacks canonicalização',
                  `${quality.canonicalization.total_fallbacks} (${quality.canonicalization.fallback_pct_of_photos.toFixed(1)}% das 6 fotos)`,
                ],
                [
                  'Fallback médio por relatório',
                  quality.canonicalization.avg_fallback_per_report != null
                    ? `${quality.canonicalization.avg_fallback_per_report.toFixed(2)} de 6`
                    : '—',
                ],
              ]}
            />
          </div>
        </div>
      </Block>

      {/* Bloco 3: Custo */}
      <Block title="Custo AI">
        <div className="grid gap-4 sm:grid-cols-2">
          <SimpleTable
            headers={['Componente', 'USD']}
            rows={[
              ['Total no período', `$${cost.total_usd.toFixed(4)}`],
              ['Report (Sonnet)', `$${cost.report_usd.toFixed(4)}`],
              ['Canonicalization (bbox)', `$${cost.bbox_usd.toFixed(4)}`],
              [
                'Gate Haiku (validate)',
                cost.haiku_validate_usd != null
                  ? `$${cost.haiku_validate_usd.toFixed(4)}`
                  : 'migration 0023 pendente',
              ],
            ]}
          />
          <SimpleTable
            headers={['Métrica', 'Valor']}
            rows={[
              [
                'Custo médio por leitura',
                cost.cost_per_reading_avg != null
                  ? `$${cost.cost_per_reading_avg.toFixed(4)}`
                  : '—',
              ],
              [
                'P90 por leitura',
                cost.cost_per_reading_p90 != null
                  ? `$${cost.cost_per_reading_p90.toFixed(4)}`
                  : '—',
              ],
              ['Tokens in', cost.tokens_in.toLocaleString('pt-BR')],
              ['Tokens out', cost.tokens_out.toLocaleString('pt-BR')],
              [
                'Latência média report',
                cost.avg_latency_ms != null
                  ? `${(cost.avg_latency_ms / 1000).toFixed(2)}s`
                  : '—',
              ],
            ]}
          />
        </div>
        {Object.keys(cost.by_method).length > 0 && (
          <div className="mt-4">
            <h5 className="mb-1 text-xs text-muted-foreground">Por método</h5>
            <SimpleTable
              headers={['Método', 'USD']}
              rows={Object.entries(cost.by_method)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => [k, `$${v.toFixed(4)}`])}
            />
          </div>
        )}
      </Block>

      {/* Bloco 4: Throughput */}
      <Block title="Throughput por terapeuta + regenerações + erros">
        {throughput.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum terapeuta com atividade no período.
          </p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Terapeuta</th>
                  <th className="px-3 py-2 font-medium text-right">Leituras</th>
                  <th className="px-3 py-2 font-medium text-right">Entregues</th>
                  <th className="px-3 py-2 font-medium text-right">Captura (aproveit.)</th>
                  <th className="px-3 py-2 font-medium">Última leitura</th>
                </tr>
              </thead>
              <tbody>
                {throughput.rows.map((r) => (
                  <tr key={r.therapist_id} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.full_name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.readings_total}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.readings_delivered}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.aproveitamento_pct != null
                        ? `${r.haiku_accepted}/${r.haiku_attempts} (${r.aproveitamento_pct.toFixed(0)}%)`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.last_reading_at
                        ? new Date(r.last_reading_at).toLocaleString('pt-BR')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SimpleTable
            headers={['Métrica', 'Valor']}
            rows={[
              [
                'Regeneration count médio',
                throughput.avg_regeneration != null
                  ? throughput.avg_regeneration.toFixed(2)
                  : '—',
              ],
              [
                'Leituras failed',
                `${throughput.failed_count.toLocaleString('pt-BR')} (${throughput.failed_pct.toFixed(1)}%)`,
              ],
            ]}
          />
          <div>
            <h5 className="mb-1 text-xs text-muted-foreground">Top error_summary</h5>
            {throughput.top_errors.length === 0 ? (
              <p className="text-xs text-muted-foreground">— sem erros no período</p>
            ) : (
              <SimpleTable
                headers={['Erro', 'Qtd']}
                rows={throughput.top_errors.map((e) => [
                  e.error_summary.length > 60
                    ? e.error_summary.slice(0, 60) + '…'
                    : e.error_summary,
                  e.count.toLocaleString('pt-BR'),
                ])}
              />
            )}
          </div>
        </div>
      </Block>
    </div>
  )
}

// ── components locais ─────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-md border bg-card px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

function SimpleTable({
  headers,
  rows,
}: {
  headers: string[]
  rows: Array<Array<string | number>>
}) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/30 text-left text-muted-foreground">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 tabular-nums">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── helpers ───────────────────────────────────────────────────────────

function isPreset(s: string | undefined): s is RangePreset {
  return s === 'hoje' || s === '7d' || s === '30d' || s === 'tudo'
}

function statusLabel(status: string): string {
  switch (status) {
    case 'pending': return 'pending (rascunho)'
    case 'processing': return 'processing'
    case 'ready': return 'ready'
    case 'edited': return 'edited'
    case 'failed': return 'failed'
    default: return status
  }
}

function formatRange(range: { from: string; to: string }): string {
  const f = new Date(range.from).toLocaleDateString('pt-BR')
  const t = new Date(range.to).toLocaleDateString('pt-BR')
  return f === t ? f : `${f} → ${t}`
}
