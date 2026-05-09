# Checkpoint — Verificação Modal do fix B1a (sessão noite, 2026-05-09)

> Continuação direta do `CHECKPOINT-2026-05-09-phase7.1-classifier-bug-and-audit-polish.md`. Esta sessão verificou se o fix B1a (mask filter no k-means de cor) entrou em vigor na Modal e descobriu que o bug verdadeiro é estrutural (não de calibração).

## TL;DR

- ✅ Modal redeploy bem-sucedido — **B1a está ativo em produção** (canário diagnóstico confirmou).
- ❌ A primeira hipótese ("Modal cacheado") foi descartada — pipeline está rodando o código novo.
- ❌ A segunda hipótese ("B1b — centroides LAB descalibrados") **também foi descartada** — os LAB centers medidos nas íris reais do Rhelton são artefato de medição, não a cor real da íris.
- 🎯 **Bug real:** o k-means de cor está incluindo pixels da pupila (preta, puxa L pra baixo) e sombras de pálpebra. Mascarar só o exterior do círculo da íris (`segment.iris_mask`) é insuficiente — precisa mascarar **pupila + zona pupilar** antes do `classify_iris_color`.
- 📋 Decisões: B1b sai da fila imediata (calibrar centroides pra enum velho de 3 categorias é trabalho descartável). B1b vira sub-task da Wave B (`P0a + P0b + B1b + B1d` bundled). Adicionado **B1d — mascarar pupila + zona pupilar**.

---

## Sequência da sessão

### 1. Modal redeploy + reprocess (3 rodadas)

Founder rodou `cd vision-service && modal deploy modal_app.py`. Deploy bem-sucedido (criou objects, web function `analyze_iris_endpoint` em `https://rhelton-sopro--aurel-iris-vision-analyze-iris-endpoint.modal.run`).

Triggered reprocess da leitura `71a7bf1d-747f-4de8-9129-13b69197c6a4` (Rhelton, mascarado como "Nailli") **3 vezes**. Todas as 3 rodadas retornaram:
- `iris_color.primary: "castanho"` idêntico
- `fiber_density.score` literalmente igual (`0.8885465264320374` no OD)
- Tamanhos de lacuna idênticos
- `processing_time` parecidos

Founder hipotetizou: "Modal está rodando código cacheado, não o `889cc94`."

### 2. Verificação local: source IS correto

`vision-service/pipeline/features.py:89-95` contém o fix mask filter exatamente como `889cc94`:

```python
rgb_pixels = masked_image.reshape(-1, 3)
iris_pixels_mask = rgb_pixels.sum(axis=1) > 0
pixels = lab.reshape(-1, 3).astype(np.float32)[iris_pixels_mask]

if pixels.shape[0] < KMEANS_K:
    return {"primary": "misto", "secondary": None, "central_heterochromia": False}
```

`git diff 889cc94 -- vision-service/pipeline/features.py` empty. Logo: source local não é o problema.

### 3. Desafio à premissa: nem tudo é caching

Crítica aplicada aos 3 sintomas:

| Sintoma | É caching? |
|---|---|
| `fiber_density` bit-exact entre rodadas | ❌ — opera em `enhanced_polar` (CLAHE no canal L), independente do B1a; mesmo input JPEG → mesmo Sobel gradient → bit-exact por design |
| Tamanhos de lacuna idênticos | ❌ — também determinístico em mesmo input |
| `iris_color.primary: "castanho"` persistente | 🟡 **Pode ser** caching, OU pode ser **B1b mordendo** (centroides LAB nunca calibrados) |

Único sintoma que diferenciava era o último — e não dava pra distinguir das duas hipóteses sem instrumentação.

### 4. Print canário aplicado

Edit em `vision-service/pipeline/features.py:138-147` (logo antes do return final de `classify_iris_color`):

```python
print(
    f"[B1a-canary] iris_color filtered={int(iris_pixels_mask.sum())}/"
    f"{int(iris_pixels_mask.size)} pixels, "
    f"primary_center_LAB={primary_center.tolist()}, "
    f"primary={primary}, secondary={secondary}",
    flush=True,
)
```

`flush=True` previne perda em container shutdown. Também limpado `vision-service/**/__pycache__` antes do redeploy (defesa contra .pyc shipped via `add_local_python_source("pipeline")`). 8/8 tests verdes em `test_color_classifier_diagnostic.py` pós-edit.

### 5. Modal logs após redeploy

Canário disparou:

```
[B1a-canary] iris_color filtered=174452/7151808 pixels, primary_center_LAB=[66.04, 130.94, 134.61], primary=castanho, secondary=None  ← OD
[B1a-canary] iris_color filtered=65478/7151808 pixels,  primary_center_LAB=[85.87, 134.22, 134.38], primary=castanho, secondary=None  ← OE
```

**B1a confirmado ativo:** mask filter funcionando, ratio de pixels sobreviventes 2.44% (OD) e 0.92% (OE) — coerente com íris ocupando ~1-3% de frame 4K.

### 6. Análise geométrica dos LAB centers (primeira interpretação errada)

Distâncias LAB do cluster center vs os 3 anchors:

**OD (66, 131, 135):**
- → `azul` (220, 130, 110): **156**
- → `castanho` (90, 145, 160): **37** ← vence
- → `verde-mosaico` (140, 110, 145): **78**

**OE (86, 134, 134):**
- → `azul`: 136
- → `castanho`: **28** ← vence
- → `verde-mosaico`: 60

Castanho ganha por >2× margem nos dois olhos. Margem de 10% pra "misto" não dispara (37 vs 78 está bem fora).

**Interpretação inicial (incorreta):** "B1b sozinho não vai resolver — íris real do Rhelton é genuinamente brown-leaning em pixel-level."

### 7. Correção do founder — bug é estrutural, não de calibração

Founder: "Minha íris é verde-acinzentada visualmente, não marrom. O LAB center calculado (L=66-86, castanho) é artefato de medição — o k-means está incluindo pixels da pupila (preta, puxa L para baixo) e sombras de pálpebra. A pupila precisa ser mascarada antes do k-means de cor, não só o mask externo."

Verificação:
- `L=66-86` é dark — coerente com pupila (preta, L≈0 quando preto puro) misturada com íris real (L mais alto). Mistura puxa o cluster center pra baixo.
- `a=131-134, b=134-135` são quase neutros (centro 128) — coerente com **mistura de preto + cor real**, onde a média neutraliza o pigmento.
- O `segment.iris_mask` atual aplica `cv2.bitwise_and(image, image, mask=mask_u8)` baseado no **círculo da íris** (raio externo), zerando tudo fora. Mas a **pupila** (círculo interno, ~30-40% do raio externo) e **sombras de pálpebra superior/inferior** ficam DENTRO do círculo da íris e sobrevivem ao mask.
- B1a filtra apenas pixels exatos R=G=B=0 (preto puro do `bitwise_and`). Pixels da pupila têm valores baixos mas NÃO exatamente zero (compressão JPEG, ruído de sensor) — passam o filtro, contaminam o k-means.

**Conclusão:** mesmo recalibrar centroides com fixtures reais (B1b) não resolve. Precisa primeiro garantir que o input do k-means é **só íris** (anel entre pupila e iris-borda externa, excluindo zona pupilar e sombras de pálpebra).

---

## Outras observações dos logs

**MediaPipe sempre falha em capturas close-up:**
```
[detect] mediapipe_no_face — falling back to Hough on 3088x2316 image
```
Aparece em 100% dos `find_iris` calls. Esperado — não há rosto na frame de uma captura close-up de íris. Hough fallback funciona, mas é overhead de inicialização do MediaPipe (TFLite XNNPACK delegate setup) por call. Vale skipar MediaPipe num modo `iris_close_up` em plano futuro (não é prioridade — funciona).

**Asimetria OD vs OE significativa:**
- OD: 174452 pixels segmentados / Hough r=691
- OE: 65478 pixels segmentados / Hough r=581
- Pixel-area ratio: 2.66× | Circle-area ratio (r²): 1.42×
- Fator extra (1.87×) vem de `segment.py` — possivelmente eyelid masking diferente entre olhos, ou qualidade de captura assimétrica.

Vale investigar quando re-shoot for possível, mas separado do bug atual de cor.

**Luminância OD vs OE 20 pontos diferente:**
L=66 (OD) vs L=86 (OE). Pode ser iluminação assimétrica nas capturas, qualidade diferente, ou contaminação diferente por pupila/sombra (esperado dado proporção diferente de pixels segmentados). Mais um sintoma que evapora quando B1d for aplicado.

---

## Decisões registradas

| Decisão | Rationale |
|---|---|
| **Diagnóstico fechado: B1a ativo em produção** | Canário disparou. Mask filter funcionando. Modal não está cacheado. |
| **B1b sai da fila imediata** | Calibrar centroides pra enum velho de 3 categorias é trabalho descartável quando Wave B vai expandir o enum (P0a) E corrigir input do k-means (B1d). Sequência correta: B1d (input limpo) → P0a/P0b (enum + sectoral) → B1b (calibrar centroides usando enum novo + input limpo via fixtures reais). |
| **B1b vira sub-task da Wave B** | Junto com P0a + P0b + B1d. Single PLAN, single Modal redeploy, single reprocess. |
| **Adicionado B1d — mascarar pupila + zona pupilar** | Sub-task da Wave B. Substituir filtro `R=G=B>0` por mask explícito que exclui (a) círculo interno da pupila — Hough já detecta o círculo externo, precisa detectar/estimar o interno; (b) banda superior/inferior do círculo da íris (zonas tipicamente cobertas por pálpebra). Provavelmente reusar `iris_circle` retornado por `detect.find_iris` + ratio típico pupila:íris (~0.3-0.4) + crop superior/inferior. |
| **Sequência confirmada** | (1) Wave A agora — prompt-only (P0c + A2 + A3, ~1h). (2) PLAN 07.1-02 depois — Wave B bundled (P0a + P0b + B1b + B1d). |
| **Canário removido pós-diagnóstico** | Edit revertido. Working tree de novo === `889cc94`. Histórico preservado neste checkpoint. Sem commit no source — diagnóstico documentado em prosa. |

---

## O que digitar pra continuar

```
/gsd-resume-work
```

Sequência da próxima sessão:

1. Wave A — 3 prompt edits em `apps/web/prompts/system.md` (P0c, A2, A3). Commits separados ou bundled, decidir no momento. ~1h total.
2. Validar Wave A regenerando relatório do Rhelton — não precisa Modal redeploy (vision já ok). Sonnet deve declarar base de cadastro-dependent claims, separar voz factual de hipotética, não duplicar encerramento.
3. Abrir PLAN 07.1-02 pra Wave B (P0a + P0b + B1b + B1d bundled). Schema migration + Pydantic + TS regen + Modal redeploy + reprocess único.

---

## Estado git no fim da sessão

- Branch: `main`
- Origin: pushado até `32abd0f` (anterior)
- Working tree: zero changes em `vision-service/` (canário aplicado e revertido nesta sessão; nunca committado)
- Próximo commit: `docs: checkpoint B1a Modal verification + Wave B requirements update` (este arquivo + atualização do TODO)

## Tests verdes ao final da sessão

- vision-service: 22 (8 diagnostic + 14 features.py); 8/8 verde antes e depois do canário; 8/8 verde pós-revert
- apps/web audit: 31/31 (sem mudança nesta sessão)
- Nenhuma regressão introduzida
