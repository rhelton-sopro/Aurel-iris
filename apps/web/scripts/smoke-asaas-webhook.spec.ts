/**
 * SMOKE — auth do webhook Asaas (Fase 8 / passo 5 go-live).
 *
 * Verifica o CONTRATO DE AUTENTICAÇÃO do endpoint /api/asaas/webhook contra
 * uma URL LIVE (preview/prod), provando que o ASAAS_WEBHOOK_TOKEN está casado
 * entre o Vercel (servidor) e o painel Asaas — SEM precisar de pagamento real
 * e SEM poluir o banco (os 3 casos retornam antes de qualquer INSERT):
 *
 *   1. sem header asaas-access-token        → 401 (missing_token)
 *   2. token errado                          → 401 (invalid_token)
 *   3. token correto + body inválido ({})    → 400 (auth PASSOU; Zod rejeita
 *                                                    o envelope ANTES do
 *                                                    recordWebhookEvent → zero
 *                                                    efeito colateral no DB)
 *
 * O fluxo COMPLETO (PIX sandbox → PAYMENT_CONFIRMED → crédito ativo) é o
 * passo 6 (smoke E2E), que exige Asaas sandbox + customer_credits pending.
 *
 * Pré-requisito (em apps/web/.env.local):
 *   ASAAS_WEBHOOK_SMOKE_URL = https://<deploy>/api/asaas/webhook
 *   ASAAS_WEBHOOK_TOKEN     = <mesmo secret setado no Vercel + painel Asaas>
 *
 * Rodar:
 *   cd apps/web
 *   npx vitest run --config scripts/smoke-asaas-webhook.config.ts
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnvLocal() {
  const envPath = resolve(__dirname, '..', '.env.local')
  if (!existsSync(envPath)) return
  for (const raw of readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}
loadEnvLocal()

const URL = process.env.ASAAS_WEBHOOK_SMOKE_URL
const TOKEN = process.env.ASAAS_WEBHOOK_TOKEN

/**
 * Lê status + corpo (truncado) e detecta a página de SSO da Vercel
 * (Deployment Protection), que devolve 401 com HTML — NÃO o 401 do nosso
 * handler (JSON {"error":"unauthorized"}). Distinguir os dois é o erro de
 * interpretação mais provável em deploys de preview.
 */
async function probe(headers: Record<string, string>, body: string) {
  const res = await fetch(URL!, { method: 'POST', headers, body })
  const text = await res.text().catch(() => '')
  const vercelGate =
    /Authentication Required|vercel\.com\/sso|_vercel_sso|<!doctype html/i.test(text)
  return { status: res.status, snippet: text.slice(0, 120), vercelGate }
}

describe.skipIf(!URL || !TOKEN)('smoke: auth do webhook Asaas', () => {
  it('rejeita sem token → 401', async () => {
    const r = await probe(
      { 'content-type': 'application/json' },
      JSON.stringify({ id: 'evt_smoke', event: 'PAYMENT_CONFIRMED' }),
    )
    console.log(`[smoke] sem token → ${r.status} ${r.snippet}`)
    expect(r.vercelGate, 'Deployment Protection da Vercel está gateando — desligue no preview').toBe(false)
    expect(r.status).toBe(401)
  })

  it('rejeita token errado → 401', async () => {
    const r = await probe(
      {
        'content-type': 'application/json',
        'asaas-access-token': 'token-errado-de-proposito',
      },
      JSON.stringify({ id: 'evt_smoke', event: 'PAYMENT_CONFIRMED' }),
    )
    console.log(`[smoke] token errado → ${r.status} ${r.snippet}`)
    expect(r.vercelGate, 'Deployment Protection da Vercel está gateando — desligue no preview').toBe(false)
    expect(r.status).toBe(401)
  })

  it('aceita token correto e rejeita body inválido → 400 (auth OK, zero efeito no DB)', async () => {
    const r = await probe(
      {
        'content-type': 'application/json',
        'asaas-access-token': TOKEN!,
      },
      JSON.stringify({}), // envelope inválido: Zod falha DEPOIS da auth
    )
    console.log(
      `[smoke] token correto + body inválido → ${r.status} ${r.snippet} (esperado 400 = auth passou)`,
    )
    // Se voltar 401 com vercelGate=true → é o SSO da Vercel, não o token.
    expect(r.vercelGate, 'Deployment Protection da Vercel está gateando — desligue no preview').toBe(false)
    // 400 prova que a auth passou (401 do nosso handler = token não casado).
    expect(r.status).toBe(400)
  })
})

describe.runIf(!URL || !TOKEN)('smoke: auth do webhook Asaas (skip)', () => {
  it('pulado — defina ASAAS_WEBHOOK_SMOKE_URL + ASAAS_WEBHOOK_TOKEN em .env.local', () => {
    console.log(
      '\n[smoke] PULADO. Para rodar:\n' +
        '  1. Seta ASAAS_WEBHOOK_TOKEN no Vercel + painel Asaas (header asaas-access-token).\n' +
        '  2. Deploy.\n' +
        '  3. Em apps/web/.env.local adiciona:\n' +
        '       ASAAS_WEBHOOK_SMOKE_URL=https://<deploy>/api/asaas/webhook\n' +
        '       ASAAS_WEBHOOK_TOKEN=<o mesmo secret>\n' +
        '  4. Roda de novo.',
    )
    expect(true).toBe(true)
  })
})
