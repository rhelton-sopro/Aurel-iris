import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { evaluateTherapistProfile } from '@/lib/gates/therapist-profile'
import { CompleteProfileForm } from './complete-profile-form'

// GATE landing. NÃO está em PROTECTED_PATHS → o middleware não a bloqueia
// (evita loop). Se o perfil já está completo, manda pro dashboard (não
// mostra o gate a quem não precisa).
export default async function CompletarPerfilPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('phone, specialties, tos_accepted_at')
    .eq('id', user.id)
    .maybeSingle()

  const gate = evaluateTherapistProfile({
    phone: profile?.phone ?? null,
    specialties: profile?.specialties ?? null,
    tos_accepted_at: profile?.tos_accepted_at ?? null,
  })
  if (gate.status === 'ok') redirect('/dashboard')

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1">
          <h1 className="text-[22px] font-light uppercase tracking-display text-ink">
            Complete seu cadastro
          </h1>
          <p className="text-sm text-muted-foreground">
            Faltam alguns dados para continuar usando o Iris Codex.
          </p>
        </div>
        <CompleteProfileForm />
      </div>
    </main>
  )
}
