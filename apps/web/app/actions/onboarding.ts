'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// 'use server' rule: SÓ async functions exportadas (memory feedback_use_server_export_hygiene).
// Sem types/interfaces aqui — retorno inline.
export async function dismissOnboardingAction(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) {
    return { ok: false, error: 'Unauthenticated' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_dismissed_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/dashboard')
  return { ok: true }
}
