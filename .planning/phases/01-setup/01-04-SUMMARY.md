---
phase: 01-setup
plan: 04
status: COMPLETE
subsystem: infra

tags: [supabase, postgres, pgvector, schema-push, types, blocking]

requires:
  - phase: 01-setup/03
    provides: "supabase/ inicializado, migration 0001 versionada, projeto remoto linkado"
provides:
  - "Schema do SPEC §3 aplicado no projeto Supabase remoto Aurel Iris (sa-east-1, ref owgbrllpznsngrkvodyw)"
  - "apps/web/types/database.ts gerado a partir do schema remoto (421 linhas, 6 tabelas tipadas)"
  - "Script pnpm gen:types em apps/web/package.json para repetibilidade"
affects: [01-05-rls-test, 01-06-vercel-deploy, 02-auth-dashboard]

tech-stack:
  added:
    - "Schema aplicado em PostgreSQL 17.6.1 (Supabase managed, sa-east-1)"
    - "TypeScript types gerados via supabase gen types typescript --linked"
  patterns:
    - "Validação dry-run antes de push real: supabase db push --dry-run --linked → confirma SQL antes de aplicar"
    - "gen:types como script pnpm idempotente: pnpm gen:types regenera types a partir do remoto a qualquer momento"

key-files:
  created:
    - apps/web/types/database.ts
  modified:
    - apps/web/package.json (script gen:types)

key-decisions:
  - id: "D-09 honored"
    decision: "Tipos gerados via supabase gen types typescript --linked > apps/web/types/database.ts; script pnpm gen:types adicionado em apps/web/package.json para repetibilidade."
    why: "CONTEXT.md D-09 mandata script automatizável."
  - id: "Validação local pulada (Docker ausente)"
    decision: "supabase db reset (local) substituído por supabase db push --dry-run --linked. Decisão consciente do user (escolha b) durante /gsd-execute-phase 1."
    why: "Docker Desktop não está instalado neste ambiente; o trade-off (sem playground SQL local) foi explicitamente aceito pelo fundador. dry-run cobre 90% do valor da validação."

verification:
  - check: "supabase migration list --linked mostra 0001 | 0001 (local e remote alinhados)"
    result: PASS
  - check: "apps/web/types/database.ts tem 421 linhas, parsa via tsc --noEmit sem erros"
    result: PASS
  - check: "pnpm gen:types executa idempotente e regenera o arquivo sem dirty state"
    result: PASS
  - check: "Vocabulário proibido (diagnóstico|tratamento|cura) ausente do tipo gerado"
    result: PASS

commit-hashes:
  - "(types + script): a serem committados pelo orquestrador junto com este SUMMARY"

requirements-covered:
  - SETUP-03 (schema aplicado no remoto + types gerados)

duration-minutes: ~3
---

# Plan 01-04 — Schema push + types generation

## What was built

Migration `0001_initial_schema.sql` (do plan 01-03) foi pushada para o projeto Supabase remoto **Aurel Iris** (sa-east-1, ref `owgbrllpznsngrkvodyw`). O schema do SPEC §3 — 6 tabelas, pgvector, índice HNSW, RLS em 6 tabelas, 6 policies — agora vive em PostgreSQL 17.6.1 gerenciado pela Supabase.

A partir desse schema vivo, foi gerado `apps/web/types/database.ts` (421 linhas) via `supabase gen types typescript --linked`. Esses tipos são a fonte autoritativa para qualquer query Supabase no `apps/web/` daqui pra frente — Fase 2 (Auth) e Fase 3+ usarão `Database` type pra autocompletar e type-check.

O script `pnpm gen:types` em `apps/web/package.json` foi atualizado para executar a regeneração; `pnpm` walks up até encontrar `supabase/config.toml` no root, então o script funciona de qualquer subdir.

## Sequência executada

```bash
# 1. Validação dry-run (substitui supabase db reset local — Docker ausente)
supabase db push --dry-run --linked
# Output: "Would push these migrations: 0001_initial_schema.sql" — clean

# 2. Push real
supabase db push --linked
# Output: "Applying migration 0001_initial_schema.sql... Finished supabase db push."

# 3. Verificação
supabase migration list --linked
# Output: 0001 | 0001 — local e remote alinhados

# 4. Gen types
supabase gen types typescript --linked --schema public > apps/web/types/database.ts
# 421 linhas geradas

# 5. Script pnpm
pnpm gen:types  # confirmação de idempotência
```

## Decisões e desvios

- **Docker absent → dry-run only:** decisão (b) do user durante o execute-phase. Sem `supabase start` / `supabase db reset` local. `--dry-run --linked` cobre o caso (mostra o SQL antes de aplicar). Custa: sem ambiente local pra brincar com SQL ad-hoc; mitigação via Studio web do Supabase (https://supabase.com/dashboard/project/owgbrllpznsngrkvodyw/sql/new).
- **Confirmação interativa do push:** `supabase db push --linked` mostrou prompt `[Y/n]` — confirmado manualmente. Em CI futura, usar `--include-all` ou `SUPABASE_AUTO_APPROVE_PUSH=1`.

## Arquivos modificados

- `apps/web/types/database.ts` — novo, 421 linhas, gerado do schema remoto. Substitui o `.gitkeep` que estava em `types/` desde 01-01.
- `apps/web/package.json` — script `gen:types` atualizado de placeholder pra `supabase gen types typescript --linked --schema public > types/database.ts`.

## Próximos passos

- Plan 01-05 (Wave 4): teste de RLS cross-terapeuta contra o banco REMOTO usando `psql "$SUPABASE_DB_URL"`.
- Plan 01-06 (Wave 4, em paralelo com 01-05): `.env.example` no root com 11 chaves D-11, `vercel.json` com `regions: ["gru1"]`, deploy preview.
