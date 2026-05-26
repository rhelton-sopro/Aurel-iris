# Fase 11 — Discussion log

**Data:** 2026-05-25 (sessão pós-GSD-resync)
**Modo:** `/gsd-discuss-phase 11` (default mode, 4 áreas)
**Output:** `11-CONTEXT.md`

## Carregando de fases anteriores
- Launch v1 = B2B convite, sem cobrança (memory `project_b2c_registration_future_phase`, 2026-05-18)
- Stripe (Fase 8) + LGPD-01..06 = V1.1+ backlog
- Resend DNS já validado 2026-05-19 (4 records Hostinger)
- MIN_AGE=0 setado em commit `7fae0f2` pra beta
- 3 launch gates ativos com memory tracking explícito

## Áreas selecionadas (multiselect)
✅ Identidade do e-mail sender
✅ Consent term — bloqueia ou não
✅ Primeiro convite — quem e como
✅ Critério de fechar Fase 11

(Founder selecionou TODAS as 4.)

## Discussão por área

### Área 1 — Identidade do e-mail sender
**Pergunta:** Qual identidade pro e-mail sender em @iriscodex.com?

**Opções apresentadas:**
- `noreply@` (Recommended) — convenção transacional
- `relatorios@` — contextual ao produto
- `contato@` — voz humana ambígua
- `rhelton@` — voz pessoal founder (não escala)

**Selecionado:** `noreply@iriscodex.com` (Recommended)

**Notas:**
- Decisão consistente com convenção universal de transacional.
- Não precisa criar inbox real `noreply@`.
- Mitigação pra terapeutas que respondem: CTA no corpo (WhatsApp founder).

### Área 2 — Consent term — bloqueia ou não
**Pergunta:** Como tratar o consent term v1 (AI-drafted, sem revisão jurídica)?

**Opções apresentadas:**
- Path B: liberar v1 com trigger (Recommended) — N=5 OR ANPD reclamação
- Path A: advogado ANTES — bloqueia 1-3 semanas
- Path C: híbrido — lança com v1 + advogado em paralelo + re-aceite quando v2 sair

**Selecionado:** Path B (Recommended)

**Notas:**
- Founder libera consciente pra ≤5 terapeutas.
- Risco aceito explicitamente pra beta com N pequeno e conhecido.
- Memory trigger ATIVA mantida com data-limite a definir (60 dias do primeiro convite, founder anota em memory).

### Área 3 — Primeiro convite — quem e como
**Pergunta:** Quem recebe o primeiro convite formal e em que regime?

**Opções apresentadas:**
- Terapeuta real conhecido, hand-held (Recommended)
- E-mail-teste seu primeiro, terapeuta depois (mais conservador, +1 dia)
- Terapeuta real, autosserviço puro (estresse-teste real, mas requer ONBOARD-01 que não tem)

**Selecionado:** Terapeuta real conhecido, hand-held (Recommended)

**Notas:**
- Founder avisa por WhatsApp/call antes do magic-link.
- Founder fica disponível pra debug em tempo real.
- ONBOARD-01 (3-step onboarding) NÃO é pré-requisito — hand-held substitui.
- Identidade da terapeuta-piloto é decisão do founder off-system.

### Área 4 — Critério de fechar Fase 11
**Pergunta:** Quando a Fase 11 está fechada?

**Opções apresentadas:**
- Terapeuta completa fluxo E2E (Recommended) — signup→cliente→6 fotos→relatório
- 1 e-mail real entregue + sender autenticado — critério técnico, não de produto
- Terapeuta entrega 1 relatório a 1 cliente final dela — critério da Fase 9, não 11

**Selecionado:** Terapeuta completa fluxo E2E (Recommended)

**Notas:**
- Fase 11 ≠ Fase 9: completar E2E não exige entrega ao cliente final.
- Founder pode estar no loop pra debug, mas não pode fazer ação por ela.
- Friction-points observados durante smoke ficam pra Fase 9 atacar.

## Side-task fora do escopo do discuss (resolvido)
- Founder pediu zerar regen_count da Nailli mid-discussion. Executado: 2 readings reset (`eb818f3c` 3→0, `36b5abd0` 1→0). Não afeta Fase 11.

## Deferred ideas (capturadas pra backlog)
Nenhuma — founder manteve foco no escopo Fase 11 sem desviar.

## Claude's discretion items
- Estrutura dos 3 plans (11-01/02/03) seguindo padrão já estabelecido no esqueleto do CONTEXT.md de noite. Refinamento granular em `/gsd-plan-phase 11`.
- Inclusão de 11-04 (smoke E2E) como plan separado vs subtask do 11-01 — Claude optou por plan separado pra rastreabilidade.
- Canonical refs section preenchida com pointers a memory + ROADMAP + PROJECT.md sem perguntar.

## Próximo passo
`/gsd-plan-phase 11` quando founder estiver pronto. Execução recomendada: 11-02 (Claude) em paralelo com 11-01 (founder Resend dashboard).
