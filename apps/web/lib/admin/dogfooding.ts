/**
 * Fase 9 / ONBOARD-04 / D-05 — Dogfooding gate instrumentation.
 *
 * Founder começou uso diário 2026-05-15 (Sonnet 2x v2.3.0 LIVE, ref STATE.md).
 * Gate fecha = 3 semanas consecutivas com ≥3 leituras/semana de clientes reais.
 *
 * Vocabulário intencional: leituras, clientes reais, autoexame, gate, semanas.
 * Sem referências a condições de saúde, protocolos ou intervenções.
 */
import 'server-only'

import { createClient } from '@/lib/supabase/server'

// ── Constantes exportadas (usadas em page.tsx) ───────────────────────────────

export const DOGFOODING_START_DATE = '2026-05-15'
export const WEEKLY_THRESHOLD = 3
export const CONSECUTIVE_WEEKS_REQUIRED = 3

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface DogfoodingWeekRow {
  /** Início da semana ISO (segunda-feira) em YYYY-MM-DD. */
  week_start: string
  /** Label de exibição em formato pt-BR "DD/MM–DD/MM". */
  week_label: string
  /** Leituras de clientes reais (is_self=false) na semana. */
  real_count: number
  /** Leituras de autoexame (is_self=true) na semana. */
  self_count: number
  /** true se real_count >= WEEKLY_THRESHOLD. */
  qualifies: boolean
}

export interface DogfoodingProgress {
  startDate: string
  weeksElapsed: number
  weeklyRows: DogfoodingWeekRow[]
  /** Semana de encerramento do gate (week_start da última semana qualifying na streak), ou null. */
  gateClosedAt: string | null
  /** Comprimento da streak mais recente de semanas qualifying. */
  consecutiveQualifyingWeeks: number
}

// ── Função principal ──────────────────────────────────────────────────────────

export async function fetchDogfoodingProgress(
  founderUserId: string | null,
): Promise<DogfoodingProgress> {
  const startDate = DOGFOODING_START_DATE
  const today = new Date()
  const startDateObj = new Date(startDate + 'T00:00:00Z')

  // Sem founder → retorno seguro sem tocar no banco.
  if (!founderUserId) {
    return {
      startDate,
      weeksElapsed: 0,
      weeklyRows: [],
      gateClosedAt: null,
      consecutiveQualifyingWeeks: 0,
    }
  }

  const weeksElapsed = Math.max(
    0,
    Math.floor((today.getTime() - startDateObj.getTime()) / (7 * 24 * 60 * 60 * 1000)),
  )

  // Leituras do founder desde a data de início, JOIN com clients pra obter is_self.
  const supabase = await createClient()
  const { data: readings } = await supabase
    .from('readings')
    .select('created_at, client:clients(is_self)')
    .eq('therapist_id', founderUserId)
    .gte('created_at', startDate + 'T00:00:00Z')
    .order('created_at', { ascending: false })

  // ── Agregar por semana ISO ─────────────────────────────────────────────────
  const bucketMap = new Map<string, { real: number; self: number }>()
  for (const r of readings ?? []) {
    const created = new Date(r.created_at as string)
    const monday = startOfIsoWeek(created)
    const key = monday.toISOString().slice(0, 10)
    const cur = bucketMap.get(key) ?? { real: 0, self: 0 }
    const isSelf = (r.client as { is_self?: boolean } | null)?.is_self === true
    if (isSelf) cur.self += 1
    else cur.real += 1
    bucketMap.set(key, cur)
  }

  // ── Gerar buckets para TODAS as semanas (inclusive as vazias) ─────────────
  const allWeeks: DogfoodingWeekRow[] = []
  let cursor = startOfIsoWeek(startDateObj)
  const todayMonday = startOfIsoWeek(today)

  while (cursor <= todayMonday) {
    const key = cursor.toISOString().slice(0, 10)
    const counts = bucketMap.get(key) ?? { real: 0, self: 0 }
    allWeeks.push({
      week_start: key,
      week_label: formatWeekLabel(cursor),
      real_count: counts.real,
      self_count: counts.self,
      qualifies: counts.real >= WEEKLY_THRESHOLD,
    })
    cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000)
  }

  // Ordenação DESC (mais recente primeiro) pra exibição em tabela.
  allWeeks.sort((a, b) => (a.week_start < b.week_start ? 1 : -1))

  // ── Calcular streak mais recente (em ordem ASC) ────────────────────────────
  const ascWeeks = [...allWeeks].reverse()
  let streak = 0
  for (let i = ascWeeks.length - 1; i >= 0; i--) {
    if (ascWeeks[i].qualifies) streak += 1
    else break
  }

  // gateClosedAt: semana qualifying mais recente quando streak atinge o limiar.
  const gateClosedAt =
    streak >= CONSECUTIVE_WEEKS_REQUIRED
      ? ascWeeks[ascWeeks.length - 1].week_start
      : null

  return {
    startDate,
    weeksElapsed,
    weeklyRows: allWeeks,
    gateClosedAt,
    consecutiveQualifyingWeeks: streak,
  }
}

// ── Helpers privados ──────────────────────────────────────────────────────────

/** Retorna a segunda-feira ISO da semana que contém `d` (UTC). */
function startOfIsoWeek(d: Date): Date {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = utc.getUTCDay() || 7 // 0=Sunday → 7
  utc.setUTCDate(utc.getUTCDate() - (day - 1))
  return utc
}

/** Label no formato "DD/MM–DD/MM" pra semana que começa em `monday`. */
function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000)
  const dd = (n: number) => n.toString().padStart(2, '0')
  return `${dd(monday.getUTCDate())}/${dd(monday.getUTCMonth() + 1)}–${dd(sunday.getUTCDate())}/${dd(sunday.getUTCMonth() + 1)}`
}
