import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SummaryCards } from '@/components/dashboard/summary-cards'
import { InviteNotifications } from '@/components/dashboard/invite-notifications'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Notifications devem refletir aberturas de /leituras/[id] do mesmo
// request (founder abre uma, volta pro dashboard — card tem que sumir).
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Contar clientes do terapeuta (RLS filtra por therapist_id = auth.uid())
  const { count: clientsCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })

  // Buscar trial info do perfil
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, trial_ends_at, beta_readings_used')
    .eq('id', user?.id ?? '')
    .single()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link
          href="/leituras/autoexame"
          className={cn(buttonVariants())}
        >
          Fazer meu próprio exame
        </Link>
      </div>
      <InviteNotifications />
      <SummaryCards
        clientsCount={clientsCount ?? 0}
        trialEndsAt={profile?.trial_ends_at ?? null}
        subscriptionStatus={profile?.subscription_status ?? null}
        betaReadingsUsed={profile?.beta_readings_used ?? 0}
      />
    </div>
  )
}
