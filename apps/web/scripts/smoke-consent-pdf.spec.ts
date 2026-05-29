/**
 * SMOKE — PDF do termo de consentimento (Fase 8 / go-live).
 *
 * Objetivo: provar, com o CÓDIGO REAL de produção, que o termo vigente
 * (seedado em consent_terms) é hidratado com os dados do operador
 * (Instituto Sopro da Origem, CNPJ, endereço, DPO Nailli, e-mail) em vez de
 * deixar [marcadores] — é o documento que o cliente assina.
 *
 * Reusa os módulos server-only de produção (via alias do shim em
 * scripts/smoke-consent-pdf.config.ts):
 *   - operatorIdentity()  (lê as env OPERATOR_* + MODALIDADE_ATIVA fixa)
 *   - hydrateTerm()       (mesma substituição {{...}} do route)
 *   - renderTermoHtml()   (mesmo HTML enviado ao Gotenberg)
 *   - createServiceClient (busca o termo vigente do banco — prova o seed)
 *
 * Saídas (apps/web/tmp/consent-smoke/):
 *   - termo-hidratado.md   → texto final do termo, placeholders resolvidos
 *   - termo.html           → abra no navegador = preview fiel do PDF
 *   - termo.pdf            → só se GOTENBERG_URL estiver no ambiente
 *
 * Rodar:
 *   cd apps/web
 *   npx vitest run --config scripts/smoke-consent-pdf.config.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { hydrateTerm } from '@/lib/consent/hydrate-term'
import { operatorIdentity } from '@/lib/consent/operator'
import { renderTermoHtml } from '@/lib/consent/pdf-template'
import { createServiceClient } from '@/lib/supabase/service'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * vitest não carrega .env.local automaticamente. Parse mínimo (split no
 * primeiro '='), só preenche chaves ainda ausentes em process.env.
 */
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

const OUT_DIR = resolve(__dirname, '..', 'tmp', 'consent-smoke')

describe('smoke: PDF do termo de consentimento', () => {
  it('hidrata os campos do operador (sem [marcadores]) e renderiza o documento', async () => {
    mkdirSync(OUT_DIR, { recursive: true })

    // 1. Termo vigente do banco (prova que o seed está live + is_current).
    const supabase = createServiceClient()
    const { data: term, error } = await supabase
      .from('consent_terms')
      .select('version, body, content_sha256')
      .eq('is_current', true)
      .maybeSingle()
    expect(error, error?.message).toBeNull()
    expect(term, 'nenhum termo is_current=true — rode o seed primeiro').toBeTruthy()
    console.log(
      `\n[smoke] termo vigente: ${term!.version} (sha256=${term!.content_sha256.slice(0, 16)}...)`,
    )

    // 2. Hidrata com os MESMOS valores do route: operador (env) + titular/
    //    terapeuta de exemplo + data/IP de exemplo.
    const { hydrated, sha256 } = hydrateTerm(term!.body, {
      ...operatorIdentity(),
      TERAPEUTA_RESPONSAVEL: 'Terapeuta de Teste (smoke)',
      TERAPEUTA_CNPJ_CPF: '123.456.789-00',
      TITULAR_NOME: 'Cliente de Teste (smoke)',
      TITULAR_CPF: '987.654.321-00',
      DATA_ACEITE_BR: '29/05/2026 11:30 BRT',
      IP_ACEITE: '203.0.113.42',
    })

    // 3. Nenhum placeholder cru {{...}} e nenhum [MARCADOR] de operador.
    expect(hydrated, 'placeholder {{...}} cru sobrou').not.toMatch(/\{\{[A-Z_]+\}\}/)
    for (const marker of [
      '[OPERADOR_RAZAO_SOCIAL]',
      '[OPERADOR_CNPJ]',
      '[OPERADOR_ENDERECO]',
      '[OPERADOR_EMAIL]',
      '[DPO_NOME]',
      '[DPO_EMAIL]',
      '[MODALIDADE_ATIVA]',
    ]) {
      expect(hydrated, `marcador não preenchido: ${marker}`).not.toContain(marker)
    }

    // 4. Os valores do operador realmente aparecem no documento.
    const op = operatorIdentity()
    for (const v of [
      op.OPERADOR_RAZAO_SOCIAL,
      op.OPERADOR_CNPJ,
      op.OPERADOR_ENDERECO,
      op.OPERADOR_EMAIL,
      op.DPO_NOME,
      op.MODALIDADE_ATIVA,
    ]) {
      expect(v, 'env OPERATOR_* ausente/vazia').toBeTruthy()
      expect(hydrated, `valor ausente no termo: ${v}`).toContain(v!)
    }

    // 5. Render do HTML (idêntico ao enviado ao Gotenberg no route).
    const html = renderTermoHtml({
      hydratedMarkdown: hydrated,
      clienteNome: 'Cliente de Teste (smoke)',
      clienteCpf: '987.654.321-00',
      terapeutaNome: 'Terapeuta de Teste (smoke)',
      terapeutaCnpjCpf: '123.456.789-00',
      consentTimestampBR: '29/05/2026 11:30 BRT',
      consentIp: '203.0.113.42',
      consentUserAgent: 'smoke-test',
      contentSha256: sha256,
      termVersion: term!.version,
    })

    writeFileSync(resolve(OUT_DIR, 'termo-hidratado.md'), hydrated, 'utf8')
    writeFileSync(resolve(OUT_DIR, 'termo.html'), html, 'utf8')

    // 6. Eco dos campos do operador pro terminal (conferência rápida).
    console.log('\n[smoke] campos do operador no termo hidratado:')
    for (const line of hydrated.split('\n')) {
      if (/social|CNPJ|Endereço|Encarregado|DPO|modalidade|Modalidade|suporte@/i.test(line)) {
        console.log('   ' + line.trim())
      }
    }

    // 7. Gotenberg (opcional — só se as env estiverem presentes localmente).
    const gotenbergUrl = process.env.GOTENBERG_URL
    if (!gotenbergUrl) {
      console.log(
        '\n[smoke] GOTENBERG_URL ausente em .env.local — pulei o PDF.' +
          '\n        Abra tmp/consent-smoke/termo.html no navegador (= preview fiel do PDF).' +
          '\n        Para gerar o .pdf real: adicione GOTENBERG_URL + GOTENBERG_BASIC_AUTH ao .env.local e rode de novo.',
      )
    } else {
      const form = new FormData()
      form.append('files', new Blob([html], { type: 'text/html' }), 'index.html')
      const headers: Record<string, string> = {}
      const basicAuth = process.env.GOTENBERG_BASIC_AUTH
      if (basicAuth) {
        headers.Authorization = `Basic ${Buffer.from(basicAuth).toString('base64')}`
      }
      const res = await fetch(
        `${gotenbergUrl.replace(/\/$/, '')}/forms/chromium/convert/html`,
        { method: 'POST', body: form, headers },
      )
      expect(res.ok, `Gotenberg ${res.status}`).toBe(true)
      const pdf = Buffer.from(await res.arrayBuffer())
      writeFileSync(resolve(OUT_DIR, 'termo.pdf'), pdf)
      console.log(`\n[smoke] PDF gerado: tmp/consent-smoke/termo.pdf (${pdf.length} bytes)`)
    }

    console.log(`\n[smoke] artefatos em: ${OUT_DIR}\n`)
  })
})
