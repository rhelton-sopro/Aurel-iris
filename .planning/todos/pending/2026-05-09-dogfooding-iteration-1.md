---
created: 2026-05-09
title: Dogfooding iteration 1 — fixes pós-Nailli (08/05/2026)
area: cross-phase (vision + llm + audit)
files:
  - vision-service/pipeline/segment.py
  - vision-service/pipeline/normalize.py
  - vision-service/pipeline/extract_features.py
  - apps/web/prompts/system.md
  - apps/web/lib/anthropic/parser.ts
  - apps/web/lib/anthropic/audit.ts
  - apps/web/lib/anthropic/types.ts
  - apps/web/app/leituras/[id]/editar/**
priority: critical
resolves_phase: null
source: análise da primeira leitura real (Nailli, 37 anos, hematogênica) gerada em 2026-05-08
related_commits:
  - c559470 fix(audit) skip encerramento_disclaimer
  - 3b423aa fix(parser) accept ## N. headings
  - bb481c6 fix(prompts) harden system.md vocab discipline
---

> Baseado na análise da primeira leitura real (Nailli, 37 anos, hematogênica) gerada em 08/05/2026.
> Comparação entre relatório gerado pelo pipeline atual e prompt original de referência.

---

## Prioridade 1 — Crítico (resolver antes da próxima rodada de dogfooding)

### [ ] B1. Threshold de lacuna calibrado por constituição
- [ ] Investigar causa do padrão uniforme no OD da Nailli (12/12 setores, lacunas grau 1, sizes 25.66–26.88mm)
- [ ] Hipótese 1: CLAHE realça textura de pigmento como "lacuna" em íris castanha
- [ ] Hipótese 2: Threshold de detecção invariante por constituição (calibrado para íris claras)
- [ ] Hipótese 3: Daugman normalization amplifica ruído em íris muito pigmentada
- [ ] Implementar dual threshold: após classificação inicial de constituição, threshold de lacuna sobe se hematogênica
- [ ] Validar com 10–15 capturas de íris hematogênicas antes de generalizar
- [ ] Acceptance: íris castanha NÃO retorna lacunas em 12/12 setores com tamanhos uniformes

### [ ] A1. Forçar 16 seções no system prompt (não 13)
- [ ] Editar `system.md` para incluir explicitamente:
  - [ ] Seção 5 — Padrões Psicoemocionais (interpretação dos sinais)
  - [ ] Seção 6 — Estado Mental (clareza, tensão nervosa, foco, estabilidade cognitiva)
  - [ ] Seção 7 — Perfil Emocional (modo funcional emocional, polaridades, padrões recorrentes)
  - [ ] Seção 8 — Psicossomática e Traumática (ponte explícita corpo↔psique)
- [ ] Atualizar parser para reconhecer 16 boundaries em vez de 13
- [ ] Atualizar schema do `report_generated` (jsonb) para 16 chaves + encerramento_disclaimer
- [ ] Atualizar UI accordion `/leituras/[id]/editar` para 16 seções
- [ ] Acceptance: novo relatório retorna 16 seções todas preenchidas

### [ ] A2. Regra de duas vozes (fato incisivo vs. interpretação hipotética)
- [ ] Adicionar bloco ao system prompt:
  ```
  Regra de duas vozes:
  - Achados geométricos: precisão e firmeza factual (raio em mm, setor, anatomia). Estilo Jensen incisivo.
  - Interpretação clínica/psicoemocional: linguagem hipotética.
  - NUNCA misture as duas vozes na mesma cláusula.
  ```
- [ ] Adicionar exemplo correto e exemplo incorreto no prompt
- [ ] Acceptance: relatório novo separa claramente "fato" de "hipótese" em frases distintas

### [ ] A3. Reforçar regra do encerramento literal
- [ ] Adicionar ao system prompt:
  ```
  NÃO inclua o encerramento literal você mesmo. O servidor adiciona automaticamente.
  Se a seção 13 (ou última seção) terminar com "Esta leitura iridológica é uma ferramenta...",
  isso será duplicado no relatório final.
  ```
- [ ] Acceptance: zero duplicação de encerramento na próxima leitura

---

## Prioridade 2 — Polimentos rápidos (sem custo de tokens)

### [ ] C1. Refinar regex do anchor_rate
- [ ] Audit hoje espera `[ancorado em: features.X]`
- [ ] Sonnet escreve `[Ancorado em: \`feature.path\`]` (A maiúsculo, path em backticks)
- [ ] Resultado: `low_anchor_rate=true, anchor_rate_pct=0` em todo relatório, mesmo perfeito
- [ ] Relaxar regex: aceitar variações de capitalização, com/sem backticks, com/sem prefixo `features.`
- [ ] Acceptance: anchor_rate > 60% em relatório bem ancorado

### [ ] C2. Skip uso negativo no audit de vocab proibido
- [ ] Audit hoje flaga "não um diagnóstico" como hit de vocab proibido
- [ ] Sonnet usa a construção negativa corretamente (alinhado com LGPD)
- [ ] Adicionar lookbehind no regex: se "diagnóstico" vier após "não um", "não constitui", "não é", "não substitui" → não conta como hit
- [ ] Acceptance: relatório com construção negativa correta passa com 0 hits

---

## Prioridade 3 — Pipeline visual (médio prazo, alto valor clínico)

### [ ] B3. Topografia detalhada da pupila
- [ ] JSON hoje: `{shape: "circular", size_ratio: 0.18, centralization: "centrada"}`
- [ ] Adicionar campo `pupil_geometry` com:
  - [ ] Achatamentos setoriais (achatamento superior → cervical alta)
  - [ ] Índice de ovalização (ansiedade, desregulação autônoma)
  - [ ] Descentralização por quadrantes (correlação com hemicorpo)
- [ ] Geometricamente extraível, baixo custo computacional
- [ ] Acceptance: nova leitura traz `pupil_geometry` populado e Sonnet interpreta

### [ ] B5. Confidence por setor, não só global
- [ ] Hoje composite_score é por olho (ex: OE 0.85, OD 0.75)
- [ ] Pestanas frequentemente cobrem setores 11–12–1; esses setores deveriam ter confidence rebaixado automaticamente
- [ ] Calcular `sector_confidence[1..12]` por olho baseado em:
  - [ ] Oclusão por pestana
  - [ ] Reflexos residuais
  - [ ] Iluminação local
- [ ] Adicionar regra ao system prompt:
  ```
  Para setores com confidence < 0.6, declare brevemente a baixa confiabilidade da captura
  e abstenha-se de interpretação detalhada nesse setor.
  ```
- [ ] Acceptance: relatório identifica e declara setores de baixa confidence em vez de inventar achados

### [ ] B2. Detecção de pigmentos psóricos discretos
- [ ] JSON hoje retorna `psoric_spots: []` na maioria das leituras
- [ ] Implementar detecção de blob por cor (não apenas geométrica): diferenças de tonalidade local vs. média da íris-base
- [ ] Em hematogênica: manchas mais escuras ou com tonalidade diferente da íris-base
- [ ] Em azul/mista: manchas psóricas clássicas
- [ ] Acceptance: pipeline detecta pelo menos 1 pigmento em íris que tem visualmente

---

## Prioridade 4 — Pipeline visual (longo prazo, transformacional)

### [ ] B6. Mapeamento biográfico granular
- [ ] Adicionar campo `biographical_timeline` ao JSON, mapeando setor → faixa etária específica
- [ ] Referência: escola alemã (Lindemann) tem mapeamento ano-a-ano do relógio biográfico
- [ ] Sonnet redigiria seção 6 (Cargas Temporais) com idades mais precisas que "0–7 anos" / "7–14 anos"
- [ ] Adicionar fontes ao RAG: documento Lindemann sobre cronobiologia da íris
- [ ] Acceptance: hipóteses de cargas temporais saem com faixas de 2–3 anos, não 7

### [ ] B4. Photometric stereo — usar profundidade, não só fusão
- [ ] Hoje as 3 fotos por olho são usadas apenas para minimizar reflexos via fusão
- [ ] A diferença entre as 3 iluminações permite extrair relevo real das fibras e profundidade das lacunas
- [ ] Diferenciar lacuna grau 1 (rasa, genótipo) de grau 3 (profunda, fenótipo ativo)
- [ ] Hoje o pipeline força tudo para grau 1 por não medir profundidade
- [ ] Provavelmente Fase 10 (Clinical Learning System) ou Fase 11
- [ ] Acceptance: lacunas saem com `depth_grade: 1|2|3` baseado em medição real

---

## Validação — Critérios da próxima rodada de dogfooding

Após implementar P1 (B1 + A1 + A2 + A3) + P2 (C1 + C2), rodar 3 capturas em sequência:

1. [ ] Íris castanha hematogênica (valida B1)
2. [ ] Íris azul/mista (valida que B1 não regrediu)
3. [ ] Íris da Nailli reanalisada (comparar relatório novo vs. atual)

Critérios de sucesso:
- [ ] 16 seções todas preenchidas
- [ ] Anchor rate > 60%
- [ ] Zero hits de vocab proibido (com C2 implementado)
- [ ] Sem padrão uniforme artificial no OD castanho
- [ ] Relatório com voz dupla bem separada (fato incisivo / interpretação hipotética)
- [ ] Zero duplicação de encerramento

---

## Notas de contexto

- Primeira leitura real bem-sucedida: 08/05/2026, Nailli 37 anos, hematogênica
- Custo médio observado: ~$0.30 por leitura (Sonnet ~120k tokens em 2 testes = $0.60)
- Webhook chain validado: Modal → Vercel → Supabase
- Migration 0008 aplicada: coluna `report_raw_text` para captura defensiva
- Bug de encerramento duplicado documentado e fix do prompt em fila
- Bug de audit (encerramento_disclaimer) corrigido em commit c559470

---

## Triagem para fan-out em phase plans

Esta TODO é raw input — não plan executável. Próximo passo de planejamento (sugerido):

**Opção A — Phase 7.1 dedicada** (recommended):
- `/gsd-insert-phase 7.1 "Dogfooding fixes — Iteração 1"` cria `phases/07.1-dogfooding-fixes/`
- P1 (4 plans) + P2 (2 plans) = 6 plans para fechar antes da próxima dogfooding
- P3/P4 ficam neste todo como backlog até decisão de promoção

**Opção B — Distribuir entre fases existentes**:
- A1/A2/A3/C1/C2 → patches no Phase 7 (já fechada — risco de re-abrir)
- B1/B3/B5/B2 → backlog para Phase 5 (também fechada)
- B4/B6 → backlog para Phase 10/11 (futuro)

**Opção C — Manter aqui como living doc**:
- Atacar P1+P2 inline com `/gsd-fast` ou commits diretos, marcando checkboxes neste arquivo
- Risco: sem plan-checker / Nyquist gates / atomic commits estruturados

Recomendação: **Opção A**. P1+P2 atravessam vision (Python) + LLM (TS) + UI + schema; merece scoping próprio e gates próprios.
