'use client'

import { useState, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { withNetworkRetry, isNetworkError } from '@/lib/net/retry'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const emailSchema = z.object({
  email: z.string().min(1, 'E-mail é obrigatório').email('E-mail inválido'),
})
type EmailValues = z.infer<typeof emailSchema>

function LoginForm() {
  const searchParams = useSearchParams()
  const hasError = searchParams.get('error') === 'auth_callback_failed'

  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [formError, setFormError] = useState<string | null>(
    hasError ? 'Sessão inválida ou expirada. Solicite um novo código de acesso.' : null
  )

  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  })

  async function onRequestCode(values: EmailValues) {
    setFormError(null)
    const supabase = createClient()
    const { error } = await withNetworkRetry(() =>
      supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          shouldCreateUser: false, // NÃO cria usuário se não existir (login)
        },
      }),
    )

    if (error) {
      // Loga erro completo no console pra diagnóstico (status code, message,
      // name) — não vaza dados sensíveis porque é client-side e só roda no
      // próprio browser do user.
      console.error('[login] signInWithOtp error:', {
        message: error.message,
        status: error.status,
        name: error.name,
        code: (error as { code?: string }).code,
      })

      if (error.message.toLowerCase().includes('not found') || error.status === 422) {
        setFormError('Não encontramos uma conta com este e-mail.')
      } else if (error.status === 429 || error.message.toLowerCase().includes('rate limit')) {
        setFormError('Muitas tentativas. Aguarde alguns minutos e tente novamente.')
      } else if (isNetworkError(error)) {
        setFormError('Falha de conexão ao enviar o código. Verifique a internet e toque em "Enviar" de novo.')
      } else {
        setFormError(`Erro ao enviar código: ${error.message} (status ${error.status ?? 'desconhecido'})`)
      }
      return
    }

    setEmail(values.email)
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
      console.error('[login] verifyOtp error:', {
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

    // Hard navigation: garante request novo onde o middleware lê o cookie de
    // sessão recém-gravado (mais robusto que router.push no PWA standalone).
    window.location.assign('/dashboard')
  }

  async function onResend() {
    setFormError(null)
    const supabase = createClient()
    const { error } = await withNetworkRetry(() =>
      supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
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
          <CardTitle className="text-[22px] font-light uppercase tracking-display text-ink">Digite o código</CardTitle>
          <CardDescription>
            Enviamos um código de acesso para <strong>{email}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {formError && (
            <div className="mb-4 bg-destructive/10 border border-destructive text-sm px-4 py-2 rounded-none text-destructive">
              {formError}
            </div>
          )}
          {/* Plain controlled input — deliberately NO react-hook-form /
              FormField / FormControl here: that stack was leaving this
              field inert. The email step above keeps RHF (it works). */}
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
                'Entrar'
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
                setStep('email')
                setFormError(null)
                setCode('')
              }}
              className="underline"
            >
              Usar outro e-mail
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[22px] font-light uppercase tracking-display text-ink">Entrar</CardTitle>
        <CardDescription>Acesse sua conta Iris Codex</CardDescription>
      </CardHeader>
      <CardContent>
        {formError && (
          <div className="mb-4 bg-destructive/10 border border-destructive text-sm px-4 py-2 rounded-none text-destructive">
            {formError}
            {formError.includes('Não encontramos') && (
              <span>
                {' '}
                <Link href="/signup" className="underline">
                  Deseja criar uma conta?
                </Link>
              </span>
            )}
          </div>
        )}
        <Form {...emailForm}>
          <form onSubmit={emailForm.handleSubmit(onRequestCode)} className="space-y-4">
            <FormField
              control={emailForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="seu@email.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={emailForm.formState.isSubmitting}
              aria-busy={emailForm.formState.isSubmitting}
            >
              {emailForm.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar código de acesso'
              )}
            </Button>
          </form>
        </Form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Primeira vez?{' '}
          <Link href="/signup" className="underline">
            Criar conta
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
