---
phase: 07-analise-llm
plan: 01
subsystem: database
tags: [phase-7, migration, schema, supabase, jsonb, generated-column, sa-east-1]

requires:
  - phase: 01-setup
    provides: readings table base schema (status enum, RLS por terapeuta)
  - phase: 04-upload-desktop
    provides: readings.vision_features Json column populada via webhook Modal

provides:
  - Migration 0007 aplicada ao remoto sa-east-1 (DROP+ADD ai_report_raw/ai_report_edited text → jsonb canônico report_generated/report_delivered)
  - Função IMMUTABLE PARALLEL SAFE jsonb_concat_sections_pt_br com numeric ordering (Pitfall 1 defense)
  - 2 colunas GENERATED ALWAYS AS … STORED reconstruindo text view do jsonb (retrocompat sintática)
  - 11 forward-compat columns SAC Fase 10 (D-P2)
  - CHECK constraint regeneration_count >= 0 AND <= 3 (D-S4 cost cap)
  - apps/web/types/database.ts regenerado com 13 novos campos no readings table
affects: [07-03, 07-04, 07-05, 07-06, 07-07, 07-08, 07-09, 07-10, 07-11, 10-aprendizagem-clinica]

tech-stack:
  added:
    - "PostgreSQL function jsonb_concat_sections_pt_br(jsonb) → text (immutable parallel safe)"
    - "Generated columns ai_report_raw/ai_report_edited STORED (retrocompat layer)"
  patterns:
    - "DROP+ADD em transação begin/commit (atomicidade — sem estado intermediário inconsistente)"
    - "regexp_match com cast numérico ::int + coalesce 99 sentinel para chaves sem prefixo (encerramento_disclaimer ordena por último)"
    - "DO block com if not exists em pg_constraint (idempotência cross-runs)"
    - "GENERATED column reconstrói representação text a partir de jsonb canônico (single source of truth = jsonb)"

key-files:
  created:
    - "supabase/migrations/0007_phase_7_analise_llm.sql (99 linhas)"
    - "supabase/tests/0007_jsonb_concat_order.sql (79 linhas, 3 DO blocks: numeric ordering, full 14-key shape, empty input)"
  modified:
    - "apps/web/types/database.ts (+40 linhas — 13 novos campos × Row/Insert/Update + GENERATED text columns reaparecem como string|null)"

key-decisions:
  - "D-P1 schema rebuild: drop ai_report_raw/ai_report_edited text columns + add jsonb canônicos report_generated/report_delivered + GENERATED text view; zero rows existentes confirmava safe drop"
  - "D-P2 11 forward-compat columns SAC Fase 10 adicionadas no mesmo migration: report_generated_at, report_delivered_at, edit_diff, zonas_editadas, tipo_edicao, clinical_feedback, exam_notes, feedback_collected_at, audit_metadata, regeneration_count, regeneration_log"
  - "D-P3 jsonb shape: 13 chaves numeric-prefixed (1_constituicao..13_mensagem_final) + encerramento_disclaimer sem prefixo (sentinel 99 ordena por último)"
  - "D-P4 status enum unchanged: 'pending'|'processing'|'ready'|'failed'|'edited' permanece como antes (zero CREATE TYPE no migration)"
  - "D-S4 cost cap em CHECK constraint regeneration_count >= 0 AND <= 3: defesa em profundidade no schema independente do guard server-side"
  - "Pitfall 1 numeric cast em ORDER BY: coalesce((regexp_match(key, '^(\\d+)_'))[1]::int, 99) — sem isso ordering vira lex '1, 10, 11, 12, 13, 2, 3, ...'"
  - "Migration 0006 learning aplicado: função usada em GENERATED ALWAYS AS (...) STORED é language sql immutable parallel safe; body é pure SELECT (Postgres rejeita expressões voláteis)"

patterns-established:
  - "Phase 7 jsonb-as-source-of-truth + GENERATED text retrocompat: código novo escreve em report_generated jsonb; ai_report_raw text reaparece reconstruído pela função para qualquer leitor existing (templates, exports, audit). Padrão replicável para futuras migrações que mudam shape de coluna."
  - "Smoke SQL com 3 DO blocks executável via psql sem framework: Test 1 invariant ordering, Test 2 full canonical shape, Test 3 edge case empty input. Pattern para validar funções IMMUTABLE em produção sem escrever pgTAP."

requirements-completed: [LLM-04]

duration: ~25min (Tasks 1+2: ~10 min file authoring; founder gate Task 3: ~15 min push + types regen + smoke + tsc + commit)
completed: 2026-05-08
---

# Plan 07-01: Migration 0007 — jsonb canônico + GENERATED retrocompat + SAC forward-compat

**Schema rebuild que substitui ai_report_raw/ai_report_edited text por jsonb canônico report_generated/report_delivered, mantém retrocompat sintática via GENERATED ALWAYS AS … STORED reconstruída por função IMMUTABLE PARALLEL SAFE com numeric ordering, e adiciona TODAS as 11 colunas forward-compat da Fase 10 SAC no mesmo deploy atômico.**

## Performance

- **Duration:** ~25 min total
  - Tasks 1+2 (file authoring): ~10 min
  - Task 3 (founder gate): ~15 min (`supabase db push --linked` + `pnpm gen:types` + smoke SQL execution + tsc check + commit)
- **Started:** 2026-05-08T12:05:00Z
- **Completed:** 2026-05-08T12:38:00Z (commit `b4ab38a`)
- **Tasks:** 3 (2 file authoring + 1 BLOCKING founder gate)
- **Files created:** 2 (migration + smoke SQL)
- **Files modified:** 1 (types regen)
- **Commits:** 2 atomic (`5eb8d38` files + `b4ab38a` types regen)

## Accomplishments

### Task 1 — Migration 0007 SQL (commit `5eb8d38`)

`supabase/migrations/0007_phase_7_analise_llm.sql` (99 linhas) com 5 seções:

1. **Função IMMUTABLE PARALLEL SAFE** `jsonb_concat_sections_pt_br(input jsonb) returns text`
   - `language sql immutable parallel safe`
   - Body: `select string_agg(value, E'\n\n' order by coalesce((regexp_match(key, '^(\d+)_'))[1]::int, 99), key) from jsonb_each_text(input)`
   - `grant execute … to authenticated`

2. **DROP+ADD atomic** dentro de `begin; … commit;` transação:
   - `drop column if exists ai_report_raw, drop column if exists ai_report_edited`
   - Zero rows affected (D-P1 verified: Phase 7 nunca executou)

3. **Add canonical jsonb + GENERATED text columns:**
   - `report_generated jsonb`, `report_delivered jsonb`
   - `ai_report_raw text generated always as (jsonb_concat_sections_pt_br(report_generated)) stored`
   - `ai_report_edited text generated always as (jsonb_concat_sections_pt_br(report_delivered)) stored`

4. **Add 11 forward-compat columns (D-P2 SAC Fase 10):**
   - `report_generated_at timestamptz`, `report_delivered_at timestamptz`
   - `edit_diff jsonb`, `zonas_editadas jsonb`, `tipo_edicao text[]`
   - `clinical_feedback jsonb`, `exam_notes text`, `feedback_collected_at timestamptz`
   - `audit_metadata jsonb default '{}'::jsonb`
   - `regeneration_count int default 0`, `regeneration_log jsonb default '[]'::jsonb`

5. **CHECK constraint (D-S4):**
   - `readings_regeneration_count_cap_check: regeneration_count >= 0 and regeneration_count <= 3`
   - DO block com `if not exists` em `pg_constraint` (idempotente)

### Task 2 — Smoke SQL (commit `5eb8d38`)

`supabase/tests/0007_jsonb_concat_order.sql` (79 linhas) com 3 DO blocks PL/pgSQL:

1. **Test 1 — Numeric ordering (Pitfall 1):** input com chaves `13_x` `2_y` `1_z` `encerramento_disclaimer` valida output `'a\n\nb\n\nc\n\nd'` (não lex `'13_x'` antes de `'2_y'`)
2. **Test 2 — Full 14-key canonical shape:** input com todas as 14 chaves canônicas valida 14 partes via `string_to_array(result, E'\n\n')`, primeira='um', última='fim'
3. **Test 3 — Empty input edge:** `jsonb_concat_sections_pt_br('{}'::jsonb)` retorna NULL (string_agg sobre zero rows)

Cada DO block tem `raise exception` em caso de fail + `raise notice 'Test N PASS'`. Final `\echo 'All smoke tests passed.'`.

### Task 3 — Founder gate (commit `b4ab38a`)

| Step | Command | Result |
|------|---------|--------|
| 1 | `supabase db push --linked` | Migration aplicada ao remoto sa-east-1 |
| 2 | `pnpm --filter @iridologista/web gen:types` | `apps/web/types/database.ts` regenerado (+40 linhas) |
| 3 | `psql -f supabase/tests/0007_jsonb_concat_order.sql` | 3× `Test N PASS` + `All smoke tests passed.` |
| 4 | `pnpm tsc --noEmit` | 18 errors em 6 files — TODOS pre-existing Phase 3/5 deferred items (fetchMock tuple, WEIGHTS.reflex, StatusBadge asChild, vision_features Json cast). **Zero erros novos** introduzidos pela migration |
| 5 | `git commit chore(07-01): regenerate types after migration 0007` | `b4ab38a` (40 insertions) |

### Acceptance criteria gates (todos GREEN)

| Gate | Status | Detail |
|------|--------|--------|
| Migration ≥ 80 linhas | ✓ | 99 linhas |
| `IMMUTABLE PARALLEL SAFE` literal | ✓ | grep 1 hit |
| `GENERATED ALWAYS AS (jsonb_concat_sections_pt_br` | ✓ | 2 hits (ai_report_raw + ai_report_edited) |
| ≥ 14 `add column if not exists` | ✓ | 16 hits |
| Sem `set local` em código | ✓ | 0 hits (Pitfall 11 cleared) |
| Transação `begin;…commit;` | ✓ | match presente |
| `coalesce((regexp_match(key, '^(\\d+)_'))[1]::int, 99)` literal | ✓ | linha 40 do migration |
| CHECK `regeneration_count >= 0 AND <= 3` | ✓ | DO block com `if not exists` |
| Status enum unchanged | ✓ | grep `create type` = 0 |
| Smoke SQL ≥ 60 linhas | ✓ | 79 linhas |
| 3 DO blocks | ✓ | grep `^do \$\$` = 3 |
| All 14 canonical keys enumerated | ✓ | `1_constituicao`..`13_mensagem_final` + `encerramento_disclaimer` |
| 7 substring acceptance criteria em types | ✓ | grep -c 7/7: report_generated, report_delivered, audit_metadata, regeneration_count, regeneration_log, ai_report_raw, ai_report_edited (todos `: Json`/`: number`/`: string` corretos) |
| Founder smoke output | ✓ | 3× `Test N PASS` + `All smoke tests passed.` |
| tsc --noEmit (clean of new errors) | ✓ | Pre-existing Phase 3/5 deferred items only — zero novos |

## Deviations

### Rule 1 — Comment rephrased to avoid `SET LOCAL` literal substring

Plan's verbatim migration content tinha o comentário "Migration 0006 learning: funções usadas em GENERATED ALWAYS AS (...) STORED DEVEM ser IMMUTABLE PARALLEL SAFE e NÃO podem usar SET LOCAL." A Task 1 verification regex era `!/set local/i.test(f)` → falhava porque comentário continha o literal.

**Fix:** rewrote comment to "DEVEM ser IMMUTABLE PARALLEL SAFE e o body precisa ser pure SELECT (sem SET runtime params, sem operações procedurais)." — preserva intent (Pitfall 11 documented) sem disparar regex overly strict.

A regra real é "NÃO use `SET LOCAL` no body da função" — restrição válida só pra código executável, não pra documentação. O verification check do plan foi overly broad. Esta deviation é cosmetic.

## What this unblocks (downstream)

| Plan | Depends on this for |
|------|---------------------|
| 07-03 | Importa `Database['public']['Tables']['readings']['Row']` com novos campos como source of truth para `ReportSectionKey` mapping em `lib/anthropic/types.ts` |
| 07-04 | Nada direto, mas parser produz output que será gravado em report_generated jsonb |
| 07-05 | audit_metadata jsonb shape (D-A3) é destino do output `runAudit()` |
| 07-06 | edit_diff jsonb + zonas_editadas jsonb + tipo_edicao text[] são outputs do `classifyAllSections()` (D-U2) |
| 07-08 | Route Handler grava report_generated incrementally + final audit_metadata + regeneration_count++ (CHECK <= 3 é defesa server-side) |
| 07-10 | Server Action `saveReportDelivered` grava report_delivered + edit_diff/zonas_editadas/tipo_edicao + report_delivered_at; CHECK não aplicável aqui |
| 10 (Future) | feedback_collected_at, clinical_feedback, exam_notes ficam vazios até SAC kickoff — schema já está pronto |

## Self-Check: PASSED

Migration aplicada ao remoto, types regenerados, smoke SQL verde, tsc clean (relativo aos novos files), CHECK constraint ativa. Wave 1 do Phase 7 fechada. Wave 2 (07-03) pode importar tipos canônicos a partir de `Database['public']['Tables']['readings']['Row']`.
