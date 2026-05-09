#!/usr/bin/env node
// scripts/audit-vocabulary.mjs
// Gate LGPD: verifica ausência de vocabulário proibido em apps/web/app e apps/web/components
// Cross-platform: não depende de grep do sistema operacional.
// Exit 0 = OK (nenhum match). Exit 1 = FAIL (vocabulário proibido encontrado).

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')

// Padrão de vocabulário proibido (LGPD-06 — jamais usar em superfícies do produto)
const PATTERN = /diagnóstico|tratamento|cura/i

// Extensões a verificar
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

// Diretórios a varrer
const DIRS = ['app', 'components', 'lib/rag', 'lib/anthropic']

// Subpaths excluídos da varredura (founder-only / internal tools — fora do
// escopo LGPD-06 que se aplica apenas a superfícies user-facing).
// Cada path é interpretado como prefixo (segmento de caminho) — match via
// includes() depois de normalizar separadores.
const EXCLUDE_SUBPATHS = [
  // Admin tooling (founder-only via middleware /admin/* gate).
  // "diagnóstico" usado aqui significa "diagnóstico operacional do pipeline
  // de calibração", não diagnóstico médico. Calibration tooling lives here
  // and legitimately uses the term as technical vocabulary.
  '/app/admin/',
  '/components/calibration/',
  // Test fixtures for actions in /admin/* may also reference the term as
  // diagnosis form payload — same justification.
  '/app/actions/calibration.test.',
]

/**
 * Marker que reconhece um arquivo inteiro como allowlisted.
 * Mesmo padrão do prompts/system.md (07-02 D-A4 forward-compat); adotado em
 * lib/anthropic/types.ts a partir de 07-03 para acomodar ENCERRAMENTO_LITERAL
 * (cópia byte-exact de SPEC §6 — copy obrigatória da LGPD que NEGA status
 * diagnóstico). O marker é file-level: presente uma vez no topo, all hits no
 * arquivo são ignorados. Justificativa deve aparecer no comment ao lado.
 */
const ALLOWLIST_MARKER = 'audit-vocabulary:allowlist'

/**
 * Recursively collect all files from a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function collectFiles(dir) {
  const files = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return files // diretório não existe ainda — OK
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...collectFiles(fullPath))
    } else if (EXTENSIONS.has(extname(entry))) {
      files.push(fullPath)
    }
  }
  return files
}

const matches = []

for (const dir of DIRS) {
  const absDir = join(ROOT, dir)
  const files = collectFiles(absDir)
  for (const file of files) {
    // Path-level exclusion (admin tools, calibration UI — out of LGPD scope).
    const normalized = file.replace(/\\/g, '/')
    if (EXCLUDE_SUBPATHS.some(prefix => normalized.includes(prefix))) continue

    const content = readFileSync(file, 'utf8')
    // File-level allowlist: pula o arquivo inteiro se contém o marker
    // (ex: lib/anthropic/types.ts onde mora ENCERRAMENTO_LITERAL = SPEC §6 literal).
    if (content.includes(ALLOWLIST_MARKER)) continue
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (PATTERN.test(lines[i])) {
        matches.push(`${file}:${i + 1}: ${lines[i].trim()}`)
      }
    }
  }
}

if (matches.length > 0) {
  console.error('VOCAB FAIL — vocabulário proibido encontrado:')
  for (const m of matches) console.error(m)
  process.exit(1)
} else {
  console.log('OK: vocabulário proibido ausente')
  process.exit(0)
}
