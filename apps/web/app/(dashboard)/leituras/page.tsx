import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { LocalDateTime } from '@/components/ui/local-date-time'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { cleanupStaleEmptyReadingsAction } from '@/app/actions/readings'
import { StatusBadge, type ReadingStatus } from '@/components/readings/StatusBadge'
import { ReprocessButton } from '@/components/readings/ReprocessButton'

/**
 * Página dinâmica: a lista deve refletir leituras criadas neste mesmo request
 * (cenário comum: usuário acabou de finalizar captura e navegou pra cá). Sem
 * `force-dynamic`, o RSC cache do Next.js pode servir uma versão pré-captura.
 */
export const dynamic = 'force-dynamic'

export default async function LeiturasPage() {
  // GC silencioso: apaga rascunhos com 0/6 fotos criados há > 1h.
  await cleanupStaleEmptyReadingsAction()

  const supabase = await createClient()

  const { data: readings } = await supabase
    .from('readings')
    .select(`
      id,
      status,
      created_at,
      vision_features,
      client:clients(full_name),
      reading_images(count)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  const list = readings ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Leituras</h1>
        <Link href="/leituras/nova" className={cn(buttonVariants())}>
          Nova leitura
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <p className="text-lg font-medium">Nenhuma leitura ainda</p>
          <p className="text-sm text-muted-foreground">
            Inicie uma nova leitura para registrar a primeira análise iridológica.
          </p>
          <Link href="/leituras/nova" className={cn(buttonVariants({ size: 'sm' }))}>
            Nova leitura
          </Link>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Fotos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map(r => {
              const client = Array.isArray(r.client) ? r.client[0] : r.client
              const count = (r.reading_images?.[0]?.count as number | undefined) ?? 0
              const status = r.status ?? 'pending'
              // Rascunho = pending com captura parcial (1..5 / 6).
              const isRascunho = status === 'pending' && count > 0 && count < 6
              const errorSummary =
                (r.vision_features as { processing_metadata?: { error_summary?: string } } | null)
                  ?.processing_metadata?.error_summary ?? null

              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {client?.full_name ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <LocalDateTime iso={r.created_at} />
                  </TableCell>
                  <TableCell>
                    <span className={count < 6 ? 'text-muted-foreground' : 'text-foreground'}>
                      {count}/6
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={(status as ReadingStatus) ?? 'pending'}
                      isRascunho={isRascunho}
                      errorSummary={errorSummary}
                    />
                  </TableCell>
                  <TableCell>
                    {isRascunho && (
                      <Link
                        href={`/leituras/nova/capturar?reading=${r.id}`}
                        className={cn(buttonVariants({ size: 'sm' }))}
                      >
                        Continuar
                      </Link>
                    )}
                    {status === 'failed' && (
                      <ReprocessButton
                        readingId={r.id}
                        status={status as ReadingStatus}
                      />
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
