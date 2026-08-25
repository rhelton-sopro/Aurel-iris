// Regressão de 25/08: o campo "Para" da caixa de suporte aceitava UM endereço
// só. Colando vários separados por ponto e vírgula, o envio inteiro morria em
// "Destinatário avulso inválido" — inclusive os terapeutas já escolhidos.
import { describe, expect, it } from 'vitest'

import { parseEnderecos } from './enderecos'

describe('parseEnderecos', () => {
  it('separa por ponto e vírgula (o jeito que o founder digita)', () => {
    expect(parseEnderecos('a@x.com; b@y.com; c@z.com').validos).toEqual([
      'a@x.com',
      'b@y.com',
      'c@z.com',
    ])
  })

  it('separa por vírgula, quebra de linha e espaço também', () => {
    expect(parseEnderecos('a@x.com, b@y.com\nc@z.com d@w.com').validos).toEqual([
      'a@x.com',
      'b@y.com',
      'c@z.com',
      'd@w.com',
    ])
  })

  it('um endereço só continua funcionando', () => {
    const r = parseEnderecos('  a@x.com  ')
    expect(r.validos).toEqual(['a@x.com'])
    expect(r.invalidos).toEqual([])
  })

  it('campo vazio não é erro — é ninguém', () => {
    expect(parseEnderecos('')).toEqual({ validos: [], invalidos: [] })
    expect(parseEnderecos(null)).toEqual({ validos: [], invalidos: [] })
  })

  it('ninguém recebe duas vezes, mesmo escrito com maiúsculas', () => {
    expect(parseEnderecos('A@X.com; a@x.com').validos).toEqual(['A@X.com'])
  })

  it('aceita a forma colada de outro cliente de e-mail', () => {
    expect(parseEnderecos('Fulana <fulana@x.com>; beltrano@y.com').validos).toEqual([
      'fulana@x.com',
      'beltrano@y.com',
    ])
  })

  it('aponta o que não é endereço, sem derrubar os que são', () => {
    const r = parseEnderecos('a@x.com; bagunça@; b@y.com')
    expect(r.validos).toEqual(['a@x.com', 'b@y.com'])
    expect(r.invalidos).toEqual(['bagunça@'])
  })

  it('texto sem nenhum endereço vira erro (e não silêncio)', () => {
    expect(parseEnderecos('nailli').invalidos).toEqual(['nailli'])
  })
})
