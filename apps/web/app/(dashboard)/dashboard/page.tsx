import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SummaryCards } from '@/components/dashboard/summary-cards'
import { InviteReadingsSection } from '@/components/dashboard/invite-readings-section'
import { AutoRefreshWhileProcessing } from '@/components/readings/AutoRefreshWhileProcessing'
import { OnboardingWizard } from '@/components/dashboard/onboarding-wizard'
import { evaluateTherapistProfile } from '@/lib/gates/therapist-profile'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Seção de convite reflete leituras criadas em tempo real (cliente faz,
// terapeuta vê na hora) e o flag "vista" muda no mesmo session.
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Paralelo: clientes + readings + perfil (onboarding state derivado de DB).
  const [{ count: clientsCount }, { count: readingsCount }, { data: profile }] =
    await Promise.all([
      supabase.from('clients').select('*', { count: 'exact', head: true }),
      supabase.from('readings').select('*', { count: 'exact', head: true }),
      supabase
        .from('profiles')
        .select(
          'subscription_status, trial_ends_at, beta_readings_used, phone, specialties, tos_accepted_at, onboarding_dismissed_at',
        )
        .eq('id', user?.id ?? '')
        .single(),
    ])

  // Onboarding state derivado de DB (D-02, D-03).
  const therapistGate = evaluateTherapistProfile({
    phone: profile?.phone ?? null,
    specialties: profile?.specialties ?? null,
    tos_accepted_at: profile?.tos_accepted_at ?? null,
  })
  const step1Complete = therapistGate.status === 'ok'
  const step2Complete = (clientsCount ?? 0) > 0
  const step3Complete = (readingsCount ?? 0) > 0

  // Banner some quando dismiss explícito. Componente garante null-return quando
  // todos 3 completos (backward-compat terapeutas existentes com dados).
  const dismissed = profile?.onboarding_dismissed_at != null
  const showWizard = !dismissed

  return (
    <div className="space-y-6">
      {/* Polling 15s — atualiza a seção "Leituras via convite" + badges
          NOVO sem F5. Padrão arquitetural existente (router.refresh()),
          zero infra nova. Cliente terminar foto via /convite reflete em
          até 15s pra terapeuta com dashboard aberto. */}
      <AutoRefreshWhileProcessing active intervalMs={15000} />
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link href="/leituras/autoexame" className={cn(buttonVariants())}>
          Fazer meu próprio exame
        </Link>
      </div>
      {showWizard && (
        <OnboardingWizard
          step1Complete={step1Complete}
          step2Complete={step2Complete}
          step3Complete={step3Complete}
        />
      )}
      <InviteReadingsSection />
      <SummaryCards
        clientsCount={clientsCount ?? 0}
        trialEndsAt={profile?.trial_ends_at ?? null}
        subscriptionStatus={profile?.subscription_status ?? null}
        betaReadingsUsed={profile?.beta_readings_used ?? 0}
      />
    </div>
  )
}
