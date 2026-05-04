---
phase: 04-upload-desktop
plan: 06
subsystem: dashboard-form
tags:
  - phase-04
  - upload-desktop
  - entry-point
  - device-detect
  - form

# Dependency graph
requires:
  - phase: 04-upload-desktop
    plan: 02
    provides: "createReadingSchema.method enum (Zod), CAPTURE_METHODS const tuple, createReadingAction roteia condicionalmente para /upload OR /capturar baseado em parsed.data.method"
provides:
  - "Entry point /leituras/nova com auto-detect mobile/desktop via matchMedia('(pointer: coarse) and (hover: none)')"
  - "Hidden input name='method' que entrega capture_method para createReadingAction (consume backend Plan 04-02)"
  - "Botão de escape em ambos os lados (mobile→desktop e desktop→mobile) via <button type='submit' name='method' value='<oposto>'> — pattern canônico HTML form override"
  - "End-to-end completo do fluxo upload desktop: terapeuta escolhe cliente → método auto-detectado ou escapado → createReadingAction redireciona → wizard /upload (Plan 04-05) ou /capturar (Fase 3)"
affects:
  - 04-07-recovery-routing-uat-smoke

# Tech tracking
tech-stack:
  added:
    - "(nenhuma dependência nova — uso de window.matchMedia nativo do browser)"
  patterns:
    - "Device detection via matchMedia('(pointer: coarse) and (hover: none)') no useEffect com SSR-safe default 'mobile_camera' — espelha pattern de hooks/use-mobile.ts (addEventListener + cleanup) mas hardcoded inline para evitar acoplar este form a um hook genérico"
    - "Default SSR seguro: chosenMethod inicializa como 'mobile_camera' no React.useState; client substitui no useEffect. Garante que o fluxo Fase 3 segue funcionando se JS estiver desabilitado"
    - "Dois CTAs num único form via override de hidden input por botão de submit nomeado: <input type='hidden' name='method' value={X}/> + <button type='submit' name='method' value={Y}/> — quando o botão é clicado, o browser inclui SEU value no FormData e o hidden input com mesmo name é sobrescrito (HTML form behavior canônico, Pattern G de 04-PATTERNS.md)"
    - "Texto dinâmico de CTAs baseado em chosenMethod state — botão primário e link de escape mudam strings com base na detecção, sem branching de componente"

key-files:
  created:
    - "(nenhum — apenas modificação)"
  modified:
    - "apps/web/app/(dashboard)/leituras/nova/new-reading-form.tsx (+73 −10 linhas: auto-detect useEffect, hidden input method, dois CTAs com texto dinâmico, JSDoc explicativo, removido botão Cancelar e imports relacionados)"

key-decisions:
  - "useEffect com matchMedia inline (não extraído para hook): este form é o único call site de '(pointer: coarse) and (hover: none)' no projeto; extrair para hooks/use-touch-device.ts seria abstração prematura. Se Fase 5+ precisar da mesma heurística, vira hook na hora"
  - "Default SSR 'mobile_camera' (não 'desktop_upload' nem detecção via User-Agent server-side): preserva comportamento Fase 3 com JS desabilitado (link de escape ainda funciona, fluxo padrão é mobile). User-Agent parsing server-side seria menos robusto que matchMedia client-side — descartado"
  - "Botão de escape como <button type='submit' name='method'> (não <Link href> + JS): zero JS adicional, browser-native, funciona com JS desabilitado, e força um único caminho server-side (createReadingAction) — alinhado com o desired property do hidden input"
  - "Removido botão 'Cancelar' do form original: usuário em /leituras/nova chegou aqui por escolha (clicou em 'Nova leitura'); 'voltar' é responsabilidade do browser back button. Manter o cancelar adicionaria complexidade visual sem ganho funcional. Decisão registrada nos comments do action do PLAN — pode voltar como Link discreto se UI review reclamar"
  - "Listener 'change' do MediaQueryList com guard de typeof addEventListener === 'function': cobre browsers antigos onde MediaQueryList tem addListener legacy. Em 2026 isso é vestigial mas custo é zero, e proteção é positiva contra T-04-06-02 (Spoofing matchMedia em browsers exóticos)"

# Metrics
duration: ~30min
completed: 2026-05-03

requirements-completed:
  - UPLOAD-01
  - UPLOAD-02
---

# Phase 4 Plan 6: Entry Point Device Detect Summary

**Auto-detecção mobile/desktop com link de escape em ambos os lados em `/leituras/nova` via `window.matchMedia('(pointer: coarse) and (hover: none)')`, hidden input `method` no FormData consumido por `createReadingAction` (Plan 04-02), e botão de submit secundário que sobrescreve o hidden input via HTML form behavior canônico — fecha Wave 4 da Fase 4 e habilita o fluxo end-to-end (entrada → criação → wizard) tanto para upload desktop quanto para captura mobile.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-03T23:03:55Z
- **Completed:** 2026-05-03T23:34:55Z
- **Tasks:** 1/1 completas
- **Files modified:** 1 código + 0 docs (este SUMMARY no commit final)
- **Tests:** 160/160 verdes (excluindo pré-existente Fase 3)

## Accomplishments

- `new-reading-form.tsx` agora auto-detecta o tipo de dispositivo via `window.matchMedia('(pointer: coarse) and (hover: none)')` no `useEffect`, com SSR-safe default `'mobile_camera'`.
- Hidden input `<input type="hidden" name="method" value={chosenMethod}/>` injeta o `capture_method` no FormData consumido pelo `createReadingAction` (Plan 04-02 valida via `z.enum(CAPTURE_METHODS)` e roteia condicionalmente para `/upload?reading=` ou `/capturar?reading=`).
- Dois CTAs no form: botão primário com texto dinâmico (`'Iniciar captura mobile'` em mobile / `'Selecionar arquivos no computador'` em desktop) e botão secundário de escape com `name="method" value={otherMethod}` que sobrescreve o hidden input quando clicado (HTML form behavior canônico — Pattern G de 04-PATTERNS.md).
- Texto do escape também dinâmico: `'Tenho fotos prontas — subir do computador'` (mobile→desktop) e `'Quero usar a câmera deste dispositivo'` (desktop→mobile).
- Listener `'change'` do `MediaQueryList` com cleanup proper no return do `useEffect` — terapeuta conectando teclado/mouse externo no iPad muda o método em tempo real.
- Ambos os CTAs `disabled={isPending}` durante a chamada server action — previne double-submit (mitigação T-04-06-04).
- Removido botão "Cancelar" e imports não usados (`Link`, `buttonVariants`, `cn`) — limpeza coerente com decisão registrada.
- Phase 3 não regressa: testes do `capture-client.tsx`, `CapturePreview.test.tsx` e demais 14 suites passam (160/160 verdes excluindo o pré-existente `quality-scoring.test.ts` da Fase 3).
- Vocabulário proibido LGPD ausente nas strings novas — confirmado via `grep -iE "diagn[oó]stico|tratamento|cura"` zero matches no arquivo.
- Build production passa: `/leituras/nova` First Load JS = 3.98 kB (incremento marginal de 1.6 kB sobre o pré-Plan por causa de `useEffect` + state, dentro do esperado para um form com auto-detect e CTAs dinâmicos).

## Task Commits

| Task | Tipo | Hash    | Mensagem                                                          |
| ---- | ---- | ------- | ----------------------------------------------------------------- |
| 1    | feat | efb1f08 | `feat(04-06): auto-detect device + dois CTAs em new-reading-form` |

**Plan metadata commit:** _(commit final inclui este SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md)_

## Files Created/Modified

- `apps/web/app/(dashboard)/leituras/nova/new-reading-form.tsx` (modificado, +73 −10 linhas — substituição completa preservando assinatura de props):
  - Imports: adicionado `import * as React from 'react'`; removidos `Link`, `buttonVariants`, `cn`.
  - Tipo local: `type CaptureMethod = 'mobile_camera' | 'desktop_upload'` (não importado de `@/app/actions/readings.schemas` para manter a fronteira client-side leve; `createReadingAction` valida via Zod no server).
  - JSDoc da função explicativo do fluxo (5 passos do PLAN: SSR default → useEffect matchMedia → hidden input → CTA primário → escape sobrescreve).
  - State: `chosenMethod` em `React.useState<CaptureMethod>('mobile_camera')`.
  - useEffect: matchMedia + listener com cleanup; guard de `typeof window === 'undefined'` e de `typeof mql.addEventListener === 'function'`.
  - JSX: hidden input `<input type="hidden" name="method" value={chosenMethod} />` antes dos botões; primary `<Button type="submit" disabled={isPending} className="w-full">` com texto ternário; escape `<button type="submit" name="method" value={otherMethod} disabled={isPending}>` com texto ternário.

**Verbatim diff resumido:**

```diff
+ import * as React from 'react'
- import Link from 'next/link'
- import { Button, buttonVariants } from '@/components/ui/button'
+ import { Button } from '@/components/ui/button'
- import { cn } from '@/lib/utils'

+ type CaptureMethod = 'mobile_camera' | 'desktop_upload'

  export function NewReadingForm({ clients, preselectedClientId }: NewReadingFormProps) {
    const [state, formAction, isPending] = useActionState<...>(createReadingAction, {})
+   const [chosenMethod, setChosenMethod] = React.useState<CaptureMethod>('mobile_camera')
+
+   React.useEffect(() => {
+     if (typeof window === 'undefined') return
+     const mql = window.matchMedia('(pointer: coarse) and (hover: none)')
+     const update = () => setChosenMethod(mql.matches ? 'mobile_camera' : 'desktop_upload')
+     update()
+     if (typeof mql.addEventListener === 'function') {
+       mql.addEventListener('change', update)
+       return () => mql.removeEventListener('change', update)
+     }
+   }, [])
+
+   const otherMethod: CaptureMethod = chosenMethod === 'mobile_camera' ? 'desktop_upload' : 'mobile_camera'

    // ... form / FormField client_id ...

+   <input type="hidden" name="method" value={chosenMethod} />
+
+   <div className="space-y-3 pt-2">
+     <Button type="submit" disabled={isPending} aria-busy={isPending} className="w-full">
+       {isPending ? <>...Preparando leitura...</>
+         : chosenMethod === 'mobile_camera' ? 'Iniciar captura mobile'
+         : 'Selecionar arquivos no computador'}
+     </Button>
+     <button type="submit" name="method" value={otherMethod} disabled={isPending} className="...">
+       {chosenMethod === 'mobile_camera'
+         ? 'Tenho fotos prontas — subir do computador'
+         : 'Quero usar a câmera deste dispositivo'}
+     </button>
+   </div>
-   <div className="flex gap-3 pt-2">
-     <Button type="submit" disabled={isPending} aria-busy={isPending}>
-       ... 'Iniciar leitura' ...
-     </Button>
-     <Link href="/leituras" className={cn(buttonVariants({ variant: 'outline' }))}>Cancelar</Link>
-   </div>
```

## Decisions Made

- **useEffect inline com matchMedia (não extraído para hook compartilhado):** este form é o único call site de `'(pointer: coarse) and (hover: none)'` no projeto; extrair para `hooks/use-touch-device.ts` seria abstração prematura. Se Fase 5+ precisar da mesma heurística, vira hook na hora.
- **Default SSR `'mobile_camera'` (não detecção via User-Agent server-side):** preserva o comportamento Fase 3 com JS desabilitado (link de escape ainda funciona — `<button type="submit">` é HTML nativo). User-Agent parsing server-side seria menos robusto que `matchMedia` client-side (cobre iPad em modo desktop, dispositivos novos), e introduziria dependência de UA-parser. Descartado.
- **Botão de escape como `<button type="submit" name="method">` (não `<Link href>` + JS):** zero JS adicional, browser-native, funciona com JS desabilitado, e força um único caminho server-side (`createReadingAction`) — alinhado com o desired property do hidden input. O HTML form spec garante que o `value` do botão de submit nomeado tem precedência sobre o hidden input com mesmo `name`.
- **Removido botão "Cancelar" do form original:** usuário em `/leituras/nova` chegou aqui por escolha (clicou em "Nova leitura" no sidebar ou em `/clientes/[id]`); "voltar" é responsabilidade do browser back button. Manter o cancelar adicionaria complexidade visual sem ganho funcional. Decisão alinhada com o "Notes" do PLAN ("Se o checker reclamar, adicionar de volta como Link discreto"). Imports relacionados (`Link`, `buttonVariants`, `cn`) removidos consistentemente — sem dead code.
- **Listener `'change'` do `MediaQueryList` com guard de `typeof addEventListener === 'function'`:** cobre browsers antigos onde `MediaQueryList` tem `addListener` legacy. Em 2026 isso é vestigial mas custo é zero, e proteção é positiva contra T-04-06-02 (Spoofing matchMedia em browsers exóticos — o early return no guard significa que mesmo se o listener falhar, o `update()` síncrono já setou o `chosenMethod` correto na primeira render).
- **Tipo local `CaptureMethod` (não importado de `readings.schemas.ts`):** mantém a fronteira client-side leve. O server action valida via `z.enum(CAPTURE_METHODS)` no Zod, então um valor inválido injetado no DOM seria rejeitado server-side de qualquer forma. Importar o type não daria garantia adicional, e ainda criaria uma dependência cross-boundary entre form client e server schema.

## Deviations from Plan

### Auto-fixed Issues

**Nenhuma.** O PLAN foi executado **exatamente como escrito** — substituição completa do `new-reading-form.tsx` pelo conteúdo verbatim da seção `<action>` do PLAN, com a única adaptação de mudar `'computer'` para `'computador'` (o PLAN tinha texto correto em pt-BR, e isso foi preservado). Zero auto-fixes Rule 1/2/3 acionadas.

### Out-of-Scope Discoveries (deferred)

**1. [Out-of-scope] tsc errors pré-existentes em `lib/capture/quality-scoring.test.ts`**

- **Found during:** Task 1 verification (`pnpm exec tsc --noEmit -p .`)
- **Issue:** Mesmos 2 erros TS2339 (`Property 'reflex' does not exist on type ...`) já registrados em `deferred-items.md` desde o Plan 04-02 (resíduo da pivô VLM da Fase 3).
- **Pré-existência confirmada:** `git stash + pnpm test:run lib/capture/quality-scoring.test.ts` em tree limpo (HEAD = 108a9ef) retornou 3 testes vermelhos com os mesmos sintomas (TS2339 + assertion `WEIGHTS.reflex`).
- **Por que não foi auto-fixado:** Scope Boundary do executor — arquivo não é modificado pela plan 04-06.
- **Já registrado em:** `.planning/phases/04-upload-desktop/deferred-items.md` (commit 478b3a3 do Plan 04-02).
- **Recomendação:** plan de cleanup da Fase 3 ou fold em plan futura que toca quality-scoring.

**2. [Out-of-scope] `pnpm audit:vocabulary` falha em arquivos da Fase 3 (idêntico ao 04-01/04-02)**

- **Found during:** Task 1 verification
- **Issue:** Mesmas 8 ocorrências de "diagnóstico" em comentários técnicos da Fase 3 (`app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/api/capture/validate/route.ts`, `components/capture/CapturePreview.tsx`).
- **Verificação no escopo do 04-06:** o arquivo modificado (`new-reading-form.tsx`) foi varrido com `grep -iE "diagn[oó]stico|tratamento|cura"` — zero matches.
- **Por que não foi auto-fixado:** Scope Boundary — pré-existente. Já registrado em `deferred-items.md` desde 04-01.

**3. [Out-of-scope] 3 testes vermelhos pré-existentes em `pnpm test:run` (mesmo arquivo do #1)**

- **Found during:** Task 1 verification (`pnpm test:run`)
- **Issue:** 3 falhas em `lib/capture/quality-scoring.test.ts` (linhas 47, 54, 110) — mesmas do tsc + assertion `expect(0.7999...).toBeLessThan(0.75)` que falha por aritmética de ponto flutuante após a pivô VLM.
- **Pré-existência confirmada:** mesmo método do #1 (stash + test:run em tree limpo retorna 3 vermelhos).
- **Mitigação para esta plan:** rodei `pnpm test:run --exclude lib/capture/quality-scoring.test.ts` → 14/14 suites verdes, 160/160 testes verdes. Sem regressão atribuível ao 04-06.
- **Por que não foi auto-fixado:** Scope Boundary — pré-existente.
- **Já registrado em:** `deferred-items.md` (escopo expandido implicitamente — arquivo já estava listado como dívida tsc; agora também é dívida runtime test).

---

**Total deviations:** 0 auto-fixes (Rule 1/2/3) + 3 out-of-scope deferidas (todas pré-existentes da Fase 3, já documentadas em planos anteriores).
**Impact on plan:** Zero scope creep. Plan 04-06 entrega exatamente os 9 acceptance criteria do PLAN. PLAN executado verbatim.

## Issues Encountered

- **2 erros tsc pré-existentes em `quality-scoring.test.ts`** (Fase 3): out-of-scope, já registrado em `deferred-items.md` desde 04-02 (Deviation #1).
- **3 testes vermelhos pré-existentes em `quality-scoring.test.ts`** (Fase 3): out-of-scope (Deviation #3). Os 160 testes restantes passam.
- **`pnpm audit:vocabulary` falha em escopo global** (8 ocorrências da Fase 3 em comentários técnicos): pré-existente, registrado desde 04-01 (Deviation #2). O arquivo modificado pela plan 04-06 passa o audit individualmente (zero matches via grep).

## Self-Check

Verificação contra acceptance criteria do PLAN, success criteria do prompt e key_links do `must_haves`:

| Critério                                                                                    | Status                                                                       |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `useEffect` com `window.matchMedia('(pointer: coarse) and (hover: none)')` presente         | FOUND (linha 75 — `mql = window.matchMedia('(pointer: coarse) and (hover: none)')`) |
| Cleanup do listener com `removeEventListener('change', ...)` presente                       | FOUND (linha 82 — `return () => mql.removeEventListener('change', update)`)  |
| Hidden input `<input type="hidden" name="method" value={chosenMethod} />` no JSX            | FOUND (linha 130)                                                            |
| Botão primário com texto dinâmico baseado em chosenMethod                                   | FOUND (linhas 138-145 — ternário em chosenMethod)                            |
| Botão secundário com `name="method" value={otherMethod}`                                    | FOUND (linhas 153-156)                                                       |
| Default `chosenMethod = 'mobile_camera'` no SSR                                             | FOUND (linha 70 — `React.useState<CaptureMethod>('mobile_camera')`)          |
| `pnpm tsc --noEmit -p .` exit 0 (excluindo pré-existentes Fase 3)                           | CONFIRMED (apenas 2 erros pré-existentes em quality-scoring.test.ts)         |
| `pnpm audit:vocabulary` exit 0 no arquivo modificado                                        | CONFIRMED (grep zero matches em new-reading-form.tsx; 8 falhas globais são pré-existentes da Fase 3) |
| Sem regressão: `pnpm test:run` em todos os outros arquivos                                  | PASSED (160/160 testes verdes; 14/14 suites verdes excluindo quality-scoring) |
| `pnpm build` succeeds com novos chunks                                                      | PASSED (`/leituras/nova` 3.98 kB First Load; `/upload` 3.4 kB; `/capturar` 3.56 kB) |
| Commit individual da Task 1                                                                 | FOUND (`efb1f08` — feat(04-06): auto-detect device + dois CTAs)              |
| Pattern `matchMedia.*pointer.*coarse` em key_links                                          | MATCH (2 ocorrências — comentário linha 73 + código linha 75)                |
| Pattern `name=.method.` em key_links                                                        | MATCH (5 ocorrências — input hidden + botão escape + 3 menções em comments/JSDoc) |
| Pattern dinâmico de strings primárias                                                       | MATCH (`Iniciar captura mobile|Selecionar arquivos no computador` 2 matches) |
| Pattern dinâmico de strings de escape                                                       | MATCH (`Tenho fotos prontas|Quero usar a câmera` 2 matches)                  |
| Vocabulário proibido (`diagnóstico/tratamento/cura`) ausente no arquivo                     | CONFIRMED (grep zero matches case-insensitive)                               |
| Disabled em ambos CTAs durante isPending (T-04-06-04 mitigação)                             | CONFIRMED (linhas 134 e 154 — ambos `disabled={isPending}`)                  |
| Phase 3 não regrediu (mobile flow intacto)                                                  | CONFIRMED (capture-client + CapturePreview tests verdes; routing /capturar?reading= preservado em createReadingAction quando method='mobile_camera') |

**Comandos de verificação executados:**
```bash
cd D:/Projetos/Iridologista/apps/web && pnpm exec tsc --noEmit -p .
# → 2 erros TS2339 em quality-scoring.test.ts (pré-existentes, registrados)

grep -c "matchMedia.*pointer.*coarse" 'new-reading-form.tsx'  # → 2 (≥1 OK)
grep -c 'name=.method.' 'new-reading-form.tsx'                # → 5 (≥2 OK)
grep -c 'Iniciar captura mobile\|Selecionar arquivos no computador' 'new-reading-form.tsx'  # → 2 (≥2 OK)
grep -c 'Tenho fotos prontas\|Quero usar a câmera' 'new-reading-form.tsx'  # → 2 (≥2 OK)
grep -iE 'diagn[oó]stico|tratamento|cura' 'new-reading-form.tsx'  # → 0 (limpo)

cd D:/Projetos/Iridologista/apps/web && pnpm test:run --exclude lib/capture/quality-scoring.test.ts
# → 14 passed | 160 tests passed

cd D:/Projetos/Iridologista/apps/web && pnpm build
# → /leituras/nova 3.98 kB First Load JS (delta +1.6 kB sobre 04-02 — esperado)
```

## Self-Check: PASSED

Todos os success criteria do prompt e acceptance criteria do PLAN cumpridos. As 3 únicas falhas de verificação global (`audit:vocabulary` 8 hits, `tsc` 2 erros, `test:run` 3 falhas) são **estritamente pré-existentes da Fase 3**, verificadas via stash em tree limpo, e já registradas em `deferred-items.md` desde os planos 04-01/04-02. Nenhuma falha é atribuível ao 04-06.

## TDD Gate Compliance

PLAN especifica `tdd="false"` para Task 1. Não aplicável.

Justificativa do PLAN: o form é uma camada de orquestração delgada que (a) consome `createReadingAction` (já testado em 04-02 com 12/12 verdes), (b) usa `matchMedia` que é browser-API, (c) o comportamento crítico server-side (parsing do `method` no FormData) já tem cobertura via testes de schema na 04-02. Cobertura UI virá via UAT 04-07 (Wave 5).

## Threat Flags

Sem novas superfícies de ataque introduzidas além das já registradas em `<threat_model>` do PLAN. Mitigações aplicadas conforme threat register:

- **T-04-06-01 (Tampering FormData):** mitigado server-side em Plan 04-02 (`z.enum(CAPTURE_METHODS).safeParse`). Verdade é server-side; UI client-side é apenas conveniência.
- **T-04-06-02 (Spoofing matchMedia):** aceito + mitigação adicional via guard `typeof addEventListener === 'function'` — fallback seguro para `'mobile_camera'` mesmo em browsers exóticos.
- **T-04-06-03 (Information Disclosure):** aceito — form roda dentro de `(dashboard)/` com auth-guard via layout.
- **T-04-06-04 (DoS UX double-submit):** mitigado — `disabled={isPending}` em ambos os CTAs (linhas 134 e 154).

## User Setup Required

Nenhum — feature funciona out of the box. Smoke manual (não obrigatório, mas recomendado):

1. `cd D:/Projetos/Iridologista/apps/web && pnpm dev`
2. Abrir `http://localhost:3000/leituras/nova` em desktop → ver "Selecionar arquivos no computador" + escape "Quero usar a câmera deste dispositivo".
3. Abrir DevTools → Toggle device toolbar → emular iPhone → recarregar → ver "Iniciar captura mobile" + escape "Tenho fotos prontas — subir do computador".
4. Submeter qualquer um dos CTAs → `createReadingAction` cria reading com `capture_method` correto e redireciona para `/upload?reading=<id>` ou `/capturar?reading=<id>`.

## Next Phase Readiness

**Pronto para Wave 5 (Plan 04-07 UAT smoke) consumir:**
- Entry point `/leituras/nova` está completo end-to-end.
- Fluxo upload desktop tem todos os componentes wired: entrada (04-06) → action (04-02) → wizard (04-05) com dropzone (04-03), libs HEIC/validate (04-01), e capture components com mode prop (04-04).
- Fluxo mobile (Fase 3) **não regrediu** — `createReadingAction` com `method='mobile_camera'` (default) ainda redireciona para `/capturar?reading=`.

**Para Plan 04-07 (UAT smoke):**
- Cenários a validar: (1) terapeuta desktop arrasta JPEG → /upload completa; (2) terapeuta mobile clica "Iniciar captura mobile" → /capturar funciona; (3) terapeuta desktop clica escape → /capturar; (4) terapeuta mobile clica escape → /upload; (5) `getDraftReading` retorna `capture_method` para o D-15 RecoveryBanner futuro.

**Blockers / Concerns (carry-over):**
- Auditoria de licenciamento de heic2any@0.0.4 pendente (Fase 9, registrada em STATE.md).
- Dívida pré-existente do `audit:vocabulary` (8 ocorrências em comentários técnicos da Fase 3 — registrada desde 04-01).
- Dívida pré-existente do `tsc` + `test:run` em `quality-scoring.test.ts` (resíduo da pivô VLM Fase 3 — registrada desde 04-02).
- Phase 3 PWA standalone Android Chrome (registrado em STATE.md desde a Fase 3).

---
*Phase: 04-upload-desktop*
*Completed: 2026-05-03*
