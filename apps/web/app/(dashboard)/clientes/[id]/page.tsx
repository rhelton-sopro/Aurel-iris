import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
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
import { resolveClientGate } from '@/lib/gates/client-gates'
import { UnderageBlockPanel } from '@/components/clientes/underage-block-panel'
import { StatusBadge, type ReadingStatus } from '@/components/readings/StatusBadge'

/**
 * A lista deve refletir leituras criadas neste mesmo request (ex.: terapeuta
 * acabou de finalizar captura e voltou pra ficha do cliente). Sem
 * `force-dynamic` o RSC cache pode servir uma versão pré-captura.
 */
export const dynamic = 'force-dynamic'

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (!client || error) {
    notFound()
  }

  const gate = resolveClientGate(client)
  if (gate.status === 'incomplete') {
    redirect(gate.completionPath)
  }
  if (gate.status === 'blocked_underage') {
    return (
      <UnderageBlockPanel
        clientId={client.id}
        fullName={client.full_name}
        birthDate={gate.birthDate}
      />
    )
  }

  const { data: readings } = await supabase
    .from('readings')
    .select(`
      id,
      status,
      created_at,
      vision_features,
      report_generated,
      is_delivered,
      reading_images(count)
    `)
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })

  const list = readings ?? []

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{client.full_name}</h1>
        <Link href={`/clientes/${client.id}/editar`} className={cn(buttonVariants({ variant: 'outline' }))}>
          Editar cliente
        </Link>
      </div>

      <div className="space-y-2 text-sm">
        {client.birth_date && (
          <p>
            <span className="font-medium">Nascimento:</span>{' '}
            {format(new Date(client.birth_date + 'T00:00:00'), 'dd/MM/yyyy')}
          </p>
        )}
        {client.notes && (
          <p>
            <span className="font-medium">Notas:</span>{' '}
            <span className="text-muted-foreground whitespace-pre-wrap">{client.notes}</span>
          </p>
        )}
      </div>

      <div className="space-y-3 pt-4 border-t">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Leituras</h2>
          {list.length > 0 && (
            <Link
              href={`/leituras/nova?cliente=${client.id}`}
              className={cn(buttonVariants({ size: 'sm' }))}
            >
              Nova Leitura
            </Link>
          )}
        </div>

        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <p className="font-medium">Nenhuma leitura ainda</p>
            <p className="text-sm text-muted-foreground">
              As leituras de íris deste cliente aparecerão aqui.
            </p>
            <Link
              href={`/leituras/nova?cliente=${client.id}`}
              className={cn(buttonVariants())}
            >
              Nova Leitura
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Fotos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Análise</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map(r => {
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
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
