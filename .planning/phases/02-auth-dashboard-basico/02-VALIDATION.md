---
phase: 2
slug: auth-dashboard-basico
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-01
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Nenhum instalado (Wave 0 gap — instalar em Wave 1 se necessário) |
| **Config file** | — (Wave 0 gap) |
| **Quick run command** | `pnpm --filter @aurel-iris/web type-check` (type checking sem testes) |
| **Full suite command** | `pnpm --filter @aurel-iris/web build` (build prod como proxy de corretude) |
| **Estimated runtime** | ~30–60 segundos (build completo) |

**Nota:** A Fase 2 é MVP de solo dev. Não há framework de testes automatizados instalado. Todos os critérios de aceitação são verificados manualmente via browser + SQL queries no Supabase Dashboard. O build de produção (`pnpm build`) serve como proxy de corretude técnica (TS compile + linting).

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @aurel-iris/web type-check` (TypeScript compiler)
- **After every plan wave:** Run `pnpm --filter @aurel-iris/web build` (full production build)
- **Before `/gsd-verify-work`:** Full build must pass + manual E2E checklist (ver Manual-Only Verifications)
- **Max feedback latency:** ~60 segundos (build)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-W1-infra | 01 | 1 | AUTH-01, AUTH-02 | T-02-01 | `getUser()` em vez de `getSession()` no servidor | type | `pnpm type-check` | ❌ W0 | ⬜ pending |
| 02-W1-trigger | 01 | 1 | AUTH-03 | — | `security definer set search_path=''` no trigger SQL | manual | SQL: `select trigger_name from information_schema.triggers where trigger_name='on_auth_user_created'` | ❌ W0 | ⬜ pending |
| 02-W1-middleware | 01 | 1 | AUTH-02 | T-02-02 | Redirect `/login` sem sessão; não expõe tokens ao browser | type | `pnpm type-check` | ❌ W0 | ⬜ pending |
| 02-W1-callback | 01 | 1 | AUTH-01 | T-02-03 | `exchangeCodeForSession` server-only; erro → redirect sem expor token | type | `pnpm type-check` | ❌ W0 | ⬜ pending |
| 02-W2-signup | 02 | 2 | AUTH-01 | T-02-04 | `shouldCreateUser: true` apenas em signup | manual | Browser: signup com email real → magic link recebido | ❌ W0 | ⬜ pending |
| 02-W2-login | 02 | 2 | AUTH-01 | T-02-05 | `shouldCreateUser: false` em login (sem criação acidental) | manual | Browser: login com email existente → magic link; email inexistente → erro | ❌ W0 | ⬜ pending |
| 02-W3-layout | 03 | 3 | CLIENT-03 | — | N/A | type | `pnpm type-check` | ❌ W0 | ⬜ pending |
| 02-W4-crud | 04 | 4 | CLIENT-01, CLIENT-02 | T-02-06 | Server Actions verificam `getUser()` antes de toda mutação | manual | Browser: CRUD completo + verificação RLS com segunda conta | ❌ W0 | ⬜ pending |
| 02-W4-smoke | 04 | 4 | AUTH-01, CLIENT-01 | — | `/api/health/db` retorna 401 sem sessão | manual | `curl` autenticado: 200 com count; não-autenticado: 401 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

O projeto não possui framework de testes instalado. Para esta fase, "Wave 0" é limitado a:

- [ ] `pnpm --filter @aurel-iris/web type-check` — rodar sem erros após cada task (TS compile check)
- [ ] `pnpm --filter @aurel-iris/web build` — rodar sem erros após cada wave completo

*Nenhum arquivo de teste será criado nesta fase. A instalação de Vitest/Jest + testes E2E (Playwright) é planejada para a Fase 9 (Polish). Verificação é manual até lá.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Magic link recebido no e-mail e login completo | AUTH-01 | Requer SMTP real + caixa de e-mail | 1. POST /signup com email real → 2. Clicar link no email → 3. Verificar aterragem em /dashboard |
| Sessão persiste em refresh; /dashboard sem sessão → /login | AUTH-02 | Requer browser + cookies | 1. Refresh logado → sessão mantida; 2. Limpar cookies → GET /dashboard → redirect /login |
| profiles criado com subscription_status='trial' e trial_ends_at ~14 dias | AUTH-03 | SQL query no Supabase Dashboard | `SELECT subscription_status, trial_ends_at FROM profiles WHERE id = '[uid]'` |
| CRUD completo com RLS cross-terapeuta | CLIENT-01 | Requer 2 contas de teste | Criar cliente como terapeuta A; logar como terapeuta B; verificar que cliente não aparece |
| Formulário captura full_name, birth_date, gender, notes corretamente | CLIENT-02 | Validação visual de UI | Preencher todos os campos, checar INSERT na tabela `clients` no Supabase Dashboard |
| Navegação entre /dashboard, /clientes, /leituras via sidebar | CLIENT-03 | Validação visual de UI | Clicar nos links da sidebar, verificar que cada rota carrega sem erro |
| /api/health/db retorna 200 com count(*) autenticado | AUTH-01 + CLIENT-01 | Requer sessão autenticada | `curl -H "Cookie: [session-cookie]" http://localhost:3000/api/health/db` |
| Trigger cria profiles no signup | AUTH-03 | SQL trigger verificado no DB | `SELECT trigger_name FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created'` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (type-check) or manual instruction
- [ ] Sampling continuity: build check após cada wave
- [ ] Wave 0 covers type-check baseline
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s (type-check) / < 120s (full build)
- [ ] `nyquist_compliant: true` set in frontmatter quando todos os critérios acima estiverem ✓

**Approval:** pending
