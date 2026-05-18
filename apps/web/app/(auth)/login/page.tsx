'use client'

import { useState, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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
const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'O código tem 6 dígitos'),
})
type EmailValues = z.infer<typeof emailSchema>
type CodeValues = z.infer<typeof codeSchema>

function LoginForm() {
  const searchParams = useSearchParams()
  const hasError = searchParams.get('error') === 'auth_callback_failed'

  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [formError, setFormError] = useState<string | null>(
    hasError ? 'Sessão inválida ou expirada. Solicite um novo código de acesso.' : null
  )

  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  })
  const codeForm = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  })

  async function onRequestCode(values: EmailValues) {
    setFormError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        shouldCreateUser: false, // NÃO cria usuário se não existir (login)
      },
    })

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
      } else {
        setFormError(`Erro ao enviar código: ${error.message} (status ${error.status ?? 'desconhecido'})`)
      }
      return
    }

    setEmail(values.email)
    setStep('code')
  }

  async function onVerifyCode(values: CodeValues) {
    setFormError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: values.code,
      type: 'email',
    })

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
        setFormError('Código inválido ou expirado. Confira os 6 dígitos ou solicite um novo.')
      }
      codeForm.reset()
      return
    }

    // Hard navigation: garante request novo onde o middleware lê o cookie de
    // sessão recém-gravado (mais robusto que router.push no PWA standalone).
    window.location.assign('/dashboard')
  }

  async function onResend() {
    setFormError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
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
            Enviamos um código de 6 dígitos para <strong>{email}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {formError && (
            <div className="mb-4 bg-destructive/10 border border-destructive text-sm px-4 py-2 rounded-none text-destructive">
              {formError}
            </div>
          )}
          <Form {...codeForm}>
            <form onSubmit={codeForm.handleSubmit(onVerifyCode)} className="space-y-4">
              <FormField
                control={codeForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código de acesso</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]*"
                        maxLength={6}
                        placeholder="------"
                        autoFocus
                        className="text-center text-2xl tracking-[0.5em] font-light"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={codeForm.formState.isSubmitting}
                aria-busy={codeForm.formState.isSubmitting}
              >
                {codeForm.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
          </Form>
          <div className="mt-4 flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <button type="button" onClick={onResend} className="underline">
              Não recebeu? Reenviar código
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('email')
                setFormError(null)
                codeForm.reset()
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
