'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MailCheck, Loader2 } from 'lucide-react'
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

const loginSchema = z.object({
  email: z.string().min(1, 'E-mail é obrigatório').email('E-mail inválido'),
})

type LoginFormValues = z.infer<typeof loginSchema>

function LoginForm() {
  const searchParams = useSearchParams()
  const hasError = searchParams.get('error') === 'auth_callback_failed'

  const [sent, setSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')
  const [formError, setFormError] = useState<string | null>(
    hasError ? 'Link inválido ou expirado. Solicite um novo link de acesso.' : null
  )

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '' },
  })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  async function onSubmit(values: LoginFormValues) {
    setFormError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        emailRedirectTo: `${siteUrl}/api/auth/callback`,
        shouldCreateUser: false, // NÃO cria usuário se não existir (T-02-04, Pitfall 3)
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

      // Supabase retorna erro quando email não existe (com shouldCreateUser: false)
      if (error.message.toLowerCase().includes('not found') || error.status === 422) {
        setFormError('Não encontramos uma conta com este e-mail.')
      } else if (error.status === 429 || error.message.toLowerCase().includes('rate limit')) {
        setFormError('Muitas tentativas. Aguarde alguns minutos e tente novamente.')
      } else {
        // Em vez de mensagem genérica, expõe os detalhes do erro pra
        // diagnóstico em prod (status code + message). Pode ser ajustado
        // depois quando estabilizar.
        setFormError(`Erro ao enviar link: ${error.message} (status ${error.status ?? 'desconhecido'})`)
      }
      return
    }

    setSentEmail(values.email)
    setSent(true)
  }

  if (sent) {
    return (
      <Card>
        <CardContent className="pt-6 flex flex-col items-center text-center gap-4">
          <MailCheck className="w-12 h-12 text-primary" />
          <h2 className="text-xl font-semibold">Verifique seu e-mail</h2>
          <p className="text-sm text-muted-foreground">
            Enviamos um link de acesso para <strong>{sentEmail}</strong>. Clique no link para entrar.
            O link é válido por 24 horas.
          </p>
          <p className="text-xs text-muted-foreground">
            Não recebeu? Verifique a pasta de spam ou tente novamente.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Entrar</CardTitle>
        <CardDescription>Acesse sua conta Aurel Iris</CardDescription>
      </CardHeader>
      <CardContent>
        {formError && (
          <div className="mb-4 bg-destructive/10 border border-destructive text-sm px-4 py-2 rounded text-destructive">
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                'Enviar link de acesso'
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

import { Suspense } from 'react'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
