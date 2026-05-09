---
created: 2026-05-09
updated: 2026-05-09 (sessão tarde — ground truth correction + 5 novos itens + reordering por waves)
title: Dogfooding iteration 1 — fixes pós-leitura real (08/05/2026)
area: cross-phase (vision + llm + audit + UX)
files:
  - vision-service/pipeline/features.py
  - vision-service/pipeline/schemas.py
  - vision-service/pipeline/segment.py
  - apps/web/prompts/system.md
  - apps/web/lib/anthropic/parser.ts
  - apps/web/lib/anthropic/audit.ts
  - apps/web/lib/anthropic/types.ts
  - apps/web/app/leituras/[id]/editar/**
priority: critical
resolves_phase: null
source: análise da primeira leitura real (08/05/2026) — íris do próprio Rhelton, cadastro feminino fictício para teste
ground_truth:
  subject: Rhelton (masculino)
  cadastro_no_DB: feminino fictício (a "Nailli")
  classificação_correta:
    constitution: mista biliar
    iris_color_primary: misto (verde/castanho com pigmento)
    pigmento_setorial: amarelo-âmbar bilateral
    sexo_real: masculino (relatórios interpretando útero/ovário foram ficção do cadastro)
related_commits:
  # Sessão 2026-05-08 (manhã)
  - c559470 fix(audit) skip encerramento_disclaimer
  - 3b423aa fix(parser) accept ## N. headings
  - bb481c6 fix(prompts) harden system.md vocab discipline
  # Sessão 2026-05-09 (manhã + tarde)
  - 3df9aa8 feat(editar) FullReportCopyBlock
  - 889cc94 fix(vision) mask filter no k-means (B1a — RESOLVED)
  - 1e58a88 fix(audit) C1+C2 regex polish (RESOLVED)
---

> **Atualização crítica 2026-05-09 (tarde):** A leitura "Nailli" é na verdade as íris do **Rhelton** (masculino, mista biliar com pigmento amarelo-âmbar setorial bilateral), com cadastro fictício feminino para teste. Isso transforma a leitura em **fixture de ground truth real** — sabemos a classificação correta e podemos validar cada iteração contra ela. Relatórios interpretando útero/ovário foram ficção induzida pelo cadastro errado, não interpretação iridológica.

---

## Status executivo

### ✅ Resolvido nesta iteração
- **B1a — mask filter no k-means** (commit `889cc94`). Antes: toda íris classificava como castanho/hematogenea porque cluster maior do k-means era pixels de mask preto. Depois: pixels mask filtrados via `rgb_pixels.sum(axis=1) > 0`. Verificado via 8 testes em `vision-service/tests/test_color_classifier_diagnostic.py` (4 cores sintéticas + Nailli regression guard explícito + 2 probes de matemática + 1 baseline). **Pendente: Modal redeploy + reprocess da Nailli/Rhelton para validar in-vivo.**
- **C1 — ANCHOR_RE relaxado** (commit `1e58a88`). Aceita capital "Ancorado", backticks em volta do path, prefixo `features.` opcional.
- **C2 — extractForbiddenHits skip LGPD-aware** (commit `1e58a88`). "não um diagnóstico" / "não substitui tratamento" / "não é diagnóstico" / etc passam com 0 hits via `NEG_CONTEXT_RE` + lookback de 30 chars. Skip propaga ao save-action defense-in-depth.

### 🟡 Em ordem de execução (Waves)
Detalhe por item nas seções abaixo. Decisões de ordenação registradas em "Decisões registradas".

| Wave | Itens | Custo aprox | Bloqueia |
|---|---|---|---|
| **A** | P0c + A2 + A3 (prompt-only) | ~1hr total, prompt edits | nada |
| **B** | P0a + P0b bundled (vision schema) | 3-5hrs, schema + Pydantic + TS regen + Modal redeploy | B1b, P1a, B1c |
| **C** | B1b (recalibrar centroides com fixtures reais) | 1-2hrs após coletar fixtures | P1a |
| **D** | P1a (distribuição %) + B1c (threshold lacuna por constituição) | 2-4hrs | nada |
| **E** | P1b (com attestation checkbox; face-detection é gold-plating) | ~30min checkbox / +6-10hrs auto | nada |
| **independente** | A1 (16 seções) | grande, paraleliza com B/C/D | nada |
| **backlog P3** | B3, B5 | médio prazo | nada |
| **backlog P4** | B6, B4 | longo prazo / Fase 10+11 | nada |

---

## Wave A — Prompt-only (cheap wins, próxima sessão)

### [ ] P0c. Sonnet declara base de cada interpretação
- [ ] Adicionar bloco ao `apps/web/prompts/system.md`:
  ```
  Regra de declaração de base:
  - Quando a interpretação depende de campos do cadastro (sexo, idade, queixas)
    OU de feature com confidence < 0.6, declare isso EXPLICITAMENTE no texto.
  - Exemplos:
    "Considerando o cadastro de paciente feminina, a zona pélvica reflete..."
    "A baixa confidence do setor 11 (oclusão por pestana) limita a interpretação;
     hipótese tentativa apenas..."
  - Se um campo do cadastro estiver ausente, NÃO assuma — explicite a lacuna.
  ```
- [ ] Adicionar ao prompt um exemplo correto (declaração explícita) e um exemplo
      incorreto (extrapolação silenciosa) — Sonnet aprende padrões.
- [ ] **Razão de prioridade:** o teste real teve cadastro errado (masculino com
      cadastro feminino) e o relatório virou ficção uterina. Esse fix sozinho
      teria preservado auditabilidade — terapeuta veria "considerando cadastro
      feminino" e poderia parar e corrigir o cadastro.
- [ ] Acceptance: pegar fixture com cadastro deliberadamente errado (ex: idade
      improvável), gerar relatório, verificar que cada interpretação cadastro-
      dependente declara a base.

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

### [ ] A3. Reforçar regra do encerramento literal (anti-duplicação)
- [ ] Adicionar ao system prompt:
  ```
  NÃO inclua o encerramento literal você mesmo. O servidor adiciona automaticamente.
  Se a seção 13 (ou última seção) terminar com "Esta leitura iridológica é uma ferramenta...",
  isso será duplicado no relatório final.
  ```
- [ ] Acceptance: zero duplicação de encerramento na próxima leitura

---

## Wave B — Vision schema bundled (uma migration, um redeploy, um reprocess)

### [ ] P0a. Categoria "mista" no classificador de constituição (precede B1b)
- [ ] Hoje `_classify_constitution` em `vision-service/pipeline/features.py:196-235`
      reduz a binário: linfática (azul+sparse), hematogenea (castanho), mista
      (resto). **40-50% do mercado brasileiro** é mista biliar ou mista
      hematogenea — sem essas categorias próprias, calibrar centroides do B1b
      é inútil porque o enum de saída não contempla o resultado correto.
- [ ] Expandir enum em `vision-service/pipeline/schemas.py` `ConstitutionEnum`:
  - linfatica
  - hematogenea
  - **mista_biliar** (novo) — íris esverdeada/amarelada, biliar marker
  - **mista_hematogenea** (novo) — íris castanha clara com fibras finas
  - **biliar** (novo) — biliar pura (mais raro)
  - mista (mantém como fallback genérico para casos ambíguos)
- [ ] Atualizar `_classify_constitution` com lógica que combina iris_color +
      fiber_density + (futuramente) pigmento setorial (P0b feed). Decisão
      sobre matriz de classificação fica para o PLAN — precisa input
      iridológico do Rhelton.
- [ ] Atualizar `apps/web/types/database.ts` via `pnpm --filter web gen:types`
      (CHECK constraint na coluna ou Zod schema do webhook precisa ser
      atualizado também).
- [ ] Acceptance: rodar pipeline contra as fotos do Rhelton e classificar
      como `mista_biliar` (ground truth). Sem regressão em fixture de íris
      castanha clara (ainda classifica `castanho`/`hematogenea` ou
      `mista_hematogenea`).

### [ ] P0b. Detecção de pigmentos setoriais (era B2, promovido P3→P0)
- [ ] **Razão de promoção:** pigmento amarelo-âmbar setorial é o feature
      mais visível das íris do Rhelton (ground truth) e o JSON atual
      retorna `psoric_spots: []`. Em constituições mistas/biliares é
      achado clínico de primeira importância. Pipeline está cego.
- [ ] **Acoplamento com P0a:** pigmento setorial é input clássico para
      diferenciar mista_biliar de mista_hematogenea. Justifica bundle.
- [ ] Implementar `_detect_sectoral_pigments(masked_image, sectors, jensen_map)`
      em `features.py`:
  - [ ] Para cada setor (1..12), calcular cor média dos pixels da íris dentro do setor
  - [ ] Comparar com cor média global da íris (usando os pixels não-mask de B1a)
  - [ ] Detectar desvios significativos em hue/saturation:
    - Pigmento amarelo-âmbar: hue 30-60° HSV, saturation > 0.4, value > 0.5
    - Pigmento escuro/psórico: value < 0.4 com saturation similar à base
  - [ ] Retornar lista de `{sector: int, pigment_type: str, confidence: float, color_lab: tuple}`
- [ ] Adicionar ao `EyeFeatures` schema (Pydantic + TS):
  ```
  sectoral_pigments: list[dict]   # default []
    sector: 1..12
    pigment_type: 'amarelo_amber' | 'psoric' | 'misto'
    confidence: 0..1
    color_lab: [L, a, b]
  ```
- [ ] Atualizar `system.md` (depois de Wave B mergeada): se `sectoral_pigments`
      tem hits no setor X, Sonnet menciona explicitamente em seção 4 (Toxemia)
      ou seção apropriada conforme zona Jensen.
- [ ] Acceptance: rodar pipeline contra fotos do Rhelton e detectar
      pigmento amarelo-âmbar bilateralmente. Lista `sectoral_pigments` não-vazia
      em ambos os olhos. Setor exato é validado pelo Rhelton via UAT.

---

## Wave C — Calibração com fixtures reais

### [ ] B1b. Recalibrar IRIS_COLOR_LAB_CENTROIDS
- [ ] Hoje em `vision-service/pipeline/features.py:51-58`:
  ```python
  IRIS_COLOR_LAB_CENTROIDS = {
      "azul":          (220, 130, 110),  # L=220 = quase branco, IRREAL
      "castanho":       (90, 145, 160),
      "verde-mosaico": (140, 110, 145),
  }
  ```
- [ ] Centroides nunca foram calibrados contra fotos reais. Mesmo após B1a,
      íris azul real (LAB ~111, 140, 81) classifica como verde-mosaico
      porque o "azul" centroide está a 113 unidades vs 76 de verde-mosaico.
- [ ] Coletar **fixtures reais**:
  - [ ] Rhelton (mista biliar, conhecido) — já temos as 6 fotos da Nailli
  - [ ] 1-2 íris azul/cinza claras
  - [ ] 1-2 íris castanha pura
  - [ ] 1 íris verde clássica (verde-mosaico)
- [ ] Para cada, rodar pipeline até `composite_image["segmented_image"]` +
      mask filter (B1a) + extrair LAB médio do cluster maior pós-filter.
- [ ] Definir novos centroides como média dos LABs medidos por categoria.
- [ ] **Decisão pendente:** se Wave B (P0a) introduzir nova categoria
      `pigment_amarelo` como cor primary OU se pigmento fica só em
      `sectoral_pigments`. Provavelmente não primary — pigment fica como
      sectoral_pigments só (P0b). Validar no PLAN.
- [ ] Atualizar testes em `test_color_classifier_diagnostic.py` para usar
      LABs reais em vez de RGB sintéticos.
- [ ] Acceptance: as 4-6 fixtures reais classificam corretamente como
      sua categoria conhecida.

---

## Wave D — Nuance downstream

### [ ] P1a. Distribuição % por categoria de constituição
- [ ] JSON hoje retorna `{primary: "hematogenea", confidence: 0.7, indicators: [...]}`.
      Confidence é por categoria escolhida; nada sobre a 2ª colocada.
- [ ] Permitir Sonnet redigir com nuance — "mista predominantemente biliar (60%)
      com componente linfático (25%) e hematogenea residual (15%)".
- [ ] Mudança no schema `Constitution`:
  ```
  primary: ConstitutionEnum   # mantém para retro-compat
  secondary: Optional[ConstitutionEnum]
  distribution: dict[ConstitutionEnum, float]  # soma 1.0; novo
  confidence: float
  indicators: list[str]
  ```
- [ ] Distribuição derivada do tamanho relativo dos clusters k-means filtrados
      (B1a) mapeados via centroides recalibrados (B1b).
- [ ] Atualizar prompt para usar `distribution` quando disponível em vez
      de `primary` solitário.
- [ ] Acceptance: relatório do Rhelton menciona "predominantemente mista_biliar
      com componente residual X" baseado em distribuição calculada, não em
      hard-coded primary.

### [ ] B1c. Threshold de lacuna por constituição (era B1, depois de B1b)
- [ ] **Renomeado de B1 → B1c** porque o B1 original era um tudo-em-um.
      Pós-B1a (mask filter ✅) + B1b (centroides recalibrados), o threshold
      de lacuna pode ser função da constituição classificada corretamente.
- [ ] Dual threshold:
  - Hematogenea/mista_hematogenea: threshold baixo (íris escuras tem mais
    contraste de lacuna)
  - Mista_biliar/biliar: threshold médio
  - Linfática: threshold padrão (calibrado para íris claras, pipeline atual)
- [ ] Validar com 10-15 capturas de íris hematogênicas + 5 mistas biliares
      antes de generalizar. Algumas das fixtures de B1b reusam aqui.
- [ ] Acceptance: íris castanha NÃO retorna lacunas em 12/12 setores com
      tamanhos uniformes (regressão do bug original observado na Nailli/Rhelton).

---

## Wave E — Cadastro↔íris cross-validation

### [ ] P1b. Validação cruzada cadastro↔íris (com fallback de attestation)
- [ ] **Caminho aceito (fallback simples):** checkbox de attestation no form
      de geração de relatório:
  ```
  [✓] Confirmo que o cadastro deste paciente confere com a pessoa fisicamente
      presente para captura.
  ```
  - [ ] Adicionar campo `cadastro_attestation_at` em `readings` (timestamp)
  - [ ] Bloquear botão "Gerar análise" enquanto não checked
  - [ ] Logar attestation no audit trail da leitura
  - [ ] **Custo:** ~30min UI + 1 migration + 1 ação server. Ship rápido.
- [ ] **Gold-plating opcional (face detection):** detectar rosto na frame
      mais ampla das capturas e flagar quando sexo aparente diverge do cadastro.
  - [ ] **Risco estrutural:** capturas atuais são close-up de íris, NÃO
        têm rosto na frame. Implementar exigiria adicionar step "selfie" ao
        capture flow — mudança não-trivial em UX. Custo +6-10hrs.
  - [ ] **Decisão registrada:** ficar no fallback de attestation por agora.
        Face detection automático fica como item opcional para Fase 9 (revisão
        jurídica healthtech) ou quando o capture flow for revisitado.
- [ ] Acceptance (para o fallback): relatório não pode ser gerado sem
      attestation; audit log registra timestamp.

---

## Independente — schema-breaking, paraleliza com B/C/D

### [ ] A1. Forçar 16 seções no system prompt (não 13)
- [ ] **Escopo:** schema breaking change. Toca:
  - `apps/web/prompts/system.md` (adicionar 4 seções)
  - `apps/web/lib/anthropic/types.ts` (`ReportSectionKey` 13→17)
  - `apps/web/lib/anthropic/parser.ts` (boundaries 13→17)
  - `apps/web/lib/anthropic/audit.ts` (anchor sections, scan keys)
  - `apps/web/components/readings/EditorAccordion.tsx` (SECTIONS array)
  - `apps/web/components/readings/FullReportCopyBlock.tsx` (uses SECTIONS — auto)
  - DB schema do `report_generated` jsonb (nova chave structure)
- [ ] Editar `system.md` para incluir explicitamente:
  - [ ] Seção 5 — Padrões Psicoemocionais (interpretação dos sinais)
  - [ ] Seção 6 — Estado Mental (clareza, tensão nervosa, foco, estabilidade cognitiva)
  - [ ] Seção 7 — Perfil Emocional (modo funcional emocional, polaridades, padrões recorrentes)
  - [ ] Seção 8 — Psicossomática e Traumática (ponte explícita corpo↔psique)
- [ ] Atualizar parser para reconhecer 16 boundaries em vez de 13
- [ ] Atualizar schema do `report_generated` (jsonb) para 16 chaves + encerramento_disclaimer
- [ ] Atualizar UI accordion `/leituras/[id]/editar` para 16 seções
- [ ] Acceptance: novo relatório retorna 16 seções todas preenchidas
- [ ] **Pode rodar em paralelo com Waves B/C/D** (diferentes árvores de código,
      sem coupling de schema entre vision e LLM).

---

## Backlog P3 — médio prazo, alto valor clínico

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
- [ ] **Sinergia com P0c:** se P0c já estiver in vigor, B5 só precisa popular
      `sector_confidence` — declaração de base já é responsabilidade do prompt.
- [ ] Acceptance: relatório identifica e declara setores de baixa confidence em vez de inventar achados

---

## Backlog P4 — longo prazo, transformacional

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

## Validação — critérios da próxima rodada de dogfooding

Após implementar **Wave A** (P0c + A2 + A3) e Wave B (P0a + P0b bundled):

1. [ ] Reprocessar fotos do Rhelton (ground truth)
2. [ ] Validar:
   - constitution.primary = `mista_biliar` (não mais hematogenea)
   - sectoral_pigments tem ≥1 hit amarelo-âmbar em cada olho
   - Sonnet declara "considerando cadastro de paciente feminina" em interpretações cadastro-dependentes (P0c)
   - 16 seções preenchidas (após A1)
   - Anchor rate > 60% (já validado pós-C1)
   - Zero hits de vocab proibido em uso negativo (já validado pós-C2)
   - Sem padrão uniforme artificial no OD (post-B1c, depois de fixtures)
   - Voz dupla bem separada (post-A2)
   - Zero duplicação de encerramento (post-A3)

Após Wave C (B1b) + Wave D (P1a + B1c):

3. [ ] Reprocess do Rhelton + 2-3 outras íris conhecidas
4. [ ] Validar:
   - Distribuição % de constituição reflete realidade (Rhelton ~60% mista_biliar)
   - Lacunas só aparecem em setores onde realmente há (não 12/12 espúrio)

---

## Decisões registradas

| Decisão | Data | Rationale |
|---|---|---|
| **B1a antes de tudo** | 2026-05-09 | Mask filter no k-means é prerequisite — sem ele, qualquer lógica baseada em cor é dominada por pixels de mask. ✅ DONE commit `889cc94`. |
| **P0c primeiro de tudo** | 2026-05-09 | Prompt-only, 30min, ganho imediato em auditabilidade. Especialmente importante depois do bug do cadastro errado (relatório virou ficção uterina). Ship antes de qualquer trabalho de vision. |
| **P0a + P0b bundled (não sequenciais)** | 2026-05-09 | Ambos tocam `vision-service/pipeline/schemas.py` + webhook contract. Bundlar = 1 schema migration vs 2, 1 Modal redeploy vs 2, 1 reprocess vs 2. Validação combinada via fotos do Rhelton prova ambos numa observação. Acoplamento iridológico justifica: pigmento setorial alimenta diferenciação biliar/hematogenea. |
| **B1b depois de P0a** | 2026-05-09 | Calibrar centroides sem o enum de saída settled é desperdício. P0a define as categorias; B1b mapeia as cores reais para essas categorias com fixtures. |
| **P1b com attestation checkbox como path principal** | 2026-05-09 | Face detection automática exige adicionar step "selfie" ao capture flow (rostos não estão na frame das capturas atuais de íris). Custo desproporcional vs ganho. Attestation checkbox resolve funcionalmente em ~30min. Auto detection fica gold-plating opcional para Fase 9. |
| **A1 paraleliza com Waves B/C/D** | 2026-05-09 | A1 (16 seções) toca apps/web (LLM/parser/UI). Vision waves B/C tocam vision-service. Sem coupling de schema. Pode rodar em árvore separada. Não é prioridade absoluta — entra como "quando Wave B liberar bandwidth". |
| **C1 + C2 já entregues** | 2026-05-09 | Polish independente, fechou nesta sessão. Commits `1e58a88` + `8db8ead` (PLAN). |

---

## Notas de contexto

- Primeira leitura real "bem-sucedida": 08/05/2026 — íris do Rhelton com cadastro feminino fictício
- Custo médio observado: ~$0.30 por leitura (Sonnet ~120k tokens)
- Webhook chain validado: Modal → Vercel → Supabase
- Migration 0008 aplicada: coluna `report_raw_text` para captura defensiva (commit 94f1c7d)
- Bug crítico do classificador (B1a) corrigido em 2026-05-09; **Modal redeploy pendente** para fix entrar em produção

## Próxima sessão (digite e enter)

```
/gsd-resume-work
```

Sequência sugerida:
1. Modal redeploy + reprocess Rhelton com B1a — validar nova classificação
2. Iniciar Wave A: P0c → A2 → A3 (prompt edits, todos em `system.md`)
3. Validar com regeneração contra Rhelton — Sonnet deve declarar base, vozes separadas, sem encerramento duplicado
4. Iniciar Wave B (P0a + P0b bundled) — escopo de plan separado dado o tamanho
