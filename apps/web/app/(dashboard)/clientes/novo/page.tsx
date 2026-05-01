import { createClientAction } from '@/app/actions/clients'
import { ClientForm } from '@/components/clientes/client-form'

export default function NovoClientePage() {
  return <ClientForm mode="create" action={createClientAction} />
}
