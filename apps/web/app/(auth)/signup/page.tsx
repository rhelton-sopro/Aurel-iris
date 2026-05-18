'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
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

const signupSchema = z.object({
  email: z.string().min(1, 'E-mail é obrigatório').email('E-mail inválido'),
  full_name: z.string().min(1, 'Nome é obrigatório'),
})
const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'O código tem 6 dígitos'),
})
type SignupFormValues = z.infer<typeof signupSchema>
type CodeValues = z.infer<typeof codeSchema>

export default function SignupPage() {
  const [step, setStep] = useState<'form' | 'code'>('form')
  const [pending, setPending] = useState<{ email: string; full_name: string }>({
    email: '',
    full_name: '',
  })
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', full_name: '' },
  })
  const codeForm = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  })

  async function onSubmit(values: SignupFormValues) {
    setFormError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        data: {
          full_name: values.full_name, // lido pelo trigger: raw_user_meta_data->>'full_name'
        },
        shouldCreateUser: true, // cria usuário se não existir (signup)
      },
    })

    if (error) {
      // Loga erro completo no console pra diagnóstico (status code, message,
      // name) — não vaza dados sensíveis porque é client-side e só roda no
      // próprio browser do user. Mesmo padrão de login/page.tsx (#267ff50).
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
      } else if (error.message.toLowerCase().includes('signups') && error.message.toLowerCase().includes('disabled')) {
        setFormError('Cadastros estão desabilitados no momento. Contate o administrador.')
      } else {
        setFormError(`Erro ao criar conta: ${error.message} (status ${error.status ?? 'desconhecido'})`)
      }
      return
    }

    setPending({ email: values.email, full_name: values.full_name })
    setStep('code')
  }

  async function onVerifyCode(values: CodeValues) {
    setFormError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      email: pending.email,
      token: values.code,
      type: 'email',
    })

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
      email: pending.email,
      options: {
        data: { full_name: pending.full_name },
        shouldCreateUser: true,
      },
    })
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
            Enviamos um código de 6 dígitos para <strong>{pending.email}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {formError && (
            <div className="mb-4 bg-destructive/10 border border-destructive text-sm px-4 py-2 rounded text-destructive">
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
                  'Criar conta e entrar'
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
                setStep('form')
                setFormError(null)
                codeForm.reset()
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do terapeuta" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
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
              disabled={form.formState.isSubmitting}
              aria-busy={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
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
          Já tem conta?{' '}
          <Link href="/login" className="underline">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
