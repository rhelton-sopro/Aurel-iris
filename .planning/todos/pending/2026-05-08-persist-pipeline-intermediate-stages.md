---
created: 2026-05-08
title: Persistir versões intermediárias do pipeline visão pra Fase 10 + auditoria
area: vision-pipeline
files:
  - vision-service/modal_app.py
  - vision-service/pipeline/segment.py
  - vision-service/pipeline/normalize.py
  - vision-service/pipeline/compose.py
  - apps/web/lib/supabase/storage.ts
priority: high
resolves_phase: null
---

## Problem

Hoje o pipeline gera 5 versões da imagem em memória mas só persiste:
- ✅ Original 4K (Supabase Storage `iris-captures/`)
- ✅ Features extraídos (jsonb `readings.vision_features`)

**Não persiste:**
- ❌ `segmented_image` (per angle): íris isolada com pálpebra/pele/cílios mascarados
- ❌ `normalized_polar` (per eye): íris "desenrolada" em polar (formato canônico ML)
- ❌ `composed_iris` (per eye): weighted average das 3 angles

Decisão original (Phase 5) foi não persistir por LGPD + storage cost + YAGNI no MVP.

## Why this matters now

Founder dogfooding em 2026-05-08 levantou 3 razões pra reverter essa decisão:

### 1. Fase 10 (Sistema de Aprendizagem Clínica) precisa de dados de treino
Fase 10 do SPEC propõe: capturar diff entre `report_generated` (LLM) e `report_delivered` (terapeuta editou). Isso vira heurística clínica + scoring proprietário. Mas os DIFFS precisam ser ancorados nos features extraídos da imagem — sem `segmented_image` salva, o pipeline retroativo precisa re-rodar Modal pra cada leitura histórica (custo $$ + tempo).

Pior: re-rodar pode produzir DIFERENTES resultados se o pipeline mudou entre captura e Fase 10 (ex: hoje Hough acha r=180, amanhã acha r=200 com calibração nova). Auditoria perde.

### 2. Debugging de produção
Cenário: terapeuta reclama "análise diz lacuna no setor 3 mas não tem nada lá". Hoje: você só tem o jsonb (números) + foto 4K original. Não dá pra ver onde a pipeline quebrou — segment cortou pálpebra como íris? Polar rotacionou errado? Sectors mapearam mal?

Com versões persistidas, dá pra re-renderizar visualmente o que cada stage produziu.

### 3. Calibração reversível
Hoje o Hough Circle está pegando círculos errados (raio 50%+ da imagem em vez de íris real). Pra debugar, precisa esperar nova captura — não dá pra inspecionar retroativamente fotos antigas.

## Solution

Adicionar uploads pro Supabase Storage em bucket separado `iris-pipeline-stages/`:

```
iris-pipeline-stages/
  {reading_id}/
    {angle}-{eye}-segmented.jpg     ← 6 files (1 per angle×eye)
    {eye}-normalized-polar.jpg      ← 2 files
    {eye}-composed.jpg              ← 2 files
    pipeline.metadata.json          ← timestamps, scale factors, hough params used
```

10 files por leitura. Storage cost ~5x atual (mas Supabase Storage é barato, ~$0.021/GB/mês, ~5MB por leitura → R$0.001/leitura/mês).

### Implementation
1. **`segment.py`**: além de retornar `segmented_image` em memória, encodar JPEG e fazer upload pro storage com signed URL TTL longo (90d auditoria, 365d se Fase 10 demorar)
2. **`normalize.py`**: idem pra polar
3. **`compose.py`**: idem pra composed
4. **`modal_app.py`**: chamar Supabase Storage API direto via `httpx` + service role key
5. **Schema**: adicionar coluna `pipeline_stages_path` em `readings` (text, path do bucket)
6. **LGPD**: documentar em CONTEXT.md de Fase 10 que essas versões processadas existem; user pode requerer deleção (via cascade no delete da reading)

### Deferral

**NÃO implementar enquanto pipeline está quebrado.** O Hough atual está pegando círculos errados (raio incorreto). Adicionar persistência agora salvaria dados ruins. Sequência:

1. Fix Hough params (em curso — commits `0446d76` e seguintes)
2. Confirmar pipeline produz `iris_circle` correto (raio típico 12-25% min_dim)
3. Confirmar segment gera mask que cobre íris real, não pálpebra
4. Confirmar features fazem sentido (sectors mapeiam zonas anatômicas corretas)
5. **DAÍ** adicionar persistência

Ordem: pipeline-quality → persistence. Inverter = persistir lixo.

## Acceptance criteria for this todo

- [ ] Pipeline atual está produzindo `iris_circle` correto em produção (validar com 3+ leituras founder)
- [ ] Bucket `iris-pipeline-stages` criado no Supabase (privado, RLS por terapeuta)
- [ ] `segment.py` upload do `segmented_image` por angle/eye após processamento
- [ ] `normalize.py` upload do `normalized_polar` por eye
- [ ] `compose.py` upload do `composed_iris` por eye
- [ ] `modal_app.py` injetar `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` via Modal Secret
- [ ] Schema migration `0008_add_pipeline_stages_path.sql` adicionando coluna
- [ ] Webhook payload inclui `pipeline_stages_path` quando status=ready
- [ ] LGPD doc atualizada — quando user delete reading, cascade delete em `iris-pipeline-stages/{reading_id}/`
- [ ] Bucket TTL (lifecycle rule): manter 365d, depois mover pra storage class mais barato
