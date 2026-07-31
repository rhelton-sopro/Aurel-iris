'use client'

import { useMemo, useState, type ReactNode } from 'react'
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
  /**
   * Tem MAPA DO SER (2026-07-30). Leitura nova não tem `report_generated` — se a
   * lista olhasse só pra ele, uma leitura recém-gerada apareceria como "sem
   * relatório" e, pior, como "Fotos apagadas" (a purga roda logo após a geração).
   */
  temMapa?: boolean
  is_delivered: boolean | null
  images_purged_at?: string | null
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

      {(() => {
        // Derivação por linha — compartilhada entre desktop table e mobile cards (Gmail-style).
        const derived = readings.map(r => {
          const client = Array.isArray(r.client) ? r.client[0] : r.client
          const count = (r.reading_images?.[0]?.count as number | undefined) ?? 0
          const status = r.status ?? 'pending'
          const isRascunho = status === 'pending' && count > 0 && count < 6
          const errorSummary =
            (r.vision_features as { processing_metadata?: { error_summary?: string } } | null)
              ?.processing_metadata?.error_summary ?? null
          const hasReport =
            r.temMapa === true ||
            (r.report_generated != null &&
              Object.keys(r.report_generated as Record<string, unknown>).length > 0)
          const isDelivered = r.is_delivered ?? false
          const isSelected = selected.has(r.id)
          // "Fotos apagadas" (furo 2026-06-29): imagens purgadas (TTL 24h) +
          // sem relatório = leitura morta. Não mostra "Gerar análise" (só dá
          // erro) — marca como expirada e oferece refazer a captura.
          const photosExpired = r.images_purged_at != null && !hasReport
          // 2026-05-21: founder UAT — qualquer leitura pending com <6 fotos
          // mostra "Continuar" (inclui count=0, ex: convite abandonado pelo
          // cliente). Antes só count>0 disparava — leitura zerada ficava
          // só "Aguardando" sem caminho de retomar.
          const canContinue = status === 'pending' && count < 6

          let action: ReactNode = (
            <span className="text-sm text-muted-foreground">—</span>
          )
          if (photosExpired) {
            // Leva ao detalhe — lá o painel "fotos apagadas" oferece as opções
            // certas (gerar novo link p/ cliente remoto OU refazer presencial).
            action = (
              <Link
                href={`/leituras/${r.id}`}
                className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
              >
                Refazer
              </Link>
            )
          } else if (!isRascunho && isDelivered) {
            action = (
              <Link
                href={`/leituras/${r.id}`}
                className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
              >
                Ver concluída
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

          // 2026-05-22 (caso Caroline): leituras com 6 fotos mas status='pending'
          // (auto-finalize do servidor não rodou) mostram Reprocessar inline,
          // sem precisar abrir o detalhe. Cobre ambas as listas: /leituras
          // (global) e /clientes/[id] (por cliente).
          const canReprocessInline =
            status === 'failed' || (status === 'pending' && count >= 6)
          const continueAction = canContinue ? (
            <Link
              href={`/leituras/nova/capturar?reading=${r.id}`}
              className={cn(buttonVariants({ size: 'sm' }))}
            >
              Continuar
            </Link>
          ) : canReprocessInline ? (
            <ReprocessButton readingId={r.id} status={status as ReadingStatus} />
          ) : null

          return { r, client, count, status, isRascunho, errorSummary, hasReport, isDelivered, isSelected, photosExpired, action, continueAction }
        })

        return (
          <>
            {/* Desktop table (≥md) */}
            <div className="hidden md:block">
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
                  {derived.map(({ r, client, count, status, isRascunho, errorSummary, isSelected, photosExpired, action, continueAction }) => (
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
                        <div className="flex items-center gap-1.5">
                          <StatusBadge
                            status={(status as ReadingStatus) ?? 'pending'}
                            isRascunho={isRascunho}
                            errorSummary={errorSummary}
                          />
                          {photosExpired && (
                            <Badge
                              variant="outline"
                              className="border-amber-600/40 bg-amber-50 text-amber-800"
                            >
                              Fotos expiradas
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{continueAction}</TableCell>
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
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards (<md) — Gmail-style stack, sem scroll horizontal */}
            <ul className="block md:hidden space-y-2">
              {derived.map(({ r, client, count, status, isRascunho, errorSummary, isSelected, photosExpired, action, continueAction }) => (
                <li
                  key={r.id}
                  className={cn(
                    'rounded-md border border-border bg-card p-3 space-y-2',
                    isSelected && 'ring-2 ring-primary',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <Checkbox
                        aria-label={`Selecionar leitura ${client?.full_name ?? r.id}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => toggle(r.id, checked === true)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        {showClient && (
                          <div className="font-medium text-sm truncate">
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
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          <LocalDateTime iso={r.created_at} />
                          <span aria-hidden>·</span>
                          <span className={count < 6 ? '' : 'text-foreground'}>
                            {count}/6 fotos
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Excluir leitura"
                      aria-label="Excluir leitura"
                      onClick={() => setPendingDelete([r.id])}
                      className="flex-shrink-0 -mr-1 -mt-1"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap pl-7">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <StatusBadge
                        status={(status as ReadingStatus) ?? 'pending'}
                        isRascunho={isRascunho}
                        errorSummary={errorSummary}
                      />
                      {photosExpired && (
                        <Badge
                          variant="outline"
                          className="border-amber-600/40 bg-amber-50 text-amber-800"
                        >
                          Fotos expiradas
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      {continueAction}
                      {action}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )
      })()}

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
