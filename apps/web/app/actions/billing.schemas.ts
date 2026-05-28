// Schemas + tipos do billing server actions. Sibling do billing.ts ('use server')
// porque arquivos 'use server' só podem exportar funções async — exportar
// const/type/Zod ali vira RPC stub no bundle client (memory
// feedback_use_server_export_hygiene; crash prod-only). Importável server+client.

import { z } from 'zod'

export const createChargeSchema = z.object({
  sku: z.enum(['avulsa', 'pequeno', 'medio', 'grande']),
})

export const refundPackageSchema = z.object({
  credit_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
})

export type CreateChargeInput = z.infer<typeof createChargeSchema>
export type RefundPackageInput = z.infer<typeof refundPackageSchema>

export type CreateChargeResult =
  | { ok: true; credit_id: string; invoice_url: string; asaas_payment_id: string }
  | { ok: false; error: string }

export type RefundPackageResult =
  | { ok: true; refunded_value_brl: number; kind: 'total' | 'partial' }
  | { ok: false; error: string }
