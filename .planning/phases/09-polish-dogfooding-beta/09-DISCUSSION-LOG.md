# Fase 9 — Discussion log

**Data:** 2026-05-26 (sessão pós-Fase 11 commits)
**Modo:** `/gsd-discuss-phase 9` (default mode, 4 áreas selecionadas → 5 decisões)
**Output:** `09-CONTEXT.md`

## Carregando de fases anteriores
- Launch v1 = B2B convite, sem Stripe (memory `project_b2c_registration_future_phase`)
- Magic-link auth + sender autenticado já entregue via Fase 11 11-01 (commit `35460b9`)
- MIN_AGE=18 restaurado (Fase 11 11-02, commit `55d54ea`)
- Consent term Path B com trigger ativo (Fase 11 11-03)
- BETA_READING_CAP=3 (commit `32cad44`)
- Resend domain Verified + Confirm signup template `{{ .Token }}`

## Áreas selecionadas (multiselect)
✅ Escopo realista da Fase 9
✅ Onboarding 3-step (ONBOARD-01)
✅ Landing page pública (ONBOARD-03) — depois descopada
✅ Dogfooding gate (ONBOARD-04)

## Discussão por área

### Área 1 — Escopo realista da Fase 9
**Pergunta:** Dado launch B2B convite, quais ONBOARD-X agora?

**Opções:**
- Só essenciais (Recommended): ONBOARD-01 + ONBOARD-02-completar + ONBOARD-04-redefinir
- Tudo (5 reqs originais)
- Mínimo absoluto: só ONBOARD-01 + ONBOARD-04

**Selecionado:** Só essenciais (Recommended)

**Notas:**
- ONBOARD-03 (landing) descopada — vira V1.1 quando founder abrir signup público
- ONBOARD-05 (beta 10-20) descopada — depende de landing + Stripe (V1.1+)

### Área 2 — Onboarding 3-step UX

**Sub-pergunta a: Como funciona o wizard?**

**Opções:**
- Wizard inline na dashboard (Recommended)
- Rota dedicada `/onboarding` (mandatory)
- Modal sobre dashboard (skipable)

**Selecionado:** Wizard inline na dashboard (Recommended)

**Notas:**
- Banner/card hero no topo da dashboard
- Skipable mas visível até completar
- State derivado de DB (perfil completo? cliente.count > 0? leitura.count > 0?)

**Sub-pergunta b: Quais 3 steps?**

**Opções:**
- Perfil → 1º cliente → 1ª leitura (Recommended)
- Perfil → termo consentimento → 1º cliente
- Sobre você → mini-tour → 1ª ação

**Selecionado:** Perfil → 1º cliente → 1ª leitura (Recommended)

**Notas:**
- Match com Success Criteria 1 do ROADMAP
- Foca em chegar ao primeiro relatório ≤30min
- Cliente autoexame (is_self=true) também conta como passo 2

### Área 3 — Landing page pública (DESCOPADA)
Founder selecionou pra discussão MAS escopou pra V1.1 na Área 1. Não deep-divada. Capturada em "Não-objetivos explícitos" do CONTEXT.md.

**Para revisitar em V1.1:** tom (clínico-funcional vs aspiracional), estrutura (1-page vs multi-page), CTA (solicitar acesso vs entrar).

### Área 4 — Dogfooding gate (ONBOARD-04)

**Pergunta:** Como mensurar 'passou'?

**Opções:**
- Manter strict 3 semanas (Recommended)
- Redefinir pra contagem (N=20 leituras founder)
- Decidir por feeling

**Selecionado:** Manter strict 3 semanas (Recommended)

**Notas:**
- Clock começou 2026-05-15 (Sonnet 2x v2.3.0 LIVE)
- Hoje ~1.5 semanas in; gate fecha ~2026-06-05
- 3+ leituras/semana em clientes reais (não regens de calibração)
- "Sem notas paralelas" = compromisso founder, não medível por código
- Memory `project_dogfooding_gate_status` (NEW) trackeia progress

### Decisão extra capturada — ONBOARD-02-completar (e-mail "leitura pronta")
Founder não selecionou como discuss area mas escopo D1 incluiu "completar". Batchada com dogfooding gate.

**Pergunta:** Quando disparar e-mail?

**Opções:**
- Auto quando status='ready' 1ª vez (Recommended)
- Manual via botão
- Adiar pra V1.1+

**Selecionado:** Auto quando status='ready' 1ª vez (Recommended)

**Notas:**
- Coluna `readings.notification_sent_at` (NEW) — idempotência
- Disparo server-side pós-stream (não bloquear se falhar)
- Sender = `noreply@iriscodex.com` (Fase 11 11-01 config)
- Sem signed URL — link plain pra `/leituras/[id]`, terapeuta loga se necessário

## Deferred ideas (V1.1+)

- **Landing page pública** — tom + estrutura + CTA a decidir (founder selecionou pra discuss aqui mas descopou)
- **Beta 10-20 terapeutas externos** — depende de Stripe + landing
- **Onboarding mandatory** — bloqueia uso até completar (rejeitado pra preserve skipability)
- **Signed URLs pra leitura no e-mail** — atual session-based basta
- **Feedback estruturado de 5 internos** — V1.1 com beta real
- **Métricas formais "tempo até primeira leitura"** — implicit no count semanal

## Claude's discretion items

- Plans esqueleto (09-01..05) com waves estimadas
- Migration 0032 cobrindo `notification_sent_at` + `onboarding_dismissed_at` em uma migração só (atomic, blocking)
- Backward-compat constraint pra onboarding (não aparece pra terapeutas existentes com dados)
- LGPD vocabulary audit em templates de e-mail (consistente com Fase 7)
- Memory file `project_dogfooding_gate_status` proposta (NEW) — confirmar quando 09-04 implementar

## Próximo passo

`/gsd-plan-phase 9` quando founder estiver pronto. Recomenda começar pelo 09-01 (migration blocking).
