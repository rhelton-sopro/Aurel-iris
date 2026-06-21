---
phase: 12
slug: publicacao-instagram
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-21
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | apps/web (vitest via package.json `test`/`test:run`) |
| **Quick run command** | `pnpm --dir apps/web test:run --changed` |
| **Full suite command** | `pnpm --dir apps/web test:run` |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --dir apps/web test:run --changed`
- **After every plan wave:** Run `pnpm --dir apps/web test:run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (preenchido pelo planner/Nyquist) | — | — | IGPUB-01..06 | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Stubs/fixtures de teste para o caminho de publicação (mock do Graph API fetch) — REQ IGPUB-03/04/06
- [ ] Fixtures para a máquina de estados (agendado→publicando→publicado/erro) — REQ IGPUB-02

*A pesquisa (12-RESEARCH.md §Validation Architecture) define o que precisa ser validado para confiar no motor.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Carrossel/reel real aparece no feed do IG | IGPUB-03/04 | Exige conta IG real + token (homework do founder); não há sandbox fiel | Smoke test do founder: "publicar agora" num post aprovado → conferir o post no Instagram |
| Token long-lived + refresh contra o Meta real | IGPUB-01 | Depende de credencial viva | Health-check em prod após configurar o token |

*O restante (idempotência, claim de linha, classificação de erro, transição de estado, montagem de payload) tem verificação automatizada com o Graph API mockado.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
