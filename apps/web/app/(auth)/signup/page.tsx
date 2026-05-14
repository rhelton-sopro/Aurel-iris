'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
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

const signupSchema = z.object({
  email: z.string().min(1, 'E-mail é obrigatório').email('E-mail inválido'),
  full_name: z.string().min(1, 'Nome é obrigatório'),
})

type SignupFormValues = z.infer<typeof signupSchema>

export default function SignupPage() {
  const [sent, setSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', full_name: '' },
  })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  async function onSubmit(values: SignupFormValues) {
    setFormError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        emailRedirectTo: `${siteUrl}/api/auth/callback`,
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
        // Em vez de mensagem genérica, expõe os detalhes do erro pra
        // diagnóstico em prod (status code + message). Pode ser ajustado
        // depois quando estabilizar.
        setFormError(`Erro ao criar conta: ${error.message} (status ${error.status ?? 'desconhecido'})`)
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
                  Salvando...
                </>
              ) : (
                'Enviar link de acesso'
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
