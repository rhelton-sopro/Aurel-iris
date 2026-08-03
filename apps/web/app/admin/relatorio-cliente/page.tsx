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
        <h2 className="text-lg font-medium">Versão do cliente — Dossiê</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Marque as seções que entram na <strong>versão condensada</strong> que o
          terapeuta entrega ao cliente (botão “Versão do cliente” na leitura). As
          seções não marcadas continuam no relatório completo — só não vão pro
          cliente. A numeração abaixo é a que aparece no relatório entregue.
        </p>
        <p className="mt-3 max-w-2xl rounded-md border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <strong>Vale só para o Dossiê</strong> — ou seja, para as leituras
          anteriores a 30/07/2026. Nas leituras novas, o relatório é o{' '}
          <strong>Mapa do Ser</strong>, e quem escolhe os blocos da versão do cliente é
          o <strong>terapeuta</strong>, bloco a bloco, na hora de baixar — não esta
          página. O padrão de lá é tudo menos “Perguntas para a sua sessão”.
        </p>
      </div>

      <ClientReportSectionsForm initialSelected={selected} />
    </div>
  )
}
