/**
 * @vitest-environment jsdom
 *
 * Caixinhas da versão do cliente (founder, 2026-08-03): o terapeuta escolhe bloco a
 * bloco o que vai no PDF do cliente.
 *
 * O que estes testes travam é o CONTRATO com a rota — quais índices saem na query —,
 * porque é ele que decide o que o cliente recebe. Um off-by-one aqui entrega o guia de
 * condução do terapeuta achando que entregou o repertório.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VersaoClienteButton } from '../VersaoClienteButton'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// Os títulos reais do motor (TITULOS_BLOCOS) — chegam por prop porque o módulo do
// render é server-only.
const TITULOS = [
  'Em poucas palavras',
  'Mente, coração e corpo — a sua mistura',
  'O que cada tempo deixou em você',
  'O que talvez não tenha começado em você',
  'O que pesa — e pra onde afrouxa',
  'As regras que você repete sem perceber',
  'Repertório de suporte',
  'Sugestões integrativas',
  'Perguntas para a sua sessão',
]

// jsdom não implementa nenhum dos dois. Ficam definidos pelo arquivo inteiro, e não por
// teste: o `revokeObjectURL` roda num setTimeout de 500ms, então um stub desfeito no
// beforeEach seguinte estoura como exceção não capturada depois do teste passar.
Object.defineProperty(URL, 'createObjectURL', {
  value: vi.fn(() => 'blob:x'),
  writable: true,
  configurable: true,
})
Object.defineProperty(URL, 'revokeObjectURL', {
  value: vi.fn(),
  writable: true,
  configurable: true,
})

function mockFetchOk() {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    blob: async () => new Blob(['%PDF']),
    headers: { get: () => null },
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('components/readings/VersaoClienteButton — seleção de blocos por entrega', () => {
  it('padrão: tudo marcado MENOS "Perguntas para a sua sessão"', () => {
    render(<VersaoClienteButton readingId="r1" titulos={TITULOS} />)
    fireEvent.click(screen.getByTestId('escolher-blocos'))
    for (let i = 0; i < TITULOS.length - 1; i++) {
      expect((screen.getByTestId(`bloco-${i}`) as HTMLInputElement).checked).toBe(true)
    }
    // o guia de condução do terapeuta é o único que começa fora
    expect((screen.getByTestId('bloco-8') as HTMLInputElement).checked).toBe(false)
  })

  it('baixa com a seleção padrão na query (blocos=0..7)', async () => {
    const fetchMock = mockFetchOk()
    render(<VersaoClienteButton readingId="r1" titulos={TITULOS} />)
    fireEvent.click(screen.getByTestId('reading-mode-versao-cliente'))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0]![0]).toBe(
      '/api/readings/r1/emocional/pdf?variant=client&blocos=0,1,2,3,4,5,6,7',
    )
  })

  it('desmarcar um bloco tira o índice DELE da query, e só ele', async () => {
    const fetchMock = mockFetchOk()
    render(<VersaoClienteButton readingId="r1" titulos={TITULOS} />)
    fireEvent.click(screen.getByTestId('escolher-blocos'))
    fireEvent.click(screen.getByTestId('bloco-6')) // Repertório de suporte
    fireEvent.click(screen.getByTestId('reading-mode-versao-cliente'))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0]![0]).toContain('blocos=0,1,2,3,4,5,7')
  })

  it('marcar "Perguntas" inclui o bloco 8 na entrega', async () => {
    const fetchMock = mockFetchOk()
    render(<VersaoClienteButton readingId="r1" titulos={TITULOS} />)
    fireEvent.click(screen.getByTestId('escolher-blocos'))
    fireEvent.click(screen.getByTestId('bloco-8'))
    fireEvent.click(screen.getByTestId('reading-mode-versao-cliente'))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0]![0]).toContain('blocos=0,1,2,3,4,5,6,7,8')
  })

  it('sem nenhum bloco marcado o download fica bloqueado (PDF só de capa não sai)', () => {
    render(<VersaoClienteButton readingId="r1" titulos={TITULOS} />)
    fireEvent.click(screen.getByTestId('escolher-blocos'))
    for (let i = 0; i < TITULOS.length - 1; i++) {
      fireEvent.click(screen.getByTestId(`bloco-${i}`))
    }
    expect(
      screen.getByTestId('reading-mode-versao-cliente').hasAttribute('disabled'),
    ).toBe(true)
  })

  it('"Voltar ao padrão" desfaz a mexida', () => {
    render(<VersaoClienteButton readingId="r1" titulos={TITULOS} />)
    fireEvent.click(screen.getByTestId('escolher-blocos'))
    fireEvent.click(screen.getByTestId('bloco-0'))
    expect((screen.getByTestId('bloco-0') as HTMLInputElement).checked).toBe(false)
    fireEvent.click(screen.getByTestId('blocos-padrao'))
    expect((screen.getByTestId('bloco-0') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByTestId('bloco-8') as HTMLInputElement).checked).toBe(false)
  })
})
