import { describe, it, expect } from 'vitest'

import {
  computeAge,
  evaluateProfileCompleteness,
  type ProfileClientInput,
} from './profile-completeness'

const COMPLETE: ProfileClientInput = {
  full_name: 'Cliente Completo',
  birth_date: '1990-01-01',
  biological_sex: 'feminino',
  email: 'c@exemplo.com',
  phone: '+5511999999999',
}

// 2026-05-17 local (mesma data-base dos 3 clientes reais do banco).
const NOW = new Date(2026, 4, 17)

describe('computeAge — fronteiras calendar-based', () => {
  it('18 exatos hoje → 18 (passa)', () => {
    expect(computeAge('2008-05-17', NOW)).toBe(18)
  })
  it('aniversário de 18 é amanhã / 17a364d → 17 (bloqueia)', () => {
    expect(computeAge('2008-05-18', NOW)).toBe(17)
  })
  it('bissexto: nascido 29/02/2008, hoje 28/02/2026 → 17', () => {
    expect(computeAge('2008-02-29', new Date(2026, 1, 28))).toBe(17)
  })
  it('bissexto: nascido 29/02/2008, hoje 01/03/2026 → 18', () => {
    expect(computeAge('2008-02-29', new Date(2026, 2, 1))).toBe(18)
  })
  it('bissexto: nascido 29/02/2008, hoje 29/02/2024 → 16', () => {
    expect(computeAge('2008-02-29', new Date(2024, 1, 29))).toBe(16)
  })
  it('birth_date ausente/inválido → null', () => {
    expect(computeAge(null, NOW)).toBeNull()
    expect(computeAge('', NOW)).toBeNull()
    expect(computeAge('xx', NOW)).toBeNull()
  })
  it('idades dos 3 clientes reais (now 2026-05-17)', () => {
    expect(computeAge('1988-08-26', NOW)).toBe(37) // Naillí
    expect(computeAge('2019-03-05', NOW)).toBe(7) // mamae
    expect(computeAge('1981-10-16', NOW)).toBe(44) // Moacir
  })
})

describe('evaluateProfileCompleteness', () => {
  it('cliente completo e adulto → ok', () => {
    expect(evaluateProfileCompleteness(COMPLETE, NOW)).toEqual({ status: 'ok' })
  })

  it('cada campo faltante isolado → incomplete com missing correto', () => {
    for (const field of ['full_name', 'biological_sex', 'email', 'phone'] as const) {
      const input: ProfileClientInput = { ...COMPLETE, [field]: null }
      expect(evaluateProfileCompleteness(input, NOW)).toEqual({
        status: 'incomplete',
        missing: [field],
      })
    }
  })

  it('birth_date faltante isolado → incomplete (idade indeterminada, não blocked)', () => {
    expect(
      evaluateProfileCompleteness({ ...COMPLETE, birth_date: null }, NOW),
    ).toEqual({ status: 'incomplete', missing: ['birth_date'] })
  })

  it('múltiplos faltantes → incomplete na ordem canônica', () => {
    expect(
      evaluateProfileCompleteness(
        {
          full_name: null,
          birth_date: '1990-01-01',
          biological_sex: null,
          email: null,
          phone: null,
        },
        NOW,
      ),
    ).toEqual({
      status: 'incomplete',
      missing: ['full_name', 'biological_sex', 'email', 'phone'],
    })
  })

  it('birth_date null + outros faltantes → incomplete (NÃO blocked)', () => {
    expect(
      evaluateProfileCompleteness(
        {
          full_name: 'X',
          birth_date: null,
          biological_sex: null,
          email: null,
          phone: null,
        },
        NOW,
      ).status,
    ).toBe('incomplete')
  })

  // Precedência: blocked_underage VENCE incomplete quando birth_date está
  // presente e idade < MIN_AGE — mesmo se outros campos também faltarem.
  it('birth_date 2019-03-05 (menor) + outros nulos → blocked_underage (vence incomplete)', () => {
    expect(
      evaluateProfileCompleteness(
        {
          full_name: null,
          birth_date: '2019-03-05',
          biological_sex: null,
          email: null,
          phone: null,
        },
        NOW,
      ),
    ).toEqual({
      status: 'blocked_underage',
      age: 7,
      birthDate: '2019-03-05',
    })
  })

  it('fronteira: 18 exatos hoje + perfil completo → ok', () => {
    expect(
      evaluateProfileCompleteness({ ...COMPLETE, birth_date: '2008-05-17' }, NOW),
    ).toEqual({ status: 'ok' })
  })

  it('fronteira: 17 anos 364 dias + perfil completo → blocked_underage', () => {
    expect(
      evaluateProfileCompleteness({ ...COMPLETE, birth_date: '2008-05-18' }, NOW),
    ).toEqual({
      status: 'blocked_underage',
      age: 17,
      birthDate: '2008-05-18',
    })
  })

  it('3 clientes reais do banco (now 2026-05-17)', () => {
    expect(
      evaluateProfileCompleteness(
        {
          full_name: 'Naillí',
          birth_date: '1988-08-26',
          biological_sex: null,
          email: null,
          phone: null,
        },
        NOW,
      ),
    ).toEqual({
      status: 'incomplete',
      missing: ['biological_sex', 'email', 'phone'],
    })

    // mamae (7yo) → blocked_underage vence incomplete.
    expect(
      evaluateProfileCompleteness(
        {
          full_name: 'mamae',
          birth_date: '2019-03-05',
          biological_sex: null,
          email: null,
          phone: null,
        },
        NOW,
      ),
    ).toEqual({
      status: 'blocked_underage',
      age: 7,
      birthDate: '2019-03-05',
    })

    expect(
      evaluateProfileCompleteness(
        {
          full_name: 'Moacir',
          birth_date: '1981-10-16',
          biological_sex: null,
          email: null,
          phone: null,
        },
        NOW,
      ),
    ).toEqual({
      status: 'incomplete',
      missing: ['biological_sex', 'email', 'phone'],
    })
  })
})
