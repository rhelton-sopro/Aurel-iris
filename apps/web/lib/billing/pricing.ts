// Fonte ÚNICA das regras de preço de venda (desconto PIX + parcelamento).
// Pura, sem I/O nem 'use server' — importável por client (PackageCard, LP) e
// server (billing action, refund, reports). Centralizar evita drift entre a
// tela de compra, a LP e o cálculo de cobrança/reembolso/receita.
//
// Decisões (founder 2026-06-19):
//   - PIX dá 5% de desconto SÓ nos pacotes médio e grande (tickets altos).
//   - Cartão pode parcelar SEM juros: médio até 2x, grande até 3x. Demais 1x.
//   - O valor REALMENTE pago é gravado em customer_credits.paid_brl (migration
//     0047) — reembolso e receita usam ele, não o preço de tabela.

/** Desconto à vista no PIX (fração). */
export const PIX_DISCOUNT_PCT = 0.05

/** SKUs elegíveis ao desconto PIX. */
const PIX_DISCOUNT_SKUS = new Set<string>(['medio', 'grande'])

/** Máximo de parcelas sem juros no cartão, por SKU. Ausente = 1x (à vista). */
const MAX_INSTALLMENTS: Record<string, number> = { medio: 2, grande: 3 }

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** True se o SKU ganha desconto no PIX. */
export function hasPixDiscount(sku: string): boolean {
  return PIX_DISCOUNT_SKUS.has(sku)
}

/** Preço no PIX (com desconto se elegível; senão o cheio). */
export function pixPriceBrl(sku: string, priceBrl: number): number {
  return hasPixDiscount(sku)
    ? round2(priceBrl * (1 - PIX_DISCOUNT_PCT))
    : round2(priceBrl)
}

/** Máximo de parcelas no cartão pra este SKU (1 = sem parcelamento). */
export function maxInstallmentsFor(sku: string): number {
  return MAX_INSTALLMENTS[sku] ?? 1
}

/** Percentual de desconto PIX como inteiro p/ exibir ("5%"). */
export const PIX_DISCOUNT_LABEL = `${Math.round(PIX_DISCOUNT_PCT * 100)}%`
