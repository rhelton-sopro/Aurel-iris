import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SummaryCards } from '@/components/dashboard/summary-cards'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
    .select('subscription_status, trial_ends_at')
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
      <SummaryCards
        clientsCount={clientsCount ?? 0}
        trialEndsAt={profile?.trial_ends_at ?? null}
        subscriptionStatus={profile?.subscription_status ?? null}
      />
    </div>
  )
}
