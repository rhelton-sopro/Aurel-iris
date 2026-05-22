import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { LocalDateTime } from '@/components/ui/local-date-time'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

// Admin tool — uses service-role client to see ALL readings across therapists.
// Founder gate is enforced at middleware + admin/layout (defense-in-depth).
export const dynamic = 'force-dynamic'

type AnnotationStatus = 'pending' | 'annotated' | 'reviewed' | 'all'
const PAGE_SIZE = 20

function parseStatusFilter(value: string | undefined): AnnotationStatus {
  if (value === 'annotated' || value === 'reviewed' || value === 'all') return value
  return 'pending'
}

function parsePage(value: string | undefined): number {
  const n = Number.parseInt(value ?? '1', 10)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

interface ReadingRow {
  id: string
  created_at: string
  status: string | null
  vision_features: unknown
  client: { full_name: string | null } | { full_name: string | null }[] | null
}

interface AnnotationRow {
  reading_id: string
  reviewed: boolean | null
}

function getClientName(
  client: ReadingRow['client']
): string | null {
  if (!client) return null
  const obj = Array.isArray(client) ? client[0] : client
  return obj?.full_name ?? null
}

function getOdColor(features: unknown): string | null {
  const f = features as { right_eye?: { iris_color?: { primary?: string } } } | null
  return f?.right_eye?.iris_color?.primary ?? null
}

function getOeColor(features: unknown): string | null {
  const f = features as { left_eye?: { iris_color?: { primary?: string } } } | null
  return f?.left_eye?.iris_color?.primary ?? null
}

function StatusPill({ status }: { status: 'pending' | 'annotated' | 'reviewed' }) {
  if (status === 'reviewed') {
    return <Badge variant="default" className="bg-emerald-600">revisado</Badge>
  }
  if (status === 'annotated') {
    return <Badge variant="secondary">anotado</Badge>
  }
  return <Badge variant="outline" className="text-muted-foreground">pendente</Badge>
}

function FilterTab({
  href,
  label,
  active,
  count,
}: {
  href: string
  label: string
  active: boolean
  count?: number
}) {
  return (
    <Link
      href={href}
      className={cn(
        'px-3 py-1.5 text-sm rounded-md border transition-colors',
        active
          ? 'bg-foreground text-background border-foreground'
          : 'bg-background text-muted-foreground hover:bg-muted'
      )}
    >
      {label}
      {typeof count === 'number' && (
        <span className="ml-1.5 text-xs opacity-70">({count})</span>
      )}
    </Link>
  )
}

export default async function CalibrationListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const params = await searchParams
  const filter = parseStatusFilter(params.status)
  const page = parsePage(params.page)

  const supabase = createServiceClient()

  // 2026-05-22 founder UAT: mostra TODAS as leituras, não só ready/edited.
  // Founder usa essa página pra "olhar as fotos como ficaram" pra ajustar
  // calibração — pending/processing/failed também são relevantes (a foto
  // foi capturada antes do pipeline rodar).
  const { data: readings } = await supabase
    .from('readings')
    .select('id, created_at, status, vision_features, client:clients(full_name)')
    .order('created_at', { ascending: false })

  const allReadings = (readings ?? []) as ReadingRow[]

  // Fetch annotations and index by reading_id.
  const { data: annotations } = await supabase
    .from('calibration_annotations')
    .select('reading_id, reviewed')

  const annotationByReading = new Map<string, AnnotationRow>()
  for (const a of (annotations ?? []) as AnnotationRow[]) {
    annotationByReading.set(a.reading_id, a)
  }

  // Compute counts for tabs.
  const counts = { pending: 0, annotated: 0, reviewed: 0, all: allReadings.length }
  for (const r of allReadings) {
    const ann = annotationByReading.get(r.id)
    if (!ann) counts.pending++
    else if (ann.reviewed) counts.reviewed++
    else counts.annotated++
  }

  // Filter by status.
  const filtered = allReadings.filter(r => {
    const ann = annotationByReading.get(r.id)
    if (filter === 'all') return true
    if (filter === 'pending') return !ann
    if (filter === 'annotated') return ann && !ann.reviewed
    if (filter === 'reviewed') return ann?.reviewed
    return true
  })

  // Paginate.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const offset = (currentPage - 1) * PAGE_SIZE
  const pageRows = filtered.slice(offset, offset + PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Calibração</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Anote o ground truth iridológico para readings com vision_features. Corpus alimenta
          recalibração de centroides LAB (Wave B) + calibração linguística (Phase 9) + dataset
          de aprendizagem (Phase 10).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterTab href="?status=pending" label="Pendente" active={filter === 'pending'} count={counts.pending} />
        <FilterTab href="?status=annotated" label="Anotado" active={filter === 'annotated'} count={counts.annotated} />
        <FilterTab href="?status=reviewed" label="Revisado" active={filter === 'reviewed'} count={counts.reviewed} />
        <FilterTab href="?status=all" label="Todos" active={filter === 'all'} count={counts.all} />
      </div>

      {pageRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center border border-dashed rounded-md">
          <p className="text-base font-medium">Nenhuma reading neste filtro</p>
          <p className="text-sm text-muted-foreground">
            {filter === 'pending'
              ? 'Todas as readings com vision_features já foram anotadas.'
              : 'Tente outro filtro.'}
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Capturado</TableHead>
              <TableHead>OD primary</TableHead>
              <TableHead>OE primary</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map(r => {
              const ann = annotationByReading.get(r.id)
              const status: 'pending' | 'annotated' | 'reviewed' = !ann
                ? 'pending'
                : ann.reviewed
                  ? 'reviewed'
                  : 'annotated'
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {getClientName(r.client) ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <LocalDateTime iso={r.created_at} />
                  </TableCell>
                  <TableCell>{getOdColor(r.vision_features) ?? '—'}</TableCell>
                  <TableCell>{getOeColor(r.vision_features) ?? '—'}</TableCell>
                  <TableCell>
                    <StatusPill status={status} />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/calibration/${r.id}`}
                      className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
                    >
                      Anotar
                    </Link>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {currentPage} de {totalPages} · {filtered.length} resultados
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={`?status=${filter}&page=${currentPage - 1}`}
                className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
              >
                ← Anterior
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={`?status=${filter}&page=${currentPage + 1}`}
                className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
              >
                Próxima →
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  )
}
