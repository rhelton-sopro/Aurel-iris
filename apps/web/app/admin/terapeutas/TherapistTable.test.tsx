/**
 * @vitest-environment jsdom
 */
// A tela dos terapeutas (24/08). O pedido do founder foi ver telefone, área
// terapêutica e o resto do cadastro — dados que o servidor JÁ buscava e que a
// tela descartava calada. Estes testes existem para que não voltem a sumir.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./GrantCreditsDialog', () => ({
  GrantCreditsDialog: () => <button type="button">Créditos</button>,
}))
vi.mock('./DeleteTherapistDialog', () => ({
  DeleteTherapistDialog: () => <button type="button">Excluir</button>,
}))

import { TherapistTable, type TherapistRow } from './TherapistTable'

const BASE: TherapistRow = {
  id: 't1',
  email: 'nailli@exemplo.com',
  full_name: 'Nailli Souza',
  phone: '(62) 98467-7916',
  specialties: ['Constelação Familiar', 'Reiki'],
  city: 'Goiânia',
  state: 'GO',
  cpf: '123.456.789-00',
  address: 'Rua das Flores',
  address_number: '120',
  address_complement: 'apto 3',
  district: 'Setor Oeste',
  cep: '74000-000',
  subscription_status: 'trial',
  trial_ends_at: '2026-09-10T00:00:00Z',
  is_paying: false,
  tos_accepted_at: '2026-07-01T00:00:00Z',
  tos_version: 'v1',
  created_at: '2026-07-01T00:00:00Z',
  clients_count: 4,
  readings_count: 7,
  bought_month: 10,
  used_month: 3,
  balance: 7,
  last_reading_at: '2026-08-20T00:00:00Z',
}

const OUTRO: TherapistRow = {
  ...BASE,
  id: 't2',
  email: 'moacir@exemplo.com',
  full_name: 'Moacir Domingues',
  phone: '(15) 94643-4646',
  specialties: ['Psicologia / Psicoterapia'],
  city: 'Sorocaba',
  state: 'SP',
}

function montar(rows: TherapistRow[] = [BASE, OUTRO]) {
  return render(<TherapistTable rows={rows} packages={[]} />)
}

describe('TherapistTable — o que a tela mostra sem clicar', () => {
  it('mostra o telefone e as áreas na própria linha', () => {
    montar()
    expect(screen.getByText('(62) 98467-7916')).toBeTruthy()
    expect(screen.getByText('Constelação Familiar · Reiki')).toBeTruthy()
  })

  it('a busca filtra por área terapêutica, não só por nome', () => {
    montar()
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nome/), {
      target: { value: 'psicologia' },
    })
    expect(screen.getByText('Moacir Domingues')).toBeTruthy()
    expect(screen.queryByText('Nailli Souza')).toBeNull()
  })

  it('a busca também acha por cidade', () => {
    montar()
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nome/), {
      target: { value: 'goiânia' },
    })
    expect(screen.getByText('Nailli Souza')).toBeTruthy()
    expect(screen.queryByText('Moacir Domingues')).toBeNull()
  })
})

describe('TherapistTable — a ficha da pessoa', () => {
  it('abre ao clicar na linha e traz cadastro, cobrança e termos', () => {
    montar()
    expect(screen.queryByText('Áreas que ele marcou')).toBeNull()

    fireEvent.click(screen.getByText('Nailli Souza'))

    expect(screen.getByText('Áreas que ele marcou')).toBeTruthy()
    expect(screen.getByText('Goiânia / GO')).toBeTruthy()
    expect(screen.getByText('123.456.789-00')).toBeTruthy()
    expect(screen.getByText(/Rua das Flores, 120/)).toBeTruthy()
    expect(screen.getByText(/v1/)).toBeTruthy()
  })

  it('o telefone vira link de WhatsApp com o 55 na frente', () => {
    montar()
    fireEvent.click(screen.getByText('Nailli Souza'))
    const link = screen.getByText(/WhatsApp/).closest('a') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('https://wa.me/5562984677916')
  })

  it('fecha ao clicar de novo, e só uma ficha fica aberta por vez', () => {
    montar()
    fireEvent.click(screen.getByText('Nailli Souza'))
    expect(screen.getByText('Goiânia / GO')).toBeTruthy()

    fireEvent.click(screen.getByText('Moacir Domingues'))
    expect(screen.queryByText('Goiânia / GO')).toBeNull()
    expect(screen.getByText('Sorocaba / SP')).toBeTruthy()

    fireEvent.click(screen.getByText('Moacir Domingues'))
    expect(screen.queryByText('Sorocaba / SP')).toBeNull()
  })

  it('clicar em Créditos/Excluir NÃO abre a ficha — são ações, não navegação', () => {
    montar()
    fireEvent.click(screen.getAllByText('Créditos')[0])
    expect(screen.queryByText('Áreas que ele marcou')).toBeNull()
  })

  it('quem não marcou área nenhuma aparece dizendo isso, sem espaço em branco', () => {
    montar([{ ...BASE, specialties: [] }])
    fireEvent.click(screen.getByText('Nailli Souza'))
    expect(screen.getByText('Não marcou nenhuma área no cadastro.')).toBeTruthy()
  })
})
