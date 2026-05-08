// Wave-0 stub — preenchido em 07-06-PLAN (diff classifier).
// Source: 07-VALIDATION.md line 56, 07-RESEARCH.md line 1081.
import { describe, it } from 'vitest'

describe('lib/anthropic/diff — classifyEdit (D-U2)', () => {
  it.todo('vazio → texto = "adicionado"')
  it.todo('texto → vazio = "removido"')
  it.todo('texto idêntico = "none"')
  it.todo('mudança de 28% = "corrigido" (boundary <30%)')
  it.todo('mudança de 30% = "reescrito" (boundary >=30%)')
  it.todo('mudança de 31% = "reescrito"')
  it.todo('char_delta = trimDel.length - trimGen.length')
})
