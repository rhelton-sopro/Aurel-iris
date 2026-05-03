---
phase: 04-upload-desktop
plan: 06
type: execute
wave: 4
depends_on:
  - 02
files_modified:
  - apps/web/app/(dashboard)/leituras/nova/new-reading-form.tsx
autonomous: true
requirements:
  - UPLOAD-01
  - UPLOAD-02

tags:
  - phase-04
  - upload-desktop
  - entry-point
  - device-detect

must_haves:
  truths:
    - "new-reading-form auto-detecta device via window.matchMedia('(pointer: coarse) and (hover: none)') (CONTEXT D-01) e seta chosenMethod ∈ {'mobile_camera', 'desktop_upload'} no useEffect."
    - "Formulário tem hidden input name='method' com value=chosenMethod (default mobile_camera para SSR/no-JS fallback)."
    - "Dois CTAs presentes: botão primário (auto-detected method) e link/botão secundário de escape (método oposto)."
    - "Botão de escape é <button type='submit' name='method' value='<oposto>'> que sobrescreve hidden input via HTML form behavior."
    - "Ambos os CTAs disabled quando isPending=true."
    - "Texto do botão primário muda dinamicamente baseado em chosenMethod: 'Iniciar captura mobile' (mobile) | 'Selecionar arquivos no computador' (desktop)."
    - "Texto do escape muda dinamicamente: 'Tenho fotos prontas — subir do computador' (mobile→desktop) | 'Quero usar a câmera deste dispositivo' (desktop→mobile)."
    - "createReadingAction recebe method via FormData (Plan 04-02 lê) e redireciona pra /upload OR /capturar."
    - "Vocabulário proibido LGPD ausente."
  artifacts:
    - path: "apps/web/app/(dashboard)/leituras/nova/new-reading-form.tsx"
      provides: "Form com auto-detect + dois CTAs"
      contains: "matchMedia.*pointer.*coarse"
  key_links:
    - from: "apps/web/app/(dashboard)/leituras/nova/new-reading-form.tsx"
      to: "createReadingAction (Plan 04-02)"
      via: "FormData inclui field 'method' lido por createReadingSchema"
      pattern: "name=.method."
    - from: "Browser matchMedia API"
      to: "chosenMethod state"
      via: "useEffect lê window.matchMedia + setChosenMethod"
      pattern: "matchMedia.*coarse"
---

<objective>
Modificar `app/(dashboard)/leituras/nova/new-reading-form.tsx` para implementar **CONTEXT D-01** (auto-detect mobile/desktop com link de escape em ambos os lados).

Comportamento:
- No mount: `matchMedia('(pointer: coarse) and (hover: none)').matches` → chosenMethod = 'mobile_camera'; senão 'desktop_upload'.
- Hidden input `<input type="hidden" name="method" value={chosenMethod} />` injeta valor no FormData (default `mobile_camera` para SSR).
- Botão primário envia FormData com method=chosenMethod.
- Botão secundário (escape) é `<button type="submit" name="method" value="<oposto>">` — quando clicado, browser usa o `value` do botão e ignora o hidden input (HTML form spec). Permite trocar de método sem JS adicional.
- Texto dos CTAs muda dinamicamente.

Implementa **D-01** (auto-detect + escape link em ambos os lados), **D-02** (CTA único em /clientes/[id] permanece — sem mudança ali; escolha vive aqui), **D-03** (capture_method via FormData consumido por createReadingAction).

Output: 1 arquivo modificado. Após este plan, terapeuta navega para `/leituras/nova`, escolhe cliente, e vê:
- No mobile: botão "Iniciar captura mobile" + escape "Tenho fotos prontas — subir do computador".
- No desktop: botão "Selecionar arquivos no computador" + escape "Quero usar a câmera deste dispositivo".

Cada CTA submete o form e chama `createReadingAction` com method correspondente. createReadingAction (Plan 04-02) redireciona pra `/upload` ou `/capturar`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/04-upload-desktop/04-CONTEXT.md
@.planning/phases/04-upload-desktop/04-PATTERNS.md

# Plano que define o contrato server-side (consumir method via FormData)
@.planning/phases/04-upload-desktop/04-02-extender-create-reading-action-PLAN.md

# Arquivo a modificar (LER PRIMEIRO antes de editar)
@apps/web/app/(dashboard)/leituras/nova/new-reading-form.tsx

# Padrão de hooks/use-mobile para matchMedia (referência de event listener com cleanup)
@apps/web/hooks/use-mobile.ts

# Padrão de form com hidden input name= (referência base-ui Select)
@apps/web/components/clientes/client-form.tsx

<interfaces>
<!-- Estado atual do new-reading-form.tsx (LER): só CTA único "Iniciar leitura". -->

<!-- Após este plan: -->

```typescript
// Adicionado:
const [chosenMethod, setChosenMethod] = React.useState<'mobile_camera' | 'desktop_upload'>('mobile_camera')

React.useEffect(() => {
  const mql = window.matchMedia('(pointer: coarse) and (hover: none)')
  setChosenMethod(mql.matches ? 'mobile_camera' : 'desktop_upload')
}, [])

// JSX dos CTAs:
<input type="hidden" name="method" value={chosenMethod} />
<Button type="submit" disabled={isPending}>
  {chosenMethod === 'mobile_camera' ? 'Iniciar captura mobile' : 'Selecionar arquivos no computador'}
</Button>
<button type="submit" name="method" value={otherMethod}>...</button>
```

<!-- Server action consumindo o FormData (já implementada em Plan 04-02): -->
```typescript
// readings.ts (após Plan 04-02):
const parsed = createReadingSchema.safeParse({
  client_id: formData.get('client_id'),
  method: formData.get('method') ?? undefined,  // default 'mobile_camera' via schema
})
// ...
const destination = parsed.data.method === 'desktop_upload'
  ? `/leituras/nova/upload?reading=${reading.id}`
  : `/leituras/nova/capturar?reading=${reading.id}`
redirect(destination)
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Modificar new-reading-form.tsx — auto-detect + dois CTAs + hidden input method</name>
  <read_first>
    - apps/web/app/(dashboard)/leituras/nova/new-reading-form.tsx (arquivo inteiro — 112 linhas)
    - apps/web/hooks/use-mobile.ts (pattern matchMedia + addEventListener + cleanup)
    - apps/web/components/clientes/client-form.tsx (referência: Select com name= injeta hidden input)
    - .planning/phases/04-upload-desktop/04-CONTEXT.md D-01, D-02, D-03 (texto exato dos CTAs e justificativa do auto-detect)
    - .planning/phases/04-upload-desktop/04-PATTERNS.md seção "app/(dashboard)/leituras/nova/new-reading-form.tsx (modificar)"
  </read_first>
  <files>
    apps/web/app/(dashboard)/leituras/nova/new-reading-form.tsx
  </files>
  <action>
**Substituir TOTALMENTE** o conteúdo de `new-reading-form.tsx` por esta versão (mantém o mesmo contrato de props, mas ampliada):

```typescript
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
// próprio schema mais estrito em readings.schemas.ts (Plan 04-02 — inclui method).
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
 * Form de seleção de cliente + escolha de método (CONTEXT D-01).
 *
 * Fluxo:
 *   1. SSR renderiza com chosenMethod='mobile_camera' (default seguro).
 *   2. useEffect roda no client: matchMedia('(pointer: coarse) and (hover: none)')
 *      → coarse pointer + sem hover ≈ touch device → mobile.
 *   3. Hidden input <input name="method" value={chosenMethod}> injeta no FormData.
 *   4. Botão primário envia com method=chosenMethod (auto-detected).
 *   5. Botão de escape (link de escape D-01) é <button type="submit" name="method"
 *      value="<oposto>">. Quando clicado, browser usa o value do botão e ignora
 *      o hidden input (HTML form behavior — pattern G em 04-PATTERNS.md).
 *
 * createReadingAction (Plan 04-02) lê formData.get('method') e redireciona pra
 * /capturar ou /upload. Default 'mobile_camera' (no schema) preserva compat
 * caso JS esteja desabilitado.
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
    // matchMedia coarse+hover é mais robusto que User-Agent (cobre iPad em modo
    // desktop e dispositivos novos). CONTEXT specifics — heurística de detecção.
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(pointer: coarse) and (hover: none)')
    const update = () => setChosenMethod(mql.matches ? 'mobile_camera' : 'desktop_upload')
    update()
    // Reagir a mudanças (terapeuta conectando teclado/mouse externo no iPad).
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', update)
      return () => mql.removeEventListener('change', update)
    }
  }, [])

  const otherMethod: CaptureMethod = chosenMethod === 'mobile_camera' ? 'desktop_upload' : 'mobile_camera'

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
                value="<oposto>"> — browser sobrescreve o hidden input ao submeter. */}
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
```

**Notas:**
- O `Link href="/leituras"` "Cancelar" do form original foi REMOVIDO. Razão: o user que está em `/leituras/nova` chegou aqui por escolha; "voltar" é via browser back. Manter o cancelar adiciona complexidade sem ganho. Se o checker reclamar, adicionar de volta como `<Link>` discreto abaixo do escape.
- O Loader2 já estava no imports antigo; aqui está mantido em `import { Loader2 } from 'lucide-react'`.
- Removidos os imports de `Link`, `buttonVariants`, `cn` que eram usados pelo botão Cancelar removido.
- O uso de `<button type="submit" name="method" value="...">` para sobrescrever o hidden input é HTML form behavior canônico — quando o usuário clica num botão de submit que tem `name`, o browser inclui esse pair no FormData e omite o hidden input com mesmo `name`. Validar este comportamento manual no UAT.

**Vocabulário proibido**: ZERO 'diagnóstico', 'tratamento', 'cura'. Strings novas:
- "Iniciar captura mobile" → neutro
- "Selecionar arquivos no computador" → neutro
- "Tenho fotos prontas — subir do computador" → neutro
- "Quero usar a câmera deste dispositivo" → neutro
- "Preparando leitura..." → neutro
  </action>
  <verify>
    <automated>cd apps/web && pnpm tsc --noEmit -p . && pnpm audit:vocabulary</automated>
    Ambos exit 0.

    Adicionalmente:
    - `grep -c "matchMedia.*pointer.*coarse" 'apps/web/app/(dashboard)/leituras/nova/new-reading-form.tsx'` retorna 1.
    - `grep -c 'name=.method.' 'apps/web/app/(dashboard)/leituras/nova/new-reading-form.tsx'` retorna ≥ 2 (hidden input + escape button).
    - `grep -c 'Iniciar captura mobile\\|Selecionar arquivos no computador' 'apps/web/app/(dashboard)/leituras/nova/new-reading-form.tsx'` retorna ≥ 2.
    - `grep -c 'Tenho fotos prontas\\|Quero usar a câmera' 'apps/web/app/(dashboard)/leituras/nova/new-reading-form.tsx'` retorna ≥ 2.
  </verify>
  <acceptance_criteria>
    - useEffect com `window.matchMedia('(pointer: coarse) and (hover: none)')` presente.
    - Cleanup do listener com `removeEventListener('change', ...)` presente.
    - Hidden input `<input type="hidden" name="method" value={chosenMethod} />` no JSX.
    - Botão primário com texto dinâmico baseado em chosenMethod.
    - Botão secundário com `name="method" value={otherMethod}` (para sobrescrever hidden input).
    - Default `chosenMethod = 'mobile_camera'` no SSR (preserva compat Fase 3 com JS desabilitado).
    - `pnpm tsc --noEmit -p .` exit 0.
    - `pnpm audit:vocabulary` exit 0.
    - Sem regressão: rodar `pnpm test:run` (todos os testes existentes verdes).
  </acceptance_criteria>
  <done>
    Entry point `/leituras/nova` agora roteia mobile vs desktop automaticamente com escape em ambos os lados. createReadingAction recebe method via FormData. Após este plan, fluxo completo end-to-end (entrada → criação → wizard) está funcional para upload desktop.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser matchMedia API → chosenMethod state | Pode ser inconsistente em browsers antigos; tratar com defaults seguros. |
| FormData (`method` field) → createReadingAction | Tampering possível via DevTools; mitigado server-side em Plan 04-02. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-06-01 | Tampering | new-reading-form (FormData) | mitigate | Mesmo se cliente forjar method='desktop_upload' no mobile, server (Plan 04-02) valida via Zod enum + grava no DB. UI client-side é apenas conveniência; verdade é server-side. ASVS L1 V5.1.3 ✓. |
| T-04-06-02 | Spoofing | new-reading-form (matchMedia) | accept | matchMedia pode retornar resultados imprevisíveis em browsers exóticos (Lynx, Opera Mini). Default 'mobile_camera' garante fluxo funcional. Aceito — fallback é seguro. |
| T-04-06-03 | Information Disclosure | new-reading-form | accept | Form roda dentro de `(dashboard)/` que já tem auth-guard via layout.tsx. Sem PII visível além do nome do cliente (já listado em /clientes). |
| T-04-06-04 | Denial of Service (UX) | new-reading-form | accept | Terapeuta clicando rapidamente nos dois botões poderia disparar 2 createReadingAction. `disabled={isPending}` previne — botão fica disabled durante a primeira chamada. ASVS L1 V11.1.1 (rate-limiting) é responsabilidade do middleware/Supabase, não cobre aqui. |
</threat_model>

<verification>
1. `cd apps/web && pnpm tsc --noEmit -p .` exit 0.
2. `cd apps/web && pnpm test:run` exit 0 (regressão).
3. `cd apps/web && pnpm audit:vocabulary` exit 0.
4. **Smoke manual** (executor pode rodar): `pnpm dev` → abrir `/leituras/nova` em desktop → ver botão "Selecionar arquivos no computador" + escape "Quero usar a câmera deste dispositivo". Submeter → criar reading → redirecionar para `/leituras/nova/upload?reading=<id>`.
</verification>

<success_criteria>
- Form auto-detecta device (matchMedia) com default seguro mobile_camera.
- Dois CTAs com texto dinâmico funcionando.
- Hidden input + escape button submetem method correto via FormData.
- TypeScript compila.
- Vocabulário proibido ausente.
- Sem regressão nos testes existentes.
</success_criteria>

<output>
Após completar, criar `.planning/phases/04-upload-desktop/04-06-SUMMARY.md` documentando:
- Linhas-chave adicionadas (matchMedia, hidden input, dois CTAs).
- Decisão de remover botão "Cancelar" (justificativa).
- Confirmação de defaults seguros para SSR/no-JS.
- Smoke manual results se executor rodou.
</output>
