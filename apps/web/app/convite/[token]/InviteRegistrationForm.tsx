'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { BirthDateInput } from '@/components/clientes/birth-date-input'
import {
  completeInviteNewClientAction,
  type CompleteInviteFormState,
} from '@/app/actions/invites'

/**
 * Form público de cadastro de cliente novo via convite. Inline state
 * (sem RHF) — mais leve pro client final, validação server-side cobre.
 *
 * Campos = mesmos do /clientes/novo (founder Q1 = cadastro completo):
 * full_name, birth_date, biological_sex, email, phone, notes + consent.
 *
 * Submit chama completeInviteNewClientAction(token, ...). Em sucesso,
 * a action redireciona pra /convite/[token]/capturar?client=<id>.
 */
export function InviteRegistrationForm({ token }: { token: string }) {
  const boundAction = completeInviteNewClientAction.bind(null, token)
  const [state, formAction, isPending] = useActionState<
    CompleteInviteFormState,
    FormData
  >(boundAction, {})
  const [birthDate, setBirthDate] = useState('')

  const errors = typeof state.error === 'object' && state.error
    ? (state.error as Record<string, string[]>)
    : null
  const errorMsg = typeof state.error === 'string' ? state.error : null

  return (
    <form action={formAction} className="space-y-4">
      {errorMsg && (
        <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMsg}
        </div>
      )}

      <Field label="Nome completo" error={errors?.full_name?.[0]}>
        <Input name="full_name" required placeholder="Seu nome" />
      </Field>

      <Field label="Data de nascimento" error={errors?.birth_date?.[0]}>
        <BirthDateInput value={birthDate} onChange={setBirthDate} name="birth_date" />
      </Field>

      <Field label="Sexo biológico de nascimento" error={errors?.biological_sex?.[0]}>
        <select
          name="biological_sex"
          required
          defaultValue=""
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          <option value="" disabled>Selecione</option>
          <option value="feminino">Feminino</option>
          <option value="masculino">Masculino</option>
        </select>
      </Field>

      <Field label="E-mail" error={errors?.email?.[0]}>
        <Input type="email" name="email" required placeholder="seu@email.com" />
      </Field>

      <Field label="Telefone / WhatsApp" error={errors?.phone?.[0]}>
        <Input type="tel" name="phone" required placeholder="(11) 99999-9999" />
      </Field>

      <Field label="Observações (opcional)">
        <Textarea
          name="notes"
          placeholder="Algo que você gostaria de compartilhar com o terapeuta"
          rows={3}
        />
      </Field>

      <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="consent_accepted"
            value="true"
            required
            className="mt-1 h-4 w-4"
          />
          <span className="text-foreground/90">
            Li e aceito os{' '}
            <Link
              href="/termos"
              target="_blank"
              className="text-foreground underline hover:no-underline"
            >
              Termos de Uso
            </Link>{' '}
            e a{' '}
            <Link
              href="/privacidade"
              target="_blank"
              className="text-foreground underline hover:no-underline"
            >
              Política de Privacidade
            </Link>
            . Autorizo o uso das fotos da minha íris para gerar a leitura
            iridológica solicitada e o envio ao terapeuta indicado.
          </span>
        </label>
        {errors?.consent_accepted?.[0] && (
          <p className="mt-1 text-xs text-destructive">{errors.consent_accepted[0]}</p>
        )}
      </div>

      <Button type="submit" disabled={isPending} aria-busy={isPending} className="w-full">
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cadastrando...
          </>
        ) : (
          'Continuar para a leitura'
        )}
      </Button>
    </form>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
