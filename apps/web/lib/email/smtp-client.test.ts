// A marca {nome} do envio em massa. Ela existe em DOIS lugares — aqui, que é
// quem de fato troca no e-mail, e no ComposeForm, que avisa o founder antes de
// disparar. Se as duas expressões saírem de sincronia, a tela libera um envio
// que sai com "Olá, ." para dezenas de pessoas.
import { describe, expect, it } from 'vitest'

import { firstName, personalize } from './smtp-client'

describe('firstName', () => {
  it('pega só o primeiro nome', () => {
    expect(firstName('Celiane Ferreira de melo')).toBe('Celiane')
    expect(firstName('  Moacir Domingues  ')).toBe('Moacir')
    expect(firstName('isa')).toBe('isa')
  })
  it('devolve vazio quando não há nome', () => {
    expect(firstName(null)).toBe('')
    expect(firstName(undefined)).toBe('')
    expect(firstName('   ')).toBe('')
  })
})

describe('personalize — a marca {nome}', () => {
  it('troca a marca pelo primeiro nome', () => {
    expect(personalize('Olá, {nome}! Tudo bem?', 'Sara Carolina Vasco')).toBe(
      'Olá, Sara! Tudo bem?',
    )
  })
  it('aceita as variações que o founder pode digitar', () => {
    for (const marca of ['{nome}', '{Nome}', '{NOME}', '{ nome }', '{{nome}}']) {
      expect(personalize(`Oi ${marca}`, 'Nailli Souza')).toBe('Oi Nailli')
    }
  })
  it('troca todas as ocorrências, não só a primeira', () => {
    expect(personalize('{nome}, o relatório de {nome} saiu.', 'Ana Paula')).toBe(
      'Ana, o relatório de Ana saiu.',
    )
  })
  it('sem nome cadastrado a marca vira vazio — é o caso que a tela precisa barrar', () => {
    expect(personalize('Olá, {nome}.', null)).toBe('Olá, .')
  })
  it('texto sem a marca passa intacto', () => {
    const t = 'Comunicado geral, sem personalização.'
    expect(personalize(t, 'Moacir')).toBe(t)
  })
})
