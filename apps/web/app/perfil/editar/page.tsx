import { redirect } from 'next/navigation'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { EditProfileForm } from './edit-profile-form'

// Edição de dados básicos do terapeuta (nome + telefone). Acessível pelo menu
// do avatar (dashboard-header). Diferente de /perfil/completar (gate one-time de
// onboarding): aqui é re-edição livre, sem gate de redirect.
export const dynamic = 'force-dynamic'

export default async function EditarPerfilPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-4 py-8">
      <div className="space-y-1">
        <h1 className="text-[22px] font-light uppercase tracking-display text-ink">
          Editar perfil
        </h1>
        <p className="text-sm text-muted-foreground">
          Atualize seu nome e telefone. Para alterar CPF ou especialidades,
          entre em contato com o suporte.
        </p>
      </div>

      <EditProfileForm
        initialFullName={profile?.full_name ?? ''}
        initialPhone={profile?.phone ?? ''}
      />

      <Link
        href="/dashboard"
        className={cn(buttonVariants({ variant: 'outline', className: 'w-full' }))}
      >
        Voltar
      </Link>
    </div>
  )
}
