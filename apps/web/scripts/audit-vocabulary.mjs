#!/usr/bin/env node
/**
 * audit-vocabulary.mjs — CI gate scanning apps/web source files for forbidden vocabulary.
 *
 * Phase 7.4 extension (D-VOC1, D-VOC2):
 *   3 pattern sets sourced from lib/anthropic/forbidden-terms.json:
 *     - iridological_jargon (D-VOC1 set 1) — proibido no relatório padrão Iris Codex
 *     - sopro_vocab (D-VOC1 set 2) — proibido absoluto em Iris Codex copy
 *     - lgpd (D-VOC1 set 3, existing) — diagnóstico|tratamento|cura
 *
 * EXCLUDE_SUBPATHS preserved from existing Phase 6 pattern + forbidden-terms.json
 * (term source — scanning would self-match) + __tests__/fixtures.
 *
 * ALLOWLIST_MARKER preserved — files with the marker are SKIPPED entirely
 * (ex: system.md instructs LLM to AVOID forbidden vocab; audit.ts implements
 * the runtime detector and quotes terms in docs comments).
 *
 * Word-boundary parity (Pitfall 7 / W6 — Phase 7): regex `\b...\b` with Unicode flag
 * `u` for accented word-boundary correctness. Innocuous compound words containing
 * a forbidden term as substring MUST NOT trip (e.g., `curadoria`, `naturocultura`).
 *
 * Exit 0 = OK (zero matches across all pattern sets). Exit 1 = FAIL.
 *
 * Phase 7.4 | Plan 07.4-02 | Decisões: D-VOC1, D-VOC2
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ---------------------------------------------------------------------------
// Term source — single source-of-truth shared with lib/anthropic/audit-v2.ts
// ---------------------------------------------------------------------------
const termsPath = join(ROOT, 'lib/anthropic/forbidden-terms.json')
const terms = JSON.parse(readFileSync(termsPath, 'utf8'))

/** Escape regex metacharacters in a literal term. */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Build a case-insensitive Unicode word-boundary regex over a term list.
 * Alternation: `\b(term1|term2|...)\b` with flags `iu`.
 */
function buildSet(termList) {
  const escaped = termList.map(escapeRegex).join('|')
  return new RegExp(`\\b(${escaped})\\b`, 'iu')
}

const PATTERNS = {
  iridological_jargon: buildSet(terms.iridological_jargon),
  sopro_vocab: buildSet(terms.sopro_vocab),
  lgpd: buildSet(terms.lgpd),
}

// ---------------------------------------------------------------------------
// Scan config
// ---------------------------------------------------------------------------
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.md'])

// Diretórios a varrer. `prompts` adicionado em 7.4 — system.md sai do escopo via
// ALLOWLIST_MARKER no topo do arquivo (instrui LLM a EVITAR forbidden vocab).
const DIRS = ['app', 'components', 'lib/rag', 'lib/anthropic', 'prompts']

// Subpaths excluded from scanning.
//   - /app/admin/, /components/calibration/, /app/actions/calibration.test.:
//     founder-only/internal tools, fora do escopo LGPD-06 user-facing (preserved
//     from Phase 6).
//   - /lib/anthropic/forbidden-terms.json: term source — would self-match.
//   - /__tests__/fixtures/ (anywhere): synthetic test data may include forbidden
//     vocab deliberately (positive-case fixtures).
//
// NOTE: the ephemeral fixture dir used by scripts/__tests__/audit-vocabulary.test.ts
// (`lib/anthropic/__audit-fixtures-tmp/`) is INTENTIONALLY NOT excluded — the test
// plants forbidden strings there and asserts detection.
const EXCLUDE_SUBPATHS = [
  '/app/admin/',
  '/components/calibration/',
  '/app/actions/calibration.test.',
  '/lib/anthropic/forbidden-terms.json',
  '/__tests__/fixtures/',
]

/**
 * File-level allowlist marker — same pattern as Phase 6/7 D-A4. Files containing
 * this marker are SKIPPED entirely (system.md cites forbidden vocab to instruct
 * LLM to avoid it; audit.ts implements the runtime detector and quotes terms in
 * documentation comments; types.ts holds ENCERRAMENTO_LITERAL byte-exact from
 * SPEC §6).
 */
const ALLOWLIST_MARKER = 'audit-vocabulary:allowlist'

/**
 * Recursively collect scannable files from a directory.
 * @param {string} dir
 * @returns {string[]}
 */
function collectFiles(dir) {
  const files = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return files // diretório não existe — OK
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue
    const fullPath = join(dir, entry)
    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      files.push(...collectFiles(fullPath))
    } else if (stat.isFile() && EXTENSIONS.has(extname(entry))) {
      files.push(fullPath)
    }
  }
  return files
}

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------
/** @type {Array<{category: string, file: string, line: number, text: string}>} */
const matches = []

for (const dir of DIRS) {
  const absDir = join(ROOT, dir)
  for (const file of collectFiles(absDir)) {
    const normalized = file.replace(/\\/g, '/')
    if (EXCLUDE_SUBPATHS.some((prefix) => normalized.includes(prefix))) continue

    const content = readFileSync(file, 'utf8')
    if (content.includes(ALLOWLIST_MARKER)) continue

    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      for (const [category, regex] of Object.entries(PATTERNS)) {
        // Per-iteration fresh regex (no `g` flag here, but defensive — `test()`
        // on a `g`-flagged source would leak `lastIndex` across calls).
        const r = new RegExp(regex.source, regex.flags)
        if (r.test(lines[i])) {
          matches.push({
            category,
            file: normalized,
            line: i + 1,
            text: lines[i].trim().slice(0, 200),
          })
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
if (matches.length > 0) {
  console.error(`VOCAB FAIL — ${matches.length} forbidden term hit(s) found.\n`)
  /** @type {Record<string, typeof matches>} */
  const grouped = matches.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = []
    acc[m.category].push(m)
    return acc
  }, {})
  for (const [category, hits] of Object.entries(grouped)) {
    console.error(`[${category}] (${hits.length} hits):`)
    for (const h of hits) console.error(`  ${h.file}:${h.line}: ${h.text}`)
    console.error('')
  }
  process.exit(1)
}

console.log(
  `OK: vocabulário proibido ausente (${DIRS.length} dirs, ${Object.keys(PATTERNS).length} pattern sets)`,
)
process.exit(0)
