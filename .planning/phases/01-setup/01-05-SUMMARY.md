---
phase: 01-setup
plan: 05
status: COMPLETE
subsystem: infra-test

tags: [rls, security, lgpd, postgres, jwt, test, sa-east-1]

requires:
  - phase: 01-setup/04
    provides: "Schema 0001 aplicado no remoto Aurel Iris (sa-east-1, ref owgbrllpznsngrkvodyw); types gerados"
provides:
  - "Verificação empírica de que RLS bloqueia leitura cross-terapeuta no DB remoto"
  - "Teste SQL re-executável (idempotente, ROLLBACK no final) em supabase/tests/cross_therapist_rls.sql"
  - "Runner Node em supabase/tests/run-rls-test.mjs (re-utilizável em CI futura)"
  - "Migration 0002 inesperada (mas necessária): grants no schema public para anon/authenticated/service_role"
affects: [02-auth-dashboard, todas-fases-com-RLS]

tech-stack:
  added:
    - "pg@^8 como devDependency root (runner do teste RLS — Node + simple query protocol)"
    - "supabase/tests/ como diretório de testes SQL re-executáveis em remoto"
  patterns:
    - "Cross-therapist RLS test usando set_config('request.jwt.claims', ...) — padrão canônico Supabase pra impersonar JWT"
    - "3 níveis de assertion: CONTROL (BYPASSRLS) → OWN-DATA → CROSS-THERAPIST"
    - "Test envolto em BEGIN; ... ROLLBACK; — idempotente, nunca polui o DB remoto"

key-files:
  created:
    - supabase/migrations/0002_grant_authenticated_role.sql
    - supabase/tests/cross_therapist_rls.sql
    - supabase/tests/run-rls-test.mjs
  modified:
    - package.json (devDependencies: pg)
    - pnpm-lock.yaml

key-decisions:
  - id: "Migration 0002 adicionada por necessidade descoberta no teste"
    decision: "SPEC §3 não inclui GRANT statements. Sem isso, role authenticated recebe 'permission denied for table' antes de RLS poder filtrar — teste falhou na primeira corrida com 'permission denied for table clients'. Adicionada migration 0002 com o pattern padrão Supabase: GRANT USAGE on schema + GRANT ALL on tables/sequences/functions + ALTER DEFAULT PRIVILEGES pra novas tabelas. Isso é o que Supabase Studio injeta automaticamente quando você cria tabelas via Studio, mas não é injetado quando você aplica migrations manualmente via CLI."
    why: "Bug latente do SPEC §3. Sem fix, qualquer fase futura que use o cliente Supabase (Fase 2 Auth + Fase 3+) ia falhar imediatamente com permission_denied. Melhor pegar agora."
  - id: "Runner Node em vez de psql"
    decision: "psql não está instalado no host. supabase db query --db-url falha em multi-statement (usa prepared protocol). Solução: Node + pg package (simple query protocol, multi-statement OK)."
    why: "Pragmático. pg é package canônico Node pra Postgres. Adicionado como devDep root pra futuros re-runs (CI ou manual)."

verification:
  - check: "Migration 0002 aplicada no remoto via supabase db push --linked"
    result: PASS
  - check: "node supabase/tests/run-rls-test.mjs com SUPABASE_DB_URL setado retorna RLS_REMOTE_OK"
    result: PASS
  - check: "3 NOTICE messages capturadas: CONTROL PASS + 2× PASS"
    result: PASS
  - check: "Zero NOTICE com FAIL/ERROR"
    result: PASS
  - check: "Test cobre 4 tabelas (clients, readings, reading_images, profiles) em ambos os sentidos (A→B e B→A)"
    result: PASS

requirements-covered:
  - SETUP-04 (RLS habilitada e empiricamente verificada com teste cross-terapeuta no remoto)
  - ROADMAP §1 success criterion #4 (cross-terapeuta bloqueado por RLS)

duration-minutes: ~10 (incluindo descoberta do bug de grants e fix)
---

# Plan 01-05 — RLS cross-therapist verification (remote)

## What was tested

Empiricamente provou que, no DB Supabase remoto **Aurel Iris** (sa-east-1), as policies RLS do SPEC §3 (+ adições D-12) bloqueiam leitura cross-terapeuta nas 4 tabelas sensíveis: `clients`, `readings`, `reading_images`, `profiles`.

Estratégia 3-níveis (per CONTEXT.md D-13 + plan 01-05 verification context):
1. **CONTROL** (postgres BYPASSRLS): inserir 2 fixtures e confirmar `count(*) = 2`. Sem isso, falha silenciosa de fixture pareceria PASS de RLS.
2. **OWN-DATA** (impersonado como Terapeuta A): lê próprio cliente = 1 row. Sem isso, "RLS bloqueia tudo" seria false PASS.
3. **CROSS-THERAPIST**: Terapeuta A lê dados de Terapeuta B = 0 rows nas 4 tabelas. E espelho B → A.

Impersonação via mecanismo canônico Supabase: `set_config('request.jwt.claims', json_build_object('sub', uuid, 'role', 'authenticated')::text, true) + set local role authenticated`. Mesma forma que o GoTrue de Supabase popula claims em produção quando JWT chega no PostgREST.

## Bug pego: grants do schema public ausentes

**Achado:** SPEC §3 não inclui `grant` statements. Em PostgreSQL puro, novas tabelas pertencem ao role que rodou o `create table` (no nosso caso, `postgres`). O role `authenticated` tinha CONNECT no DB mas zero privilégio nas tabelas — primeira chamada do teste retornou `ERROR: permission denied for table clients`.

**Por que o SPEC não pegou:** Supabase Studio (UI web) injeta os grants automaticamente quando você cria tabelas via UI. Quando você aplica migrations manualmente (Supabase CLI), você precisa gerenciá-los explicitamente. O SPEC foi escrito como SQL "puro" sem assumir o context Studio.

**Fix:** Migration `0002_grant_authenticated_role.sql` aplica o pattern padrão Supabase:
- `grant usage on schema public to anon, authenticated, service_role`
- `grant all on all tables/sequences/functions in schema public to anon, authenticated, service_role`
- `alter default privileges` pra que tabelas FUTURAS criadas por postgres herdem os grants automaticamente — próximas migrations não precisam repetir.

Após push da 0002, re-run do teste passou nos 3 níveis.

**Impacto pra fases futuras:** Sem este fix, Fase 2 (Auth + Dashboard) ia bater em permission_denied imediatamente quando o terapeuta logado tentasse listar próprios clientes. Pego cedo, antes de virar bug em produção.

## Sequência executada

```bash
# 1. Setup: instalar pg como devDep root pra runner
pnpm add -D -w pg

# 2. Escrever supabase/tests/cross_therapist_rls.sql (~250 linhas SQL)
#    e supabase/tests/run-rls-test.mjs (~80 linhas Node)

# 3. Primeira tentativa
SUPABASE_DB_URL='...' node supabase/tests/run-rls-test.mjs
# → CONTROL PASS, depois "permission denied for table clients"

# 4. Diagnóstico: missing grants em schema public

# 5. Escrever supabase/migrations/0002_grant_authenticated_role.sql

# 6. Push da migration 0002
supabase db push --linked
# → applied (com warnings inofensivos sobre funções pgvector)

# 7. Re-run do teste
SUPABASE_DB_URL='...' node supabase/tests/run-rls-test.mjs
# → RLS_REMOTE_OK (3 NOTICE: CONTROL + A + B)
```

## Output do teste (capturado)

```
NOTICE: CONTROL PASS: fixture inseriu 2 clients e 2 readings (verificado com BYPASSRLS).
NOTICE: PASS: Terapeuta A le proprio cliente/reading (1+1) e e bloqueado em todas as 4 tabelas vs B (0+0+0+0).
NOTICE: PASS: Terapeuta B le proprio cliente/reading (1+1) e e bloqueado em todas as 4 tabelas vs A (0+0+0+0).

SQL executed without errors.

Notices captured: 3
  [✓] CONTROL PASS: fixture inseriu 2 clients e 2 readings
  [✓] PASS: Terapeuta A le proprio cliente
  [✓] PASS: Terapeuta B le proprio cliente

RLS_REMOTE_OK
```

## Como re-rodar

```bash
cd D:/Projetos/Iridologista
SUPABASE_DB_URL='postgresql://postgres:<senha>@db.<ref>.supabase.co:5432/postgres' \
  node supabase/tests/run-rls-test.mjs
```

A connection string vem do Supabase Dashboard → Settings → Database → Connection String → URI. **Senha aparece em chat history quando o user cola** — rotacionar antes de qualquer rollout externo (gate Estágio 2 do dogfooding).

## Próximos passos

- Plan 01-06 Task 2 (Vercel deploy + cadastrar envs reais Supabase) — executando agora.
