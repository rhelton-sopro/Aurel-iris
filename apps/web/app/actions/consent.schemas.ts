/**
 * Schemas + tipos do fluxo de assinatura do termo biométrico.
 *
 * Mora fora do arquivo 'use server' (consent.ts) — regra de higiene: arquivos
 * 'use server' só exportam funções async (consts/types/schemas viram stubs RPC
 * no bundle do client). Ver memory feedback_use_server_export_hygiene.
 */
import { z } from 'zod'

export const signTermSchema = z.object({
  client_id: z.string().uuid(),
  reading_id: z.string().uuid(),
  consent_channel: z.enum([
    'office_handoff',
    'office_qr',
    'remote_link',
    'therapist_created',
  ]),
  cliente_nome: z.string().min(2).max(200),
  cliente_cpf: z.string().optional(),
})

export type SignTermInput = z.infer<typeof signTermSchema>

export type SignTermResult =
  | { ok: true; consent_id: string; pdf_url: string | null }
  | { ok: false; error: string }
