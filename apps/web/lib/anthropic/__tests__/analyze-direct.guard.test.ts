// Teste-guarda da BARREIRA §5 (anti-viés de confirmação).
//
// Garante POR CONSTRUÇÃO que nenhum dado clínico/anamnese entra no prompt
// do Sonnet: o <client_context> só carrega nome + idade + mapa, e o tipo
// `AnalyzeDirectArgs` não tem campo de texto livre clínico.
//
// Se QUALQUER teste aqui falhar, a barreira foi reaberta. NÃO afrouxe o
// teste — reverta a mudança que reintroduziu o canal clínico.
//
// Padrão de import: mock do SDK + ANTHROPIC_API_KEY + import dinâmico
// (lib/anthropic/client lança no import sem a env — ver client.test.ts).
import { describe, it, expect, beforeEach, vi } from 'vitest'

import type { AnalyzeDirectArgs } from '../analyze-direct'

vi.mock('@anthropic-ai/sdk', () => {
  class Anthropic {
    apiKey: string
    constructor(opts: { apiKey: string }) {
      this.apiKey = opts.apiKey
    }
  }
  return { default: Anthropic }
})

const baseArgs: AnalyzeDirectArgs = {
  readingId: 'reading-1',
  therapistId: 'therapist-1',
  images: [
    { eye: 'right', angle: 'frontal', mediaType: 'image/jpeg', base64: 'AAAA' },
  ],
  clientName: 'Fulana de Tal',
  clientAge: 42,
}

async function buildText(): Promise<string> {
  const mod = await import('../analyze-direct')
  return mod
    .buildUserContent(baseArgs)
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('\n')
}

describe('analyze-direct — barreira §5 (sem dado clínico no prompt)', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ANTHROPIC_API_KEY = 'sk-test'
  })

  it('<client_context> carrega só nome + idade + mapa', async () => {
    const text = await buildText()
    expect(text).toContain('Nome:')
    expect(text).toContain('Idade:')
    expect(text).toContain('Mapa preferido: jensen')
  })

  it('nenhum rótulo clínico aparece no conteúdo do usuário', async () => {
    const text = await buildText()
    expect(text).not.toMatch(
      /Observa[çc][õo]es do terapeuta|therapistNotes|queixa|cl[íi]nic|anamnese|condi[çc][õaã]|medicament/i,
    )
  })

  it('AnalyzeDirectArgs não possui campo therapistNotes (barreira por tipo)', () => {
    // Se `therapistNotes` voltar ao tipo, `HasTherapistNotes` vira `true` e
    // a atribuição `= false` deixa de compilar → tsc quebra o build.
    type HasTherapistNotes =
      'therapistNotes' extends keyof AnalyzeDirectArgs ? true : false
    const noClinicalField: HasTherapistNotes = false
    expect(noClinicalField).toBe(false)
  })
})
