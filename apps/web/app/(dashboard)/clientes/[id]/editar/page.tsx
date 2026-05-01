import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientForm } from '@/components/clientes/client-form'
import { updateClientAction } from '@/app/actions/clients'

export default async function EditarClientePage({
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

  // bind clientId para o updateClientAction
  const action = updateClientAction.bind(null, client.id)

  return <ClientForm mode="edit" client={client} action={action} />
}
