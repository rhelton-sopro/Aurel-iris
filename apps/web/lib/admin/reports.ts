/**
 * Data fetchers do /admin/relatorios — todos founder-only via service
 * client (bypassa RLS p/ rollups cross-terapeuta). Layer-1 do gate é o
 * isFounderEmail nas pages; este módulo NÃO checa identidade.
 *
 * Todas as funções recebem {from, to} (timestamptz inclusive) e SEMPRE
 * filtram por created_at — sem date range a tabela é beta inteira.
 *
 * `capture_attempts` (migration 0023) ainda não está em types/database.ts;
 * casts `as never` ficam até o founder rodar `supabase gen types` após
 * aplicar a migration. Se a tabela não existir ainda (migration pendente),
 * as funções engolem o erro e retornam zeros — a página renderiza com
 * "sem dados ainda" no bloco de Qualidade.
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { isFounderEmail } from '@/lib/auth/founder'

export interface DateRange {
  from: string // ISO timestamp inclusivo
  to: string   // ISO timestamp inclusivo
}

export interface TherapistInfo {
  id: string
  full_name: string
  email: string
}

/**
 * Map de profiles + auth.users — usado p/ rotular linhas por nome+email
 * em todos os blocos. Founder filtrado (não vira linha de "terapeuta").
 */
export async function fetchTherapistsMap(): Promise<Map<string, TherapistInfo>> {
  const service = createServiceClient()
  const [profilesRes, usersRes] = await Promise.all([
    service.from('profiles').select('id, full_name'),
    service.auth.admin.listUsers({ perPage: 200 }),
  ])
  const users = usersRes.data?.users ?? []
  const map = new Map<string, TherapistInfo>()
  for (const p of profilesRes.data ?? []) {
    const u = users.find((x) => x.id === p.id)
    const email = u?.email ?? '(sem email)'
    if (isFounderEmail(email)) continue
    map.set(p.id, {
      id: p.id,
      full_name: (p.full_name as string | null) ?? '(sem nome)',
      email,
    })
  }
  return map
}

// ── 1. FUNIL DE LEITURAS + ENTREGA + AUTOEXAME ─────────────────────────

export interface FunnelStats {
  total: number
  by_status: Record<string, number> // pending/processing/ready/edited/failed
  delivered: number
  delivered_pct: number
  self_exam: number
  self_exam_pct: number
}

export async function fetchFunnel(range: DateRange): Promise<FunnelStats> {
  const service = createServiceClient()
  const { data } = await service
    .from('readings')
    .select('id, status, is_delivered, client:clients(is_self)')
    .gte('created_at', range.from)
    .lte('created_at', range.to)

  const rows = data ?? []
  const by_status: Record<string, number> = {}
  let delivered = 0
  let self_exam = 0
  for (const r of rows) {
    const status = (r.status as string | null) ?? 'pending'
    by_status[status] = (by_status[status] ?? 0) + 1
    if (r.is_delivered) delivered++
    const c = Array.isArray(r.client) ? r.client[0] : r.client
    if (c?.is_self) self_exam++
  }
  const total = rows.length
  return {
    total,
    by_status,
    delivered,
    delivered_pct: pct(delivered, total),
    self_exam,
    self_exam_pct: pct(self_exam, total),
  }
}

// ── 2. QUALIDADE DAS FOTOS ─────────────────────────────────────────────

export interface QualityStats {
  // Gate Haiku pre-upload (capture_attempts). NULL se migration 0023 pendente.
  haiku: {
    total: number
    accepted: number
    rejected: number
    aproveitamento_pct: number
    by_reason: Record<string, number> // sem_olho/dois_olhos/.../olho_detectado
  } | null
  // Quality score persistido em reading_images (das fotos JÁ aceitas).
  images: {
    total: number
    avg_quality_score: number | null
    // Distribuição em buckets simples.
    bucket_low: number     // <0.5
    bucket_mid: number     // 0.5-0.75
    bucket_high: number    // >=0.75
  }
  // Canonicalization (Sonnet-bbox rejeição de framing).
  canonicalization: {
    total_reports: number
    total_fallbacks: number
    avg_fallback_per_report: number | null
    // % das 6 fotos que caíram em fallback (somatório / (reports × 6)).
    fallback_pct_of_photos: number
  }
}

export async function fetchQuality(range: DateRange): Promise<QualityStats> {
  const service = createServiceClient()

  // (a) Haiku gate via capture_attempts (migration 0023; pode não existir).
  let haiku: QualityStats['haiku'] = null
  try {
    const { data, error } = await service
      .from('capture_attempts' as never)
      .select('accepted, vlm_reason')
      .gte('created_at', range.from)
      .lte('created_at', range.to)
    if (!error) {
      const rows = (data ?? []) as Array<{ accepted: boolean; vlm_reason: string }>
      let accepted = 0
      const by_reason: Record<string, number> = {}
      for (const r of rows) {
        if (r.accepted) accepted++
        by_reason[r.vlm_reason] = (by_reason[r.vlm_reason] ?? 0) + 1
      }
      const total = rows.length
      haiku = {
        total,
        accepted,
        rejected: total - accepted,
        aproveitamento_pct: pct(accepted, total),
        by_reason,
      }
    }
  } catch {
    // Tabela inexistente / qualquer erro → bloco fica null, UI mostra
    // "migration 0023 pendente".
  }

  // (b) reading_images.quality_score das fotos aceitas.
  // Restringe pela janela via JOIN em readings.created_at (proxy razoável
  // — reading_images não tem created_at indexável aqui).
  const { data: readingsInWindow } = await service
    .from('readings')
    .select('id')
    .gte('created_at', range.from)
    .lte('created_at', range.to)
  const readingIds = (readingsInWindow ?? []).map((r) => r.id as string)
  let avg_quality_score: number | null = null
  let imgs_total = 0
  let bucket_low = 0
  let bucket_mid = 0
  let bucket_high = 0
  if (readingIds.length > 0) {
    const { data: imgs } = await service
      .from('reading_images')
      .select('quality_score')
      .in('reading_id', readingIds)
    const scores = (imgs ?? [])
      .map((i) => i.quality_score as number | null)
      .filter((v): v is number => typeof v === 'number')
    imgs_total = (imgs ?? []).length
    if (scores.length > 0) {
      avg_quality_score = scores.reduce((a, b) => a + b, 0) / scores.length
      for (const s of scores) {
        if (s < 0.5) bucket_low++
        else if (s < 0.75) bucket_mid++
        else bucket_high++
      }
    }
  }

  // (c) canonical_fallback_count via report_generations (mais ricamente
  // populado que readings.audit_metadata, que é sobrescrito a cada regen).
  const { data: gens } = await service
    .from('report_generations')
    .select('canonical_fallback_count')
    .gte('created_at', range.from)
    .lte('created_at', range.to)
  const fallbackVals = (gens ?? [])
    .map((g) => g.canonical_fallback_count as number | null)
    .filter((v): v is number => typeof v === 'number')
  const total_reports = (gens ?? []).length
  const total_fallbacks = fallbackVals.reduce((a, b) => a + b, 0)
  const avg_fallback_per_report =
    fallbackVals.length > 0 ? total_fallbacks / fallbackVals.length : null
  // 6 fotos por reading (constante do produto).
  const fallback_pct_of_photos = pct(total_fallbacks, total_reports * 6)

  return {
    haiku,
    images: {
      total: imgs_total,
      avg_quality_score,
      bucket_low,
      bucket_mid,
      bucket_high,
    },
    canonicalization: {
      total_reports,
      total_fallbacks,
      avg_fallback_per_report,
      fallback_pct_of_photos,
    },
  }
}

// ── 3. CUSTO AI ────────────────────────────────────────────────────────

export interface CostStats {
  total_usd: number              // soma TUDO (stage 1 + stage 2 + bbox + haiku validate)
  stage1_usd: number             // report_findings.cost_usd (Sonnet tool use, pipeline v2.3.0+)
  stage2_usd: number             // report_generations.cost_usd (Sonnet composição)
  bbox_usd: number               // só report_generations.bbox_cost_usd
  haiku_validate_usd: number | null // capture_attempts.cost_estimate_usd
  by_method: Record<string, number> // vigente/sam/sonnet_direct/sonnet_2x_X.Y.Z (Stage 1)
  tokens_in: number              // Stage 1 + Stage 2 somados
  tokens_out: number             // Stage 1 + Stage 2 somados
  cache_creation_total: number   // Stage 1 + Stage 2 somados — tokens gravados no cache
  cache_read_total: number       // Stage 1 + Stage 2 somados — tokens lidos do cache (hit)
  cache_hit_rate_pct: number | null // cache_read / (cache_read + cache_creation + tokens_in) * 100
  avg_latency_ms: number | null  // só Stage 2 (latência percebida pelo usuário)
  // Per-reading: divide soma de stage1+stage2+bbox pelo COUNT(distinct reading_id)
  cost_per_reading_avg: number | null
  cost_per_reading_p90: number | null
}

export async function fetchCost(range: DateRange): Promise<CostStats> {
  const service = createServiceClient()

  // Pipeline Sonnet 2x v2.3.0+ tem 2 chamadas LLM por leitura:
  //   - Stage 1: report_findings (Sonnet tool use → JSON estruturado)
  //   - Stage 2: report_generations (Sonnet composição streaming)
  // Antes de v2.3.0 só havia report_generations. Pra cobrir ambas as eras
  // somamos os dois agregados.
  // Colunas cache_*_input_tokens vieram em migration 0031 mas types/database.ts
  // ainda não foi regenerado — `as never` aqui segue mesmo padrão usado em
  // capture_attempts. Remover quando rodar `supabase gen types`.
  const [gensRes, findingsRes] = await Promise.all([
    service
      .from('report_generations' as never)
      .select(
        'reading_id, method, cost_usd, bbox_cost_usd, tokens_in, tokens_out, latency_ms, cache_creation_input_tokens, cache_read_input_tokens',
      )
      .gte('created_at', range.from)
      .lte('created_at', range.to),
    service
      .from('report_findings' as never)
      .select(
        'reading_id, method_version, cost_usd, tokens_in, tokens_out, cache_creation_input_tokens, cache_read_input_tokens, generated_at',
      )
      .gte('generated_at', range.from)
      .lte('generated_at', range.to),
  ])

  interface GenRow {
    reading_id: string | null
    method: string | null
    cost_usd: number | null
    bbox_cost_usd: number | null
    tokens_in: number | null
    tokens_out: number | null
    latency_ms: number | null
    cache_creation_input_tokens: number | null
    cache_read_input_tokens: number | null
  }
  interface FindingRow {
    reading_id: string | null
    method_version: string | null
    cost_usd: number | null
    tokens_in: number | null
    tokens_out: number | null
    cache_creation_input_tokens: number | null
    cache_read_input_tokens: number | null
  }
  const gens = (gensRes.data ?? []) as unknown as GenRow[]
  const findings = (findingsRes.data ?? []) as unknown as FindingRow[]

  let stage2_usd = 0
  let bbox_usd = 0
  let tokens_in = 0
  let tokens_out = 0
  let cache_creation_total = 0
  let cache_read_total = 0
  const by_method: Record<string, number> = {}
  const latencies: number[] = []
  const per_reading_cost = new Map<string, number>()
  for (const g of gens) {
    const cost = numOrZero(g.cost_usd)
    const bbox = numOrZero(g.bbox_cost_usd)
    const method = g.method ?? 'desconhecido'
    stage2_usd += cost
    bbox_usd += bbox
    tokens_in += numOrZero(g.tokens_in)
    tokens_out += numOrZero(g.tokens_out)
    cache_creation_total += numOrZero(g.cache_creation_input_tokens)
    cache_read_total += numOrZero(g.cache_read_input_tokens)
    by_method[method] = (by_method[method] ?? 0) + cost
    if (typeof g.latency_ms === 'number') latencies.push(g.latency_ms)
    if (g.reading_id) per_reading_cost.set(g.reading_id, (per_reading_cost.get(g.reading_id) ?? 0) + cost + bbox)
  }

  let stage1_usd = 0
  for (const f of findings) {
    const cost = numOrZero(f.cost_usd)
    const methodVersion = f.method_version ?? 'stage1_desconhecido'
    stage1_usd += cost
    tokens_in += numOrZero(f.tokens_in)
    tokens_out += numOrZero(f.tokens_out)
    cache_creation_total += numOrZero(f.cache_creation_input_tokens)
    cache_read_total += numOrZero(f.cache_read_input_tokens)
    by_method[methodVersion] = (by_method[methodVersion] ?? 0) + cost
    if (f.reading_id) per_reading_cost.set(f.reading_id, (per_reading_cost.get(f.reading_id) ?? 0) + cost)
  }

  // Haiku validate via capture_attempts (pode não existir).
  let haiku_validate_usd: number | null = null
  try {
    const { data, error } = await service
      .from('capture_attempts' as never)
      .select('cost_estimate_usd')
      .gte('created_at', range.from)
      .lte('created_at', range.to)
    if (!error) {
      const vals = ((data ?? []) as Array<{ cost_estimate_usd: number | null }>)
        .map((r) => numOrZero(r.cost_estimate_usd))
      haiku_validate_usd = vals.reduce((a, b) => a + b, 0)
    }
  } catch {
    // migration pendente
  }

  const perReadingArr = Array.from(per_reading_cost.values()).sort((a, b) => a - b)
  const cost_per_reading_avg =
    perReadingArr.length > 0
      ? perReadingArr.reduce((a, b) => a + b, 0) / perReadingArr.length
      : null
  const cost_per_reading_p90 =
    perReadingArr.length > 0
      ? perReadingArr[Math.min(perReadingArr.length - 1, Math.floor(perReadingArr.length * 0.9))]
      : null

  // Cache hit rate = read / (read + creation + sem-cache). 0% até ter
  // 2 chamadas dentro do TTL Anthropic (~5min) com prompt estável.
  // Mede o fix v2.7.3 (4 cache_control breakpoints) empiricamente.
  const cache_denominator = cache_read_total + cache_creation_total + tokens_in
  const cache_hit_rate_pct =
    cache_denominator > 0 ? (cache_read_total / cache_denominator) * 100 : null

  return {
    total_usd: stage1_usd + stage2_usd + bbox_usd + (haiku_validate_usd ?? 0),
    stage1_usd,
    stage2_usd,
    bbox_usd,
    haiku_validate_usd,
    by_method,
    tokens_in,
    tokens_out,
    cache_creation_total,
    cache_read_total,
    cache_hit_rate_pct,
    avg_latency_ms:
      latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : null,
    cost_per_reading_avg,
    cost_per_reading_p90,
  }
}

// ── 3.5. VENDAS / RECEITA ──────────────────────────────────────────────

export interface RevenueStats {
  gross_brl: number // receita bruta — compras confirmadas (type=purchase) no período
  refunds_brl: number // reembolsos no período (proporcional, cobre parcial)
  net_brl: number // bruta − reembolsos
  sales_count: number // nº de compras confirmadas no período
  by_sku: Record<string, { count: number; brl: number }> // por pacote (sku)
}

/**
 * Receita do período. Base = credit_transactions (created_at = confirmação do
 * pagamento, gravado pelo webhook): type='purchase' é venda; type='refund' é
 * devolução (amount em leituras → BRL via preço unitário do pacote). 'adjust'
 * (concessão manual) NÃO é venda e fica de fora. N pequena no beta → lê o mapa
 * de créditos inteiro p/ resolver preço/sku de cada transação.
 */
export async function fetchRevenue(range: DateRange): Promise<RevenueStats> {
  const service = createServiceClient()

  const { data: creditsData } = await service
    .from('customer_credits')
    .select('id, paid_brl, credit_packages(sku, price_brl, leituras_count)')
  // price_brl aqui = valor REALMENTE pago (paid_brl, com desconto PIX); compras
  // antigas sem paid_brl caem no preço de tabela. Mantém o nome do campo p/ não
  // mexer no resto da função.
  interface CreditMeta { sku: string; price_brl: number; leituras_count: number }
  const creditMeta = new Map<string, CreditMeta>()
  for (const c of creditsData ?? []) {
    const pkg = (Array.isArray(c.credit_packages) ? c.credit_packages[0] : c.credit_packages) as
      | { sku: string | null; price_brl: number | null; leituras_count: number | null }
      | null
    if (!pkg) continue
    const paid = (c as { paid_brl: number | null }).paid_brl
    creditMeta.set(c.id as string, {
      sku: pkg.sku ?? 'desconhecido',
      price_brl: paid != null ? numOrZero(paid) : numOrZero(pkg.price_brl),
      leituras_count: pkg.leituras_count ?? 0,
    })
  }

  const { data: txData } = await service
    .from('credit_transactions')
    .select('type, amount, credit_id')
    .gte('created_at', range.from)
    .lte('created_at', range.to)

  let gross_brl = 0
  let refunds_brl = 0
  let sales_count = 0
  const by_sku: Record<string, { count: number; brl: number }> = {}
  for (const t of txData ?? []) {
    const meta = t.credit_id ? creditMeta.get(t.credit_id as string) : undefined
    if (!meta) continue
    if (t.type === 'purchase') {
      gross_brl += meta.price_brl
      sales_count += 1
      const bucket = (by_sku[meta.sku] ??= { count: 0, brl: 0 })
      bucket.count += 1
      bucket.brl += meta.price_brl
    } else if (t.type === 'refund') {
      const unit = meta.leituras_count > 0 ? meta.price_brl / meta.leituras_count : 0
      refunds_brl += Math.abs(numOrZero(t.amount)) * unit
    }
  }

  return {
    gross_brl,
    refunds_brl,
    net_brl: gross_brl - refunds_brl,
    sales_count,
    by_sku,
  }
}

// ── 4. THROUGHPUT POR TERAPEUTA + REGENERAÇÕES + ERROS ─────────────────

export interface ThroughputRow {
  therapist_id: string
  full_name: string
  email: string
  /**
   * Capturas INICIADAS no período — inclui as que pararam em 0 foto. Uma leitura
   * nasce quando alguém abre a tela de captura, então este número mede TENTATIVA,
   * não trabalho: 28% dele, desde 01/07, nunca virou relatório.
   */
  readings_total: number
  /**
   * Relatórios efetivamente gerados — o que consome crédito e o que o terapeuta
   * de fato entrega. É este que responde "quanto ela usou?".
   *
   * Separado de readings_total em 2026-08-10: no painel, uma terapeuta nova
   * aparecia com "4 leituras" e nenhuma compra, e a conclusão natural era que
   * havia furo na cobrança. Eram 3 tentativas abandonadas (0, 0 e 1 foto) mais 1
   * relatório, esse pago pela trial. O número certo era 1.
   */
  reports_generated: number
  readings_delivered: number
  haiku_attempts: number    // capture_attempts no período (0 se migration pendente)
  haiku_accepted: number
  aproveitamento_pct: number | null
  last_reading_at: string | null
}

export interface ThroughputStats {
  rows: ThroughputRow[]
  avg_regeneration: number | null
  top_errors: Array<{ error_summary: string; count: number }>
  failed_count: number
  failed_pct: number
}

export async function fetchThroughput(
  range: DateRange,
  therapists: Map<string, TherapistInfo>,
): Promise<ThroughputStats> {
  const service = createServiceClient()

  // `report_emocional` é da migration 0051 e ainda não está em types/database.ts —
  // mesmo cast usado nas outras rotas até o founder regenerar os tipos.
  type ReadingRow = {
    therapist_id: string | null
    status: string | null
    is_delivered: boolean | null
    created_at: string | null
    regeneration_count: number | null
    vision_features: unknown
    report_generated: Record<string, unknown> | null
    report_emocional: string | null
  }
  const { data: readingsRaw } = await service
    .from('readings')
    .select(
      'therapist_id, status, is_delivered, created_at, regeneration_count, vision_features, report_generated, report_emocional' as never,
    )
    .gte('created_at', range.from)
    .lte('created_at', range.to)
  const readings = (readingsRaw ?? []) as unknown as ReadingRow[]

  const byTherapist = new Map<
    string,
    {
      total: number
      generated: number
      delivered: number
      last_at: string | null
    }
  >()
  let regen_sum = 0
  let regen_n = 0
  let failed = 0
  const errors = new Map<string, number>()
  for (const r of readings) {
    const tid = r.therapist_id as string | null
    if (tid) {
      const cur = byTherapist.get(tid) ?? { total: 0, generated: 0, delivered: 0, last_at: null }
      cur.total++
      // "Gerou relatório" = tem Mapa do Ser OU Dossiê. É o mesmo critério que o
      // resto do sistema usa pra dizer que a leitura virou entrega.
      const temDossie =
        r.report_generated != null &&
        Object.keys(r.report_generated as Record<string, unknown>).length > 0
      if (temDossie || r.report_emocional) cur.generated++
      if (r.is_delivered) cur.delivered++
      const ts = r.created_at as string | null
      if (ts && (!cur.last_at || ts > cur.last_at)) cur.last_at = ts
      byTherapist.set(tid, cur)
    }
    if (typeof r.regeneration_count === 'number') {
      regen_sum += r.regeneration_count
      regen_n++
    }
    if (r.status === 'failed') failed++
    const vf = r.vision_features as { processing_metadata?: { error_summary?: string } } | null
    const errSum = vf?.processing_metadata?.error_summary
    if (typeof errSum === 'string' && errSum.length > 0) {
      errors.set(errSum, (errors.get(errSum) ?? 0) + 1)
    }
  }

  // Haiku attempts por terapeuta (capture_attempts pode não existir).
  const haikuByTherapist = new Map<string, { total: number; accepted: number }>()
  try {
    const { data, error } = await service
      .from('capture_attempts' as never)
      .select('therapist_id, accepted')
      .gte('created_at', range.from)
      .lte('created_at', range.to)
    if (!error) {
      for (const a of (data ?? []) as Array<{ therapist_id: string; accepted: boolean }>) {
        const cur = haikuByTherapist.get(a.therapist_id) ?? { total: 0, accepted: 0 }
        cur.total++
        if (a.accepted) cur.accepted++
        haikuByTherapist.set(a.therapist_id, cur)
      }
    }
  } catch {
    // migration pendente
  }

  const rows: ThroughputRow[] = []
  // Linha por terapeuta conhecido COM atividade (readings OU haiku) no período.
  const activeIds = new Set<string>([...byTherapist.keys(), ...haikuByTherapist.keys()])
  for (const tid of activeIds) {
    const info = therapists.get(tid)
    if (!info) continue // founder filtrado em fetchTherapistsMap
    const r = byTherapist.get(tid) ?? { total: 0, generated: 0, delivered: 0, last_at: null }
    const h = haikuByTherapist.get(tid) ?? { total: 0, accepted: 0 }
    rows.push({
      therapist_id: tid,
      full_name: info.full_name,
      email: info.email,
      readings_total: r.total,
      reports_generated: r.generated,
      readings_delivered: r.delivered,
      haiku_attempts: h.total,
      haiku_accepted: h.accepted,
      aproveitamento_pct: h.total > 0 ? pct(h.accepted, h.total) : null,
      last_reading_at: r.last_at,
    })
  }
  // Ordena por RELATÓRIO GERADO (uso real), com a tentativa como desempate — antes
  // ordenava por tentativa, e quem só abriu a tela várias vezes subia no ranking.
  rows.sort((a, b) => b.reports_generated - a.reports_generated || b.readings_total - a.readings_total)

  const total = readings.length
  return {
    rows,
    avg_regeneration: regen_n > 0 ? regen_sum / regen_n : null,
    top_errors: Array.from(errors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error_summary, count]) => ({ error_summary, count })),
    failed_count: failed,
    failed_pct: pct(failed, total),
  }
}

// ── 5. APROVEITAMENTO POR DISPOSITIVO ─────────────────────────────────

export interface DeviceBreakdownRow {
  key: string         // os_family OU browser_family
  total: number
  accepted: number
  rejected: number
  aproveitamento_pct: number
}

export interface DeviceBreakdownStats {
  // null se migration 0023 (capture_attempts) OU 0024 (device cols)
  // ainda não aplicadas. Page mostra "—" no bloco.
  by_os: DeviceBreakdownRow[] | null
  by_browser: DeviceBreakdownRow[] | null
  by_device_type: DeviceBreakdownRow[] | null
}

export async function fetchDeviceBreakdown(
  range: DateRange,
): Promise<DeviceBreakdownStats> {
  const service = createServiceClient()
  try {
    const { data, error } = await service
      .from('capture_attempts' as never)
      .select('accepted, os_family, browser_family, device_type')
      .gte('created_at', range.from)
      .lte('created_at', range.to)
    if (error) {
      // Tabela existe mas algo deu errado — log e devolve nulls.
      console.error('[reports] fetchDeviceBreakdown error:', error.message)
      return { by_os: null, by_browser: null, by_device_type: null }
    }
    const rows = (data ?? []) as Array<{
      accepted: boolean
      os_family: string | null
      browser_family: string | null
      device_type: string | null
    }>
    // Se a tabela existe mas as colunas device ainda não (0023 sem 0024),
    // todos os campos vêm null — agrega tudo em "unknown" silenciosamente.
    return {
      by_os: aggregateByKey(rows, (r) => r.os_family),
      by_browser: aggregateByKey(rows, (r) => r.browser_family),
      by_device_type: aggregateByKey(rows, (r) => r.device_type),
    }
  } catch {
    return { by_os: null, by_browser: null, by_device_type: null }
  }
}

function aggregateByKey<T extends { accepted: boolean }>(
  rows: T[],
  keyFn: (r: T) => string | null,
): DeviceBreakdownRow[] {
  const map = new Map<string, { total: number; accepted: number }>()
  for (const r of rows) {
    const k = keyFn(r) ?? 'unknown'
    const cur = map.get(k) ?? { total: 0, accepted: 0 }
    cur.total++
    if (r.accepted) cur.accepted++
    map.set(k, cur)
  }
  const out: DeviceBreakdownRow[] = []
  for (const [key, v] of map.entries()) {
    out.push({
      key,
      total: v.total,
      accepted: v.accepted,
      rejected: v.total - v.accepted,
      aproveitamento_pct: pct(v.accepted, v.total),
    })
  }
  return out.sort((a, b) => b.total - a.total)
}

// ── helpers ───────────────────────────────────────────────────────────

function pct(n: number, d: number): number {
  if (d <= 0) return 0
  return (n / d) * 100
}

function numOrZero(v: unknown): number {
  return typeof v === 'number' ? v : typeof v === 'string' ? Number(v) || 0 : 0
}

// ── preset ranges ─────────────────────────────────────────────────────

export type RangePreset = 'hoje' | '7d' | '30d' | 'tudo'

export function resolveRange(
  preset: RangePreset | undefined,
  custom: { from?: string; to?: string } | undefined,
  now: Date = new Date(),
): DateRange {
  if (custom?.from && custom?.to) {
    return { from: toIsoStart(custom.from), to: toIsoEnd(custom.to) }
  }
  const p = preset ?? '7d'
  if (p === 'tudo') {
    // Início do projeto = 2026-01-01 com folga (qualquer data anterior à
    // primeira tabela criada).
    return { from: '2026-01-01T00:00:00Z', to: now.toISOString() }
  }
  if (p === 'hoje') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return { from: start.toISOString(), to: now.toISOString() }
  }
  const days = p === '30d' ? 30 : 7
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return { from: start.toISOString(), to: now.toISOString() }
}

function toIsoStart(ymd: string): string {
  return `${ymd}T00:00:00Z`
}
function toIsoEnd(ymd: string): string {
  return `${ymd}T23:59:59.999Z`
}
