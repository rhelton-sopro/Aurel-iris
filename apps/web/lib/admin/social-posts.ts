import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

// Fila de aprovação de conteúdo de marketing (Instagram). Migration 0045.
// Leitura via service-role (a página /admin/painel já gateia founder).

/** Retorno padrão das server actions do painel. */
export interface ActionResult {
  ok: boolean
  error?: string
}

export type SocialPostStatus =
  | 'pendente'
  | 'aprovado'
  | 'agendado'
  | 'publicado'
  | 'reprovado'

export type SocialPostFormat = 'carrossel' | 'reel' | 'post'

export type SocialPostMedia =
  | { kind: 'carrossel'; slides: string[] }
  | { kind: 'reel'; video: string; poster?: string; duration?: string }
  | { kind: 'post'; image: string }
  | Record<string, never>

export interface SocialPost {
  id: string
  format: SocialPostFormat
  status: SocialPostStatus
  pilar: string | null
  tags: string[]
  caption: string
  why: string | null
  generated_by: string[]
  media: SocialPostMedia
  suggested_slot: string | null
  scheduled_at: string | null
  comment: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

// Ordem das abas + rótulos (a contagem vem do banco).
export const STATUS_TABS: Array<{ status: SocialPostStatus; label: string }> = [
  { status: 'pendente', label: 'Pendentes' },
  { status: 'aprovado', label: 'Aprovados' },
  { status: 'agendado', label: 'Agendados' },
  { status: 'publicado', label: 'Publicados' },
  { status: 'reprovado', label: 'Reprovados' },
]

export function isSocialPostStatus(v: string | undefined): v is SocialPostStatus {
  return (
    v === 'pendente' ||
    v === 'aprovado' ||
    v === 'agendado' ||
    v === 'publicado' ||
    v === 'reprovado'
  )
}

/** Posts de um status, ordenados pelo sort_order do feed. */
export async function fetchPostsByStatus(
  status: SocialPostStatus,
): Promise<SocialPost[]> {
  const service = createServiceClient()
  const { data, error } = await service
    .from('social_posts')
    .select('*')
    .eq('status', status)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) {
    throw new Error(`fetchPostsByStatus(${status}): ${error.message}`)
  }
  return (data ?? []) as unknown as SocialPost[]
}

/** Contagem por status, pra preencher os badges das abas. */
export async function fetchStatusCounts(): Promise<
  Record<SocialPostStatus, number>
> {
  const service = createServiceClient()
  const { data, error } = await service.from('social_posts').select('status')
  if (error) {
    throw new Error(`fetchStatusCounts: ${error.message}`)
  }
  const counts: Record<SocialPostStatus, number> = {
    pendente: 0,
    aprovado: 0,
    agendado: 0,
    publicado: 0,
    reprovado: 0,
  }
  for (const row of (data ?? []) as Array<{ status: string }>) {
    if (isSocialPostStatus(row.status)) counts[row.status] += 1
  }
  return counts
}
