#!/usr/bin/env tsx
/**
 * apps/web/scripts/generate-schema-artifacts.ts
 *
 * Source-of-truth = apps/web/lib/anthropic/stage1-schema.ts (GLOSSARY[])
 * Generated artifact = bloco glossário entre marcadores
 *   <!-- GLOSSARY-START ... --> e <!-- GLOSSARY-END -->
 * em apps/web/prompts/stage1-scan.md
 *
 * Modos:
 *   --check  : compara output em memória com disk; exit 1 se diff
 *   (default): atualiza arquivo em disk
 *
 * Uso:
 *   pnpm generate:schema-artifacts          # atualiza
 *   pnpm generate:schema-artifacts:check    # valida (pre-commit ou CI)
 *
 * Por que existe: founder decidiu 2026-05-23 que NÃO quer sincronização
 * manual entre prompt e schema. Schema é único source-of-truth; prompt
 * é parcialmente gerado. Inconsistência detectada falha o build/commit
 * (depende de quem chama --check).
 *
 * Bibliografia: GLOSSARY[].bibliografia NÃO é renderizada no markdown
 * (Sonnet não precisa de citação durante a varredura; bibliografia é
 * meta-info pra auditoria humana). Fica preservada em schema.ts.
 *
 * v2.3.0 Caminho 1
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

// Source of truth: import direto do glossary puro (sem 'server-only' guard).
// stage1-schema.ts re-exporta GLOSSARY pra runtime; nós importamos do módulo
// puro pra não esbarrar no 'server-only' em script standalone Node.
import { GLOSSARY, type GlossaryEntry } from '../lib/anthropic/stage1-glossary'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const STAGE1_SCAN_PATH = join(__dirname, '..', 'prompts', 'stage1-scan.md')

const MARKER_START_PATTERN = /<!-- GLOSSARY-START[\s\S]*?-->/
const MARKER_END = '<!-- GLOSSARY-END -->'

const MODE: 'check' | 'write' = process.argv.includes('--check') ? 'check' : 'write'

main()

function main(): void {
  const current = readFileSync(STAGE1_SCAN_PATH, 'utf8')
  const generatedBody = generateGlossaryMarkdown(GLOSSARY)
  const updated = replaceBlock(current, generatedBody)

  if (MODE === 'check') {
    if (current === updated) {
      console.log('[generate-schema-artifacts] ✅ in sync')
      process.exit(0)
    }
    console.error('[generate-schema-artifacts] ❌ OUT OF SYNC')
    console.error('  Source : apps/web/lib/anthropic/stage1-schema.ts (GLOSSARY)')
    console.error('  Target : apps/web/prompts/stage1-scan.md (glossário bloco)')
    console.error('')
    console.error('  Fix: pnpm generate:schema-artifacts')
    process.exit(1)
  }

  if (current === updated) {
    console.log('[generate-schema-artifacts] ✅ already up to date (no write needed)')
    return
  }
  writeFileSync(STAGE1_SCAN_PATH, updated, 'utf8')
  console.log('[generate-schema-artifacts] ✅ stage1-scan.md glossário regenerado')
}

// ========================================================
// Block replacement (between START/END markers)
// ========================================================

function replaceBlock(source: string, generatedBody: string): string {
  const startMatch = source.match(MARKER_START_PATTERN)
  if (!startMatch || startMatch.index === undefined) {
    throw new Error(
      `START marker not found in ${STAGE1_SCAN_PATH}. ` +
        `Expected /<!-- GLOSSARY-START.*?-->/ (multiline allowed).`,
    )
  }
  const endIdx = source.indexOf(MARKER_END)
  if (endIdx === -1) {
    throw new Error(
      `END marker not found in ${STAGE1_SCAN_PATH}. ` +
        `Expected literal '${MARKER_END}'.`,
    )
  }
  const startMarkerEnd = startMatch.index + startMatch[0].length
  // Preserva o marker START + 2 newlines + corpo gerado + 2 newlines + marker END + resto
  return (
    source.slice(0, startMarkerEnd) +
    '\n\n' +
    generatedBody +
    '\n\n' +
    source.slice(endIdx)
  )
}

// ========================================================
// Markdown generation
// ========================================================

function generateGlossaryMarkdown(glossary: readonly GlossaryEntry[]): string {
  const sistemas = glossary.filter(e => e.group === 'sistema_orgao')
  const cerebrais = glossary.filter(e => e.group === 'sub_zona_cerebral')
  const eixos = glossary.filter(e => e.group === 'eixo_topografico')
  const estruturas = glossary.filter(e => e.group === 'estrutura_iridologica')
  const constitucionais = glossary.filter(e => e.group === 'constitucional')
  const perifericos = glossary.filter(e => e.group === 'periferico')

  return [
    `## Glossário canônico — ${glossary.length} termos`,
    '',
    'Vocabulário REFERENCIAL para uso em `campo`. Você pode usar termo',
    'composto fora do glossário se a íris realmente pede.',
    '',
    `### Sistemas e órgãos (${sistemas.length})`,
    '',
    '| campo | zona iridológica | sinal de CARGA | sinal de PRESERVAÇÃO |',
    '|---|---|---|---|',
    ...sistemas.map(rowSistema),
    '',
    `### Sub-zonas cerebrais (${cerebrais.length})`,
    '',
    '| campo | zona iridológica | função clínica | sinal de CARGA |',
    '|---|---|---|---|',
    ...cerebrais.map(rowCerebral),
    '',
    `### Eixos topográficos (${eixos.length})`,
    '',
    '| campo | zona iridológica | psicossomática |',
    '|---|---|---|',
    ...eixos.map(rowEixo),
    '',
    `### Estruturas iridológicas (${estruturas.length})`,
    '',
    '| campo | onde aparece | sinal de CARGA | sinal de PRESERVAÇÃO |',
    '|---|---|---|---|',
    ...estruturas.map(rowEstrutura),
    '',
    `### Constitucionais (${constitucionais.length}) — vão pra \`constituicao_base\`, NÃO pra achados`,
    '',
    '| campo | categorias | observação |',
    '|---|---|---|',
    ...constitucionais.map(rowConstitucional),
    '',
    `### Periféricos (${perifericos.length})`,
    '',
    '| campo | onde | sinal de CARGA |',
    '|---|---|---|',
    ...perifericos.map(rowPeriferico),
  ].join('\n')
}

function rowSistema(e: GlossaryEntry): string {
  if (e.group !== 'sistema_orgao') return ''
  return `| \`${e.campo}\` | ${e.zona} | ${e.sinal_carga} | ${e.sinal_preservacao} |`
}
function rowCerebral(e: GlossaryEntry): string {
  if (e.group !== 'sub_zona_cerebral') return ''
  return `| \`${e.campo}\` | ${e.zona} | ${e.funcao_clinica} | ${e.sinal_carga} |`
}
function rowEixo(e: GlossaryEntry): string {
  if (e.group !== 'eixo_topografico') return ''
  return `| \`${e.campo}\` | ${e.zona} | ${e.psicossomatica} |`
}
function rowEstrutura(e: GlossaryEntry): string {
  if (e.group !== 'estrutura_iridologica') return ''
  return `| \`${e.campo}\` | ${e.zona} | ${e.sinal_carga} | ${e.sinal_preservacao} |`
}
function rowConstitucional(e: GlossaryEntry): string {
  if (e.group !== 'constitucional') return ''
  return `| \`${e.campo}\` | ${e.categorias} | ${e.observacao} |`
}
function rowPeriferico(e: GlossaryEntry): string {
  if (e.group !== 'periferico') return ''
  return `| \`${e.campo}\` | ${e.zona} | ${e.sinal_carga} |`
}
