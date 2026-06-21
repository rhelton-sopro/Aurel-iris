import { describe, expect, it } from 'vitest'

// Fase 12 Plan 01 — Task 2 (lockstep bump do SocialPostStatus).
// Guarda a regra de memória "bump EVERY occurrence": o union, as abas, o guard
// e o objeto de counts precisam todos refletir 'publicando' + 'erro'. Atualização
// parcial é a causa #1 de bug — este teste falha se qualquer ocorrência ficar pra trás.
import {
  STATUS_TABS,
  isSocialPostStatus,
  type SocialPostStatus,
} from '../social-posts'

describe('isSocialPostStatus (lockstep com migration 0049)', () => {
  it('aceita o lock state publicando', () => {
    expect(isSocialPostStatus('publicando')).toBe(true)
  })

  it('aceita o estado terminal erro', () => {
    expect(isSocialPostStatus('erro')).toBe(true)
  })

  it('continua aceitando os 5 estados originais', () => {
    for (const s of [
      'pendente',
      'aprovado',
      'agendado',
      'publicado',
      'reprovado',
    ] as const) {
      expect(isSocialPostStatus(s)).toBe(true)
    }
  })

  it('rejeita strings desconhecidas', () => {
    expect(isSocialPostStatus('xpto')).toBe(false)
    expect(isSocialPostStatus(undefined)).toBe(false)
  })
})

describe('STATUS_TABS (abas do painel)', () => {
  it('inclui publicando e erro', () => {
    const statuses = STATUS_TABS.map((t) => t.status)
    expect(statuses).toContain('publicando')
    expect(statuses).toContain('erro')
  })

  it('todo status de aba é um SocialPostStatus válido', () => {
    for (const tab of STATUS_TABS) {
      const s: SocialPostStatus = tab.status
      expect(isSocialPostStatus(s)).toBe(true)
    }
  })
})
