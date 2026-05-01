import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const GENDER_LABELS: Record<string, string> = {
  masculino: 'Masculino',
  feminino: 'Feminino',
  outro: 'Outro',
  não_informado: 'Não informado',
}

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
        {client.gender && (
          <p>
            <span className="font-medium">Gênero:</span>{' '}
            {GENDER_LABELS[client.gender] ?? client.gender}
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
        <h2 className="text-xl font-semibold">Leituras</h2>
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
      </div>
    </div>
  )
}
