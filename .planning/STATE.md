# Estado do projeto

## Referência ao projeto

Ver: .planning/PROJECT.md (atualizado em 2026-04-30)

**Valor central:** Cada cliente atendido produz um JSON de features genuinamente diferente, e por isso cada relatório é genuinamente diferente. Pipeline de visão objetivo + LLM ancorado em RAG é o coração do produto.
**Foco atual:** Fase 1 — Setup.

## Posição atual

Fase: 1 de 9 (Setup)
Plan: 0 de 6 na fase atual
Status: Pronto para executar (`/gsd-execute-phase 1`)
Última atividade: 2026-04-30 — Fase 1 planejada (6 planos, 4 waves) e verificada após 1 ciclo de revisão.

Progresso: [░░░░░░░░░░] 0%

## Métricas de performance

**Velocidade:**
- Total de plans concluídos: 0
- Duração média: —
- Tempo total de execução: —

**Por fase:**

| Fase | Plans | Total | Média/plan |
|-------|-------|-------|------------|
| — | — | — | — |

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

Última sessão: 2026-04-30
Parou em: Fase 1 planejada — 6 planos em 4 waves (1: scaffold web+vision; 2: supabase init+migration+link; 3: BLOCKING db push+types; 4: RLS test remoto + Vercel deploy). Revisão 1× resolveu 2 blockers + 4 warnings (deferimento do critério `select autenticado` para Fase 2; correções em verify chains, RLS test methodology, wave deps).
Arquivo de retomada: `.planning/phases/01-setup/` — próxima ação é `/gsd-execute-phase 1`.
