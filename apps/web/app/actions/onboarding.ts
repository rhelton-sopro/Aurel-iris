'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { startTrial } from '@/lib/billing/trial'

// 'use server' rule: SÓ async functions exportadas (memory feedback_use_server_export_hygiene).
// Sem types/interfaces aqui — retorno inline.

// Religa a trial de boas-vindas (3 leituras / 15 dias) no fim do signup.
// startTrial() é idempotente (23505 → no-op), então é seguro chamar das duas
// trilhas (self-signup E convite) e mesmo em re-render. Fix 2026-05-31: a função
// existia desde a Fase 8 mas NUNCA tinha caller — terapeuta novo caía em
// no_trial → paywall antes da 1ª leitura. Agora nasce com leituras grátis pro aha.
export async function ensureTrialStartedAction(): Promise<{ ok: boolean; created?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) {
    return { ok: false }
  }

  const result = await startTrial(user.id)
  return { ok: result.ok, created: result.created }
}
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
