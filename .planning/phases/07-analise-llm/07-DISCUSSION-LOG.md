# Phase 7: Análise LLM - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisões canônicas estão em `07-CONTEXT.md` — este log preserva alternativas consideradas.

**Date:** 2026-05-06
**Phase:** 07-analise-llm
**Areas discussed:** Enforcement de âncora + linguagem; Schema p/ pré-requisito Fase 10; Editor UX + granularidade do diff; Streaming UX + cost guards; Schema redundância (follow-up); Coleta L2/L3 (follow-up)

---

## Enforcement de âncora + vocabulário LGPD-06

| Option | Description | Selected |
|--------|-------------|----------|
| Regenerar silenciosamente em reprovação | Anchor rate <95% ou hit de vocabulário proibido → API regenera sem mostrar ao usuário | |
| Bloquear entrega + regenerar com aviso | Anchor rate baixo → bloqueia entrega; UI força regeneração explícita | |
| Salvar com banner de aviso, NÃO bloquear | Salva sempre; banner persistente no editor; terapeuta decide editar/entregar/descartar | ✓ |

**User's choice:** Salvar com banner; vocabulário proibido tratado da mesma forma (regex pós-stream → warning visível, não reject+retry; terapeuta corrige na edição).
**Notes:** Founder enfatizou "transparência total — não regenera silenciosamente." Decisão D-A1, D-A2 reflete a posição: confiança no terapeuta como árbitro final, IA como assistente que sinaliza problemas mas não decide por ele. Vocabulário proibido na ENTREGA (`report_delivered`) bloqueia o save (D-A2 segunda metade) — entregar ao cliente exige limpo, mas a geração crua não é punida.

---

## Schema p/ pré-requisito Fase 10 (SAC — Sistema de Aprendizado Constante)

| Option | Description | Selected |
|--------|-------------|----------|
| Adicionar AGORA via migration 0007 | Todos os campos (zonas_editadas, tipo_edição, timestamps, clinical_feedback, exam_notes, edit_diff) já no schema; resolução temporal completa desde dia 1 | ✓ |
| Só persistir textos; computar diff on-demand depois | report_generated/delivered text; Fase 10 computa diff/zonas dinamicamente quando precisar | |

**User's choice:** Adicionar agora. Lista completa solicitada (8 campos novos além de report_generated/delivered).
**Notes:** Founder explicitou "Resolução temporal importa para o SAC. Implementar agora." Phase 10 CONTEXT já avisava: "Sem esses campos persistidos desde a Fase 7, cada leitura é uma anotação perdida para sempre." Founder usou nomenclatura "SAC" (Sistema de Aprendizado Constante) — Phase 10 CONTEXT chama "Sistema de Aprendizagem Clínica"; convergir nomenclatura na plan-phase 10 (deferido).

---

## Editor UX + granularidade do diff

| Option | Description | Selected |
|--------|-------------|----------|
| Textarea único | Diff = string-diff bruto sobre todo o relatório; mais simples; perde resolução clínica | |
| Editor com 13 seções colapsáveis editáveis individualmente | Mais trabalho; zonas_editadas fica preciso por seção sem NLP | ✓ |
| Markdown editor com preview | Intermediário; uma área de edição mas com renderização live | |

**User's choice:** 13 seções colapsáveis.
**Notes:** Justificativa explícita do founder: "zonas_editadas por seção é o sinal mais valioso para o Sistema de Aprendizado Constante. Diff bruto perde informação clínica. O esforço de implementação vale o ganho de qualidade do dado capturado." Decisão D-U1 escolhe `react-markdown` + `<textarea>` split como recomendação default (planner pode trocar para `@uiw/react-md-editor`).

---

## Streaming UX + cost guards

| Option | Description | Selected |
|--------|-------------|----------|
| Route Handler + Web Streams | Controle total sobre headers/retry/abort; persistência incremental viável | ✓ |
| Server Action streamable | Alinhado com Next.js 15 RSC; abstrai stream; mais difícil persistir parcial | |
| Persistência ao final do stream | Mais simples; perde se cair no meio | |
| Persistência incremental chunk-a-chunk | Sobrevive a refresh; UX premium; mais complexo | ✓ |
| Regenerar ilimitado | Sem cap; maior custo possível em abuso | |
| Regenerar máximo N tentativas (N=3) | Cap rígido por leitura; bloqueia se já há report_delivered | ✓ |
| Bloquear regenerar baseado em status | Se já entregou, não pode regerar | ✓ |
| Cost guard: log + alerta acima de threshold | Monitora abuso (>10/mês/terapeuta) sem bloquear automaticamente | ✓ |

**User's choice:** Route Handler + Web Streams; persistência incremental; máx 3 regenerações por leitura; bloqueado se report_delivered existe; alerta acima de 10/mês mas não bloqueia.
**Notes:** Founder priorizou UX premium ("sobrevive a refresh") e abuse-resistance pragmática (cap por leitura é hard guard; cap por terapeuta é só monitoria). Decisão D-S1..S4 detalha section-boundary parsing para persistência (não por delta event), telemetria estruturada em `regeneration_log` jsonb, e Fluid Compute timeout 5min.

---

## Follow-up: Schema redundância (ai_report_raw text vs report_generated jsonb)

| Option | Description | Selected |
|--------|-------------|----------|
| Substituir (drop existentes) | Migration 0007 dropa ai_report_raw/edited; jsonb vira único canônico; LLM-04 atualizado em REQUIREMENTS.md | |
| Coexistir (keep both) | Texto + jsonb populados em lockstep; duplicação de storage | |
| Coexistir como GENERATED column | jsonb canônico; text recalculado pelo Postgres via função IMMUTABLE; sem duplicação real | ✓ |

**User's choice:** GENERATED column.
**Notes:** Decisão limpa que mantém contrato LLM-04 (text columns continuam existindo) sem duplicar dado nem manter sync manual. Função `jsonb_concat_sections_pt_br(jsonb) RETURNS text IMMUTABLE` faz o trabalho. Detalhado em D-P1.

---

## Follow-up: UI/fluxo de coleta L2/L3 (clinical_feedback, exam_notes)

| Option | Description | Selected |
|--------|-------------|----------|
| Só schema agora | Migration 0007 inclui colunas; UI/fluxo de coleta fica para Fase 9 | ✓ |
| Schema + UI mínimo | Migration + formulário in-app simples sem reminder por e-mail | |
| Schema + UI completo + lembrete | Tudo: migration + UI + e-mail Resend +24h após delivered_at | |

**User's choice:** Só schema agora.
**Notes:** Decisão de escopo conservadora — risco zero de bloqueio na entrega da Fase 7. Resend só entra na Fase 9 (ONBOARD-02), e founder vai validar L2/L3 cadência durante dogfooding semanal antes de cristalizar a UI. Detalhado em D-F1.

---

## Claude's Discretion

Áreas onde founder não fixou opinião e o planner tem latitude (lista detalhada em CONTEXT.md `<decisions>` §Claude's Discretion):

- Definição exata de "afirmação" para cálculo do anchor rate (sentence vs parágrafo vs bullet) — recomendação: sentence-split.
- Protocolo de stream (SSE vs plain text chunked) — recomendação: plain text chunked.
- Lib de markdown rendering no editor — recomendação: `react-markdown` + `remark-gfm` + `<textarea>` split.
- Lib de diff — recomendação: `diff` npm.
- Threshold 30% entre "corrigido" e "reescrito".
- Ordem de chamadas paralelas no Route Handler.
- Naming exato de arquivos novos.
- Estratégia de Anthropic prompt caching para o system prompt (~2k tokens, TTL 5min) — recomendação: usar.
- Posicionamento do botão "gerar análise" no DOM (RSC vs client component pequeno).

---

## Deferred Ideas

(Lista canônica em `07-CONTEXT.md` `<deferred>`. Resumo:)

- UI L2/L3 → Fase 9 (Resend já entra lá)
- PDF do relatório → Fase 8 (junto com termo LGPD-01)
- Auto-trigger pós-webhook Fase 5 → Fase 9 se UAT pedir
- Alerta automático de abuso (e-mail/Slack) → Fase 9
- Análise temporal evolutiva → v2
- Multi-mapa Jensen+Hidalgo+Jausas → v2
- Reranking RAG ajuste → reabrir se UAT mostrar ruído
- Edição de vision_features pelo terapeuta → fora (Fase 5 D-T4)
- HyDE para Família B → reabrir se gap em seções abstratas
- Heurísticas / scoring clínico próprio → Fase 10
- Prompt versionado automaticamente → Fase 10
- Re-audit batch para auditor_version antiga → quando v2 do auditor existir
- Streaming de progresso visual no editor → polish Fase 9
- Convergir nomenclatura "SAC" vs "Sistema de Aprendizagem Clínica" → housekeeping na plan-phase 10
