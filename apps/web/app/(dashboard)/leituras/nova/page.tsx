import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NewReadingForm } from './new-reading-form'
import { evaluateProfileCompleteness } from '@/lib/gates/profile-completeness'

export default async function NovaLeituraPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>
}) {
  const { cliente: preselected } = await searchParams
  const supabase = await createClient()

  // RLS filtra automaticamente para clientes do terapeuta logado
  const { data: clients } = await supabase
    .from('clients')
    .select('id, full_name, birth_date, biological_sex, email, phone')
    .order('full_name', { ascending: true })

  const list = (clients ?? []).map((c) => ({
    id: c.id,
    full_name: c.full_name,
    gateStatus: evaluateProfileCompleteness(c).status,
  }))

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-semibold">Nova leitura</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione o cliente para iniciar a captura das imagens.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <p className="text-lg font-medium">Você ainda não tem clientes cadastrados.</p>
          <p className="text-sm text-muted-foreground">
            Cadastre antes de iniciar uma leitura.
          </p>
          <Link href="/clientes/novo" className={cn(buttonVariants({ size: 'sm' }))}>
            Cadastrar cliente
          </Link>
        </div>
      ) : (
        <NewReadingForm clients={list} preselectedClientId={preselected} />
      )}
    </div>
  )
}
