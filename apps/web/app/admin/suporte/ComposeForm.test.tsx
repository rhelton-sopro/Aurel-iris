/**
 * @vitest-environment jsdom
 */
// Regressão de 2026-08-24: a mensagem que o founder digitava sumia sozinha.
//
// Causa: o corpo do e-mail é um `contenteditable` cujo conteúdo inicial era
// injetado por `dangerouslySetInnerHTML={{ __html: ... }}`. No React 19 o diff
// de props compara o objeto por IDENTIDADE (`next === prev`) e, quando difere,
// executa `domElement.innerHTML = value.__html` SEM comparar a string. Como o
// objeto literal nasce de novo a cada render, TODO re-render reescrevia o
// editor com o texto inicial — apagando o que já estava escrito.
//
// Gatilhos reais: digitar em "Para"/"Assunto" e a auto-atualização de 60s da
// inbox. Daí o "às vezes".
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: vi.fn(() => ({ refresh: vi.fn() })) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
const TERAPEUTAS = [
  { id: 't1', name: 'Nailli Souza', email: 'nailli@exemplo.com' },
  { id: 't2', name: 'Moacir Domingues', email: 'moacir@exemplo.com' },
  { id: 't3', name: '', email: 'sem-nome@exemplo.com' },
]

vi.mock('./actions', () => ({
  sendEmailAction: vi.fn(async () => ({ ok: true })),
  sendBulkEmailAction: vi.fn(async () => ({ ok: true, sent: 1, failed: [] })),
  listTherapistRecipients: vi.fn(async () => ({ ok: true, therapists: TERAPEUTAS })),
}))

import { toast } from 'sonner'

import { sendEmailAction, sendBulkEmailAction } from './actions'
import { ComposeForm } from './ComposeForm'

// O jsdom não implementa innerText (só textContent), e é de innerText que sai o
// corpo em texto do e-mail — inclusive a marca {nome} que a trava procura. Sem
// isto o teste da trava passaria por engano, achando que não há {nome} nenhum.
if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText')) {
  Object.defineProperty(HTMLElement.prototype, 'innerText', {
    configurable: true,
    get(this: HTMLElement) {
      return this.textContent ?? ''
    },
  })
}

const INITIAL = {
  title: 'Responder',
  to: 'terapeuta@exemplo.com',
  subject: 'Re: dúvida',
  text: '\n\n----- Em 24/08, Fulana escreveu: -----\n> texto citado',
}

function setup(initial = INITIAL) {
  const { container } = render(<ComposeForm initial={initial} onClose={vi.fn()} />)
  const editor = container.querySelector('[contenteditable]') as HTMLDivElement
  expect(editor).toBeTruthy()
  return { container, editor }
}

describe('ComposeForm — o texto digitado não pode sumir', () => {
  it('semeia o editor com o texto inicial (citação da resposta)', () => {
    const { editor } = setup()
    expect(editor.innerHTML).toContain('texto citado')
  })

  it('preserva o que foi digitado quando o Assunto muda', () => {
    const { container, editor } = setup()
    editor.innerHTML = 'Oi Fulana, <b>tudo certo</b> por aqui.'

    const assunto = container.querySelectorAll('input')[1] as HTMLInputElement
    fireEvent.change(assunto, { target: { value: 'Re: dúvida sobre o relatório' } })

    expect(editor.innerHTML).toContain('tudo certo')
  })

  it('preserva o que foi digitado quando o campo Para muda', () => {
    const { container, editor } = setup()
    editor.innerHTML = 'rascunho longo que não pode sumir'

    const para = container.querySelectorAll('input')[0] as HTMLInputElement
    fireEvent.change(para, { target: { value: 'outro@exemplo.com' } })

    expect(editor.innerHTML).toContain('rascunho longo que não pode sumir')
  })

  it('preserva o que foi digitado quando a inbox re-renderiza por fora (auto-atualização de 60s)', () => {
    const onClose = vi.fn()
    const { container, rerender } = render(<ComposeForm initial={INITIAL} onClose={onClose} />)
    const editor = container.querySelector('[contenteditable]') as HTMLDivElement
    editor.innerHTML = 'mensagem escrita antes do refresh'

    // o pai re-renderiza e passa um objeto NOVO com o mesmo conteúdo — foi
    // exatamente isso que apagava o rascunho.
    rerender(<ComposeForm initial={{ ...INITIAL }} onClose={onClose} />)

    expect(editor.innerHTML).toContain('mensagem escrita antes do refresh')
  })
})

// ===========================================================================
// Envio em massa (24/08): a caixinha de terapeutas.
// ===========================================================================

async function escolher(container: HTMLElement, emails: string[]) {
  fireEvent.click(screen.getByText('👥 Escolher terapeutas'))
  await screen.findByText('Escolher terapeutas')
  for (const email of emails) {
    const linha = screen.getByText(email).closest('label') as HTMLLabelElement
    fireEvent.click(linha.querySelector('input[type="checkbox"]') as HTMLInputElement)
  }
  fireEvent.click(screen.getByText(`Usar ${emails.length} selecionado(s)`))
  await waitFor(() => expect(screen.queryByText('Escolher terapeutas')).toBeNull())
  return container
}

describe('ComposeForm — envio em massa para terapeutas', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sem ninguém escolhido continua sendo envio único', async () => {
    const { editor } = setup({ ...INITIAL, text: '' })
    editor.innerHTML = 'mensagem simples'
    fireEvent.click(screen.getByText('Enviar'))
    await waitFor(() => expect(sendEmailAction).toHaveBeenCalledTimes(1))
    expect(sendBulkEmailAction).not.toHaveBeenCalled()
  })

  it('com terapeutas escolhidos manda os IDS pro envio em massa — nunca os endereços', async () => {
    const { container, editor } = setup({ ...INITIAL, to: '', text: '' })
    await escolher(container, ['nailli@exemplo.com', 'moacir@exemplo.com'])
    editor.innerHTML = 'Olá, {nome}! Novidade no Iris Codex.'

    fireEvent.click(screen.getByText('Enviar para 2'))
    await waitFor(() => expect(sendBulkEmailAction).toHaveBeenCalledTimes(1))
    expect(sendEmailAction).not.toHaveBeenCalled()

    const arg = vi.mocked(sendBulkEmailAction).mock.calls[0][0]
    expect(arg.therapistIds).toEqual(['t1', 't2'])
    expect(JSON.stringify(arg)).not.toContain('@exemplo.com')
  })

  it('BARRA o disparo quando o texto usa {nome} e alguém escolhido não tem nome', async () => {
    const { container, editor } = setup({ ...INITIAL, to: '', text: '' })
    await escolher(container, ['nailli@exemplo.com', 'sem-nome@exemplo.com'])
    editor.innerHTML = 'Olá, {nome}!'

    fireEvent.click(screen.getByText('Enviar para 2'))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(sendBulkEmailAction).not.toHaveBeenCalled()
  })

  it('sem a marca {nome} no texto, quem não tem nome pode receber normalmente', async () => {
    const { container, editor } = setup({ ...INITIAL, to: '', text: '' })
    await escolher(container, ['sem-nome@exemplo.com'])
    editor.innerHTML = 'Comunicado geral, sem personalização.'

    fireEvent.click(screen.getByText('Enviar para 1'))
    await waitFor(() => expect(sendBulkEmailAction).toHaveBeenCalledTimes(1))
  })

  it('dá para tirar alguém da lista pelo × antes de enviar', async () => {
    const { container } = setup({ ...INITIAL, to: '', text: '' })
    await escolher(container, ['nailli@exemplo.com', 'moacir@exemplo.com'])
    fireEvent.click(screen.getByLabelText('remover Moacir Domingues'))
    expect(screen.getByText('Enviar para 1')).toBeTruthy()
  })

  it('escolher terapeutas não apaga o que já estava escrito', async () => {
    const { container, editor } = setup()
    editor.innerHTML = 'rascunho anterior à escolha'
    await escolher(container, ['nailli@exemplo.com'])
    expect(editor.innerHTML).toContain('rascunho anterior à escolha')
  })
})
