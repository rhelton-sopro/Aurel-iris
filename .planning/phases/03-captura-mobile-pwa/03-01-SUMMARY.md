---
plan_id: 03-01
phase: 3
phase_slug: captura-mobile-pwa
subsystem: infra/test
tags: [vitest, storage, rls, migration, types, lgpd]
dependency_graph:
  requires: []
  provides:
    - vitest runner (apps/web)
    - bucket iris-captures privado no Supabase Storage (sa-east-1)
    - 4 policies RLS folder-based em storage.objects
    - UNIQUE constraint reading_images(reading_id, eye, angle)
    - script audit:vocabulary (gate LGPD)
    - teste SQL cross-terapeuta storage RLS
  affects:
    - apps/web/package.json (scripts test/audit:vocabulary)
    - apps/web/types/database.ts (regerado)
    - supabase schema (bucket + constraint)
tech_stack:
  added:
    - vitest@2.1.9
    - "@vitejs/plugin-react@4.7.0"
    - "@testing-library/react@16.3.2"
    - "@testing-library/jest-dom@6.9.1"
    - "@testing-library/user-event@14.6.1"
    - jsdom@25.0.1
  patterns:
    - jsdom environment para testes unitários
    - audit:vocabulary Node.js puro (cross-platform, sem dependência de grep do SO)
    - storage RLS folder-based com auth.uid()::text = (storage.foldername(name))[1]
    - migration idempotente com ON CONFLICT DO NOTHING + DO $$ block para constraint
key_files:
  created:
    - apps/web/vitest.config.ts
    - apps/web/tests/setup.ts
    - apps/web/tests/smoke.test.ts
    - apps/web/scripts/audit-vocabulary.mjs
    - supabase/migrations/0004_storage_bucket_iris_captures.sql
    - supabase/tests/storage_cross_therapist_rls.sql
  modified:
    - apps/web/package.json (scripts: test, test:run, test:changed, audit:vocabulary)
    - apps/web/.gitignore (entrada Serwist: public/sw.js, public/swe-worker-*.js)
    - apps/web/types/database.ts (regerado após migration 0004)
    - pnpm-lock.yaml (novas devDependencies)
decisions:
  - "vitest.config.ts inclui css.postcss={plugins:[]} para isolar de @tailwindcss/postcss v4 (incompatível com vite 5.x em test environment)"
  - "audit:vocabulary implementado como script .mjs puro em Node.js (grep -E não disponível em Windows — cross-platform obrigatório)"
  - "storage_cross_therapist_rls.sql usa ROLLBACK em vez de DELETE explícito (trigger protect_delete do Supabase bloqueia DELETE direto em storage.objects)"
metrics:
  duration: "~15 min"
  completed_date: "2026-05-01"
  tasks_completed: 3
  files_created: 6
  files_modified: 4
---

# Phase 3 Plan 01: Wave 0 — vitest + migration 0004 + audit:vocabulary Summary

**One-liner:** vitest 2.1.9 com jsdom configurado, bucket iris-captures privado no Supabase Storage sa-east-1 com 4 policies RLS folder-based e UNIQUE constraint reading_images, e script audit:vocabulary cross-platform como gate LGPD.

## O que foi entregue

Wave 0 da Fase 3: "chão" técnico que todos os outros 7 plans desta fase dependem.

1. **vitest 2.1.9** instalado e configurado com jsdom; smoke test verde (`pnpm test:run` exit 0, "1 passed").
2. **Migration 0004** aplicada no remoto Supabase sa-east-1 às 2026-05-01: bucket `iris-captures` privado com `public=false`, `file_size_limit=10MB`, `allowed_mime_types=['image/jpeg']` + 4 policies RLS folder-based (INSERT/SELECT/UPDATE/DELETE) + UNIQUE constraint `reading_images_reading_eye_angle_unique`.
3. **`apps/web/types/database.ts`** regerado e válido (421 linhas, 2 referências a `reading_images`).
4. **`audit:vocabulary`** executado com exit 0, output: "OK: vocabulário proibido ausente".
5. **`storage_cross_therapist_rls.sql`** executado contra remoto com exit 0 (nenhum `raise exception` disparado).

## Versões exatas instaladas

| Pacote | Versão |
|--------|--------|
| vitest | 2.1.9 |
| @vitejs/plugin-react | 4.7.0 |
| @testing-library/react | 16.3.2 |
| @testing-library/jest-dom | 6.9.1 |
| @testing-library/user-event | 14.6.1 |
| jsdom | 25.0.1 |

## Outputs de verificação

### pnpm run test:run
```
RUN  v2.1.9

✓ tests/smoke.test.ts (1 test) 2ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Duration  1.72s
```

### pnpm run audit:vocabulary
```
OK: vocabulário proibido ausente
```

### supabase db push --linked (migration 0004)
```
Applying migration 0004_storage_bucket_iris_captures.sql...
NOTICE (00000): policy "..." does not exist, skipping (x4 — idempotência confirmada)
Finished supabase db push.
```
Timestamp: 2026-05-01T22:02:xx UTC

### supabase db query storage_cross_therapist_rls.sql
```
exit code 0 — nenhuma exception disparada
(NOTICE "PASS A: own=1 cross=0" e "PASS B: own=1 cross=0" visíveis via psql, não via supabase CLI)
```

## Commits

| Task | Commit | Descrição |
|------|--------|-----------|
| 1 — vitest + scripts | 31fac04 | feat(03-01): instalar vitest 2.x + smoke test + scripts test/audit:vocabulary |
| 2 — migration 0004 | 30c3129 | feat(03-01): migration 0004 — bucket iris-captures privado + RLS folder-based + unique constraint |
| 3 — storage RLS test | a88e567 | test(03-01): teste SQL cross-terapeuta de RLS storage.objects (iris-captures) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] audit:vocabulary script reescrito como Node.js puro**
- **Found during:** Task 1 verificação
- **Issue:** O script inline no package.json usava `grep -rniE` que não existe no Windows (o projeto roda em Windows 11). O comando retornava `'tratamento' não é reconhecido como um comando interno ou externo`.
- **Fix:** Criado `apps/web/scripts/audit-vocabulary.mjs` — implementação pura em Node.js usando `fs.readdirSync`/`readFileSync`/regex, sem dependência de ferramentas do SO. Cross-platform (Windows + Unix). Semântica idêntica ao script original (exit 0 = clean, exit 1 = vocabulário proibido encontrado).
- **Files modified:** `apps/web/scripts/audit-vocabulary.mjs` (criado), `apps/web/package.json` (script simplificado para `node scripts/audit-vocabulary.mjs`)
- **Commit:** 31fac04

**2. [Rule 1 - Bug] vitest.config.ts inclui `css.postcss = {plugins: []}` para compatibilidade Tailwind v4**
- **Found during:** Task 1 primeira execução de `pnpm test:run`
- **Issue:** `@tailwindcss/postcss v4` usa formato de string em `postcss.config.mjs` (`plugins: ["@tailwindcss/postcss"]`) que é incompatível com o parser PostCSS do vite 5.4.x (vitest 2.x embute vite 5.x). Erro: `Invalid PostCSS Plugin found at: plugins[0]`.
- **Fix:** Adicionado `css: { postcss: { plugins: [] } }` em `vitest.config.ts` para desabilitar processamento PostCSS nos testes (testes não precisam de CSS compilado).
- **Files modified:** `apps/web/vitest.config.ts`
- **Commit:** 31fac04

**3. [Rule 1 - Bug] storage_cross_therapist_rls.sql removeu DELETE explícito de storage.objects**
- **Found during:** Task 3 execução via `supabase db query --linked`
- **Issue:** O template do plan incluía `delete from storage.objects ...` na seção de cleanup. O Supabase tem um trigger `storage.protect_delete()` que bloqueia DELETE direto em `storage.objects` para evitar objetos órfãos (arquivos no S3 sem registro DB). Erro: `ERROR 42501: Direct deletion from storage tables is not allowed`.
- **Fix:** Removido o DELETE de `storage.objects`. Como o teste roda inteiramente em BEGIN/ROLLBACK, o ROLLBACK desfaz todos os INSERTs automaticamente — DELETE explícito era redundante. A limpeza de `auth.users` também foi removida (ROLLBACK a cobre). Constraints de unicidade em `storage.objects` (bucket_id, name) receberam `ON CONFLICT DO NOTHING` para idempotência em caso de runs sem ROLLBACK completo.
- **Files modified:** `supabase/tests/storage_cross_therapist_rls.sql`
- **Commit:** a88e567

**4. [Rule 3 - Blocking] @vitejs/plugin-react downgrade de 6.x para 4.x**
- **Found during:** Task 1 instalação de deps
- **Issue:** pnpm instalou `@vitejs/plugin-react@6.0.1` que requer `vite@^8.0.0`, mas vitest 2.x embute `vite@^5.0.0`. Peer dependency conflict.
- **Fix:** Reinstalado com `pnpm add -D @vitejs/plugin-react@^4` — versão 4.7.0 é compatível com vite 5.x. Sem quebra de funcionalidade para o uso em testes.
- **Files modified:** `apps/web/package.json`, `pnpm-lock.yaml`
- **Commit:** 31fac04

## Known Stubs

Nenhum — plano não entrega componentes de UI; entrega infraestrutura (vitest + migration + tipos + scripts).

## Threat Flags

Nenhum surface novo além do planejado no threat model do plan.

## Verificação Manual Pendente (Studio)

Conforme acceptance criteria do plan:
- Bucket `iris-captures` visível em Supabase Studio > Storage: confirmar `public=false`, `allowed_mime_types=['image/jpeg']`.
- Tab Policies em `storage.objects`: confirmar 4 policies com nomes "Terapeutas inserem/leem/atualizam/removem fotos em sua própria pasta/de íris".
- UNIQUE constraint em `reading_images`: confirmar via SQL `\d+ reading_images` ou Studio > Table Editor > Constraints.

## Self-Check: PASSED

Arquivos criados verificados:
- apps/web/vitest.config.ts: FOUND
- apps/web/tests/setup.ts: FOUND
- apps/web/tests/smoke.test.ts: FOUND
- apps/web/scripts/audit-vocabulary.mjs: FOUND
- supabase/migrations/0004_storage_bucket_iris_captures.sql: FOUND
- supabase/tests/storage_cross_therapist_rls.sql: FOUND

Commits verificados:
- 31fac04: FOUND
- 30c3129: FOUND
- a88e567: FOUND
