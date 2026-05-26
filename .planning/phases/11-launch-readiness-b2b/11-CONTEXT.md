# Fase 11 — Launch readiness B2B

**Criada:** 2026-05-25 (durante GSD re-sync pós-audit `v1.0-MILESTONE-AUDIT.md`)
**Tipo:** INSERTED — captura trabalho real pendente, não escopo retroativo
**Goal:** Liberar o primeiro convite formal a um terapeuta externo (não-founder) sem regressão visível em e-mail, age-gate ou compliance.

## Por que existe

Audit de milestone v1.0 (2026-05-25) revelou que o produto está em produção há ~3 semanas com calibração diária via memory+git, mas **3 launch gates ainda bloqueiam o uso real por terapeutas externos**. Cada gate tem memory tracking ativo:

- `project_resend_domain_unverified_launch_gate` — DNS já validado (4 records Hostinger 2026-05-19), faltam 3 passos no dashboard Resend + Supabase. Sem isso, e-mail sai de `onboarding@resend.dev` (fallback Resend) — visível como spammy / não-profissional pra um terapeuta externo.
- `project_min_age_beta_revert_before_ga` — `MIN_AGE=0` setado temporariamente em `apps/web/lib/gates/profile-completeness.ts` (commit `7fae0f2`) pra permitir teste com crianças nas leituras de calibração. Reverter pra `18` antes de qualquer convite formal.
- `project_consent_term_legal_review_debt` — `legal/term-v1.md` AI-drafted, sem revisão jurídica. Trigger atual: ≥10 paying clients OR primeira reclamação ANPD. Pra primeiro convite formal vale (a) revisar antes OR (b) founder libera consciente pra ≤10 clients com agenda explícita.

## Escopo NÃO incluso

- **Stripe BR + LGPD completo** (Fases 8/LGPD-01..06): launch v1 = B2B convite, sem cobrança automatizada. Esses ficam pra V1.1+ quando o produto crescer pra GA público.
- **Reabrir Fase 3 PWA**: app-instalável + captura PWA descontinuados durante pivot B2B v1. Foco em upload desktop é a UX validada.
- **Implementar tech debts de prompt**: Stage 1 variability / §2 anti-fusão / §0 vocativo continuam rastreados em memory como observações com triggers. Não bloqueiam launch.

## Plans esqueleto (a refinar via /gsd-discuss-phase 11)

### 11-01 — Resend gate fechado
**Tipo:** Non-Claude-doable (founder dashboard work) + Claude assist (verificação)
**Passos:**
1. Founder no Resend dashboard: verifica que `iriscodex.com` mostra Verified verde.
2. Founder no Supabase Auth → Email Templates: troca sender de `onboarding@resend.dev` pra `noreply@iriscodex.com` (ou similar; founder decide local-part).
3. Founder dispara signup test em e-mail externo (gmail/outlook não-founder), confirma magic-link/OTP chega autenticado (DMARC pass).
4. Claude valida via `iris-resend-verify.mjs` (a criar) que último log de auth.users mostra sender correto.

**Acceptance:** 1 e-mail real entregue a domínio externo com `From: <noreply@iriscodex.com>` confirmado em headers.

### 11-02 — MIN_AGE revertido (Claude-doable)
**Tipo:** Code change atômico
**Passos:**
1. Edit `apps/web/lib/gates/profile-completeness.ts`: `MIN_AGE = 18`.
2. Grep todas ocorrências (Zod schemas, form validators, gate functions, tests) e confirmar consistência.
3. Test: signup com data nasc <18 deve ser bloqueada com mensagem clara.
4. Memory `project_min_age_beta_revert_before_ga` movida pra "RESOLVED" (manter como histórico).

**Acceptance:** PR atômico, tests passing, deploy LIVE, signup com menor de 18 rejeita.

### 11-03 — Consent term decisão
**Tipo:** Decisão founder + (opcional) code change
**Path A (founder revisão jurídica):**
1. Founder agenda com advogado, envia `legal/term-v1.md` pra review.
2. Pós-review, cria `legal/term-v2.md` + changelog em `legal/CHANGELOG.md`.
3. Migration ou config flag pra que novos signups usem v2.
4. Memory `project_consent_term_legal_review_debt` → RESOLVED.

**Path B (founder libera com trigger explícito):**
1. Founder anota em memory: "term-v1 liberado pra ≤10 clients, trigger revisão = N=10 OR primeira reclamação."
2. Cria calendar reminder pra checar count em 30/60 dias.
3. Trigger memory mantida ATIVA com nova data-limite.

**Acceptance:** Memory atualizada com decisão explícita + path A → term-v2.md committed OR path B → trigger ativo documentado.

## Success criteria gerais (acceptance milestone)

1. ✅ Resend gate: 1 e-mail real entregue a domínio externo com sender autenticado.
2. ✅ MIN_AGE: 18 em todas as superfícies, test cobrindo rejeição.
3. ✅ Consent: decisão path A ou B documentada + memory atualizada.
4. ✅ Smoke E2E: founder convida 1 terapeuta externo (real ou e-mail-teste alternativo), terapeuta completa signup → primeiro cliente → 6 fotos → recebe relatório por e-mail. Sem regressão visível.
5. ✅ ROADMAP.md atualizado: Fase 11 marcada done com data; memory `project_v284_start_here` substituída por pointer "launch-v1-done" ou similar.

## Dependências externas

- **Resend support** (path 11-01): support response time pode atrasar. Se Resend support tiver problema, founder pode trocar pra outro provider (Postmark, SendGrid) — mas memory diz Resend tá quase resolvido, apenas dashboard steps.
- **Advogado** (path 11-03 A): se escolhido, prazo varia. Não bloqueia (11-01) e (11-02).

## Não-objetivos explícitos

- ❌ Não otimizar custo (~$0.60/leitura tá OK pra B2B beta — markup 17-33x cobre).
- ❌ Não validar cache empírico (tech debt continua em memory, não bloqueia launch).
- ❌ Não fechar Stage 1 variability (tech debt, founder aceita custo do modelo).
- ❌ Não atacar Fase 7.5 mapping engine determinístico (V1.1).

## Quando começar

Imediatamente após founder revisar este re-sync de manhã. Sugestão: `/gsd-discuss-phase 11` pra refinar plans + começar 11-02 (Claude-doable, fecha em 30min) em paralelo com founder agendando 11-01 com Resend.
