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
import { BirthDateSelect } from '@/components/clientes/birth-date-select'
import { cn } from '@/lib/utils'
import type { ClientFormState } from '@/app/actions/clients'
import type { Database } from '@/types/database'

type Client = Database['public']['Tables']['clients']['Row']

const clientSchema = z.object({
  full_name: z.string().min(1, 'Nome é obrigatório'),
  birth_date: z
    .string()
    .optional()
    .refine(
      (s) => !s || new Date(`${s}T00:00:00`) <= new Date(),
      'Data de nascimento não pode estar no futuro',
    ),
  gender: z.enum(['masculino', 'feminino', 'outro', 'não_informado']).optional(),
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
      gender: (client?.gender as ClientFormValues['gender']) ?? undefined,
      notes: client?.notes ?? '',
    },
  })

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
                  <BirthDateSelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gênero</FormLabel>
                {/* base-ui Select: name prop injeta hidden input no form para FormData */}
                <Select
                  name="gender"
                  value={field.value ?? null}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                    <SelectItem value="não_informado">Não informado</SelectItem>
                  </SelectContent>
                </Select>
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
            <Button type="submit" disabled={isPending} aria-busy={isPending}>
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
