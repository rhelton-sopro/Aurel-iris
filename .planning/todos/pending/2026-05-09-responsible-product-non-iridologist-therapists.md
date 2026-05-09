---
created: 2026-05-09
title: Responsible product — proteção de terapeutas não-iridologistas
area: Fase 9 (Polish + dogfooding + beta) / blocking pra Estágio 2 (rollout externo)
priority: critical (gate de Estágio 2)
files:
  - apps/web/components/readings/EditorAccordion.tsx
  - apps/web/components/readings/AnalysisHero.tsx
  - apps/web/prompts/system.md
  - apps/web/lib/anthropic/audit.ts
  - vision-service/pipeline/features.py
  - vision-service/pipeline/schemas.py
  - apps/web/app/leituras/nova/captura/  # validation checklist
source: insight do fundador 2026-05-09 sessão noite (pós-validação Wave A v1)
related_phases:
  - Fase 7.1 (atual — dogfooding fixes; calibração começa aqui)
  - Fase 9 (Polish + dogfooding + beta — escopo formal)
  - Fase 10 (Aprendizagem Clínica — formaliza o que começarmos como manual)
---

## Insight estratégico

**A maioria dos terapeutas que vão usar o Iris Codex NÃO são iridologistas.**
Eles não têm como auditar se um achado é real ou artefato algorítmico. Sem
proteção, o produto entrega afirmações pseudo-iridológicas que terapeutas
sem expertise vão tratar como ground truth — risco de dano clínico ao cliente
final + risco reputacional ao produto.

Hoje (Fase 7.1) o único freio de qualidade sou eu (fundador, iridologista em
exercício). **Esse freio NÃO escala pra Estágio 2 (beta com 10-20 terapeutas)
e fundamentalmente quebra em qualquer rollout externo** — terapeutas externos
não têm acesso ao founder pra auditar cada achado.

**Conclusão:** quality protection para terapeutas não-iridologistas é
**requisito de produto responsável**, não nice-to-have. **É gate de Estágio 2.**

## Itens do backlog (escopo formal Fase 9)

### Q1. Confidence score visível por achado na UI

**Hoje:** `vision_features.<eye>.sectors[N].findings[M]` carrega confidence,
mas só no JSON interno. UI (`/leituras/[id]` + `/leituras/[id]/editar`)
mostra apenas o relatório textual gerado pelo Sonnet. Terapeuta não vê o
sinal de incerteza embutido no pipeline.

**Fix:**
- Cada parágrafo do relatório que cita um achado mostra inline o confidence
  da feature ancorada (provavelmente do path em `[ancorado em: features.X.Y]`).
- Visual: badge colorido (verde > 0.8, amarelo 0.6-0.8, laranja 0.4-0.6,
  vermelho < 0.4) ao lado da hipótese.
- Hover/click no badge mostra: qual feature, qual setor, por que confidence
  é baixa (ex: "oclusão por pestana", "iluminação inconsistente",
  "borda detectada com baixa precisão").

**Acceptance:**
- Em uma leitura com 6 capturas mistas (3 boas + 3 ruins), os parágrafos
  ancorados em features de baixa confidence mostram badge laranja/vermelho.
- Terapeuta passa o mouse e vê uma explicação leiga (não jargão técnico).

**Custo estimado:** 4-8h (UI parsing do `[ancorado em: ...]` + lookup
features tree + componente Badge tooltip). Backend não muda — só read-side
sobre dado já existente.

### Q2. Sonnet calibra linguagem por confidence (auto-omissão ou hedge extra)

**Hoje:** Sonnet recebe features como dado autoritativo. Não há sinal de
"esta feature é incerta — fale com cuidado ou omita". Princípio 6 (P0c v2)
agora exige declarar baixa confidence em prosa, mas isso é manual — Sonnet
ainda decide quando mencionar.

**Fix:**
Política explícita no `system.md` (potencialmente como Princípio 8):

```
Calibração por confidence:
- confidence >= 0.8: linguagem normal hipotética (Princípio 4)
- 0.6 <= confidence < 0.8: linguagem extra-cautelosa, declarar a baixa
  confidence em prosa: "este sinal é registrado com confidence moderada
  (X), o que sugere..."
- 0.4 <= confidence < 0.6: hipótese tentativa, frase curta única, sem
  detalhamento. "Sinal observado com baixa confidence (X) — vale
  inspeção visual direta antes de qualquer interpretação."
- confidence < 0.4: OMITIR a feature do relatório. Mencionar apenas em
  uma nota agregada na §2: "N achados foram detectados com confidence
  insuficiente para análise (< 0.4) — recomenda-se nova captura desses
  setores".
```

**Acceptance:**
- Leitura com features mistas: features < 0.4 NÃO aparecem como hipótese
  individual no relatório.
- Features 0.4-0.6 aparecem como single-line tentativa.
- Features 0.6-0.8 aparecem com declaração explícita de confidence.
- audit_metadata reflete: contagem de features omitidas, contagem de
  features com hedge extra.

**Custo estimado:** prompt edit + audit logic update. ~2-3h.

**Coupling com Wave B:** essa política só funciona se a calibração de
features (Wave B — P0a + P0b + B1d + B1b) entregar confidences que
realmente refletem qualidade da detecção. Hoje os confidences são
heurísticos (baseados em coverage de detecção), não calibrados contra
ground truth. **Q2 depende da calibração de Wave B + dataset de fixtures
ground-truth (ver "Calibração colaborativa" abaixo).**

### Q3. Checklist de validação visual antes de gerar relatório

**Hoje:** Após captura, terapeuta clica "Gerar análise" sem confirmação
visual de qualidade. Pipeline pode retornar features absurdas (cor errada,
asimetria espúria, lacunas em tudo) e o relatório vai ser gerado sobre
features ruins.

**Fix:**
Página intermediária entre captura/upload e geração de relatório:

```
Antes de gerar a análise, confirme visualmente:

[ ] Cor da íris detectada está coerente com a íris do cliente?
    (mostrar: thumbnail das 6 fotos + cor primária classificada)
    └ Se NÃO: [Re-capturar] [Reportar erro do pipeline] [Continuar mesmo assim — eu vou editar manualmente]

[ ] Visíveis no thumbnail: pupila claramente delimitada, íris ocupa >60% do frame, sem reflexos cobrindo > 1/3 da íris?
    └ Se NÃO: [Re-capturar] [Continuar mesmo assim]

[ ] Constituição classificada como [X] — você concorda visualmente?
    └ Se NÃO: [Re-capturar] [Reportar erro do pipeline] [Continuar mesmo assim]

[ ] Asimetria detectada entre olhos: [N notas]. Faz sentido pra esta captura?
    └ Se NÃO: [Re-capturar] [Continuar mesmo assim]

[Gerar análise] (só habilita após todos os checks ou explicit override)
```

**Acceptance:**
- Não há "gerar análise" sem passar pelo checklist.
- "Continuar mesmo assim" registra audit log (quem, quando, qual gate
  desabilitado) — trilha pra Phase 10 aprender a melhorar.
- "Reportar erro do pipeline" abre form curto (foto + descrição) que
  vira fixture para a calibração colaborativa.

**Custo estimado:** 8-12h (UI + persistência de checks + integração com
o flow atual). Maior dos 3 mas o mais protetor.

## Calibração colaborativa (founder ↔ AI assistant)

Esta é a peça **metodológica** que destrava Q1 + Q2 + Q3:

### Por que precisa ser colaborativa

Os 3 itens acima precisam de:
- **Q1:** thresholds de cor por banda de confidence (qual valor numérico
  mapeia pra "vermelho"? Hoje arbitrário).
- **Q2:** política linguística calibrada — qual confidence justifica
  omissão? Qual justifica hedge extra? Em que contexto a banda muda?
- **Q3:** quais checks visuais são must-have, nice-to-have, descartáveis?
  Quais sinais visíveis ao olho não-treinado realmente predizem features
  ruins?

Nenhum desses parâmetros pode ser inventado de cabeça. Precisa de **dataset
de fixtures com ground truth iridológico** — fotos do banco de dados
existentes + interpretação correta marcada pelo fundador.

### Workflow proposto (operacionaliza durante Phase 7.1)

1. **Coleta de fixtures (~30-50 leituras)**
   - Pegar 30-50 leituras do `readings` com `vision_features` populado
   - Para cada: as 6 fotos originais + JSON features atual + relatório gerado
   - Salvar em `vision-service/tests/fixtures/calibration/` (gitignored se
     contém fotos identificáveis; talvez Storage signed-URL paths em vez de
     arquivos locais)

2. **Anotação ground truth pelo fundador (~5-10 min/leitura)**
   - Para cada leitura, fundador marca:
     - Cor real da íris (vs. classificação do pipeline)
     - Constituição correta (vs. classificada)
     - Achados que o pipeline ACERTOU
     - Achados que o pipeline INVENTOU (artefato)
     - Achados que o pipeline FALHOU em detectar
     - Confidence subjetiva por feature ("se eu fosse o pipeline, qual
       confidence eu daria")
     - Quais sinais visuais nas fotos preveem cada erro
   - Persistir em `vision-service/tests/fixtures/calibration/<reading_id>.yaml`

3. **AI assistant (Claude Code) deriva calibração quantitativa**
   - Roda o pipeline atual contra cada fixture, compara com ground truth
   - Computa: thresholds de confidence que minimizam falsos positivos
     (achados inventados) sem perder true positives (achados reais)
   - Sugere política linguística do Q2 com data evidence
   - Sugere checklist do Q3 com evidências concretas (ex: "se cor
     classificada diverge da real → 73% das vezes tem reflexo cobrindo
     pupila — sugere check visual de reflexo")

4. **Founder revisa + aprova / ajusta**
   - Calibração derivada não vira ground truth automática — fundador valida
   - Iteração curta entre evidência empírica e julgamento clínico

5. **Fixture set vira asset permanente**
   - Reusável pra: B1b (centroides LAB), Q1 (confidence bands), Q2 (política
     linguística), Q3 (checklist), Phase 10 (modelo de aprendizagem)
   - Versionado em git (sem fotos — só os JSON de ground truth + paths
     pra Storage; fotos ficam no Supabase com signed URLs)

### Por que isso já começa em Phase 7.1 (não Fase 9)

Wave B (PLAN 07.1-02 a abrir) já PRECISA de fixtures reais pra B1b
(recalibrar centroides LAB). Mesma coleta serve dupla função:
- Imediato: B1b + P0a + P0b + B1d (Wave B)
- Próximo: Q1 + Q2 + Q3 (Phase 9 backlog)
- Longo: dataset seed pra Phase 10 (modelo)

Adiar a coleta pra Fase 9 desperdiça o trabalho de Wave B.

## Decisões pendentes

| Decisão | Quem decide | Quando |
|---|---|---|
| Volume da primeira leva de fixtures (10? 30? 50?) | founder | antes de Wave B abrir |
| Storage de fotos pra fixtures (signed-URL on demand vs cópia local gitignored) | founder + AI | Wave B planning |
| Schema do `<reading_id>.yaml` ground truth | AI sugere, founder valida | Wave B planning |
| Q1 confidence color thresholds | derivado de calibração | pós-fixtures coletadas |
| Q2 política linguística por banda | derivado de calibração | pós-fixtures coletadas |
| Q3 checks must-have do checklist | derivado de calibração | pós-fixtures coletadas |
| Endpoint admin pra exportar fixtures (vs. SQL direto) | founder | quando coleta começar |

## Vincular esta proposta ao roadmap

- **Adicionar requirement code** `RESP-01` (Q1), `RESP-02` (Q2), `RESP-03` (Q3)
  ao `.planning/REQUIREMENTS.md` (ou criar `RESPONSIBLE-*` namespace).
- **Atualizar Fase 9 em ROADMAP.md** — adicionar Success Criterion 6:
  "Antes do Estágio 2 (beta externo), Q1+Q2+Q3 estão entregues e validados
  contra dataset de fixtures de ≥30 leituras com ground truth."
- **Atualizar Fase 10 CONTEXT.md** — registrar que o dataset de fixtures
  da calibração colaborativa é a seed do dataset de treino.

## Próxima ação

Quando Wave B abrir (PLAN 07.1-02 a planejar), incluir como pré-task:
- Definir schema YAML de ground truth
- Coletar primeira leva de N fixtures (N a decidir com fundador)
- Anotar fundador
- AI deriva análise quantitativa de coverage/precision do pipeline atual
- Decisões de calibração entram no PLAN 07.1-02 (centroides LAB) E na
  spec de Q1+Q2+Q3 (Phase 9 backlog refined).
