import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { ClientsTable } from '@/components/clientes/clients-table'
import { ClientesHeaderActions } from '@/components/clientes/ClientesHeaderActions'
import { cn } from '@/lib/utils'

export default async function ClientesPage() {
  const supabase = await createClient()

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('full_name', { ascending: true })

  const list = clients ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[22px] font-light uppercase tracking-display text-ink">Clientes</h1>
        <div className="flex items-center gap-2">
          <ClientesHeaderActions
            availableClients={list.map((c) => ({ id: c.id, full_name: c.full_name }))}
          />
          <Link href="/clientes/novo" className={cn(buttonVariants())}>
            Novo cliente
          </Link>
        </div>
      </div>
      <ClientsTable clients={list} />
    </div>
  )
}
