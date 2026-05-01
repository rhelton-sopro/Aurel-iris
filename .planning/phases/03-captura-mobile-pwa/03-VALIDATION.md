---
phase: 3
slug: captura-mobile-pwa
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-01
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `03-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.x + @testing-library/react + jsdom (a instalar em Wave 0) |
| **Config file** | `apps/web/vitest.config.ts` (a criar em Wave 0) |
| **Quick run command** | `pnpm --filter web test --changed` |
| **Full suite command** | `pnpm --filter web test:run && pnpm --filter web lint && pnpm --filter web build` |
| **Estimated runtime** | ~30-60s para suite completa |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web lint` + `vitest run --changed`
- **After every plan wave:** Run full suite (`pnpm --filter web test:run`) + `pnpm --filter web build` (verifica que Serwist gera SW)
- **Before `/gsd-verify-work`:** Full suite green + grep audit de vocabulário + checklist manual UAT em iPhone real + Android real
- **Max feedback latency:** ~60 segundos

---

## Per-Task Verification Map

| Plan | Wave | Requirement | Behavior | Test Type | Automated Command | File Exists |
|------|------|-------------|----------|-----------|-------------------|-------------|
| 03-01 (Wave 0) | 0 | infra | vitest configurado, scripts adicionados, types regen, audit:vocabulary script | smoke | `pnpm --filter web test:run` (suite vazia OK) | ❌ W0 |
| 03-01 (Wave 0) | 0 | CAPTURE-06 (RLS infra) | Storage bucket privado existe; RLS bloqueia cross-terapeuta | spot SQL | `psql -f supabase/tests/storage_cross_therapist_rls.sql` | ❌ W0 |
| 03-02 | 1 | CAPTURE-01 | Manifest + SW respondem; ícones servem | manual + build | `pnpm --filter web build` (Serwist gera SW); manual UAT em iOS Safari + Chrome Android | ❌ W0 (manual) |
| 03-03 | 2 | CAPTURE-05 (entry) | createReading insere `readings` com `status='pending'`, `capture_method='mobile_camera'` | unit + integration | `vitest run app/actions/readings.test.ts` | ❌ W0 |
| 03-04 | 3 | CAPTURE-02 | useCamera retorna stream; cleanup em unmount; CameraDeniedScreen renderiza em NotAllowedError | unit | `vitest run hooks/use-camera.test.ts` | ❌ W0 |
| 03-05 | 4 | CAPTURE-03 | quality-scoring produz 7 sub-scores numericamente sãos para fixtures sintéticas; pesos somam 1.0 | unit | `vitest run lib/capture/quality-scoring.test.ts` | ❌ W0 |
| 03-05 | 4 | CAPTURE-04 | useQualityScore só dispara captura após 400ms estável em score ≥0.75 | unit (state machine) | `vitest run hooks/use-quality-score.test.ts` | ❌ W0 |
| 03-06 | 5 | CAPTURE-05 | State machine percorre `right/frontal → ... → left/backlight` em ordem; instruções renderizam | unit + manual | `vitest run lib/capture/sequence.test.ts` + manual UAT | ❌ W0 |
| 03-07 | 6 | CAPTURE-06 | jpeg-compress gera blob ~500KB com max 2048px maior lado; storage-path produz `{therapist_id}/{reading_id}/{eye}_{angle}.jpg`; upload retorna sucesso; insert em reading_images persiste todos os campos | unit + integration | `vitest run lib/capture/jpeg-compress.test.ts lib/capture/storage-path.test.ts lib/capture/upload.test.ts` | ❌ W0 |
| 03-08 | 7 | CAPTURE-05 (recovery) | RecoveryBanner aparece quando há reading pending com <6 imagens; CTA Continuar restaura estado; Descartar deleta reading + Storage objects | manual UAT | manual checklist (recovery + discard) | ❌ W0 (manual) |
| **Cross-cutting** | — | LGPD-06 forward | grep não encontra "diagnóstico|tratamento|cura" em apps/web/app/(capture) e apps/web/components/capture | grep audit | `pnpm --filter web audit:vocabulary` | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/vitest.config.ts` — config com jsdom + setup
- [ ] `apps/web/tests/setup.ts` — mocks globais (matchMedia, ResizeObserver)
- [ ] `apps/web/package.json` scripts: `test`, `test:run`, `audit:vocabulary`
- [ ] `apps/web/package.json` devDependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
- [ ] `supabase/migrations/0004_storage_bucket_iris_captures.sql` — bucket `iris-captures` privado + 4 RLS policies + unique constraint reading_images(reading_id, eye, angle)
- [ ] `supabase/tests/storage_cross_therapist_rls.sql` — análogo a Phase 1 cross_therapist_rls.sql
- [ ] `apps/web/types/database.ts` — regen via `pnpm --filter web gen:types`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PWA install em iOS Safari | CAPTURE-01 | Sem API automatizável; iOS não dispara `beforeinstallprompt` | iPhone real → Safari → abrir URL → ⎙ → "Adicionar à Tela de Início" → ícone aparece na home |
| PWA install em Chrome Android | CAPTURE-01 | Critérios de engagement do Chrome são opacos | Android real → Chrome → abrir URL → critério de engagement → banner CTA "Instalar app" → ícone aparece |
| Captura ponta-a-ponta em iPhone real | CAPTURE-02..06 | getUserMedia + MediaPipe não roda em jsdom | iPhone real → fluxo de 6 capturas em <90s → verificar 6 arquivos no Supabase Studio bucket |
| Captura ponta-a-ponta em Android real | CAPTURE-02..06 | idem | Android real → fluxo idêntico → idem |
| Recovery após abandono | D-12 | Race conditions em re-mount não são triviais em testes | Iniciar captura → abandonar na 3ª foto → fechar app → reabrir → banner aparece → "Continuar" volta para `right/backlight` |
| Discard cascading | D-12, D-13 | Storage delete + DB delete + RLS verification | "Descartar" → confirmar dialog → reading sumir do banco + arquivos do Storage |
| Cross-terapeuta Storage | LGPD/RLS | Spot check ad-hoc | Terapeuta B logado → tentar baixar foto do terapeuta A no Studio → bloqueado |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (vitest, storage migration, audit:vocabulary)
- [ ] No watch-mode flags in CI commands
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (after Wave 0 ships)

**Approval:** pending
