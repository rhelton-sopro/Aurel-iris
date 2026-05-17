import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'

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

  // Buscar perfil do terapeuta (RLS garante que só vê o próprio)
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, subscription_status, trial_ends_at')
    .eq('id', user.id)
    .single()

  const fullName = profile?.full_name ?? 'Terapeuta'
  const trialEndsAt = profile?.trial_ends_at ?? null
  const subscriptionStatus = profile?.subscription_status ?? null

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
          trialEndsAt={trialEndsAt}
          subscriptionStatus={subscriptionStatus}
        />
        <main className="flex-1 px-7 py-6">
          {children}
        </main>
        <footer className="px-7 pb-5">
          <p className="text-[10.5px] uppercase tracking-label text-mist">
            Ferramenta de apoio à anamnese terapêutica integrativa, não substitui avaliação médica.
          </p>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  )
}
