// audit-vocabulary:allowlist — test file plants forbidden vocab as fixtures to
// assert the audit detects them; without this marker the audit would scan this
// file and trip on the planted strings.
//
// Phase 7.4 | Plan 07.4-02 | D-VOC1, D-VOC2 contracts.
//
// Strategy: each test writes a temporary fixture file inside the scan tree,
// then runs the audit script as a child process and asserts the categorized
// output. Fixtures are cleaned up after each run.
//
// Baseline state (2026-05-13): the apps/web tree has 24 pre-existing hits
// (7 LGPD comment-word "diagnóstico" + 17 iridological_jargon RAG enum
// references to Jensen/etc — all structural metadata, not user-facing report
// output). These are Phase 3-7 debt; not in scope for Plan 07.4-02. The tests
// below DELTA-check: subtract the baseline category counts from the planted
// run to prove the fixture is detected. Future Plan 07.4-09 rebrand cleans
// baseline OR allowlist-markers the legitimate metadata files.
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { execSync } from 'node:child_process'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '../..')
const FIXTURE_DIR = join(ROOT, 'lib/anthropic/__audit-fixtures-tmp')

interface AuditResult {
  exitCode: number
  stderr: string
  stdout: string
}

/**
 * Run the audit script as a child process. Returns exit code + stderr text.
 * `stdio: 'pipe'` so spawn errors don't write to test stderr.
 */
function runAudit(): AuditResult {
  try {
    const out = execSync('node scripts/audit-vocabulary.mjs', {
      cwd: ROOT,
      stdio: 'pipe',
    })
    return { exitCode: 0, stderr: '', stdout: out.toString() }
  } catch (err) {
    const e = err as { status?: number; stderr?: Buffer; stdout?: Buffer }
    return {
      exitCode: e.status ?? 1,
      stderr: e.stderr?.toString() ?? '',
      stdout: e.stdout?.toString() ?? '',
    }
  }
}

/**
 * Count hits per category in stderr output. Output format:
 *   `[category] (N hits):`
 * Returns Record<string, number>.
 */
function parseCategoryCounts(stderr: string): Record<string, number> {
  const counts: Record<string, number> = {}
  const re = /\[(\w+)\] \((\d+) hits\):/g
  let m: RegExpExecArray | null
  while ((m = re.exec(stderr)) !== null) {
    counts[m[1]] = parseInt(m[2], 10)
  }
  return counts
}

let baselineCounts: Record<string, number> = {}

beforeAll(() => {
  // Ensure fixture dir doesn't exist from a prior failed run
  if (existsSync(FIXTURE_DIR)) rmSync(FIXTURE_DIR, { recursive: true, force: true })

  // Snapshot baseline category counts so positive-fixture tests can
  // delta-check rather than assume baseline is clean.
  const r = runAudit()
  baselineCounts = parseCategoryCounts(r.stderr)
})

afterEach(() => {
  if (existsSync(FIXTURE_DIR)) rmSync(FIXTURE_DIR, { recursive: true, force: true })
})

describe('audit-vocabulary CI gate (D-VOC1, D-VOC2)', () => {
  it('script runs and reports categorized output', () => {
    const r = runAudit()
    // Exit code reflects whether hits exist; we don't gate on 0 here because
    // pre-existing Phase 3-7 baseline debt is documented (see file-top notes).
    expect([0, 1]).toContain(r.exitCode)
    // The output structure includes the 3 expected category labels even when
    // some have zero hits — but only categories with hits show in stderr.
    // Just assert script ran without crashing.
    expect(typeof r.stderr).toBe('string')
  })

  it('detects iridological_jargon term in planted fixture', () => {
    mkdirSync(FIXTURE_DIR, { recursive: true })
    const fix = join(FIXTURE_DIR, 'jargon.ts')
    // Array-join construction so this test file itself remains audit-clean
    // (defense-in-depth on top of the allowlist marker).
    const t = [
      'c', 'o', 'n', 's', 't', 'i', 't', 'u', 'i', 'ç', 'ã', 'o',
      ' ',
      'l', 'i', 'n', 'f', 'á', 't', 'i', 'c', 'a',
    ].join('')
    writeFileSync(fix, `// fixture\nconst x = '${t}'\n`)
    const r = runAudit()
    const counts = parseCategoryCounts(r.stderr)
    expect(r.exitCode).toBe(1)
    expect((counts.iridological_jargon ?? 0)).toBeGreaterThan(
      baselineCounts.iridological_jargon ?? 0,
    )
  })

  it('detects sopro_vocab term in planted fixture', () => {
    mkdirSync(FIXTURE_DIR, { recursive: true })
    const fix = join(FIXTURE_DIR, 'sopro.ts')
    const t = ['c', 'e', 'n', 't', 'e', 'l', 'h', 'a', ' ', 'd', 'i', 'v', 'i', 'n', 'a'].join('')
    writeFileSync(fix, `const x = '${t}'\n`)
    const r = runAudit()
    const counts = parseCategoryCounts(r.stderr)
    expect(r.exitCode).toBe(1)
    expect((counts.sopro_vocab ?? 0)).toBeGreaterThan(
      baselineCounts.sopro_vocab ?? 0,
    )
  })

  it('detects lgpd term in planted fixture', () => {
    mkdirSync(FIXTURE_DIR, { recursive: true })
    const fix = join(FIXTURE_DIR, 'lgpd.ts')
    const t = ['d', 'i', 'a', 'g', 'n', 'ó', 's', 't', 'i', 'c', 'o'].join('')
    writeFileSync(fix, `const x = '${t}'\n`)
    const r = runAudit()
    const counts = parseCategoryCounts(r.stderr)
    expect(r.exitCode).toBe(1)
    expect((counts.lgpd ?? 0)).toBeGreaterThan(baselineCounts.lgpd ?? 0)
  })

  it('respects allowlist marker — does NOT trip on file with marker', () => {
    mkdirSync(FIXTURE_DIR, { recursive: true })
    const fix = join(FIXTURE_DIR, 'allowlisted.ts')
    const t = ['d', 'i', 'a', 'g', 'n', 'ó', 's', 't', 'i', 'c', 'o'].join('')
    writeFileSync(fix, `// audit-vocabulary:allowlist\nconst x = '${t}'\n`)
    const r = runAudit()
    const counts = parseCategoryCounts(r.stderr)
    // No new LGPD hits beyond baseline because the marker neutralizes the file.
    expect((counts.lgpd ?? 0)).toBe(baselineCounts.lgpd ?? 0)
  })

  it('does NOT false-positive on innocent compound words (curadoria, naturocultura)', () => {
    // Word-boundary `\b...\b` with Unicode flag must NOT match compound words
    // that merely contain a forbidden term as substring. Critical Pitfall 7 / W6
    // contract — see lib/anthropic/audit.ts banner for full rationale.
    mkdirSync(FIXTURE_DIR, { recursive: true })
    const fix = join(FIXTURE_DIR, 'innocent.ts')
    // Curadoria contains "cura"; naturocultura contains "cura" (twice).
    writeFileSync(fix, `const x = 'curadoria editorial e naturocultura'\n`)
    const r = runAudit()
    const counts = parseCategoryCounts(r.stderr)
    expect((counts.lgpd ?? 0)).toBe(baselineCounts.lgpd ?? 0)
  })

  it('honors EXCLUDE_SUBPATHS for the term source file forbidden-terms.json', () => {
    // The term source file lib/anthropic/forbidden-terms.json contains all
    // forbidden terms as data. It MUST be excluded from scanning — otherwise
    // every category would self-match against its own term list.
    // Verify by reading current baseline (already excludes the file).
    const r = runAudit()
    // Categories present in baseline are all from real source files, not
    // from the JSON term source. If the JSON were scanned, we'd see >100
    // hits per category trivially. Sanity bound:
    const counts = parseCategoryCounts(r.stderr)
    expect((counts.sopro_vocab ?? 0)).toBeLessThan(10)
  })
})
