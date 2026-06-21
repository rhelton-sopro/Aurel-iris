import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { isFounderEmail } from '@/lib/auth/founder'
import { getClientReportSections } from '@/lib/admin/client-report-config'

import { ClientReportSectionsForm } from './client-report-sections-form'

// Service-role (supabase-js) na leitura da config → runtime nodejs.
export const runtime = 'nodejs'

export default async function AdminClientReportPage() {
  // Defense-in-depth founder gate (mirror admin/layout.tsx).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isFounderEmail(user.email)) {
    notFound()
  }

  const selected = await getClientReportSections()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Versão do cliente (relatório)</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Marque as seções que entram na <strong>versão condensada</strong> que o
          terapeuta entrega ao cliente (botão “Versão do cliente” na leitura). As
          seções não marcadas continuam no relatório completo — só não vão pro
          cliente. A numeração abaixo é a que aparece no relatório entregue.
        </p>
      </div>

      <ClientReportSectionsForm initialSelected={selected} />
    </div>
  )
}
