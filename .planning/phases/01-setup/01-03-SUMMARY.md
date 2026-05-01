---
phase: 01-setup
plan: 03
status: COMPLETE — Task 1 (supabase init + migration) commit 5ffc64b; Task 2 (supabase link --project-ref owgbrllpznsngrkvodyw) executada manualmente em 2026-04-30. Projeto remoto "Aurel Iris" em sa-east-1 (org fmfodhurzqupvouctcxa) linkado. Push e gen types em plan 01-04.
subsystem: infra

tags: [supabase, postgres, pgvector, hnsw, rls, lgpd, schema, migration]

requires:
  - phase: 01-setup/01
    provides: "Monorepo root + .gitignore com supabase/.branches e supabase/.temp"
provides:
  - "supabase/ inicializado via supabase CLI (config.toml + .gitignore)"
  - "supabase/config.toml com project_id = aurel-iris (D-05)"
  - "supabase/migrations/0001_initial_schema.sql verbatim do SPEC §3 + adições D-12"
  - "supabase/seed.sql vazio com header explicativo (Fase 1 não tem seed)"
  - "Schema SQL versionado em git pronto para supabase db push --linked (plan 01-04)"
pending:
  - "Task 2 (checkpoint:human-action): criar projeto Supabase remoto em sa-east-1, capturar project-ref + anon/service_role keys, supabase login, supabase link --project-ref <ref>"
affects: [01-04-supabase-push, 01-05-rls-test, 01-06-vercel-deploy]

tech-stack:
  added:
    - "Supabase CLI 2.95.4 (já instalado no host; supabase init executado em D:/Projetos/Iridologista/)"
    - "Postgres extension: vector (pgvector) — habilitada via create extension if not exists vector"
  patterns:
    - "Schema verbatim do SPEC §3 com adição mínima documentada inline (RLS enable em knowledge_chunks por necessidade lógica das policies SPEC; ver D-12)"
    - "Comentários SQL em pt-BR preservados do SPEC §3 (documentam tabelas e colunas; não traduzidos)"
    - "Ordem original SPEC §3: extensão → profiles → clients → indexes → readings → indexes → reading_images → index → knowledge_chunks → hnsw → subscriptions → RLS enables → policies"
    - "Vocabulário LGPD compliant: zero ocorrências de diagnóstico/tratamento/cura em supabase/ (auditado via grep)"

key-files:
  created:
    - supabase/.gitignore
    - supabase/config.toml
    - supabase/migrations/0001_initial_schema.sql
    - supabase/seed.sql
  modified: []

key-decisions:
  - "project_id = aurel-iris (não 'Iridologista' default do dir): nome explícito do projeto remoto, alinhado com D-05 e branding."
  - "Adição mínima documentada: alter table knowledge_chunks enable row level security (não está literal no SPEC §3; comentário inline explica que sem ela a policy de SELECT do SPEC §3 fica inerte; ver D-12)."
  - "3 policies adicionais (profiles/reading_images/subscriptions) por D-12 do CONTEXT, totalizando 6 policies (3 SPEC §3 verbatim + 3 D-12)."
  - "Validação local com supabase db reset DEFERIDA para plan 01-04 via supabase db push --dry-run --linked: Docker Desktop indisponível neste ambiente (decisão do fundador, escolha b — pular validação local; SQL será exercitado contra o DB remoto sa-east-1)."
  - "seed.sql vazio com header (Fase 1 não tem dados de seed; Fase 2+ pode adicionar perfis/clientes de demo)."

patterns-established:
  - "Migrations versionadas via supabase/migrations/NNNN_*.sql (D-07): toda alteração futura entra como nova migration, sem SQL ad-hoc no dashboard exceto debug temporário."
  - "Vocabulário proibido auditado em todo arquivo SQL: zero ocorrências de diagnóstico/tratamento/cura (PROJECT.md restrição não-negociável)."
  - "supabase/.gitignore (gerado por supabase init) ignora .branches/ e .temp/ — confirmado por git check-ignore."

requirements-completed: []
requirements-pending:
  - SETUP-03 (depende de Task 2 + plan 01-04 push remoto)
  - SETUP-04 (depende de Task 2 + plan 01-04 push remoto)

duration: ~3min (Task 1 only)
started: 2026-05-01T01:07:25Z
completed: 2026-05-01T01:10:08Z (Task 1 only — plan NÃO finalizado)
---

# Phase 1 Plan 03: Supabase Init + Initial Schema — PARTIAL Summary (Task 1 only)

**STATUS: Plan PAUSED após Task 1. Aguardando checkpoint humano de Task 2 (criar projeto Supabase remoto em sa-east-1 + supabase link --project-ref <ref>). Schema do SPEC §3 versionado em git, mas ainda não exercitado contra DB algum (Docker indisponível localmente; validação acontece em plan 01-04 via supabase db push --dry-run --linked após o link).**

## Performance

- **Duration (Task 1):** ~3 min
- **Started:** 2026-05-01T01:07:25Z
- **Completed (Task 1):** 2026-05-01T01:10:08Z
- **Tasks completed:** 1 / 2 (Task 2 = checkpoint:human-action, pending)
- **Files committed:** 4 (supabase/.gitignore, config.toml, migrations/0001, seed.sql)

## Task Status

| # | Task                                                                                              | Type                  | Status                            | Commit    |
| - | ------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------- | --------- |
| 1 | supabase init + migration 0001 com schema verbatim do SPEC §3 + adições mínimas documentadas      | auto                  | **complete**                      | `5ffc64b` |
| 2 | [HUMAN] Criar projeto Supabase remoto em sa-east-1 + linkar repo                                  | checkpoint:human-action | **pending — awaiting human checkpoint** | —         |

## Accomplishments (Task 1)

- `supabase init` executado em `D:/Projetos/Iridologista/`, criando estrutura padrão da CLI.
- `supabase/config.toml` ajustado: `project_id = "aurel-iris"` (D-05; default era `"Iridologista"` derivado do dir).
- `supabase/migrations/0001_initial_schema.sql` (148 linhas) escrito com schema completo do SPEC §3 verbatim:
  - 1 extensão: `pgvector` (`create extension if not exists vector`).
  - 6 tabelas: `profiles`, `clients`, `readings`, `reading_images`, `knowledge_chunks`, `subscriptions` — colunas, tipos, defaults e constraints **verbatim** do SPEC §3 (linhas 127-221).
  - 5 índices simples: `clients(therapist_id)`, `readings(therapist_id)`, `readings(client_id)`, `readings(status)`, `reading_images(reading_id)`.
  - 1 índice HNSW: `using hnsw (embedding vector_cosine_ops)` em `knowledge_chunks(embedding)` para busca vetorial Voyage `voyage-3` (1024 dim).
  - 6 RLS enables: 5 do SPEC §3 verbatim (`profiles`, `clients`, `readings`, `reading_images`, `subscriptions`) + 1 adição mínima documentada inline (`knowledge_chunks`, com comentário SQL explicando que sem ela a policy de SELECT do SPEC §3 fica inerte; ver D-12).
  - 6 policies: 3 do SPEC §3 verbatim (`clients`, `readings`, `knowledge_chunks` SELECT autenticado) + 3 adições D-12 (`profiles` self-only, `reading_images` via reading_id chain, `subscriptions` self-only).
- `supabase/seed.sql` vazio com header explicativo.
- Vocabulário LGPD compliant: 0 ocorrências de `diagnóstico|tratamento|cura` (case-insensitive) em `supabase/migrations/0001_initial_schema.sql` e `supabase/config.toml`.

## Task Commits

1. **Task 1:** `5ffc64b` — `feat(01-03): adiciona supabase init + migration 0001 com schema do SPEC §3`
   - Files: `supabase/.gitignore`, `supabase/config.toml`, `supabase/migrations/0001_initial_schema.sql`, `supabase/seed.sql`

**Plan metadata commit:** **NÃO criado** (plan ainda não finalizado; orquestrador criará após Task 2 humana ser completada via spawn de continuation agent).

## Files Created/Modified

### supabase/ root (Task 1)
- `supabase/.gitignore` (3 linhas úteis): gerado por `supabase init`; ignora `.branches/`, `.temp/`, `.env.keys`, `.env.local`, `.env.*.local`. `git check-ignore -v supabase/.temp` confirma o ignore funcionando.
- `supabase/config.toml` (~340 linhas, default da CLI 2.95.4): apenas linha 5 ajustada — `project_id = "aurel-iris"`. Demais defaults (portas locais 54321/54322, schemas `public`+`graphql_public`, auth.email config) são adequados para Fase 1; SMTP custom Resend é Deferred Idea para Fase 8.
- `supabase/migrations/0001_initial_schema.sql` (148 linhas): schema canônico — ver "Accomplishments" acima.
- `supabase/seed.sql` (3 linhas): header explicativo apenas.

### Snapshot da migration (estrutura)

```
-- Habilita pgvector
create extension if not exists vector;

-- 6 tabelas SPEC §3 verbatim
create table profiles ( ... );
create table clients ( ... );
  create index on clients(therapist_id);
create table readings ( ... );
  create index on readings(therapist_id);
  create index on readings(client_id);
  create index on readings(status);
create table reading_images ( ... );
  create index on reading_images(reading_id);
create table knowledge_chunks (
  ...
  embedding vector(1024),  -- voyage-3
  ...
);
  create index on knowledge_chunks using hnsw (embedding vector_cosine_ops);
create table subscriptions ( ... );

-- 6 RLS enables (5 SPEC §3 + 1 D-12 documentada inline)
alter table profiles enable row level security;
alter table clients enable row level security;
alter table readings enable row level security;
alter table reading_images enable row level security;
alter table subscriptions enable row level security;
alter table knowledge_chunks enable row level security;  -- D-12 (não SPEC §3 verbatim)

-- 6 policies (3 SPEC §3 verbatim + 3 D-12 adicionais)
create policy "Terapeutas só veem seus próprios clientes" on clients ...
create policy "Terapeutas só veem suas próprias leituras" on readings ...
create policy "Knowledge chunks são públicos pra usuários autenticados" on knowledge_chunks for select ...
create policy "Terapeutas só veem o próprio profile" on profiles ...
create policy "Terapeutas só veem imagens de suas próprias leituras" on reading_images ...
create policy "Terapeutas só veem as próprias assinaturas" on subscriptions ...
```

## Verification Performed (Task 1)

| Check                                                                       | Method                                                            | Result |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------ |
| `supabase/config.toml` existe                                               | `test -f`                                                         | OK     |
| `supabase/migrations/0001_initial_schema.sql` existe                        | `test -f`                                                         | OK     |
| `supabase/.gitignore` existe                                                | `test -f`                                                         | OK     |
| `supabase/seed.sql` existe                                                  | `test -f`                                                         | OK     |
| `project_id = "aurel-iris"` em config.toml                                  | grep linha 5                                                      | OK     |
| `create extension if not exists vector` na migration                        | grep                                                              | OK     |
| 6 `create table` (profiles, clients, readings, reading_images, knowledge_chunks, subscriptions) | grep individual          | OK     |
| `vector(1024)` (Voyage `voyage-3` dim)                                      | grep                                                              | OK     |
| `using hnsw (embedding vector_cosine_ops)`                                  | grep                                                              | OK     |
| 6 `alter table ... enable row level security` (5 SPEC + 1 D-12)             | grep                                                              | OK     |
| Exatamente 6 ocorrências de `^create policy`                                | `grep -c '^create policy'` → 6                                    | OK     |
| Vocabulário proibido (`diagnóstico|tratamento|cura`) ausente                | `grep -iE` → No matches                                           | OK     |
| `supabase/.temp/` não rastreado (gitignored)                                | `git check-ignore -v` → ignora via supabase/.gitignore:3          | OK     |
| Commit atômico Task 1                                                       | `git log` mostra `5ffc64b`                                        | OK     |
| Sem deletions inesperadas no commit                                         | `git diff --diff-filter=D HEAD~1 HEAD` → vazio                    | OK     |

## Verification DEFERRED (Docker indisponível)

Os seguintes checks do plano original **não** foram executados nesta sessão por decisão do fundador (escolha b — pular validação local; ver runtime override do prompt do orquestrador):

- `supabase start` — levantar Postgres+GoTrue+PostgREST+Storage local em Docker.
- `supabase db reset` — aplicar migration + seed em DB local limpo.
- Sanity checks via `psql`: contar 6 tabelas em `pg_tables`, 6 policies em `pg_policies`, ≥1 índice HNSW em `pg_indexes`, insert dummy de `vector(1024)` em `knowledge_chunks`.

**Mitigação:** plan 01-04 (BLOCKING push remoto + types) executará `supabase db push --dry-run --linked` contra o projeto remoto sa-east-1 após Task 2 humana — isso valida que o SQL é aceito pelo Postgres real do Supabase. Se houver erro de sintaxe ou semântica, será detectado lá. Como migration é verbatim do SPEC §3 (testado conceitualmente pelo autor da SPEC) + 1 linha trivial (`alter table ... enable row level security` — sintaxe Postgres padrão) + 3 policies seguindo padrão das 3 verbatim, o risco de surpresa é baixo.

## Deviations from Plan

### Auto-fixed Issues

Nenhum (Rule 1-3 não aplicaram). Plan executado conforme escrito, com **uma única adição explícita do runtime override** do orquestrador:

**Skip do passo 6 do `<action>` da Task 1 (validação local com `supabase db reset`).**
- **Decisão:** fundador, antes do spawn deste executor (registrada como "escolha b" no prompt).
- **Razão:** Docker Desktop não está disponível neste ambiente Windows.
- **Substituição:** validação SQL acontece em plan 01-04 via `supabase db push --dry-run --linked`.
- **Não é Rule 1-3:** é uma escolha consciente de gating tooling, documentada na chain de CONTEXT/PLAN como "validação local é nice-to-have, validação remota é obrigatória" (plan 01-04 é BLOCKING).

## Awaiting (Task 2 — Human Checkpoint)

O orquestrador (`/gsd-execute-phase 1`) ou um continuation agent precisa retomar este plan executando os passos manuais documentados em `01-03-PLAN.md` Task 2:

1. Acessar https://supabase.com/dashboard com `rhelton@gmail.com` (criar conta se necessário).
2. New project → nome `aurel-iris`, password forte salva em password manager, **region: South America (São Paulo) — sa-east-1** (D-05 não-negociável LGPD).
3. Capturar credenciais (Settings → API → Project URL, anon, service_role; Settings → General → Reference ID).
4. Salvar em password manager (NÃO commitar em arquivo do repo nesta task — plan 01-06 popula `.env.example` + Vercel envs).
5. `supabase login` (uma vez por máquina, OAuth browser).
6. `cd D:/Projetos/Iridologista && supabase link --project-ref <PROJECT_REF>` — pede database password do passo 2.
7. Sanity check: `supabase projects list` deve mostrar `aurel-iris` em sa-east-1 com status linked.
8. Resume signal: typar `approved` + colar `project-ref` na resposta para o continuation agent pegar.

**Após Task 2 ser completada pelo continuation agent**, este SUMMARY.md deverá ser **atualizado** (não recriado) para:
- Marcar Task 2 como complete + adicionar commit hash do `supabase/config.toml` que `supabase link` modifica (project_id real do remoto).
- Mover `requirements-completed` de `[]` para `[SETUP-03, SETUP-04]` (ou parcialmente, dependendo do escopo do plan 01-04).
- Adicionar seção "Plan metadata commit" com hash do commit final.
- Atualizar `status` no frontmatter para `complete`.
- Atualizar STATE.md, ROADMAP.md, REQUIREMENTS.md (não modificados nesta sessão).

**Próximo plan após 01-03 completar:** 01-04 (BLOCKING `supabase db push --linked` + `supabase gen types typescript`) na Wave 3, depois 01-05 (RLS test em remoto) e 01-06 (Vercel deploy) em Wave 4.

## Self-Check: PASSED

Files claimed in `key-files.created` verified to exist:

- `D:/Projetos/Iridologista/supabase/.gitignore` — FOUND
- `D:/Projetos/Iridologista/supabase/config.toml` — FOUND
- `D:/Projetos/Iridologista/supabase/migrations/0001_initial_schema.sql` — FOUND
- `D:/Projetos/Iridologista/supabase/seed.sql` — FOUND

Commit hash claimed verified to exist in `git log --oneline`:

- `5ffc64b feat(01-03): adiciona supabase init + migration 0001 com schema do SPEC §3` — FOUND

No state files modified (per runtime override): STATE.md, ROADMAP.md, REQUIREMENTS.md unchanged in this session — confirmed via `git status` showing only `.claude/` (out of scope) as untracked, and HEAD diff showing only the 4 supabase/ files added.
