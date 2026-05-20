'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Badge } from '@/components/ui/badge'
import { StatusBadge, type ReadingStatus } from '@/components/readings/StatusBadge'
import { ReprocessButton } from '@/components/readings/ReprocessButton'
import { DeleteReadingDialog } from '@/components/readings/delete-reading-dialog'
import { AutoRefreshWhileProcessing } from '@/components/readings/AutoRefreshWhileProcessing'

type ClientRef = { id?: string | null; full_name: string | null; is_self?: boolean | null }

export interface ReadingRow {
  id: string
  status: string | null
  created_at: string | null
  vision_features: unknown
  report_generated: unknown
  is_delivered: boolean | null
  reading_images: { count: number }[] | null
  client?: ClientRef | ClientRef[] | null
}

interface ReadingsListManagerProps {
  readings: ReadingRow[]
  /** mostra a coluna "Cliente" (lista global /leituras) */
  showClient?: boolean
  /** destino do botão "Nova leitura" no empty state */
  newReadingHref: string
}

export function ReadingsListManager({
  readings,
  showClient = false,
  newReadingHref,
}: ReadingsListManagerProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // null = fechado · [] nunca · [id] = single · [...] = lote
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null)

  const allIds = useMemo(() => readings.map(r => r.id), [readings])
  const anyProcessing = useMemo(
    () => readings.some(r => r.status === 'processing'),
    [readings],
  )
  const allSelected = selected.size > 0 && selected.size === allIds.length
  const someSelected = selected.size > 0 && !allSelected

  function toggle(id: string, checked: boolean) {
    setSelected(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(allIds) : new Set())
  }

  function handleDeleted() {
    setSelected(new Set())
    router.refresh()
  }

  if (readings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <p className="font-medium">Nenhuma leitura ainda</p>
        <p className="text-sm text-muted-foreground">
          As leituras de íris aparecerão aqui.
        </p>
        <Link href={newReadingHref} className={cn(buttonVariants())}>
          Nova leitura
        </Link>
      </div>
    )
  }

  return (
    <>
      <AutoRefreshWhileProcessing active={anyProcessing} />
      {selected.size > 0 && (
        <div className="flex flex-col gap-2 rounded-none border bg-muted/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium">
            {selected.size} selecionada{selected.size > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              Limpar seleção
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setPendingDelete([...selected])}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir selecionadas
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                aria-label="Selecionar todas"
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={(checked) => toggleAll(checked === true)}
              />
            </TableHead>
            {showClient && <TableHead>Cliente</TableHead>}
            <TableHead>Data</TableHead>
            <TableHead>Fotos</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-32" />
            <TableHead>Análise</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {readings.map(r => {
            const client = Array.isArray(r.client) ? r.client[0] : r.client
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
            const isSelected = selected.has(r.id)

            // rascunho cai no default (—); a ação "Continuar" fica na coluna própria
            let action = <span className="text-sm text-muted-foreground">—</span>
            if (!isRascunho && isDelivered) {
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
              <TableRow key={r.id} data-state={isSelected ? 'selected' : undefined}>
                <TableCell>
                  <Checkbox
                    aria-label={`Selecionar leitura ${client?.full_name ?? r.id}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => toggle(r.id, checked === true)}
                  />
                </TableCell>
                {showClient && (
                  <TableCell className="font-medium">
                    {client?.id && client?.full_name ? (
                      <Link
                        href={`/clientes/${client.id}`}
                        className="hover:underline focus-visible:underline outline-none"
                      >
                        {client.full_name}
                      </Link>
                    ) : (
                      client?.full_name ?? <span className="text-muted-foreground">—</span>
                    )}
                    {client?.is_self && (
                      <Badge variant="secondary" className="ml-2">
                        Meu exame
                      </Badge>
                    )}
                  </TableCell>
                )}
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
                    <ReprocessButton readingId={r.id} status={status as ReadingStatus} />
                  )}
                </TableCell>
                <TableCell>{action}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Excluir leitura"
                    aria-label="Excluir leitura"
                    onClick={() => setPendingDelete([r.id])}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {pendingDelete && pendingDelete.length > 0 && (
        <DeleteReadingDialog
          readingIds={pendingDelete}
          open={pendingDelete.length > 0}
          onOpenChange={(open) => { if (!open) setPendingDelete(null) }}
          onDeleted={handleDeleted}
        />
      )}
    </>
  )
}
