import Link from 'next/link'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
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

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  processing: 'Processando',
  ready: 'Pronta',
  failed: 'Falhou',
  edited: 'Editada',
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  ready: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  edited: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
}

export default async function LeiturasPage() {
  const supabase = await createClient()

  const { data: readings } = await supabase
    .from('readings')
    .select(`
      id,
      status,
      created_at,
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map(r => {
              const client = Array.isArray(r.client) ? r.client[0] : r.client
              const count = (r.reading_images?.[0]?.count as number | undefined) ?? 0
              const status = r.status ?? 'pending'
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {client?.full_name ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.created_at
                      ? format(new Date(r.created_at), 'dd/MM/yyyy HH:mm')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <span className={count < 6 ? 'text-muted-foreground' : 'text-foreground'}>
                      {count}/6
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                      STATUS_CLASS[status] ?? STATUS_CLASS['pending']
                    )}>
                      {STATUS_LABEL[status] ?? status}
                    </span>
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
