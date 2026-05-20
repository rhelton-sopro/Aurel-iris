/**
 * `markReadingReady` — função compartilhada de "marca a leitura como
 * processada e incrementa contador do beta" (Modal-disabled path do
 * /api/readings/[id]/process linhas 78-112 originais).
 *
 * Extraída pra reuso pelo:
 *  - `/api/readings/[id]/process` (path authed, finalizeReadingAction
 *    do fluxo terapeuta normal)
 *  - `/api/convite/[token]/finalize` (fluxo público, cliente sem sessão
 *    — service-role chama esta função direto, sem HTTP roundtrip)
 *
 * Mantém o contrato exato do path original:
 *  - Atualiza status='ready' (Modal aposentado — Sonnet-direct lê os
 *    canonicals direto quando terapeuta clica "Gerar análise" depois).
 *  - CAS em beta_counted: garante COUNT EXATAMENTE 1× na 1ª saída de
 *    'pending'. Reprocess/regen NÃO duplica. Apagar leitura NÃO libera
 *    vaga (counter monotônico em profiles.beta_readings_used).
 *  - Cap rule: counter incrementa pra TODO terapeuta, founder incluído.
 *    Founder bypassa apenas o GATE em createReadingAction (libera criar
 *    além do cap). Aqui não tem GATE — é só o tally.
 *
 * Retorna { ok: true } ou { error: string }. NÃO faz revalidatePath —
 * caller decide quando invalidar (path authed faz após chamada; convite
 * finalize não precisa porque cliente foi pra /obrigada).
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

export interface MarkReadyArgs {
  readingId: string
  /**
   * Status atual da leitura (pra decidir se incrementa contador).
   * Counter só incrementa na 1ª saída de 'pending' (CAS evita duplo-fire,
   * mas precisamos saber o status atual pra evitar UPDATE desnecessário
   * em readings já em 'ready'/'failed').
   */
  currentStatus: string | null
}

export interface MarkReadyResult {
  ok?: true
  error?: string
}

export async function markReadingReady(args: MarkReadyArgs): Promise<MarkReadyResult> {
  const { readingId, currentStatus } = args
  const svc = createServiceClient()

  // 1. Marca status='ready' (idempotente — UPDATE roda mesmo se já está
  //    ready; sem WHERE de status pra simplificar; CAS em beta_counted
  //    abaixo evita duplo-incremento).
  const { error: readyError } = await svc
    .from('readings')
    .update({ status: 'ready' })
    .eq('id', readingId)
  if (readyError) {
    return { error: `Mark-ready failed: ${readyError.message}` }
  }

  // 2. Beta cap CAS — só incrementa se vinha de 'pending' (a 1ª saída).
  //    Em 'failed' (reprocess) NÃO incrementa: já foi contado antes.
  if (currentStatus === 'pending') {
    const { data: claimed } = await svc
      .from('readings')
      .update({ beta_counted: true })
      .eq('id', readingId)
      .eq('beta_counted', false)
      .select('therapist_id')
      .maybeSingle()
    if (claimed?.therapist_id) {
      await svc.rpc('increment_beta_readings_used', {
        p_therapist: claimed.therapist_id,
      })
    }
  }

  return { ok: true }
}
