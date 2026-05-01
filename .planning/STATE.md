---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-05-01T11:34:19.832Z"
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 10
  completed_plans: 6
  percent: 60
---

# Estado do projeto

## Referência ao projeto

Ver: .planning/PROJECT.md (atualizado em 2026-04-30)

**Valor central:** Cada cliente atendido produz um JSON de features genuinamente diferente, e por isso cada relatório é genuinamente diferente. Pipeline de visão objetivo + LLM ancorado em RAG é o coração do produto.
**Foco atual:** Fase 2 — Auth + Dashboard básico.

## Posição atual

Fase: 2 de 9 (Auth + Dashboard básico)
Plan: 0 de 4 na fase atual
Status: Executing Phase 02
Última atividade: 2026-05-01 — Fase 2 planejada: 4 plans em 4 waves (Supabase Auth infra → Auth pages → Dashboard layout → CRUD clientes + smoke test).

Progresso: [█░░░░░░░░░] 11% (1/9 fases)

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
- **Database password apareceu no chat (2026-05-01):** durante execução do plan 01-05 (RLS test), `AurelIris123` foi colada em conversa. Rotacionar via Supabase Dashboard antes de qualquer dogfooding real (Estágio 1 do PROJECT.md). Atualizar `.env.local` (gitignored) e Vercel env `SUPABASE_SERVICE_ROLE_KEY` se rotacionar.

## Itens diferidos

Nenhum (bootstrap inicial, sem milestone anterior).

| Categoria | Item | Status | Diferido em |
|-----------|------|--------|-------------|
| *(nenhum)* | | | |

## Continuidade de sessão

Última sessão: 2026-05-01
Parou em: Fase 1 (Setup) **concluída**. Repo movido de D:/GDrive/iridologista para D:/Projetos/Iridologista. Monorepo pnpm com apps/web/ (Next.js 15 + shadcn/ui) e vision-service/ (Python skeleton). Supabase Aurel Iris em sa-east-1 (ref owgbrllpznsngrkvodyw) com schema do SPEC §3 + migration 0002 (grants para authenticated role) aplicado. RLS verificada cross-terapeuta no remoto via teste SQL idempotente em supabase/tests/. Deploy production verde em https://aurel-iris-web.vercel.app/ (Vercel gru1). 4 SETUP requirements (01..04) cobertos. Critério `select autenticado from clients` deferido pra Fase 2.
Arquivo de retomada: `.planning/phases/02-auth-dashboard-basico/02-CONTEXT.md` — próxima ação é `/gsd-plan-phase 2`.
