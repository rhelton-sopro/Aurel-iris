'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { withNetworkRetry, isNetworkError } from '@/lib/net/retry'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  SPECIALTIES,
  OTHER,
  MAX_SPECIALTIES,
  formatPhoneBR,
  phoneIsValidBR,
  buildSpecialties,
} from '@/lib/profile/fields'
import { TOS_VERSION } from '@/lib/consent/tos'
import { markTherapistInviteUsedAction } from '@/app/actions/therapist-invites'
import { ensureTrialStartedAction } from '@/app/actions/onboarding'

const inputClass =
  'h-11 w-full rounded-none border-0 border-b border-b-ink bg-transparent px-3 text-base outline-none transition-colors duration-[180ms] placeholder:text-mist focus-visible:border-b-teal'

interface Props {
  tokenEmail: string
  tokenId: string
}

export function TherapistInviteSignupForm({ tokenEmail, tokenId }: Props) {
  const [step, setStep] = useState<'form' | 'code'>('form')

  // Campos do cadastro (email vem do token — read-only)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [otherText, setOtherText] = useState('')
  const [tosAccepted, setTosAccepted] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const otherSelected = selected.includes(OTHER)

  function toggleSpecialty(s: string) {
    setSelected((prev) => {
      if (prev.includes(s)) return prev.filter((x) => x !== s)
      if (prev.length >= MAX_SPECIALTIES) return prev
      return [...prev, s]
    })
  }

  function buildMeta() {
    return {
      full_name: fullName.trim(),
      phone,
      specialties: buildSpecialties(selected, otherText),
      tos_accepted_at: new Date().toISOString(),
      tos_version: TOS_VERSION,
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!fullName.trim()) return setFormError('Informe seu nome completo.')
    if (!phoneIsValidBR(phone)) return setFormError('WhatsApp inválido (DDD + número).')
    const specs = buildSpecialties(selected, otherText)
    if (specs.length < 1) return setFormError('Selecione ao menos 1 especialidade.')
    if (!tosAccepted)
      return setFormError('É necessário aceitar os Termos e a Política de Privacidade.')

    setSubmitting(true)
    const supabase = createClient()
    const { error } = await withNetworkRetry(() =>
      supabase.auth.signInWithOtp({
        email: tokenEmail,
        options: {
          data: buildMeta(),
          shouldCreateUser: true,
        },
      }),
    )

    if (error) {
      console.error('[therapist-invite] signInWithOtp error:', {
        message: error.message,
        status: error.status,
        name: error.name,
        code: (error as { code?: string }).code,
      })
      if (error.status === 429 || error.message.toLowerCase().includes('rate limit')) {
        setFormError('Muitas tentativas. Aguarde alguns minutos e tente novamente.')
      } else if (isNetworkError(error)) {
        setFormError('Falha de conexão ao enviar o código. Verifique a internet e tente de novo.')
      } else {
        setFormError(`Erro ao criar conta: ${error.message} (status ${error.status ?? 'desconhecido'})`)
      }
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    setStep('code')
  }

  async function onVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    const token = code.trim()
    if (!token) {
      setFormError('Digite o código recebido por e-mail.')
      return
    }
    setFormError(null)
    setVerifying(true)
    const supabase = createClient()
    const { error } = await withNetworkRetry(() =>
      supabase.auth.verifyOtp({
        email: tokenEmail,
        token,
        type: 'email',
      }),
    )

    if (error) {
      console.error('[therapist-invite] verifyOtp error:', {
        message: error.message,
        status: error.status,
        name: error.name,
        code: (error as { code?: string }).code,
      })
      if (error.status === 429 || error.message.toLowerCase().includes('rate limit')) {
        setFormError('Muitas tentativas. Aguarde alguns minutos e tente novamente.')
      } else {
        setFormError('Código inválido ou expirado. Confira o código ou solicite um novo.')
      }
      setCode('')
      setVerifying(false)
      return
    }

    // Pós-OTP: nada aqui pode impedir a navegação. Com o código já verificado,
    // a conta existe e a sessão está ativa — uma falha de rede nestas Server
    // Actions rejeitava a promise e deixava `verifying` true PARA SEMPRE, com o
    // botão preso em "Verificando..." (2026-08-09, Daniel Negri no /signup).
    try {
      // Marca token usado após sessão criada.
      const markResult = await markTherapistInviteUsedAction(tokenId)
      if (!markResult.ok) {
        console.warn('[therapist-invite] markTherapistInviteUsedAction failed:', markResult.error)
      }

      // Religa a trial de boas-vindas (idempotente). Mesma trilha do self-signup.
      await ensureTrialStartedAction()
    } catch (err) {
      console.warn('[therapist-invite] pós-verificação falhou (não bloqueia):', err)
    }

    // Hard navigation: middleware lê o cookie de sessão recém-gravado.
    window.location.assign('/dashboard')
  }

  async function onResend() {
    setFormError(null)
    const supabase = createClient()
    const { error } = await withNetworkRetry(() =>
      supabase.auth.signInWithOtp({
        email: tokenEmail,
        options: { data: buildMeta(), shouldCreateUser: true },
      }),
    )
    if (error) {
      setFormError('Não foi possível reenviar o código. Aguarde um instante e tente de novo.')
    }
  }

  if (step === 'code') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Digite o código</CardTitle>
          <CardDescription>
            Enviamos um código de acesso para <strong>{tokenEmail}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {formError && (
            <div className="mb-4 bg-destructive/10 border border-destructive text-sm px-4 py-2 rounded text-destructive">
              {formError}
            </div>
          )}
          <form onSubmit={onVerifyCode} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="otp-code" className="text-sm font-medium">
                Código de acesso
              </label>
              <input
                id="otp-code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Código do e-mail"
                className="h-12 w-full rounded-none border-0 border-b border-b-ink bg-transparent px-3 text-center text-2xl tracking-[0.3em] font-light outline-none transition-colors duration-[180ms] placeholder:text-base placeholder:tracking-normal placeholder:text-mist focus-visible:border-b-teal"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={verifying}
              aria-busy={verifying}
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Criar conta e entrar'
              )}
            </Button>
          </form>
          <div className="mt-4 flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <button type="button" onClick={onResend} className="underline">
              Não recebeu? Reenviar código
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('form')
                setFormError(null)
                setCode('')
              }}
              className="underline"
            >
              Corrigir dados
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Cadastro de Terapeuta</CardTitle>
        <CardDescription>Iris Codex — Complete seu cadastro como terapeuta.</CardDescription>
      </CardHeader>
      <CardContent>
        {formError && (
          <div className="mb-4 bg-destructive/10 border border-destructive text-sm px-4 py-2 rounded text-destructive">
            {formError}
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="full_name" className="text-sm font-medium">
              Nome completo
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nome do terapeuta"
              className={inputClass}
            />
          </div>

          {/* Email read-only: vem do token de convite (não editável pelo terapeuta).
              Segurança: signInWithOtp usa tokenEmail do prop (server-validated), não state. */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">E-mail</span>
            <div className="h-11 w-full rounded-none border-0 border-b border-b-ink/40 px-3 flex items-center text-base text-mist">
              <strong className="text-ink">{tokenEmail}</strong>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="phone" className="text-sm font-medium">
              WhatsApp
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhoneBR(e.target.value))}
              placeholder="(11) 99999-9999"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">
              Especialidades{' '}
              <span className="text-mist">(1 a {MAX_SPECIALTIES})</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES.map((s) => {
                const on = selected.includes(s)
                const disabled = !on && selected.length >= MAX_SPECIALTIES
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSpecialty(s)}
                    disabled={disabled}
                    aria-pressed={on}
                    className={
                      'rounded-none border px-3 py-1.5 text-sm transition-colors ' +
                      (on
                        ? 'border-teal bg-teal text-white'
                        : disabled
                          ? 'border-b-ink/20 text-mist cursor-not-allowed'
                          : 'border-ink text-ink hover:border-teal hover:text-teal')
                    }
                  >
                    {s}
                  </button>
                )
              })}
            </div>
            {otherSelected && (
              <input
                type="text"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Qual especialidade?"
                className={inputClass + ' mt-1'}
              />
            )}
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={tosAccepted}
              onChange={(e) => setTosAccepted(e.target.checked)}
              className="mt-1"
            />
            <span>
              Li e aceito os{' '}
              <Link href="/termos" target="_blank" className="underline">
                Termos de Uso
              </Link>{' '}
              e a{' '}
              <Link href="/privacidade" target="_blank" className="underline">
                Política de Privacidade
              </Link>
              .
            </span>
          </label>

          <Button
            type="submit"
            className="w-full"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar código de acesso'
            )}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Já tem conta?{' '}
          <Link href="/login" className="underline">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
