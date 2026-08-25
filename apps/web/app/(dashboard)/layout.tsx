import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { DisclaimerCopy } from '@/components/legal/DisclaimerCopy'
import { LowCreditsBanner } from '@/components/billing/LowCreditsBanner'
import { getTrialState } from '@/lib/billing/trial'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // getUser() valida JWT server-side (T-02-01 — nunca usar getSession no servidor)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user || authError) {
    redirect('/login')
  }

  // Perfil (nome p/ avatar) + saldo de créditos COMPRADOS + estado da trial.
  // Trial e créditos são saldos SEPARADOS (gasta trial primeiro, créditos
  // intactos) → dois selos no header ao lado da inicial (founder 2026-05-31).
  const [{ data: profile }, { data: creditRows }, trial] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase
      .from('customer_credits')
      .select('leituras_remaining')
      .eq('user_id', user.id)
      .eq('status', 'active'),
    getTrialState(user.id),
  ])

  const fullName = profile?.full_name ?? 'Terapeuta'
  const creditsRemaining = (creditRows ?? []).reduce(
    (s, r) => s + (r.leituras_remaining ?? 0),
    0,
  )
  // > 0 só quando a trial está ativa com leituras restantes (trial esgotado/
  // expirado → evaluateTrial retorna 'ended', então cai em 0 = sem selo grátis).
  const trialReadingsRemaining =
    trial.status === 'active' ? trial.readings_remaining : 0

  return (
    <SidebarProvider
      style={
        { '--sidebar-width': '15rem', '--sidebar-width-icon': '4rem' } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <DashboardHeader
          fullName={fullName}
          creditsRemaining={creditsRemaining}
          trialReadingsRemaining={trialReadingsRemaining}
          trialExpiresAt={trial.status === 'active' ? trial.expires_at : null}
        />
        <main className="flex-1 px-7 py-6">
          {/* Nudge de recompra quando o saldo COMPRADO total está baixo (≤3).
              Client component: esconde sozinho em /assinatura e quando saldo
              não é baixo. Cobre dashboard + criação/geração de leitura (todas
              sob este layout). */}
          <LowCreditsBanner creditsRemaining={creditsRemaining} />
          {children}
        </main>
        {/* Surface 2 (LGPD-05) — rodapé passivo de páginas autenticadas.
            Single source of truth via DisclaimerCopy (DISCLAIMER_COMPACT). */}
        <div className="px-7 pb-5">
          <DisclaimerCopy variant="compact" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
