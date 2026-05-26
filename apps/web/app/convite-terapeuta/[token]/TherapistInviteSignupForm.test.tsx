/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ href, children, className, target }: { href: string; children: React.ReactNode; className?: string; target?: string }) => (
    <a href={href} className={className} target={target}>{children}</a>
  ),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

const {
  mockSignInWithOtp,
  mockVerifyOtp,
} = vi.hoisted(() => {
  const mockSignInWithOtp = vi.fn()
  const mockVerifyOtp = vi.fn()
  return { mockSignInWithOtp, mockVerifyOtp }
})

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithOtp: mockSignInWithOtp,
      verifyOtp: mockVerifyOtp,
    },
  })),
}))

const { mockMarkTherapistInviteUsedAction } = vi.hoisted(() => {
  const mockMarkTherapistInviteUsedAction = vi.fn()
  return { mockMarkTherapistInviteUsedAction }
})

vi.mock('@/app/actions/therapist-invites', () => ({
  markTherapistInviteUsedAction: mockMarkTherapistInviteUsedAction,
}))

// Mock net/retry — passa direto a fn sem retry
vi.mock('@/lib/net/retry', () => ({
  withNetworkRetry: vi.fn((fn: () => unknown) => fn()),
  isNetworkError: vi.fn(() => false),
}))

// Mock window.location.assign
const mockAssign = vi.fn()
Object.defineProperty(window, 'location', {
  value: { assign: mockAssign },
  writable: true,
})

import { TherapistInviteSignupForm } from './TherapistInviteSignupForm'

beforeEach(() => {
  vi.clearAllMocks()
})

const TOKEN_EMAIL = 'terapeuta@example.com'
const TOKEN_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

describe('TherapistInviteSignupForm', () => {
  it('Test 1: render mostra email read-only com valor do prop tokenEmail', () => {
    render(<TherapistInviteSignupForm tokenEmail={TOKEN_EMAIL} tokenId={TOKEN_ID} />)

    // Email deve estar visível no componente
    expect(screen.getByText(TOKEN_EMAIL)).toBeInTheDocument()
  })

  it('Test 2: render NÃO tem input editável de email (type="email")', () => {
    const { container } = render(
      <TherapistInviteSignupForm tokenEmail={TOKEN_EMAIL} tokenId={TOKEN_ID} />,
    )

    // Não deve existir nenhum input com type="email"
    const emailInput = container.querySelector('input[type="email"]')
    expect(emailInput).toBeNull()
  })

  it('Test 3: submit sem nome → erro "Informe seu nome completo."', async () => {
    render(<TherapistInviteSignupForm tokenEmail={TOKEN_EMAIL} tokenId={TOKEN_ID} />)

    const form = screen.getByRole('button', { name: /enviar código/i }).closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText(/Informe seu nome completo\./i)).toBeInTheDocument()
    })
  })

  it('Test 4: submit sem WhatsApp válido → erro WhatsApp', async () => {
    render(<TherapistInviteSignupForm tokenEmail={TOKEN_EMAIL} tokenId={TOKEN_ID} />)

    // Preenche nome mas deixa phone vazio
    const nameInput = screen.getByLabelText(/nome completo/i)
    fireEvent.change(nameInput, { target: { value: 'João Terapeuta' } })

    const form = screen.getByRole('button', { name: /enviar código/i }).closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText(/WhatsApp inválido/i)).toBeInTheDocument()
    })
  })

  it('Test 5: submit sem specialties → erro especialidade', async () => {
    render(<TherapistInviteSignupForm tokenEmail={TOKEN_EMAIL} tokenId={TOKEN_ID} />)

    const nameInput = screen.getByLabelText(/nome completo/i)
    fireEvent.change(nameInput, { target: { value: 'João Terapeuta' } })

    const phoneInput = screen.getByLabelText(/whatsapp/i)
    fireEvent.change(phoneInput, { target: { value: '(11) 99999-9999' } })

    const form = screen.getByRole('button', { name: /enviar código/i }).closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText(/ao menos 1 especialidade/i)).toBeInTheDocument()
    })
  })

  it('Test 6: submit sem TOS → erro termos', async () => {
    render(<TherapistInviteSignupForm tokenEmail={TOKEN_EMAIL} tokenId={TOKEN_ID} />)

    const nameInput = screen.getByLabelText(/nome completo/i)
    fireEvent.change(nameInput, { target: { value: 'João Terapeuta' } })

    const phoneInput = screen.getByLabelText(/whatsapp/i)
    fireEvent.change(phoneInput, { target: { value: '(11) 99999-9999' } })

    // Seleciona uma especialidade
    const iridologiaBtn = screen.getByRole('button', { name: 'Iridologia' })
    fireEvent.click(iridologiaBtn)

    const form = screen.getByRole('button', { name: /enviar código/i }).closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText(/Termos e a Política/i)).toBeInTheDocument()
    })
  })

  it('Test 7: submit completo → signInWithOtp com email do prop + shouldCreateUser:true → step transita pra code', async () => {
    mockSignInWithOtp.mockResolvedValueOnce({ error: null })

    render(<TherapistInviteSignupForm tokenEmail={TOKEN_EMAIL} tokenId={TOKEN_ID} />)

    // Preenche todos os campos obrigatórios
    fireEvent.change(screen.getByLabelText(/nome completo/i), {
      target: { value: 'João Terapeuta' },
    })
    fireEvent.change(screen.getByLabelText(/whatsapp/i), {
      target: { value: '(11) 99999-9999' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Iridologia' }))
    fireEvent.click(screen.getByRole('checkbox'))

    const form = screen.getByRole('button', { name: /enviar código/i }).closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        email: TOKEN_EMAIL,
        options: expect.objectContaining({
          shouldCreateUser: true,
          data: expect.objectContaining({
            full_name: 'João Terapeuta',
          }),
        }),
      })
    })

    // Step transita para 'code' — título muda
    await waitFor(() => {
      expect(screen.getByText(/Digite o código/i)).toBeInTheDocument()
    })
  })

  it('Test 8: verify OTP success → markTherapistInviteUsedAction chamado com tokenId + window.location.assign("/dashboard")', async () => {
    mockSignInWithOtp.mockResolvedValueOnce({ error: null })
    mockVerifyOtp.mockResolvedValueOnce({ error: null })
    mockMarkTherapistInviteUsedAction.mockResolvedValueOnce({ ok: true })

    render(<TherapistInviteSignupForm tokenEmail={TOKEN_EMAIL} tokenId={TOKEN_ID} />)

    // Preenche e submete o form inicial
    fireEvent.change(screen.getByLabelText(/nome completo/i), {
      target: { value: 'João Terapeuta' },
    })
    fireEvent.change(screen.getByLabelText(/whatsapp/i), {
      target: { value: '(11) 99999-9999' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Iridologia' }))
    fireEvent.click(screen.getByRole('checkbox'))

    fireEvent.submit(
      screen.getByRole('button', { name: /enviar código/i }).closest('form')!,
    )

    // Aguarda step 'code'
    await waitFor(() => {
      expect(screen.getByText(/Digite o código/i)).toBeInTheDocument()
    })

    // Preenche e submete código OTP
    const codeInput = screen.getByLabelText(/código de acesso/i)
    fireEvent.change(codeInput, { target: { value: '12345678' } })

    fireEvent.submit(codeInput.closest('form')!)

    await waitFor(() => {
      expect(mockMarkTherapistInviteUsedAction).toHaveBeenCalledWith(TOKEN_ID)
      expect(mockAssign).toHaveBeenCalledWith('/dashboard')
    })
  })
})
