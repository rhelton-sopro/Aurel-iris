/**
 * Schemas + tipos do fluxo PÚBLICO de assinatura do termo biométrico via
 * convite (remote_link). Mora fora do arquivo 'use server' (invite-consent.ts) —
 * regra de higiene: arquivos 'use server' só exportam funções async.
 * Ver memory feedback_use_server_export_hygiene.
 */
import { z } from 'zod'

export const signInviteTermSchema = z.object({
  token: z.string().min(1),
  client_id: z.string().uuid(),
  reading_id: z.string().uuid(),
  cliente_nome: z.string().min(2).max(200),
  cliente_cpf: z.string().optional(),
})

export type SignInviteTermInput = z.infer<typeof signInviteTermSchema>

export type SignInviteTermResult =
  | { ok: true; consent_id: string; pdf_url: string | null }
  | { ok: false; error: string }
