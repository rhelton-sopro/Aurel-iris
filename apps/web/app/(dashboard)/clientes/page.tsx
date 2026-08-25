import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { ClientsTable } from '@/components/clientes/clients-table'
import { ClientesHeaderActions } from '@/components/clientes/ClientesHeaderActions'
import { cn } from '@/lib/utils'

export default async function ClientesPage() {
  const supabase = await createClient()

  // ⚠️ A coluna "Última leitura" da tabela existia, tinha título, ocupava espaço
  // — e mostrava um traço para TODO cliente, sempre. Um cliente com cinco
  // leituras aparecia igual a um que nunca fez nenhuma: informação errada com
  // cara de informação, na coluna que responde "quem está atrasado pra voltar".
  const [{ data: clients }, { data: readingDates }] = await Promise.all([
    supabase.from('clients').select('*').order('full_name', { ascending: true }),
    supabase
      .from('readings')
      .select('client_id, created_at')
      .order('created_at', { ascending: false }),
  ])

  // Primeira ocorrência por cliente = a mais recente (a query já vem ordenada).
  const ultimaLeitura = new Map<string, string>()
  for (const r of readingDates ?? []) {
    if (r.client_id && !ultimaLeitura.has(r.client_id)) {
      ultimaLeitura.set(r.client_id, r.created_at as string)
    }
  }

  const list = (clients ?? []).map((c) => ({
    ...c,
    ultima_leitura_at: ultimaLeitura.get(c.id) ?? null,
  }))

  return (
    <div className="space-y-6">
      {/* Mesma responsividade de /leituras: empilha em mobile, row em sm+. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <h1 className="text-[22px] font-light uppercase tracking-display text-ink">Clientes</h1>
        <div className="flex flex-wrap items-center gap-2">
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
