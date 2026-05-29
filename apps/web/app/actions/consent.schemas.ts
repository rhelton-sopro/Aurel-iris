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
  // Opcional: no fluxo de consultório o termo é assinado a NÍVEL DE CLIENTE
  // (antes de qualquer leitura existir — o gate em createReadingAction roda
  // antes do INSERT reading). client_consents.reading_id é nullable (0020).
  reading_id: z.string().uuid().optional(),
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
