'use server'

// Wrapper 'use server' fino pra UI invocar o cancelamento manual de reserva
// (D-11 — botão "Cancelar" em "Processos em andamento"). Só exporta funções
// async (memory feedback_use_server_export_hygiene — const/type aqui viram
// RPC stub no bundle client e quebram em prod).
//
// Ownership/RLS são garantidos a jusante: cancelReservation (08-05) faz SELECT
// .eq('user_id') antes do release_reservation RPC (T-08-11-01). Aqui só
// reafirmamos a sessão e revalidamos os caminhos que exibem o saldo.

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { cancelReservation } from '@/lib/billing/reservations'

export interface CancelReservationResult {
  ok: boolean
  error?: string
}

export async function cancelReservationAction(
  readingId: string,
): Promise<CancelReservationResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Não autenticado.' }
  if (typeof readingId !== 'string' || readingId.length === 0) {
    return { ok: false, error: 'Reading ID inválido.' }
  }

  const r = await cancelReservation(readingId, user.id)
  if (!r.ok) {
    const msg =
      r.reason === 'unauthorized'
        ? 'Você não tem permissão.'
        : r.reason === 'not_found'
          ? 'Reserva não encontrada.'
          : 'Erro interno.'
    return { ok: false, error: msg }
  }

  revalidatePath('/assinatura')
  revalidatePath('/dashboard')
  return { ok: true }
}
