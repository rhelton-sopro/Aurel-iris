---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-05-02T00:41:18.710Z"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 18
  completed_plans: 15
  percent: 83
---

# Estado do projeto

## Referência ao projeto

Ver: .planning/PROJECT.md (atualizado em 2026-04-30)

**Valor central:** Cada cliente atendido produz um JSON de features genuinamente diferente, e por isso cada relatório é genuinamente diferente. Pipeline de visão objetivo + LLM ancorado em RAG é o coração do produto.
**Foco atual:** Fase 3 — Captura mobile (PWA), planejada e pronta para executar.

## Posição atual

Fase: 3 de 9 (Captura mobile / PWA)
Plan: 0 de 8 na fase atual
Status: Executing Phase 03
Última atividade: 2026-05-01 — Fase 3 planejada: 8 plans em 8 waves (Wave 0 vitest+migration → PWA shell → entry points → camera shell → MediaPipe core → sequência guiada → captura+upload → recovery+finalize).

Progresso: [██░░░░░░░░] 11% (1/9 fases)

## Métricas de performance

**Velocidade:**

- Total de plans concluídos: 6
- Duração média: ~12 min/plan (incluindo descoberta+fix de bug de grants e 3 iterações de vercel.json)
- Tempo total de execução: ~75 min de Wave 1 ao deploy production

**Por fase:**

| Fase | Plans | Total | Média/plan |
|-------|-------|-------|------------|
| 1 — Setup | 6 | ~75 min | ~12 min |

**Tendência recente:**

- Últimos 5 plans: —
- Tendência: — (sem amostra ainda)

*Atualizado após a conclusão de cada plan.*

## Contexto acumulado

### Decisões

Decisões são logadas em PROJECT.md (tabela "Decisões-chave").
Decisões recentes que afetam o trabalho atual:

- **Bootstrap (2026-04-30):** stack inteira do SPEC herdada como "decidida sem ADR ratificado" — pode ser honrada ou re-decidida via ADR em qualquer fase.
- **Bootstrap (2026-04-30):** métrica de sucesso primária = uso semanal real do fundador em clientes reais; beta com 10–20 terapeutas é Estágio 2 condicional.
- **Bootstrap (2026-04-30):** LGPD + posicionamento "ferramenta de apoio à anamnese, não diagnóstico" tratados como restrições não-negociáveis em PROJECT.md (vocabulário proibido, copy obrigatória, ancoragem do prompt em features do JSON).

### Todos pendentes

Nenhum ainda.

### Bloqueadores / Preocupações

- **Sem ADRs ratificados:** as 21 constraints do SPEC (Next.js / Supabase / Modal / Sonnet 4.6 / Voyage / Stripe / Resend) estão como `locked: false`. Não bloqueia execução, mas qualquer plan-phase deve estar consciente de que pode formalmente re-decidir via ADR — particularmente antes da Fase 5 (Modal) e Fase 7 (LLM), onde a escolha tem maior impacto técnico.
- **Revisão jurídica healthtech (~R$ 2–4k) recomendada antes de qualquer rollout externo na Fase 9.** Não é pré-requisito para dogfooding interno do fundador (Estágio 1), mas é gate para Estágio 2.
- **Corpus RAG seed (Fase 6) depende de obter PDFs de Jensen Vol. 1 e Battello em pt** — verificar disponibilidade legal/licenciamento antes de ingerir.

## Itens diferidos

Nenhum (bootstrap inicial, sem milestone anterior).

| Categoria | Item | Status | Diferido em |
|-----------|------|--------|-------------|
| *(nenhum)* | | | |

## Continuidade de sessão

Última sessão: 2026-05-01
Parou em: **Fase 3 (Captura mobile / PWA) planejada e pronta para executar**. 8 plans em 8 waves cobrindo todas as 6 CAPTURE requirements: Wave 0 (vitest + migration 0004 com bucket `iris-captures` privado + RLS folder + unique constraint reading_images) → Wave 1 (PWA shell com Serwist) → Wave 2 (server actions + entry pages) → Wave 3 (camera shell + useCamera + CameraDeniedScreen) → Wave 4 (MediaPipe FaceLandmarker lazy-loaded + 7 sub-scores + 400ms gate) → Wave 5 (sequência guiada 6 capturas) → Wave 6 (compressão JPEG 0.85/2048px + Storage upload) → Wave 7 (RecoveryBanner + PWAInstallBanner + finalize). Plan-checker passou com 5 warnings cosméticos (0 blockers). Stack novo: `@mediapipe/tasks-vision` 0.10.35 + `@serwist/next` 9.5.10 + `sonner` 2.0.7. Plans 03-04..03-08 são `autonomous: false` (UAT manual em iPhone+Android obrigatória). Note: Fase 2 ainda tem plans listados como concluídos no STATE histórico mas tracking real do execute precisa ser revisitado — esta sessão focou em Fase 3 plan only.
Arquivo de retomada: `.planning/phases/03-captura-mobile-pwa/03-01-PLAN.md` — próxima ação é `/clear` + `/gsd-execute-phase 3`.
