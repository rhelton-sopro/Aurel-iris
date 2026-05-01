---
plan_id: 03-03
phase: 3
phase_slug: captura-mobile-pwa
subsystem: backend/actions + frontend/pages
tags: [server-actions, readings, tdd, zod, rls, pwa, entry-pages]
dependency_graph:
  requires: [03-01, 03-02]
  provides:
    - createReadingAction (cria readings row status=pending, redireciona para /leituras/nova/capturar?reading=<id>)
    - finalizeReadingAction (placeholder Fase 5)
    - discardReadingAction (lista+remove Storage objects + deleta row, RLS ownership)
    - getDraftReading (query helper para RecoveryBanner D-12 em 03-08)
    - /leituras/nova (server component, select de clientes, pré-seleção via ?cliente=<id>, empty-state)
    - /leituras/nova/upload (placeholder D-15 — rota existe para CameraDeniedScreen em 03-04)
    - Botão "Nova Leitura" em /clientes/[id] ativo (Link → /leituras/nova?cliente=<id>)
  affects:
    - apps/web/app/(dashboard)/clientes/[id]/page.tsx (Button disabled → Link)
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN com vitest 2.1.9 para Zod schemas
    - Server action com 'use server' + getUser() server-side + Zod v4.4.1 .uuid() (RFC 9562)
    - useActionState + Form + Select base-ui com name prop (hidden input no FormData)
    - getDraftReading com PostgREST nested select (reading_images(count))
key_files:
  created:
    - apps/web/app/actions/readings.ts
    - apps/web/app/actions/readings.test.ts
    - apps/web/app/(dashboard)/leituras/nova/page.tsx
    - apps/web/app/(dashboard)/leituras/nova/new-reading-form.tsx
    - apps/web/app/(dashboard)/leituras/nova/upload/page.tsx
  modified:
    - apps/web/app/(dashboard)/clientes/[id]/page.tsx
decisions:
  - "Zod v4.4.1 usa regex RFC 9562 estrita para .uuid() — UUIDs sintéticos como 11111...1111 são rejeitados; testes usam UUIDs gerados por crypto.randomUUID()"
  - "discardReadingAction: Storage remove é best-effort (erro não bloqueia delete da row) — blobs órfãos são piores que uma falha silenciosa de cleanup"
  - "getDraftReading: PostgREST reading_images(count) retorna count como number no objeto — cast explícito (r.reading_images?.[0]?.count as number | undefined) tratado no código"
  - "finalizeReadingAction: status não muda nesta fase (permanece 'pending'); comentário inline 'Fase 5' documenta o ponto de extensão"
metrics:
  duration: "~11 min"
  completed_date: "2026-05-01"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 1
---

# Phase 3 Plan 03: Server Actions + Entry Pages Summary

**One-liner:** Server actions de readings (create/finalize/discard/getDraftReading) com Zod v4 + RLS ownership pattern, entry page `/leituras/nova` com select de clientes e empty-state, placeholder `/leituras/nova/upload` para D-15, e botão "Nova Leitura" em `/clientes/[id]` ativado apontando para `/leituras/nova?cliente=<id>`.

## O que foi entregue

### Task 1 — TDD: Server actions readings.ts + testes Zod schemas

**TDD RED** (commit `b7a175f`): arquivo `readings.test.ts` criado com 5 cenários de teste — falhou como esperado (módulo `readings.ts` não existia).

**TDD GREEN** (commit `7172df5`): `readings.ts` implementado, testes passando 5/5.

**Funções exportadas em `readings.ts`:**

| Export | Tipo | Descrição |
|--------|------|-----------|
| `createReadingAction` | Server Action | Insere `readings{status=pending, capture_method=mobile_camera}`, redireciona para `/leituras/nova/capturar?reading=<id>` |
| `finalizeReadingAction` | Server Action | Placeholder Fase 5 — revalida caches, não muda status |
| `discardReadingAction` | Server Action | Lista storage_paths (RLS filtra), remove blobs do bucket iris-captures, deleta row (cascade apaga reading_images) |
| `getDraftReading` | Query Helper | Retorna rascunho mais recente com `status=pending AND count(reading_images) < 6` — para RecoveryBanner D-12 |
| `createReadingSchema` | Schema Zod | Valida `client_id` UUID |
| `readingIdSchema` | Schema Zod | Valida `reading_id` UUID |
| `ReadingFormState` | Tipo | `{ error?, readingId? }` para useActionState |
| `DraftReading` | Tipo | Shape do retorno de `getDraftReading` |

**Resultado dos testes vitest:**

```
 ✓ app/actions/readings.test.ts (5 tests) 4ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  1.90s
```

Após o plano completo, o runner de todos os testes:

```
 ✓ tests/smoke.test.ts (1 test) 2ms
 ✓ app/actions/readings.test.ts (5 tests) 5ms
 ✓ hooks/use-pwa-install.test.ts (5 tests) 21ms

 Test Files  3 passed (3)
      Tests  11 passed (11)
```

### Task 2 — Entry pages + placeholder upload + ativar botão

1. **`/leituras/nova/page.tsx`** — server component: query `clients` (RLS filtra), pré-seleção via `?cliente=<id>`, empty-state com CTA "Cadastrar cliente" quando lista vazia.

2. **`/leituras/nova/new-reading-form.tsx`** — client component: `useActionState(createReadingAction)` + `<Form>` + `<Select name="client_id">` (hidden input no FormData, padrão base-ui). Loader no botão enquanto `isPending=true`.

3. **`/leituras/nova/upload/page.tsx`** — placeholder estático: "Upload no computador em breve / Disponível na Fase 4". Rota existe para que `CameraDeniedScreen` em 03-04 não dê 404 (D-15).

4. **`/clientes/[id]/page.tsx`** — substituído `<Button disabled title="Disponível em breve">` por `<Link href="/leituras/nova?cliente=${client.id}" className={cn(buttonVariants())}>`. Import de `Button` removido (não mais utilizado).

## Smoke Manual (documentado)

Fluxo testado localmente via `pnpm dev`:

1. Login como terapeuta → `/clientes/[id]` de cliente teste
2. Clicar "Nova Leitura" → URL muda para `/leituras/nova?cliente=<uuid>` (pré-seleção funcionando)
3. Submeter o form → URL muda para `/leituras/nova/capturar?reading=<uuid>` (404 esperado — rota da câmera é 03-04)
4. `/leituras/nova/upload` → placeholder em pt-BR renderiza corretamente

Nota: O 404 em `/leituras/nova/capturar` é **comportamento esperado** nesta fase. A rota será criada no plan 03-04.

## Commits

| Task | Commit | Descrição |
|------|--------|-----------|
| 1 — TDD RED | b7a175f | test(03-03): add failing Zod schema tests for readings actions (RED) |
| 1 — TDD GREEN | 7172df5 | feat(03-03): server actions readings.ts — createReading/finalize/discard/getDraftReading + Zod schemas |
| 2 — Entry pages | 30e77f2 | feat(03-03): /leituras/nova entry pages + upload placeholder + ativar botão Nova Leitura |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] UUIDs sintéticos nos testes rejeitados pelo Zod v4.4.1**
- **Found during:** Task 1 — primeiro run do vitest (TDD GREEN)
- **Issue:** O plan especificava UUIDs como `11111111-1111-1111-1111-111111111111` e `22222222-2222-2222-2222-222222222222` nos testes. O Zod v4.4.1 adota regex RFC 9562 estrita que exige: 3o bloco começar com `[1-8]`, 4o bloco começar com `[89ab]`. Esses UUIDs sintéticos falham na validação.
- **Fix:** Substituídos por UUIDs RFC v4 válidos gerados por `crypto.randomUUID()`:
  - `VALID_CLIENT_UUID = '865eaf2a-62b6-41b2-92ad-d601fd72705c'`
  - `VALID_READING_UUID = '401288f4-0f02-43aa-bdee-16d501089dc9'`
- **Files modified:** `apps/web/app/actions/readings.test.ts`
- **Commit:** 7172df5

## Verificações de segurança (threat model)

| Ameaça | Status |
|--------|--------|
| T-03-03-01: Cross-tenant client_id | Mitigado — RLS de clients na FK + therapist_id=user.id server-side |
| T-03-03-02: Discard sem ownership | Mitigado — RLS de readings filtra o DELETE; comentário "RLS garante ownership" no código |
| T-03-03-03: Storage paths antes de auth | Mitigado — listagem de reading_images é RLS-filtrada; se 0 rows, nenhum blob é tocado |
| T-03-03-04: Vocabulário proibido | Mitigado — audit:vocabulary exit 0; nenhum termo proibido em copy |

## Known Stubs

- `finalizeReadingAction`: status não muda (Fase 5 implementa a transição `pending → processing`). Comentário inline `// Fase 5: muda status para 'processing' aqui` documenta o ponto de extensão.
- `/leituras/nova/upload`: placeholder estático (Fase 4 implementa o upload real via dropzone).

## Threat Flags

Nenhum surface novo além do planejado no threat model do plan (T-03-03-01..04).

## Self-Check: PASSED

Arquivos criados verificados:
- apps/web/app/actions/readings.ts: FOUND
- apps/web/app/actions/readings.test.ts: FOUND
- apps/web/app/(dashboard)/leituras/nova/page.tsx: FOUND
- apps/web/app/(dashboard)/leituras/nova/new-reading-form.tsx: FOUND
- apps/web/app/(dashboard)/leituras/nova/upload/page.tsx: FOUND

Arquivos modificados verificados:
- apps/web/app/(dashboard)/clientes/[id]/page.tsx: FOUND (Button disabled removido, Link ativo)

Commits verificados:
- b7a175f: FOUND (test RED)
- 7172df5: FOUND (feat GREEN)
- 30e77f2: FOUND (feat entry pages)
