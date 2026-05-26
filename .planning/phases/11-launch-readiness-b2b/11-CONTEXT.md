# Fase 11 — Launch readiness B2B

**Criada:** 2026-05-25 (durante GSD re-sync pós-audit `v1.0-MILESTONE-AUDIT.md`)
**Discussão:** 2026-05-25 (4 áreas exploradas via `/gsd-discuss-phase 11`)
**Tipo:** INSERTED — captura trabalho real pendente, não escopo retroativo
**Goal:** Liberar o primeiro convite formal a um terapeuta externo (não-founder) sem regressão visível em e-mail, age-gate ou compliance.

## Domínio

3 launch gates atômicos pra primeiro convite a terapeuta externo:
- **11-01** Resend domain verification + sender swap
- **11-02** MIN_AGE revert 0→18
- **11-03** Consent term decisão

Goal mensurável: 1 terapeuta real recebe convite, completa fluxo E2E (signup → cria cliente → 6 fotos → recebe relatório), sem regressão visível.

## Decisões locked nesta discussão

### D1 — E-mail sender: `noreply@iriscodex.com`
Convenção universal de e-mail transacional. Sinaliza claramente "isso é sistema". Combina com landing page futura que terá forms de contato dedicados. Mitigação pra terapeutas que tentem responder: call-to-action no corpo do e-mail (WhatsApp do founder OR e-mail real na assinatura).

**Implicação:**
- Configurar Supabase Auth Email Templates pra usar `noreply@iriscodex.com` como sender.
- Magic-link / OTP transacionais saem desse endereço.
- Inbox `noreply@` NÃO precisa existir (ninguém deve receber lá).
- Pra futuras notificações "leitura pronta" considerar outro sender contextual (`relatorios@`) — mas isso é V1.1+, fora da Fase 11.

### D2 — Consent term: Path B (libera v1 com trigger)
Founder libera consciente o `legal/term-v1.md` AI-drafted pra primeiros ≤5 terapeutas. Memory `project_consent_term_legal_review_debt` mantém trigger ATIVO: "revisar com advogado quando N=5 paying clients OR primeira reclamação ANPD".

**Implicação:**
- Não bloquear launch agora.
- Risco aceito pelo founder com N pequeno e conhecido.
- Não criar v2 do termo — só revisar quando trigger disparar.
- Memory `project_consent_term_legal_review_debt` atualizada com nova data-limite (founder define em 11-03).

### D3 — Primeiro convite: terapeuta real conhecida, hand-held
1 terapeuta que founder já conhece e confia recebe o convite. Founder avisa por WhatsApp/call antes ("vou te mandar um link, me avisa se travar"). Founder fica disponível pra debug em tempo real. Máximo aprendizado, mínimo risco de feedback público ruim.

**Implicação:**
- Founder escolhe a pessoa antes do convite ser enviado (esta decisão é tarefa dele, não rastreada como plan).
- WhatsApp/call de aviso prévio é parte do protocolo, não da app.
- Onboarding 3-step (ONBOARD-01) NÃO é pré-requisito — founder é o onboarding humano nesta primeira leva.

### D4 — Acceptance: terapeuta completa fluxo E2E
Fase 11 fecha quando: a terapeuta convidada faz signup → cria 1 cliente → sobe 6 fotos → recebe relatório por e-mail OU baixa PDF. Sem regressão visível em qualquer etapa.

**Implicação:**
- Não basta "e-mail chegou" — exige prova de que o produto inteiro funciona pra outra pessoa.
- Founder pode estar no loop pra debug, mas não pode fazer ação por ela.
- Critério "entrega a cliente final" (ONBOARD-04) NÃO é gate da Fase 11 — esse é critério da Fase 9 dogfooding.

## Plans (a refinar via `/gsd-plan-phase 11`)

### 11-01 — Resend gate + sender swap
**Tipo:** Founder dashboard work (não-Claude-doable) + Claude assist (verificação)
**Passos:**
1. Founder no Resend dashboard: confirma `iriscodex.com` Verified (DNS já validado 2026-05-19 — talvez já tá verde, só confirmar).
2. Founder no Supabase → Auth → Email Templates: troca sender pra `noreply@iriscodex.com`. Aplica nos templates de magic-link e OTP (signup + recovery + change-email).
3. Founder dispara signup test em e-mail externo (gmail/outlook não-founder do próprio founder), confirma magic-link/OTP chega autenticado (DMARC pass em headers).
4. Claude assiste verificando logs `auth.users` mostrando sender correto + headers do e-mail (se founder copiar/colar headers).

**Acceptance:** 1 e-mail real entregue a domínio externo com `From: <noreply@iriscodex.com>` confirmado em headers + DMARC pass.

### 11-02 — MIN_AGE revert 0→18
**Tipo:** Code change atômico (Claude-doable, ~30min)
**Passos:**
1. Edit `apps/web/lib/gates/profile-completeness.ts`: `MIN_AGE = 18`.
2. Grep todas ocorrências (Zod schemas, form validators, gate functions, tests, badges "menor") — confirmar consistência. Memory rule: `[feedback_calibration_grep_all_occurrences]` aplica.
3. Test ou ajuste manual: signup/cliente-form com data-nasc <18 deve ser bloqueado com mensagem clara `blocked_underage`.
4. Memory `project_min_age_beta_revert_before_ga` movida pra histórico/RESOLVED.

**Acceptance:** PR atômico, deploy LIVE, signup com menor de 18 rejeitado em ambas as superfícies (terapeuta auth + cliente form).

### 11-03 — Consent term decisão + memory update
**Tipo:** Decisão founder (D2 acima já travou Path B) + atualização de memory
**Passos:**
1. Founder anota explicitamente em memory `project_consent_term_legal_review_debt`: "term-v1 liberado pra ≤5 terapeutas externos, trigger revisão = N=5 OR primeira reclamação ANPD OR 60 dias do primeiro convite (whichever first)."
2. Cria reminder no calendário pessoal do founder (fora do GSD) com data-limite 60 dias do primeiro convite.
3. Nenhuma mudança de código.

**Acceptance:** Memory atualizada com data-limite explícita + reminder externo agendado.

### 11-04 — Smoke E2E hand-held com terapeuta real
**Tipo:** Founder + 1 terapeuta convidada
**Passos:**
1. Founder identifica terapeuta-piloto (off-system).
2. Founder envia mensagem prévia WhatsApp/call avisando.
3. Founder convida via UI atual (`/admin/terapeutas` ou fluxo de invite existente — verificar qual via durante /gsd-plan-phase).
4. Terapeuta completa: signup → cria 1 cliente → upload 6 fotos → recebe relatório.
5. Founder observa cada etapa (em standby pra debug). Anota friction-points.
6. Memory `project_v284_start_here` substituída por pointer "launch-v1-done" com data + identidade da terapeuta-piloto + observações.

**Acceptance:** Terapeuta completa E2E sem regressão visível. Friction-points documentados em memory pra Fase 9 atacar depois.

## Cross-cutting constraints

- **Ordem de execução**: 11-02 (Claude-doable) pode rodar AGORA em paralelo com 11-01 (founder dashboard). 11-03 (Consent) é trivial após 11-01/02. 11-04 (smoke) só roda depois de 11-01/02/03 fecharem.
- **Reversibilidade**: se signup test em 11-01 falhar (DMARC fail, e-mail spam, sender errado), founder pode tentar `relatorios@` como backup local-part — mas memory rule é manter `noreply@` como default.
- **Sem cobrança automatizada**: Stripe NÃO entra. Founder cobra terapeutas via meio externo (boleto/PIX/transfer) se decidir cobrar no piloto — fora do escopo Fase 11.
- **Sem onboarding formal**: ONBOARD-01 (3-step onboarding) e landing page (ONBOARD-03) ficam pra Fase 9. Hand-held substitui onboarding na Fase 11.

## Não-objetivos explícitos (deferred)

- ❌ Stripe BR + LGPD-01..06 completos → Fase 8, V1.1+
- ❌ Onboarding 3-step + landing page pública → Fase 9
- ❌ Beta com 10-20 terapeutas → Fase 9 (ONBOARD-05)
- ❌ Reabrir Fase 3 PWA captura instalável → permanece abandonada pra B2B v1
- ❌ Validar cache empírico (fix v2.7.3) → memory tech debt, não bloqueia
- ❌ Fix Stage 1 variability / §0 vocativo / §2 anti-fusão → memory tech debts com triggers, não bloqueiam

## Canonical refs (downstream agents leiam)

- `.planning/ROADMAP.md` — fase 11 marcada como next-up; tabela de Progresso atualizada
- `.planning/v1.0-MILESTONE-AUDIT.md` — contexto histórico da decisão de criar Fase 11
- `.planning/PROJECT.md` — Iris Codex value central + métrica de sucesso MVP (Estágio 1 dogfooding gate, Estágio 2 beta 10-20)
- `apps/web/lib/gates/profile-completeness.ts` — arquivo a editar em 11-02 (MIN_AGE revert)
- `legal/term-v1.md` — termo AI-drafted que continua válido (Path B)
- Memory `project_resend_domain_unverified_launch_gate` — 3 passos restantes
- Memory `project_min_age_beta_revert_before_ga` — pré-revert state
- Memory `project_consent_term_legal_review_debt` — trigger ativo
- Memory `project_b2c_registration_future_phase` — confirma que launch v1 = B2B-only
- Memory `feedback_calibration_grep_all_occurrences` — regra pra 11-02 (bumpar todas as ocorrências)

## Code context (assets reutilizáveis pra 11-02)

- `apps/web/lib/gates/profile-completeness.ts` — fonte única do MIN_AGE
- `apps/web/lib/forms/` ou `apps/web/components/forms/` — Zod schemas que validam idade (grep necessário)
- `apps/web/app/(auth)/signup/page.tsx` — form de signup terapeuta
- Cliente form: `apps/web/app/clientes/novo/` e `apps/web/app/clientes/[id]/editar/` — onde menor-de-idade é validado pra cliente final

## Próximo passo

Quando founder retomar: `/gsd-plan-phase 11` pra gerar plans 11-01..04 formais com tasks granulares. Recomenda começar a execução por 11-02 (Claude-doable, atômico, 30min) em paralelo com founder fazendo 11-01 no Resend dashboard.
