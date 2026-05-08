// Wave-0 stub flipped em 07-06-PLAN (diff classifier).
// Source: 07-VALIDATION.md line 56, 07-RESEARCH.md line 1081, D-U2.
import { describe, it, expect } from 'vitest'
import { classifyEdit, classifyAllSections } from '../diff'
import type { ReportJsonb } from '../types'

describe('lib/anthropic/diff — classifyEdit (D-U2)', () => {
  it('texto idêntico = "none"', () => {
    const r = classifyEdit('Foo bar baz.', 'Foo bar baz.')
    expect(r.type).toBe('none')
    expect(r.changed_pct).toBe(0)
    expect(r.char_delta).toBe(0)
  })

  it('vazio → texto = "adicionado"', () => {
    const r = classifyEdit('', 'Conteúdo novo aqui.')
    expect(r.type).toBe('adicionado')
    expect(r.changed_pct).toBe(100)
    expect(r.char_delta).toBeGreaterThan(0)
  })

  it('texto → vazio = "removido"', () => {
    const r = classifyEdit('Conteúdo removido.', '')
    expect(r.type).toBe('removido')
    expect(r.changed_pct).toBe(100)
    expect(r.char_delta).toBeLessThan(0)
  })

  it('whitespace only original = também "adicionado" (trim aplica)', () => {
    const r = classifyEdit('   \n  ', 'Conteúdo novo.')
    expect(r.type).toBe('adicionado')
  })

  it('mudança <30% (abaixo do threshold) = "corrigido"', () => {
    // 14 palavras, 2 substituídas no final → ~25% via diffWords
    // (added+removed contam separadamente: total = 12 common + 2 rem + 2 add = 16,
    // changed = 4, 4/16 = 25%).
    const generated = 'um dois três quatro cinco seis sete oito nove dez onze doze treze quatorze'
    const delivered = 'um dois três quatro cinco seis sete oito nove dez onze doze ZERO ONZE'
    const r = classifyEdit(generated, delivered)
    expect(r.type).toBe('corrigido')
    expect(r.changed_pct).toBeLessThan(30)
  })

  it('mudança ~30% (boundary inclusive >=) = "reescrito"', () => {
    // 3 de ~10 tokens substituídos no início → claramente >= 30%.
    const generated = 'um dois três quatro cinco seis sete oito nove dez'
    const delivered = 'A B C quatro cinco seis sete oito nove dez'
    const r = classifyEdit(generated, delivered)
    expect(r.type).toBe('reescrito')
    expect(r.changed_pct).toBeGreaterThanOrEqual(30)
  })

  it('mudança >50% (claramente acima) = "reescrito"', () => {
    const generated = 'um dois três quatro cinco'
    const delivered = 'A B C D quatro'
    const r = classifyEdit(generated, delivered)
    expect(r.type).toBe('reescrito')
    expect(r.changed_pct).toBeGreaterThan(50)
  })

  it('char_delta = trimDel.length - trimGen.length', () => {
    const generated = 'foo'
    const delivered = 'foo bar'
    const r = classifyEdit(generated, delivered)
    expect(r.char_delta).toBe(4) // ' bar' = 4 chars added
  })

  it('diff_summary é string não-vazia para edits not none', () => {
    const r = classifyEdit('original', 'modified')
    expect(typeof r.diff_summary).toBe('string')
    expect(r.diff_summary.length).toBeGreaterThan(0)
  })
})

describe('lib/anthropic/diff — classifyAllSections (D-U2 outputs)', () => {
  it('produz edit_diff jsonb + zonas_editadas + tipo_edicao para 3 keys mistos', () => {
    const generated: ReportJsonb = {
      '1_constituicao': 'Original constituição.',
      '2_estrutural_fisica': 'Original estrutural.',
      '3_indicacoes_sistemicas': 'Original sistêmicas.',
    }
    const delivered: ReportJsonb = {
      '1_constituicao': 'Original constituição.', // none
      '2_estrutural_fisica': 'Modificação completa diferente texto outro novo.', // reescrito
      '3_indicacoes_sistemicas': '', // removido
    }
    const r = classifyAllSections(generated, delivered)
    expect(r.edit_diff['1_constituicao']?.type).toBe('none')
    expect(r.edit_diff['2_estrutural_fisica']?.type).toBe('reescrito')
    expect(r.edit_diff['3_indicacoes_sistemicas']?.type).toBe('removido')
    expect(r.zonas_editadas).toContain('2_estrutural_fisica')
    expect(r.zonas_editadas).toContain('3_indicacoes_sistemicas')
    expect(r.zonas_editadas).not.toContain('1_constituicao')
    expect(r.tipo_edicao.sort()).toEqual(['removido', 'reescrito'].sort())
  })

  it('chave ausente em generated mas presente em delivered = "adicionado"', () => {
    const generated: ReportJsonb = {}
    const delivered: ReportJsonb = { '5_psicoemocional': 'Texto novo aqui.' }
    const r = classifyAllSections(generated, delivered)
    expect(r.edit_diff['5_psicoemocional']?.type).toBe('adicionado')
    expect(r.zonas_editadas).toEqual(['5_psicoemocional'])
    expect(r.tipo_edicao).toEqual(['adicionado'])
  })

  it('tudo idêntico = zonas_editadas vazio + tipo_edicao vazio', () => {
    const report: ReportJsonb = {
      '1_constituicao': 'Mesmo texto.',
      '2_estrutural_fisica': 'Mesmo texto 2.',
    }
    const r = classifyAllSections(report, report)
    expect(r.zonas_editadas).toEqual([])
    expect(r.tipo_edicao).toEqual([])
  })

  it('classifyAllSections processa encerramento_disclaimer (terapeuta NÃO deveria editar mas defesa em profundidade)', () => {
    const generated: ReportJsonb = { encerramento_disclaimer: '> Disclaimer original.' }
    const delivered: ReportJsonb = { encerramento_disclaimer: '> Disclaimer alterado pelo terapeuta.' }
    const r = classifyAllSections(generated, delivered)
    expect(r.edit_diff['encerramento_disclaimer']?.type).not.toBe('none')
    expect(r.zonas_editadas).toContain('encerramento_disclaimer')
  })
})
