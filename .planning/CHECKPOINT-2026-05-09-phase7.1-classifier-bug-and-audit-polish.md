# Checkpoint Phase 7.1 dogfooding — 2026-05-09 sessão tarde

> Continuação direta do checkpoint da manhã (`CHECKPOINT-2026-05-09-phase7-dogfooding-continuation.md`). Próxima sessão: `/gsd-resume-work`.

## TL;DR onde paramos

Sessão atacou 3 frentes:

1. **UI editar — bloco copiável de relatório completo** — entregue (commit `3df9aa8`)
2. **Iteração 1 dogfooding TODO + classificador de cor/constituição** — bug crítico descoberto, diagnóstico empírico confirmado, fix mínimo (mask filter) aplicado (commits `02764b2`, `889cc94`)
3. **C1 + C2 — regex polish em audit.ts** — ambos entregues (commits `1e58a88`, `8db8ead`)

7 commits novos pushed para origin (incluindo `ea789cb` chore que removeu o arquivo `=`).

## Frente 1: FullReportCopyBlock — ENTREGUE

User reclamou que estava copiando seção por seção do `/leituras/[id]/editar` para análise externa. Adicionado bloco copiável read-only ao final da página:

- Novo componente `apps/web/components/readings/FullReportCopyBlock.tsx`
- `EditorAccordion.SECTIONS` promovido a `export const` (fonte única; vai facilitar A1 do TODO 13→16)
- Plugado em `editar-client.tsx` entre accordion e sticky bar
- Texto concatenado em markdown (`## N. Title\n\nbody`) + encerramento literal
- Botão "Copiar tudo" via `navigator.clipboard.writeText`
- Atualiza em tempo real conforme as seções são editadas

Commit: `3df9aa8 feat(editar): add FullReportCopyBlock for one-click copy of full report`

## Frente 2: Iteração 1 TODO + bug do classificador — ENTREGUE PARCIALMENTE

### TODO capturado

Análise da Nailli pós-leitura real produziu lista de 11 itens (P1–P4) cobrindo prompt-side (A1/A2/A3), audit polish (C1/C2), vision pipeline (B1/B2/B3/B5) e long-term (B4/B6). Salva em `.planning/todos/pending/2026-05-09-dogfooding-iteration-1.md` com triagem recomendando Phase 7.1 dedicada (Opção A).

Commit: `02764b2 docs(todo): capture dogfooding iteration 1 TODO post-Nailli`

### Alerta crítico do user (mid-session)

User informou que **a Nailli tem íris VERDE, não castanha** — o pipeline classificou como `iris_color.primary: "castanho"` + `constitution: "hematogênica"` incorretamente. Hipótese inicial: distorção CLAHE.

### Investigação + diagnóstico empírico

Tracei o fluxo `detect → segment → compose → features.classify_iris_color`:

- **CLAHE descartado:** `vision-service/pipeline/enhance.py:23-60` aplica CLAHE só no canal L de LAB com a/b preservados (anti-pattern guard explícito). Além disso, CLAHE alimenta `enhanced_polar` (fiber/lacuna), NÃO o `composite_image["segmented_image"]` que vai pra `classify_iris_color`. Os caminhos são paralelos.
- **Bug primário descoberto:** `segment.py:109-110` faz `cv2.bitwise_and(image, image, mask=mask_u8)` — zera tudo fora do círculo da íris. Numa captura 4K com íris ~250px raio, a íris ocupa **~2% da imagem**; **~98% é preto puro**. K-means com K=3 sobre `pixels = lab.reshape(-1, 3)` faz cluster maior ser sempre os pixels de mask. LAB-preto `(0, 128, 128)` tem distância 97.0 para "castanho" vs 142.2 para "verde-mosaico" vs 220.7 para "azul" → **toda íris classifica como castanho** independentemente da cor real, e cascade vai pra `_classify_constitution` → "hematogenea".

### Verificação empírica

Antes do fix, escrevi `vision-service/tests/test_color_classifier_diagnostic.py` (8 testes) que:
- Sintetiza segmented_image realístico (98% black + 2% disco colorido)
- Roda `classify_iris_color` em 4 cores: blue/green/brown/hazel
- Confirma que **todas retornam "castanho" como primary** (largest cluster = mask)
- Imprime os centros de k-means + distâncias LAB pra visibilidade

Os 4 casos parametrizados + 1 hardcoded Nailli regression guard + 2 probes diretos de matemática + 1 baseline de uniform image = 8 tests. Originalmente RED documentando o bug, depois flipados para regression guards pós-fix.

### Fix mínimo (B1a) aplicado

`vision-service/pipeline/features.py:65-127 classify_iris_color`:

```python
# Before LAB→k-means, filter pure-black mask pixels:
rgb_pixels = masked_image.reshape(-1, 3)
iris_pixels_mask = rgb_pixels.sum(axis=1) > 0
pixels = lab.reshape(-1, 3).astype(np.float32)[iris_pixels_mask]

if pixels.shape[0] < KMEANS_K:
    return {"primary": "misto", "secondary": None, "central_heterochromia": False}
```

Pós-fix:
- Blue iris (60, 100, 180) → `verde-mosaico` (era castanho)
- **Green iris Nailli (90, 140, 80) → `verde-mosaico` ← O FIX**
- Brown iris (130, 90, 50) → `castanho` (correto, sem regressão)
- Hazel iris (140, 110, 70) → `verde-mosaico` (razoável)

22/22 testes verdes em vision-service (8 diagnostic novos + 14 features.py existentes).

Commit: `889cc94 fix(vision): filter mask-zeroed pixels before iris-color k-means (B1a)`

### Bug secundário identificado, NÃO corrigido (B1b — deferred)

`IRIS_COLOR_LAB_CENTROIDS` em `features.py:51` tem valores que claramente nunca foram calibrados contra fotos reais:

```python
IRIS_COLOR_LAB_CENTROIDS = {
    "azul":          (220, 130, 110),  # L=220 quase branco — irreal
    "castanho":       (90, 145, 160),
    "verde-mosaico": (140, 110, 145),
}
```

Real iris azul (LAB ~111, 140, 81) está a 113 unidades de "azul" centroide vs 76 de "verde-mosaico" — mesmo após mask filter, blue iris classifica como verde-mosaico. **Recalibração precisa de fixtures reais (3-5 fotos por cor conhecida)** + medição dos LABs médios reais. Tracked em `.planning/todos/pending/2026-05-09-dogfooding-iteration-1.md` (item B1b implícito; expandir se necessário).

## Frente 3: C1 + C2 — ENTREGUE

### C1 — ANCHOR_RE relaxado

Antes: `/\[ancorado em: features\.[\w.\[\]]+\]/g` (literal estrito, lowercase, prefixo obrigatório).
Sonnet 4.6 escreve `[Ancorado em: \`feature.path\`]` (capital A, backticks, sem prefixo `features.`) → `anchor_rate_pct=0` em relatório bem-ancorado, false alarms no banner amarelo.

Depois: `/\[\s*ancorado em\s*:[^\]]+\]/giu` — case-insensitive (`i`), Unicode (`u`), conteúdo permissivo entre brackets, NÃO casa `[markdown link](url)` ou `[outro conteúdo]`.

3 novos test cases verdes.

### C2 — extractForbiddenHits skip LGPD-aware

Antes: `extractForbiddenHits` flagava "não um diagnóstico" como hit, mesmo a frase sendo a construção LGPD-correta exigida pelo SPEC. Banner vermelho "Termos clinicamente afirmativos detectados" disparava em relatório obediente.

Depois:
```ts
const NEG_CONTEXT_RE = /n[ãa]o\s+(um|uma|constitui|é|e|substitui|representa|significa)\s*$/iu
const NEG_LOOKBACK_CHARS = 30

// In loop:
const lookbackStart = Math.max(0, m.index - NEG_LOOKBACK_CHARS)
const preceding = text.slice(lookbackStart, m.index)
if (NEG_CONTEXT_RE.test(preceding)) continue
```

8 novos test cases verdes (5 negativas reconhecidas + 2 regression guards confirmando que uso afirmativo continua disparando + 1 edge case "não em outra cláusula NÃO mascara hit subsequente").

Skip propaga transparentemente ao save-action defense-in-depth (`analise.ts:62` e `:151` consomem `extractForbiddenHits`).

Verification:
- audit.test.ts: 31/31 verdes (era 19; +11 novos: 3 C1 + 8 C2)
- save-action.test.ts: 9 passes + 3 todos preexistentes (não regrediu)
- meta-invariant test (audit.ts source sem literais proibidos) preservado — `NEG_CONTEXT_RE` não contém termos proibidos
- pnpm lint: 0 errors, 9 warnings preexistentes

Commit: `1e58a88 fix(audit): relax ANCHOR_RE + skip LGPD-correct negative usage (C1+C2)`

### PLAN registrado

`.planning/phases/07.1-dogfooding-fixes/07.1-01-audit-regex-polish-PLAN.md` (222 linhas) — preserva audit trail das decisões: lookback window 30 chars, lista de verbos reconhecidos, slice-based check vs lookbehind regex.

Commit: `8db8ead docs(07.1): record audit-regex-polish PLAN for C1+C2`

## Pergunta lateral do user

User perguntou: "como faço para visualizar as fotos de cada exame... acho que essa opção deveria existir no app tb..."

**Confirmado:** hoje nenhuma página em `/leituras/*` mostra as fotos de volta. Imagens são uploaded para Supabase Storage (`iris-captures/`) durante captura/upload e gravadas em `reading_images`, mas **nunca exibidas**. É um gap de UI legítimo.

Estimativa de adicionar: ~1-2 hrs. Componente novo `ReadingPhotoGrid` com 6 thumbnails (3 ângulos × 2 olhos), signed URLs do Supabase Storage, lightbox/zoom no clique. Plugar em `/leituras/[id]/page.tsx` e/ou `/leituras/[id]/editar/page.tsx`.

**NÃO foi implementado.** Precisa ser adicionado ao TODO da iteração 1 ou tratado como item separado.

## Pendência para próxima sessão

### CRÍTICO: reprocessar Nailli para ver nova classificação

User quer ver o efeito do fix mínimo na Nailli antes de seguir. Caminho:

1. **Modal redeploy** (founder-side — credenciais Modal):
   ```
   cd vision-service
   modal deploy modal_app.py
   ```
2. **Trigger reprocess para Nailli** — endpoint admin **NÃO existe ainda** (era a Frente 2 não-implementada do checkpoint da manhã). Opções:
   - **Quick path:** SQL update em `readings` (algo como `UPDATE readings SET status='pending_vision' WHERE id='71a7bf1d-747f-4de8-9129-13b69197c6a4'`) + retrigger via existing webhook flow — verificar se existe trigger automático
   - **Caprichado:** adicionar endpoint admin `/api/admin/readings/[id]/reprocess` (novo plano em 07.1) — entra como follow-up
   - **Hack:** apagar `vision_features` da Nailli (NULL) + retrigger via Modal — mas pode quebrar invariantes

3. **Checar nova `iris_color.primary` + `constitution.primary`** no DB. Esperado: `verde-mosaico` ou `misto` (não mais castanho).

### Outras pendências menores

- **`apps/web/types/database.ts` modificado uncommited** (regen da migration 0008 da sessão anterior — ainda sem commit; verificar se vale committar standalone ou descartar)
- **Untracked:** `.claude/` (statusline config), `livros/`, `Estatégia comercial e mkt/` (conteúdo do user, não-rastreado intencionalmente)
- **Photo viewing surface** (gap UI confirmado, ~1-2hrs trabalho — adicionar ao TODO)
- **B1b — recalibrar IRIS_COLOR_LAB_CENTROIDS** com fixtures reais
- **A1, A2, A3** (16 seções, regra de duas vozes, encerramento literal) — P1 do TODO, pendentes
- **B1c** (threshold de lacuna por constituição) — P1 do TODO, pendente

## O que digitar amanhã pra continuar

```
/gsd-resume-work
```

Sequência sugerida amanhã:
1. **Confirma reprocessamento da Nailli** (ou via Modal redeploy + SQL trigger, ou via novo endpoint admin)
2. **Veja a nova classificação** — esperar `verde-mosaico` ou `misto`
3. **Decida B1b agora ou mais tarde** — recalibrar centroides precisa de fixtures reais
4. **A1 (16 seções)** é o próximo grande item — precisa SPEC update + parser + schema + UI

## Estado git no fim da sessão

- Branch: `main`
- Origin: pushado até este checkpoint (8 commits da sessão de hoje)
- Vercel: build vai pegar o novo audit.ts (não toca vision)
- Modal: `0446d76` (Hough fix) — **DESATUALIZADO** vs main `889cc94`. Redeploy necessário para que B1a entre em vigor

## Tests verdes ao final da sessão

- vision-service: 22 (8 diagnostic novos + 14 features.py preexistentes); pytest test_color_classifier_diagnostic 8/8
- apps/web audit: 31/31 (era 19; +11 novos)
- apps/web save-action: 9 passes + 3 todos preexistentes
- pnpm lint: 0 errors, 9 warnings preexistentes
