'use client'

import { useActionState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BirthDateInput } from '@/components/clientes/birth-date-input'
import { cn } from '@/lib/utils'
import type { ClientFormState } from '@/app/actions/clients'
import type { Database } from '@/types/database'
import { MIN_AGE, isAdult } from '@/lib/gates/profile-completeness'

type Client = Database['public']['Tables']['clients']['Row']

// Mesma forma do schema servidor (app/actions/clients.ts). A REGRA de idade
// vem da fonte única (isAdult) — aqui aplicada via watch (não via .refine)
// para dar bloqueio visível + submit desabilitado sem mensagem duplicada.
const clientSchema = z.object({
  full_name: z.string().min(1, 'Nome é obrigatório'),
  birth_date: z.string().min(1, 'Data de nascimento é obrigatória'),
  biological_sex: z.enum(['feminino', 'masculino']),
  email: z
    .string()
    .min(1, 'E-mail é obrigatório')
    .refine((v) => /.+@.+\..+/.test(v), 'E-mail inválido'),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  notes: z.string().max(2000).optional(),
})

type ClientFormValues = z.infer<typeof clientSchema>

type ActionFn = (prev: ClientFormState, formData: FormData) => Promise<ClientFormState>

interface ClientFormProps {
  mode: 'create' | 'edit'
  client?: Client
  action: ActionFn
}

export function ClientForm({ mode, client, action }: ClientFormProps) {
  const [state, formAction, isPending] = useActionState(action, {})

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      full_name: client?.full_name ?? '',
      birth_date: client?.birth_date ?? '',
      biological_sex:
        (client?.biological_sex as ClientFormValues['biological_sex']) ?? undefined,
      email: client?.email ?? '',
      phone: client?.phone ?? '',
      notes: client?.notes ?? '',
    },
  })

  // Gate de idade inline — usa a FONTE ÚNICA (isAdult). null = data
  // incompleta/inválida (não bloqueia enquanto digita).
  const birthDate = form.watch('birth_date')
  const isUnderage = birthDate ? isAdult(birthDate) === false : false

  const title = mode === 'create' ? 'Novo cliente' : 'Editar cliente'
  const submitLabel = mode === 'create' ? 'Salvar cliente' : 'Atualizar cliente'

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>

      {typeof state.error === 'string' && (
        <div className="bg-destructive/10 border border-destructive text-sm px-4 py-2 rounded text-destructive">
          {state.error}
        </div>
      )}

      <Form {...form}>
        <form action={formAction} className="space-y-4">
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome completo</FormLabel>
                <FormControl>
                  <Input placeholder="Nome do cliente" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="birth_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de nascimento</FormLabel>
                <FormControl>
                  <BirthDateInput
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {isUnderage && (
            <div className="bg-destructive/10 border border-destructive text-sm px-4 py-2 rounded text-destructive">
              O Iris Codex atende apenas pessoas com {MIN_AGE} anos ou mais —
              não é possível cadastrar este cliente.
            </div>
          )}

          <FormField
            control={form.control}
            name="biological_sex"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sexo biológico de nascimento</FormLabel>
                {/* base-ui Select: name injeta hidden input no FormData */}
                <Select
                  name="biological_sex"
                  value={field.value ?? null}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="masculino">Masculino</SelectItem>
                  </SelectContent>
                </Select>
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
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone / WhatsApp</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notas</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Observações relevantes para a anamnese..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={isPending || isUnderage}
              aria-busy={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                submitLabel
              )}
            </Button>
            <Link href="/clientes" className={cn(buttonVariants({ variant: 'outline' }))}>
              Cancelar
            </Link>
          </div>
        </form>
      </Form>
    </div>
  )
}
