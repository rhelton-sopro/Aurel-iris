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
import { isValidCpf, cpfDigits, formatCpfBR } from '@/lib/auth/cpf'
import { ensureTrialStartedAction } from '@/app/actions/onboarding'

const inputClass =
  'h-11 w-full rounded-none border-0 border-b border-b-ink bg-transparent px-3 text-base outline-none transition-colors duration-[180ms] placeholder:text-mist focus-visible:border-b-teal'

export default function SignupPage() {
  const [step, setStep] = useState<'form' | 'code'>('form')

  // Campos do cadastro
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [cpf, setCpf] = useState('')
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
      cpf: cpfDigits(cpf), // dígitos only — propagado pro profiles via handle_new_user (0039)
      specialties: buildSpecialties(selected, otherText),
      tos_accepted_at: new Date().toISOString(),
      tos_version: TOS_VERSION,
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!fullName.trim()) return setFormError('Informe seu nome completo.')
    if (!/.+@.+\..+/.test(email)) return setFormError('E-mail inválido.')
    if (!phoneIsValidBR(phone)) return setFormError('WhatsApp inválido (DDD + número).')
    if (!isValidCpf(cpf)) return setFormError('CPF inválido (verifique os dígitos).')
    const specs = buildSpecialties(selected, otherText)
    if (specs.length < 1) return setFormError('Selecione ao menos 1 especialidade.')
    if (!tosAccepted)
      return setFormError('É necessário aceitar os Termos e a Política de Privacidade.')

    setSubmitting(true)

    // Pre-check de CPF: o trigger handle_new_user (0039) tem UNIQUE em cpf, e a
    // colisão estoura no trigger como o opaco "Database error saving new user"
    // (Supabase mascara o erro — o branch de mensagem abaixo nunca casava).
    // Checar ANTES do OTP dá "CPF já cadastrado" claro e não queima um e-mail.
    // Fail-open: glitch na checagem não bloqueia cadastro (o trigger ainda
    // garante a integridade).
    try {
      const r = await fetch('/api/auth/check-cpf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf }),
      })
      if (r.ok) {
        const { exists } = (await r.json()) as { exists?: boolean }
        if (exists) {
          setFormError('Já existe cadastro com este CPF. Use a tela de login.')
          setSubmitting(false)
          return
        }
      }
    } catch {
      /* fail-open */
    }

    const supabase = createClient()
    const { error } = await withNetworkRetry(() =>
      supabase.auth.signInWithOtp({
        email,
        options: {
          data: buildMeta(),
          shouldCreateUser: true,
        },
      }),
    )

    if (error) {
      console.error('[signup] signInWithOtp error:', {
        message: error.message,
        status: error.status,
        name: error.name,
        code: (error as { code?: string }).code,
      })
      if (error.status === 429 || error.message.toLowerCase().includes('rate limit')) {
        setFormError('Muitas tentativas. Aguarde alguns minutos e tente novamente.')
      } else if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('user already')) {
        setFormError('Este e-mail já tem conta. Use a tela de login.')
      } else if (error.message.toLowerCase().includes('cpf') || error.message.toLowerCase().includes('profiles_cpf_unique')) {
        setFormError('Já existe cadastro com este CPF. Use a tela de login.')
      } else if (error.message.toLowerCase().includes('signups') && error.message.toLowerCase().includes('disabled')) {
        setFormError('Cadastros estão desabilitados no momento. Contate o administrador.')
      } else if (isNetworkError(error)) {
        setFormError('Falha de conexão ao enviar o código. Verifique a internet e toque em "Enviar" de novo.')
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
        email,
        token,
        type: 'email',
      }),
    )

    if (error) {
      console.error('[signup] verifyOtp error:', {
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

    // Religa a trial de boas-vindas (idempotente). Nice-to-have: se falhar, a
    // sessão já está ativa e o gate/cron pode recriar; não bloqueia a entrada.
    await ensureTrialStartedAction()

    // Hard navigation: middleware lê o cookie de sessão recém-gravado.
    window.location.assign('/dashboard')
  }

  async function onResend() {
    setFormError(null)
    const supabase = createClient()
    const { error } = await withNetworkRetry(() =>
      supabase.auth.signInWithOtp({
        email,
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
            Enviamos um código de acesso para <strong>{email}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {formError && (
            <div className="mb-4 bg-destructive/10 border border-destructive text-sm px-4 py-2 rounded text-destructive">
              {formError}
            </div>
          )}
          {/* Plain controlled input — sem react-hook-form/FormControl (esse
              stack deixava o campo inerte; ver login/page.tsx). */}
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
        <CardTitle className="text-2xl">Criar conta</CardTitle>
        <CardDescription>Iris Codex — A íris como mapa do ser.</CardDescription>
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

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className={inputClass}
            />
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

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cpf" className="text-sm font-medium">
              CPF
            </label>
            <input
              id="cpf"
              name="cpf"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={cpf}
              onChange={(e) => setCpf(formatCpfBR(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
              data-testid="signup-cpf"
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
