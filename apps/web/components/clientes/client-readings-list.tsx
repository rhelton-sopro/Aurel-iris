'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
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
import { StatusBadge, type ReadingStatus } from '@/components/readings/StatusBadge'
import { DeleteReadingDialog } from '@/components/readings/delete-reading-dialog'

export interface ClientReading {
  id: string
  status: string | null
  created_at: string | null
  vision_features: unknown
  report_generated: unknown
  is_delivered: boolean | null
  reading_images: { count: number }[] | null
}

interface ClientReadingsListProps {
  readings: ClientReading[]
  clientId: string
}

export function ClientReadingsList({ readings, clientId }: ClientReadingsListProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  if (readings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <p className="font-medium">Nenhuma leitura ainda</p>
        <p className="text-sm text-muted-foreground">
          As leituras de íris deste cliente aparecerão aqui.
        </p>
        <Link
          href={`/leituras/nova?cliente=${clientId}`}
          className={cn(buttonVariants())}
        >
          Nova Leitura
        </Link>
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Fotos</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Análise</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {readings.map(r => {
            const count = (r.reading_images?.[0]?.count as number | undefined) ?? 0
            const status = r.status ?? 'pending'
            const isRascunho = status === 'pending' && count > 0 && count < 6
            const errorSummary =
              (r.vision_features as { processing_metadata?: { error_summary?: string } } | null)
                ?.processing_metadata?.error_summary ?? null
            const hasReport =
              r.report_generated != null &&
              Object.keys(r.report_generated as Record<string, unknown>).length > 0
            const isDelivered = r.is_delivered ?? false

            let action = <span className="text-sm text-muted-foreground">—</span>
            if (isRascunho) {
              action = (
                <Link
                  href={`/leituras/nova/capturar?reading=${r.id}`}
                  className={cn(buttonVariants({ size: 'sm' }))}
                >
                  Continuar captura
                </Link>
              )
            } else if (isDelivered) {
              action = (
                <Link
                  href={`/leituras/${r.id}`}
                  className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
                >
                  Ver entregue
                </Link>
              )
            } else if (status === 'edited') {
              action = (
                <Link
                  href={`/leituras/${r.id}/editar`}
                  className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
                >
                  Continuar editando
                </Link>
              )
            } else if (status === 'ready') {
              action = (
                <Link
                  href={`/leituras/${r.id}`}
                  className={cn(
                    buttonVariants({ size: 'sm', variant: hasReport ? 'outline' : 'default' }),
                  )}
                >
                  {hasReport ? 'Ver análise' : 'Gerar análise'}
                </Link>
              )
            }

            return (
              <TableRow key={r.id}>
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
                <TableCell>{action}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Excluir leitura"
                    aria-label="Excluir leitura"
                    onClick={() => setDeletingId(r.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {deletingId && (
        <DeleteReadingDialog
          readingId={deletingId}
          open={!!deletingId}
          onOpenChange={(open) => { if (!open) setDeletingId(null) }}
          onDeleted={() => router.refresh()}
        />
      )}
    </>
  )
}
