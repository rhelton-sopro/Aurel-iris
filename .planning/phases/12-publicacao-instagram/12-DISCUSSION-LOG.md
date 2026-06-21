# Phase 12: publicacao-instagram - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 12-publicacao-instagram
**Areas discussed:** Cadência & pontualidade do cron, Falha & re-tentativa, Ciclo do token (60 dias), "Publicar agora" nesta fase

---

## Cadência & pontualidade do cron

| Option | Description | Selected |
|--------|-------------|----------|
| A cada 15 min | Publica até ~15min após o slot; poucas chamadas | |
| A cada 5 min | Quase pontual; mais invocações | |
| De hora em hora | Mais simples/barato; post pode sair até ~1h depois | ✓ |

**User's choice:** De hora em hora
**Notes:** Atraso de até 1h aceitável. Combinado com o "publicar agora" (D-08), a validação imediata não depende da cadência.

---

## Falha & re-tentativa

| Option | Description | Selected |
|--------|-------------|----------|
| Re-tenta 2x + erro visível no /admin | Re-tenta nas próximas 2 passadas; persistindo, marca erro + central de notificações | ✓ |
| Sem re-tentativa; erro na hora | Marca erro na 1ª falha, reenfileira manual | |
| Re-tenta até dar certo | Insiste sempre; risco de loop em erro permanente | |

**User's choice:** Re-tenta 2x + erro visível no /admin
**Notes:** Sucesso fica silencioso (só marca publicado + permalink); apenas falha alerta.

---

## Ciclo do token (60 dias)

| Option | Description | Selected |
|--------|-------------|----------|
| Health-check + refresh automático + alerta | Renova antes de expirar; só avisa se falhar | ✓ |
| Só health-check + alerta pra renovar manual | Sem refresh; founder regenera a cada ~60d | |

**User's choice:** Health-check + refresh automático + alerta
**Notes:** Objetivo: founder quase nunca precisa mexer no token.

---

## "Publicar agora" nesta fase?

| Option | Description | Selected |
|--------|-------------|----------|
| Só cron agora; botão na Fase 13 | Mantém a fase enxuta; testar via endpoint do cron | |
| Incluir "publicar agora" na Fase 12 | Botão no painel pra forçar imediato; ótimo pra testar e2e | ✓ |

**User's choice:** Incluir "publicar agora" na Fase 12
**Notes:** Reaproveita o mesmo caminho de publicação do cron. Vira a ferramenta de validação end-to-end.

---

## Claude's Discretion

- Estrutura do endpoint do cron, layout das env vars, poll de status do reel, schema de erro/permalink, mecânica do lock de idempotência.
- Sucesso silencioso (sem notificação).

## Deferred Ideas

- Cockpit/timeline polido do painel → Fase 13.
- Loop de métricas/Insights API → Fase 14.
- Multi-conta / publicar em terceiros (exigiria App Review) → fora do v1.1.
