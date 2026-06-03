// audit-vocabulary:allowlist — este teste valida em runtime que `audit.ts`
// rejeita compostos pt-BR contendo termo proibido como substring (e.g.,
// "naturocultura", "curadoria") via word-boundary regex. Mencionar tais
// compostos por nome em it() descriptions é parte do contrato de teste —
// pessoa lendo o test source DEVE ver as palavras testadas. Os 3 termos
// restritos LGPD-06 também aparecem em comentários explicativos dos casos
// regex (caps "TRATAMENTO", literal "cura," com pontuação) — necessário
// para que humanos auditem o que o teste afirma. Marker file-level honrado
// por apps/web/scripts/audit-vocabulary.mjs (mesmo pattern que types.ts em
// 07-03 e prompts/system.md em 07-02).
//
// Phase 7 | Plan 07-05 — audit.ts tests (RED→GREEN cycle).
// Phase 7.4 Plan 11 — Direction Correction DC-1/DC-4: ReportSectionKey union
//   remapped from 13 legacy keys to 14 new keys. The legacy keys still exist
//   at runtime in already-generated 1.0 reports (jsonb is structure-agnostic),
//   and `runAudit` keeps a legacy-detect branch so anchor-rate scan still
//   works on those. Test fixtures for the LEGACY path use the `LegacyShape`
//   record type to type-check correctly without claiming legacy keys belong
//   to the new ReportSectionKey union.
//
// Forbidden vocab terms são montados via array-join (TERM_DIAG/TERM_TRAT/
// TERM_CURA) para que as fixtures runtime carreguem as strings via concat,
// não via literal — defesa em profundidade alinhada ao audit.ts source
// (Pitfall 7 + W6 parity).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { runAudit, FORBIDDEN_VOCAB_RE, extractForbiddenHits } from '../audit'
import type { ReportJsonb } from '../types'

// Legacy 1.0 report shape — runAudit detects this via the legacy-keys check
// and engages the original anchor-rate scan. The keys below are NOT in the
// Plan-11 ReportSectionKey union, so we type-cast fixtures explicitly.
type LegacyShape = Record<string, string>

// Build forbidden term fixtures via concat so the test source ALSO doesn't
// embed the 3 restricted literals (defensive — scanner currently skips
// __tests__ but future-proofing against config drift).
const TERM_DIAG = ['d', 'i', 'a', 'g', 'n', 'ó', 's', 't', 'i', 'c', 'o'].join('')
const TERM_TRAT = ['t', 'r', 'a', 't', 'a', 'm', 'e', 'n', 't', 'o'].join('')
const TERM_CURA = ['c', 'u', 'r', 'a'].join('')

describe('lib/anthropic/audit — anchor rate (D-A1, legacy 1.0 path)', () => {
  it('low_anchor_rate=false quando overall = 100%', () => {
    const report: LegacyShape = {
      '2_estrutural_fisica':
        'Sinal A [ancorado em: features.constitution.primary]. Sinal B [ancorado em: features.sectors[0]].',
      '3_indicacoes_sistemicas': 'Indicação X [ancorado em: features.global_signs.lymph].',
      '4_toxemia': 'Carga Y [ancorado em: features.rings.toxic].',
      '5_psicoemocional': 'Padrão Z [ancorado em: features.collarette.shape].',
      '6_cargas_temporais': 'Hipótese W [ancorado em: features.sectors[3]].',
    }
    const result = runAudit(report as ReportJsonb)
    expect(result.low_anchor_rate).toBe(false)
    expect(result.anchor_rate_pct).toBe(100)
  })

  it('low_anchor_rate=true quando overall < 95%', () => {
    const report: LegacyShape = {
      '2_estrutural_fisica': 'Sentence one. Sentence two. Sentence three.', // 0/3
      '3_indicacoes_sistemicas': 'Indicação X [ancorado em: features.X]. Outra sem ancora.', // 1/2
      '4_toxemia': 'Carga Y [ancorado em: features.Y].',
      '5_psicoemocional': 'Padrão Z [ancorado em: features.Z].',
      '6_cargas_temporais': 'Hipótese W [ancorado em: features.W].',
    }
    const result = runAudit(report as ReportJsonb)
    expect(result.low_anchor_rate).toBe(true)
    expect(result.anchor_rate_pct).toBeLessThan(95)
  })

  // C1 — relaxed ANCHOR_RE accepts Sonnet 4.6 output variations
  // (dogfooding 2026-05-09).
  it('C1: aceita capital "Ancorado" (case-insensitive)', () => {
    const report: LegacyShape = {
      '2_estrutural_fisica': 'Sinal A [Ancorado em: features.constitution].',
      '3_indicacoes_sistemicas': 'Indicação X [ANCORADO EM: features.X].',
      '4_toxemia': 'Carga Y [ancorado em: features.Y].',
      '5_psicoemocional': 'Padrão Z [ancorado em: features.Z].',
      '6_cargas_temporais': 'Hipótese W [ancorado em: features.W].',
    }
    const result = runAudit(report as ReportJsonb)
    expect(result.anchor_rate_pct).toBe(100)
  })

  it('C1: aceita conteúdo entre crases — `feature.path`', () => {
    const report: LegacyShape = {
      '2_estrutural_fisica':
        'Sinal A [Ancorado em: `feature.path`]. Sinal B [Ancorado em: `features.sectors[3].findings`].',
      '3_indicacoes_sistemicas': 'Indicação X [ancorado em: features.X].',
      '4_toxemia': 'Carga Y [ancorado em: features.Y].',
      '5_psicoemocional': 'Padrão Z [ancorado em: features.Z].',
      '6_cargas_temporais': 'Hipótese W [ancorado em: features.W].',
    }
    const result = runAudit(report as ReportJsonb)
    expect(result.anchor_rate_pct).toBe(100)
  })

  it('C1: NÃO casa colchetes não-relacionados (markdown links, outros)', () => {
    const report: LegacyShape = {
      '2_estrutural_fisica':
        'Sinal sem ancora aqui. Veja [este link](http://x). Outro [conteúdo aleatório].',
      '3_indicacoes_sistemicas': 'Sem ancora.',
      '4_toxemia': 'Sem ancora.',
      '5_psicoemocional': 'Sem ancora.',
      '6_cargas_temporais': 'Sem ancora.',
    }
    const result = runAudit(report as ReportJsonb)
    // 0 anchored sentences across all sections — overall_pct = 0
    expect(result.anchor_rate_pct).toBe(0)
  })

  // C1.b — compact form (no "ancorado em:" preamble). Surfaced 2026-05-09 night
  // when Sonnet drifted from verbose to compact across §2-7 in Wave A v2 regen.
  it('C1.b: aceita formato compacto sem preâmbulo — [`left_eye.collarette`]', () => {
    const report: LegacyShape = {
      '2_estrutural_fisica':
        'Colarete regular em ambos os olhos [`left_eye.collarette`, `right_eye.collarette`]. Pupila circular [`left_eye.pupil`, `right_eye.pupil`].',
      '3_indicacoes_sistemicas': 'Sistema X [`left_eye.fiber_density.score`].',
      '4_toxemia': 'Carga [`rings`].',
      '5_psicoemocional': 'Padrão [`left_eye.sectors[8].findings`].',
      '6_cargas_temporais': 'Hipótese [`right_eye.sectors[4].findings`].',
    }
    const result = runAudit(report as ReportJsonb)
    expect(result.anchor_rate_pct).toBe(100)
  })

  it('C1.b: aceita compacto com array index — [`left_eye.sectors[3].findings`]', () => {
    const report: LegacyShape = {
      '2_estrutural_fisica':
        'Lacuna no setor 4 [`left_eye.sectors[3].findings` — 2 lacunas grau 1].',
      '3_indicacoes_sistemicas': '[`left_eye.sectors[7].findings`].',
      '4_toxemia': '[`right_eye.rings.linfatico`].',
      '5_psicoemocional': '[`left_eye.sectors[8].findings`].',
      '6_cargas_temporais': '[`right_eye.sectors[5].findings`].',
    }
    const result = runAudit(report as ReportJsonb)
    expect(result.anchor_rate_pct).toBe(100)
  })

  it('C1.b: aceita identifier simples sem ponto — [`rings`]', () => {
    const report: LegacyShape = {
      '2_estrutural_fisica': 'Anéis ausentes [`rings` — todos negativos em ambos os olhos].',
      '3_indicacoes_sistemicas': 'X [`pupil`].',
      '4_toxemia': 'Y [`rings`].',
      '5_psicoemocional': 'Z [`constitution`].',
      '6_cargas_temporais': 'W [`sectors`].',
    }
    const result = runAudit(report as ReportJsonb)
    expect(result.anchor_rate_pct).toBe(100)
  })

  it('C1.b: regression — formato verbose continua casando', () => {
    const report: LegacyShape = {
      '2_estrutural_fisica': 'Sinal X [ancorado em: features.X].',
      '3_indicacoes_sistemicas': 'Y [Ancorado em: `features.Y`].',
      '4_toxemia': 'Z [ancorado em: features.Z.W].',
      '5_psicoemocional': 'W [ANCORADO EM: features.A].',
      '6_cargas_temporais': 'V [ancorado em: features.B[3].C].',
    }
    const result = runAudit(report as ReportJsonb)
    expect(result.anchor_rate_pct).toBe(100)
  })

  it('C1.b: regression — colchete sem backtick continua não casando', () => {
    const report: LegacyShape = {
      '2_estrutural_fisica':
        'Sem ancora. [Markdown link](http://x). [outro conteúdo aleatório]. [não-é-path].',
      '3_indicacoes_sistemicas': 'Sem ancora.',
      '4_toxemia': 'Sem ancora.',
      '5_psicoemocional': 'Sem ancora.',
      '6_cargas_temporais': 'Sem ancora.',
    }
    const result = runAudit(report as ReportJsonb)
    expect(result.anchor_rate_pct).toBe(0)
  })

  it('boundary 95% — exactly 95% rate is NOT low (strict <)', () => {
    // 95 ancoradas / 100 sentences in section 2 plus 4 perfect sections.
    // Total: 99/104 ≈ 95.2% — NOT < 95.
    const ancoradas = Array.from({ length: 95 }, () => 'Frase [ancorado em: features.X].').join(' ')
    const sem = Array.from({ length: 5 }, () => 'Frase sem ancora.').join(' ')
    const report: LegacyShape = {
      '2_estrutural_fisica': ancoradas + ' ' + sem,
      '3_indicacoes_sistemicas': 'Sentence [ancorado em: features.A].',
      '4_toxemia': 'Sentence [ancorado em: features.B].',
      '5_psicoemocional': 'Sentence [ancorado em: features.C].',
      '6_cargas_temporais': 'Sentence [ancorado em: features.D].',
    }
    const result = runAudit(report as ReportJsonb)
    expect(result.low_anchor_rate).toBe(false)
  })

  it('anchor_rate_pct=100 quando seção é vazia (degenerate — no sentences = no failures)', () => {
    const report: LegacyShape = {
      '2_estrutural_fisica': '',
      '3_indicacoes_sistemicas': 'Sentence [ancorado em: features.A].',
      '4_toxemia': 'Sentence [ancorado em: features.B].',
      '5_psicoemocional': 'Sentence [ancorado em: features.C].',
      '6_cargas_temporais': 'Sentence [ancorado em: features.D].',
    }
    const result = runAudit(report as ReportJsonb)
    expect(result.anchor_rate_per_section['2']).toBe(100)
  })

  it('sentence-split via /[.!?]+(?=\\s|$)/ corretamente segmenta pt-BR', () => {
    const report: LegacyShape = {
      '2_estrutural_fisica': 'Foo. Bar! Baz?',
      '3_indicacoes_sistemicas': 'Sentence [ancorado em: features.A].',
      '4_toxemia': 'Sentence [ancorado em: features.B].',
      '5_psicoemocional': 'Sentence [ancorado em: features.C].',
      '6_cargas_temporais': 'Sentence [ancorado em: features.D].',
    }
    const result = runAudit(report as ReportJsonb)
    // Section 2 has 3 sentences, 0 ancoradas → 0%
    expect(result.anchor_rate_per_section['2']).toBe(0)
  })

  it('regex anchor /\\[ancorado em: features\\.[\\w.\\[\\]]+\\]/ casa caminhos com [], ., _, números', () => {
    const report: LegacyShape = {
      '2_estrutural_fisica':
        'A [ancorado em: features.sectors[0]]. B [ancorado em: features.global_signs.lymph]. C [ancorado em: features.constitution_primary].',
      '3_indicacoes_sistemicas': 'X [ancorado em: features.A].',
      '4_toxemia': 'Y [ancorado em: features.B].',
      '5_psicoemocional': 'Z [ancorado em: features.C].',
      '6_cargas_temporais': 'W [ancorado em: features.D].',
    }
    const result = runAudit(report as ReportJsonb)
    expect(result.anchor_rate_pct).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// Plan 11 (Direction Correction DC-4) — new 14-section path
//
// The new prompt explicitly bans inline `[ancorado em features.x]` markers.
// runAudit detects the new shape via absence of legacy keys + presence of new
// keys and produces deterministic passing anchor-rate values. Forbidden-vocab
// scan continues full force.
// ---------------------------------------------------------------------------

describe('lib/anthropic/audit — anchor rate (Plan 11 new 14-section path)', () => {
  it('new shape: anchor_rate_pct=100 even without any inline markers', () => {
    const report: ReportJsonb = {
      '1_constituicao_temperamento':
        'Padrão funcional misto. Reatividade linfática moderada com sustentação metabólica.',
      '2_mapa_organico': 'Fígado sob carga. Tireoide pede investigação.',
      '5_eixo_psicossomatico': 'Fígado ↔ raiva contida. Rim ↔ medo da sobrevivência.',
      '14_mensagem_cliente': 'Que esse encontro abra uma porta para você.',
    }
    const result = runAudit(report)
    expect(result.low_anchor_rate).toBe(false)
    expect(result.anchor_rate_pct).toBe(100)
  })

  it('new shape: anchor_rate_per_section has the 5 new keys (2..6)', () => {
    const report: ReportJsonb = {
      '1_constituicao_temperamento': 'padrão.',
    }
    const result = runAudit(report)
    // Per-section keys are number-prefixed for shape compatibility with the UI.
    expect(Object.keys(result.anchor_rate_per_section).sort()).toEqual([
      '2',
      '3',
      '4',
      '5',
      '6',
    ])
  })

  it('new shape: forbidden-vocab scan still active', () => {
    const report: ReportJsonb = {
      '4_padroes_emocionais_ativos': `Há tendência a ${TERM_DIAG} de ansiedade. Outro ${TERM_DIAG} ali.`,
      '14_mensagem_cliente': `Sugere ${TERM_TRAT}.`,
    }
    const result = runAudit(report)
    expect(result.forbidden_vocab.length).toBeGreaterThan(0)
    const diagHit = result.forbidden_vocab.find(
      (h) => h.section === '4_padroes_emocionais_ativos' && h.term === TERM_DIAG,
    )
    expect(diagHit).toBeDefined()
    expect(diagHit!.occurrences).toBe(2)
  })

  it('new shape: clean report yields no forbidden hits', () => {
    const report: ReportJsonb = {
      '1_constituicao_temperamento': 'Padrão funcional misto e equilibrado.',
      '2_mapa_organico': 'Sistema digestivo em estado funcional regular.',
      '14_mensagem_cliente': 'Caminho aberto à frente.',
    }
    const result = runAudit(report)
    expect(result.forbidden_vocab).toEqual([])
    expect(result.low_anchor_rate).toBe(false)
  })
})

describe('lib/anthropic/audit — LGPD forbidden vocab (D-A2 + Pitfall 7 word-boundary parity)', () => {
  it('regex casa o termo "diagnóstico" (com ó, Unicode flag) — runtime fixture', () => {
    const sample = `o ${TERM_DIAG} clínico`
    expect(FORBIDDEN_VOCAB_RE.test(sample)).toBe(true)
    FORBIDDEN_VOCAB_RE.lastIndex = 0
  })

  it('regex casa "TRATAMENTO" case-insensitive — runtime fixture uppercase', () => {
    const sample = `${TERM_TRAT.toUpperCase()} indicado`
    expect(FORBIDDEN_VOCAB_RE.test(sample)).toBe(true)
    FORBIDDEN_VOCAB_RE.lastIndex = 0
  })

  it('regex casa "cura," com pontuação (word-boundary acaba em vírgula)', () => {
    const sample = `a ${TERM_CURA}, então`
    expect(FORBIDDEN_VOCAB_RE.test(sample)).toBe(true)
    FORBIDDEN_VOCAB_RE.lastIndex = 0
  })

  it('regex NÃO casa "naturocultura" (substring rejeitada por \\b — Pitfall 7)', () => {
    expect(FORBIDDEN_VOCAB_RE.test('naturocultura')).toBe(false)
    FORBIDDEN_VOCAB_RE.lastIndex = 0
  })

  it('regex NÃO casa "curadoria" (substring rejeitada por \\b — Pitfall 7)', () => {
    expect(FORBIDDEN_VOCAB_RE.test('uma curadoria de textos')).toBe(false)
    FORBIDDEN_VOCAB_RE.lastIndex = 0
  })

  it('runAudit lista hits por seção+termo+ocorrências', () => {
    const report: LegacyShape = {
      '5_psicoemocional': `Tem ${TERM_DIAG} aqui. Outro ${TERM_DIAG} ali.`,
      '6_cargas_temporais': `Sugere ${TERM_TRAT}.`,
      'encerramento_disclaimer': `Esta leitura iridológica é uma ferramenta de apoio à anamnese terapêutica. Não constitui ${TERM_DIAG} médico.`,
    }
    const result = runAudit(report as ReportJsonb)
    expect(result.forbidden_vocab.length).toBeGreaterThan(0)
    const psicoHit = result.forbidden_vocab.find(
      (h) => h.section === '5_psicoemocional' && h.term === TERM_DIAG,
    )
    expect(psicoHit).toBeDefined()
    expect(psicoHit!.occurrences).toBe(2)
  })

  it('runAudit IGNORA encerramento_disclaimer no scan de vocab proibido (server-appended literal contém "diagnóstico" por SPEC)', () => {
    const report: ReportJsonb = {
      'encerramento_disclaimer': `Esta leitura iridológica é uma ferramenta de apoio à anamnese terapêutica. Não constitui ${TERM_DIAG} médico nem substitui avaliação clínica profissional.`,
    }
    const result = runAudit(report)
    expect(result.forbidden_vocab).toEqual([])
  })

  // C2 — extractForbiddenHits skips LGPD-correct negative constructions
  // (dogfooding 2026-05-09).
  it('C2: "não é diagnóstico" NÃO conta como hit', () => {
    const text = `Esta leitura não é ${TERM_DIAG} médico, mas um convite à reflexão.`
    const hits = extractForbiddenHits(text, '14_mensagem_cliente')
    expect(hits).toEqual([])
  })

  it('C2: "não substitui tratamento" NÃO conta como hit', () => {
    const text = `Esta análise não substitui ${TERM_TRAT} profissional.`
    const hits = extractForbiddenHits(text, '14_mensagem_cliente')
    expect(hits).toEqual([])
  })

  it('C2: "não um diagnóstico" NÃO conta como hit (Nailli case)', () => {
    const text = `Não um ${TERM_DIAG}, mas um convite à reflexão.`
    const hits = extractForbiddenHits(text, '14_mensagem_cliente')
    expect(hits).toEqual([])
  })

  it('C2: "Não constitui diagnóstico" — case-insensitive', () => {
    const text = `Não constitui ${TERM_DIAG} médico.`
    const hits = extractForbiddenHits(text, '14_mensagem_cliente')
    expect(hits).toEqual([])
  })

  it('C2: "não significa cura" — feminine + alt verb', () => {
    const text = `Esta orientação não significa ${TERM_CURA} definitiva.`
    const hits = extractForbiddenHits(text, '14_mensagem_cliente')
    expect(hits).toEqual([])
  })

  it('C2 regression: uso afirmativo "diagnóstico precoce" CONTINUA disparando', () => {
    const text = `Esta zona indica ${TERM_DIAG} precoce de carga renal.`
    const hits = extractForbiddenHits(text, '4_padroes_emocionais_ativos')
    expect(hits.length).toBe(1)
    expect(hits[0]!.term).toBe(TERM_DIAG)
  })

  it('C2 regression: termo standalone sem "não" antes CONTINUA disparando', () => {
    const text = `Sugere ${TERM_TRAT} adicional.`
    const hits = extractForbiddenHits(text, '7_carencias_funcionais')
    expect(hits.length).toBe(1)
    expect(hits[0]!.term).toBe(TERM_TRAT)
  })

  it('C2 regression: "não" em outra cláusula NÃO mascara hit subsequente', () => {
    // Sentence-split would normally separate, but extractForbiddenHits is
    // sentence-blind. The 30-char lookback window ends well before "não vai".
    const text = `Esta leitura não vai discutir o assunto. Sugere ${TERM_DIAG} clínico em outra avaliação.`
    const hits = extractForbiddenHits(text, '4_padroes_emocionais_ativos')
    expect(hits.length).toBe(1)
  })

  it('runAudit forbidden_vocab é [] quando texto é limpo', () => {
    const report: LegacyShape = {
      '2_estrutural_fisica':
        'Sinal X [ancorado em: features.A]. Sinal Y [ancorado em: features.B].',
      '3_indicacoes_sistemicas': 'Indicação [ancorado em: features.C].',
      '4_toxemia': 'Carga [ancorado em: features.D].',
      '5_psicoemocional': 'Padrão [ancorado em: features.E].',
      '6_cargas_temporais': 'Hipótese [ancorado em: features.F].',
    }
    const result = runAudit(report as ReportJsonb)
    expect(result.forbidden_vocab).toEqual([])
  })
})

describe('lib/anthropic/audit — AuditMetadata shape (D-A3)', () => {
  it('audited_at é ISO 8601 timestamp', () => {
    const result = runAudit({
      '1_constituicao_temperamento': 'Padrão constitucional.',
    })
    expect(result.audited_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('auditor_version="v2" (2026-06-03: + section_completeness)', () => {
    const result = runAudit({})
    expect(result.auditor_version).toBe('v2')
  })

  it('section_completeness: relatório vazio → incompleto, lista o que faltou', () => {
    const result = runAudit({})
    expect(result.section_completeness.complete).toBe(false)
    // §0 + 15 numeradas + essência + encerramento = 18 chaves obrigatórias.
    expect(result.section_completeness.required_count).toBe(18)
    expect(result.section_completeness.present_count).toBe(0)
    expect(result.section_completeness.missing).toContain('1_constituicao_temperamento')
    expect(result.section_completeness.missing).toContain('essence_phrase')
  })

  it('anchor_rate_per_section tem 5 keys (2..6) no legacy path', () => {
    const report: LegacyShape = {
      '2_estrutural_fisica': 'Sentence [ancorado em: features.A].',
      '3_indicacoes_sistemicas': 'Sentence [ancorado em: features.B].',
      '4_toxemia': 'Sentence [ancorado em: features.C].',
      '5_psicoemocional': 'Sentence [ancorado em: features.D].',
      '6_cargas_temporais': 'Sentence [ancorado em: features.E].',
    }
    const result = runAudit(report as ReportJsonb)
    expect(Object.keys(result.anchor_rate_per_section).sort()).toEqual([
      '2',
      '3',
      '4',
      '5',
      '6',
    ])
  })
})

describe('lib/anthropic/audit — extractForbiddenHits (helper for save-action D-A2)', () => {
  it('retorna lista vazia para texto limpo', () => {
    expect(extractForbiddenHits('texto limpo aqui', '4_padroes_emocionais_ativos')).toEqual([])
  })

  it('retorna 1 hit por termo distinto + occurrences agregadas', () => {
    const sample = `um ${TERM_DIAG}, outro ${TERM_DIAG}, e ${TERM_CURA}`
    const hits = extractForbiddenHits(sample, '4_padroes_emocionais_ativos')
    const diag = hits.find((h) => h.term === TERM_DIAG)
    const cura = hits.find((h) => h.term === TERM_CURA)
    expect(diag?.occurrences).toBe(2)
    expect(cura?.occurrences).toBe(1)
  })
})

describe('lib/anthropic/audit — meta-invariante: source file is clean', () => {
  it('audit.ts source NÃO contém os 3 termos proibidos como substring literal (self-match guard)', () => {
    const auditSrc = readFileSync(path.resolve(__dirname, '..', 'audit.ts'), 'utf8')
    // Strip comments first — comments may legitimately mention forbidden terms
    // for documentation. Strict guard is: NO LITERAL outside of comments.
    // Conservative implementation: scan the whole source EXCLUDING lines
    // beginning with `//`, `/*`, ` *`, ` */` (block-comment continuations).
    const codeLines = auditSrc
      .split('\n')
      .filter((line) => {
        const t = line.trimStart()
        return !(
          t.startsWith('//') ||
          t.startsWith('/*') ||
          t.startsWith('*') ||
          t.startsWith('*/')
        )
      })
      .join('\n')
    expect(codeLines).not.toContain(TERM_DIAG)
    expect(codeLines).not.toContain(TERM_TRAT)
    expect(codeLines).not.toContain(TERM_CURA)
  })
})
