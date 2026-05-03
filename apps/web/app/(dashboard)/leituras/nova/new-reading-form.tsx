'use client'

import { useActionState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'
import { createReadingAction, type ReadingFormState } from '@/app/actions/readings'

const formSchema = z.object({
  client_id: z.string().uuid('Selecione um cliente'),
})

type FormValues = z.infer<typeof formSchema>

interface NewReadingFormProps {
  clients: { id: string; full_name: string }[]
  preselectedClientId?: string
}

export function NewReadingForm({ clients, preselectedClientId }: NewReadingFormProps) {
  const [state, formAction, isPending] = useActionState<ReadingFormState, FormData>(
    createReadingAction,
    {}
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      client_id: preselectedClientId ?? '',
    },
  })

  return (
    <div className="space-y-4">
      {typeof state.error === 'string' && (
        <div className="bg-destructive/10 border border-destructive text-sm px-4 py-2 rounded text-destructive">
          {state.error}
        </div>
      )}

      <Form {...form}>
        <form action={formAction} className="space-y-4">
          <FormField
            control={form.control}
            name="client_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cliente</FormLabel>
                {/* base-ui Select: name prop injeta hidden input no FormData (igual ao pattern de client-form.tsx) */}
                <Select name="client_id" value={field.value || null} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente">
                        {(value: string | null) =>
                          clients.find((c) => c.id === value)?.full_name ?? 'Selecione o cliente'
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending} aria-busy={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparando leitura...
                </>
              ) : (
                'Iniciar leitura'
              )}
            </Button>
            <Link href="/leituras" className={cn(buttonVariants({ variant: 'outline' }))}>
              Cancelar
            </Link>
          </div>
        </form>
      </Form>
    </div>
  )
}
