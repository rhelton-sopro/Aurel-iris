import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * LGPD-02 / LGPD-03 / LGPD-05 — guarda de regressão sobre as páginas legais
 * públicas e a copy obrigatória. Lê os arquivos-fonte (não renderiza RSC) e
 * grep-a as âncoras canônicas: pricing D-02, arrependimento D-14, mailto de
 * exclusão e a copy não-médica do DisclaimerCopy.
 *
 * Plano 08-09 | Decisões: D-02, D-13/D-14, LGPD-02/03/05
 */
const read = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8')

describe('LGPD-05 / LGPD-02 copy nas páginas legais', () => {
  it('/privacidade contém âncora #deletar-dados + mailto: de exclusão', () => {
    const content = read('../privacidade/page.tsx')
    expect(content).toContain('deletar-dados')
    expect(content).toContain('mailto:')
  })

  it('/privacidade usa OPERATOR_EMAIL via env (não hardcode rígido)', () => {
    const content = read('../privacidade/page.tsx')
    expect(content).toContain('NEXT_PUBLIC_OPERATOR_EMAIL')
  })

  it('/termos contém pricing D-02 (99,70 / 298,50 / 745,50 / 1.191)', () => {
    const content = read('../termos/page.tsx')
    expect(content).toMatch(/99[,.]70/)
    expect(content).toMatch(/298[,.]50/)
    expect(content).toMatch(/745[,.]50/)
    expect(content).toMatch(/1[,.]?191/)
  })

  it('/termos contém arrependimento 7d em destaque (D-14)', () => {
    const content = read('../termos/page.tsx')
    expect(content).toMatch(/7\s+dias/)
    expect(content.toLowerCase()).toContain('arrependimento')
  })

  it('DisclaimerCopy exporta copy LGPD-05 não-médica', () => {
    const content = read('../../components/legal/DisclaimerCopy.tsx')
    expect(content).toContain('apoio à anamnese terapêutica integrativa')
    expect(content).toContain('NÃO substitui avaliação médica')
    expect(content).toContain('DISCLAIMER_TEXT')
    expect(content).toContain('DISCLAIMER_COMPACT')
  })
})
