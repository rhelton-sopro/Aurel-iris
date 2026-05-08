// Wave-0 stub — preenchido em 07-04-PLAN (section-boundary parser).
// Source: 07-VALIDATION.md line 54, 07-RESEARCH.md line 1079.
import { describe, it } from 'vitest'

describe('lib/anthropic/parser', () => {
  it.todo('detecta `### N. ` boundaries em buffer acumulado, não em delta event')
  it.todo('rejeita boundary com number fora de 1..13 (Pitfall 2)')
  it.todo('rejeita boundary com number não-monotônico crescente (Pitfall 2)')
  it.todo('ignora "### 7.5 Detalhe" inline em corpo (Pitfall 2)')
  it.todo('retorna lista vazia para buffer sem boundaries')
})
