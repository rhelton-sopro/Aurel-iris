'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { createReadingAction, type ReadingFormState } from '@/app/actions/readings'

// Schema do form CLIENT-SIDE (para react-hook-form). O server action tem seu
// proprio schema mais estrito em readings.schemas.ts (Plan 04-02 — inclui method).
const formSchema = z.object({
  client_id: z.string().uuid('Selecione um cliente'),
})

type FormValues = z.infer<typeof formSchema>
type CaptureMethod = 'mobile_camera' | 'desktop_upload'

interface NewReadingFormProps {
  clients: { id: string; full_name: string }[]
  preselectedClientId?: string
}

/**
 * Form de selecao de cliente + escolha de metodo (CONTEXT D-01 da Fase 4).
 *
 * Fluxo:
 *   1. SSR renderiza com chosenMethod='mobile_camera' (default seguro — preserva
 *      comportamento Fase 3 com JS desabilitado).
 *   2. useEffect roda no client: matchMedia('(pointer: coarse) and (hover: none)')
 *      → coarse pointer + sem hover ≈ touch device → mobile_camera.
 *   3. Hidden input <input name="method" value={chosenMethod}> injeta no FormData.
 *   4. Botao primario envia com method=chosenMethod (auto-detected).
 *   5. Botao de escape (link de escape D-01) e <button type="submit" name="method"
 *      value="<oposto>">. Quando clicado, browser usa o value do botao e ignora
 *      o hidden input (HTML form behavior canonico — Pattern G em 04-PATTERNS.md).
 *
 * createReadingAction (Plan 04-02) le formData.get('method') e redireciona para
 * /capturar ou /upload. Default 'mobile_camera' (no schema) preserva compat caso
 * JS esteja desabilitado.
 */
export function NewReadingForm({ clients, preselectedClientId }: NewReadingFormProps) {
  const [state, formAction, isPending] = useActionState<ReadingFormState, FormData>(
    createReadingAction,
    {},
  )

  // Default 'mobile_camera' garante que SSR/no-JS resulta em fluxo mobile
  // (preserva comportamento Fase 3). Client substitui no useEffect.
  const [chosenMethod, setChosenMethod] = React.useState<CaptureMethod>('mobile_camera')

  React.useEffect(() => {
    // matchMedia coarse+hover e mais robusto que User-Agent (cobre iPad em modo
    // desktop e dispositivos novos). CONTEXT D-01 — heuristica de deteccao.
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(pointer: coarse) and (hover: none)')
    const update = () => setChosenMethod(mql.matches ? 'mobile_camera' : 'desktop_upload')
    update()
    // Reagir a mudancas (terapeuta conectando teclado/mouse externo no iPad).
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', update)
      return () => mql.removeEventListener('change', update)
    }
  }, [])

  const otherMethod: CaptureMethod =
    chosenMethod === 'mobile_camera' ? 'desktop_upload' : 'mobile_camera'

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

          {/* Hidden input — injeta method no FormData (default mobile_camera no SSR). */}
          <input type="hidden" name="method" value={chosenMethod} />

          <div className="space-y-3 pt-2">
            <Button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className="w-full"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparando leitura...
                </>
              ) : chosenMethod === 'mobile_camera' ? (
                'Iniciar captura mobile'
              ) : (
                'Selecionar arquivos no computador'
              )}
            </Button>

            {/* Link de escape (CONTEXT D-01). Usa <button type="submit" name="method"
                value="<oposto>"> — browser sobrescreve o hidden input ao submeter
                (Pattern G de 04-PATTERNS.md — HTML form behavior canonico). */}
            <button
              type="submit"
              name="method"
              value={otherMethod}
              disabled={isPending}
              className="w-full text-sm text-muted-foreground underline-offset-2 hover:underline text-center disabled:opacity-50"
            >
              {chosenMethod === 'mobile_camera'
                ? 'Tenho fotos prontas — subir do computador'
                : 'Quero usar a câmera deste dispositivo'}
            </button>
          </div>
        </form>
      </Form>
    </div>
  )
}
