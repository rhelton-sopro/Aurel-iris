// Schemas + tipos do billing server actions. Sibling do billing.ts ('use server')
// porque arquivos 'use server' só podem exportar funções async — exportar
// const/type/Zod ali vira RPC stub no bundle client (memory
// feedback_use_server_export_hygiene; crash prod-only). Importável server+client.

import { z } from 'zod'

export const createChargeSchema = z.object({
  // 'teste' = SKU EFÊMERO de UAT (R$5, 1 leitura). Remover do enum + desativar no
  // banco após validar o fluxo de compra em produção (founder 2026-06-20).
  sku: z.enum(['avulsa', 'pequeno', 'medio', 'grande', 'teste']),
  // Método escolhido pelo cliente na NOSSA tela (B-lite, founder 2026-05-31):
  // SÓ PIX ou cartão — NUNCA UNDEFINED/BOLETO. O /payments aceita 1 billingType
  // por cobrança e não existe valor "PIX+cartão" (doc Asaas criar-nova-cobranca),
  // então a escolha é nossa: o checkout hospedado mostra só o método escolhido →
  // boleto nunca aparece.
  billingType: z.enum(['PIX', 'CREDIT_CARD']),
  // Opcional: quando a compra é disparada pelo banner "sem créditos" de uma
  // leitura (analise-client), carregamos o reading_id pra montar o successUrl
  // do checkout Asaas → cliente volta pra ESSA leitura após pagar (autoRedirect).
  // Ausente = compra avulsa pela tela /assinatura/comprar → volta pra /assinatura.
  reading_id: z.string().uuid('reading_id inválido').optional(),
  // Parcelas no cartão (founder 2026-06-19): o cliente escolhe 1–3x na nossa tela.
  // SÓ vale pro pacote grande + CREDIT_CARD; a action re-clampa (preço/regra vêm
  // do servidor, nunca do client). Ausente = 1x à vista.
  installments: z.number().int().min(1).max(3).optional(),
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
  // total (0 leituras usadas) → estornado na hora via API
  | { ok: true; mode: 'refunded'; refunded_value_brl: number; kind: 'total' }
  // parcial (já usou leituras) → solicitação enviada ao suporte (estorno manual no MP)
  | { ok: true; mode: 'requested'; value_brl: number; leituras_to_refund: number }
  | { ok: false; error: string }
