import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientForm } from '@/components/clientes/client-form'
import { updateClientAction } from '@/app/actions/clients'

export default async function EditarClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ motivo?: string }>
}) {
  const { id } = await params
  const { motivo } = await searchParams
  const supabase = await createClient()

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (!client || error) {
    notFound()
  }

  // bind clientId para o updateClientAction
  const action = updateClientAction.bind(null, client.id)

  return (
    <div className="max-w-lg space-y-4">
      {motivo === 'completar' && (
        <div className="bg-amber-50 border border-amber-300 text-sm px-4 py-3 rounded text-amber-900">
          O Iris Codex foi atualizado e agora exige sexo biológico, e-mail e
          telefone para conformidade LGPD e qualidade da leitura. Complete o
          cadastro de {client.full_name} para continuar.
        </div>
      )}
      <ClientForm mode="edit" client={client} action={action} />
    </div>
  )
}
