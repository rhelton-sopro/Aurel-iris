import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { DisclaimerCopy } from '@/components/legal/DisclaimerCopy'

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

  // Perfil (nome p/ avatar) + saldo de créditos ativos (badge no header, onde
  // antes ficavam os dias de trial — founder 2026-05-30).
  const [{ data: profile }, { data: creditRows }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase
      .from('customer_credits')
      .select('leituras_remaining')
      .eq('user_id', user.id)
      .eq('status', 'active'),
  ])

  const fullName = profile?.full_name ?? 'Terapeuta'
  const creditsRemaining = (creditRows ?? []).reduce(
    (s, r) => s + (r.leituras_remaining ?? 0),
    0,
  )

  return (
    <SidebarProvider
      style={
        { '--sidebar-width': '15rem', '--sidebar-width-icon': '4rem' } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset>
        <DashboardHeader fullName={fullName} creditsRemaining={creditsRemaining} />
        <main className="flex-1 px-7 py-6">
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
