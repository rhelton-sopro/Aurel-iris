'use server'

/**
 * Server action: salvar a seleção global de seções da "Versão do cliente".
 * Gate de founder (defense-in-depth — middleware + layout já protegem /admin).
 * A escrita em si passa pelo service-role em lib/admin/client-report-config.
 */
import { createClient } from '@/lib/supabase/server'
import { isFounderEmail } from '@/lib/auth/founder'
import { setClientReportSections } from '@/lib/admin/client-report-config'

export async function saveClientReportSections(
  headings: string[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isFounderEmail(user.email)) {
    return { ok: false, error: 'Não autorizado.' }
  }
  try {
    await setClientReportSections(headings)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Falha ao salvar.' }
  }
}
