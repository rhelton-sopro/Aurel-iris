# ATA — Pipeline da Foto (captura → relatório)

> **Para que serve este arquivo.** Registro do que JÁ foi tentado, do que morreu e POR QUÊ.
> Criado em 2026-07-17 depois de quase reimplementarmos MediaPipe — que já existe no repo,
> já funcionou, e foi desligado por um motivo concreto. Sem esta ata, o ciclo se repete.
>
> **Regra:** antes de propor qualquer mudança no pipeline da foto, leia o CEMITÉRIO (§3).
> Se for ressuscitar algo de lá, diga explicitamente o que mudou desde que morreu.
> Ao abandonar/decidir algo novo, ACRESCENTE aqui — com data, motivo e evidência.

---

## 1. Fluxo real hoje (verificado em 2026-07-17)

```
[cliente/terapeuta no celular]
        │  <input type="file" capture="environment">   ← APP NATIVO da câmera
        │  capture-client.tsx:552 — NÃO há getUserMedia, NÃO há preview ao vivo
        ▼
   JPEG 4K cru (~4032×3024, vários MB)
        │
        ├──► GATE (por foto): resize 1536px q0.85 → Haiku 4.5
        │    validate-image.ts:27 (VALIDATION_DIM=1536) · api/capture/validate
        │    veredito via tool use + strict schema (041bdc7)
        │    → telemetria em capture_attempts
        │
        └──► UPLOAD: 4K INTACTO, sem recompressão (decisão do founder)
             upload.ts / upload-invite.ts:37 → storage_path
                  │
                  ▼
             CANONICALIZE (por foto):
               1) resize 1024px → Sonnet 4.6 acha bbox da íris (radius_pct)
                  canonicalize/sonnet-bbox.ts:33,152
               2) crop = max(2.5×raio, 0.4×min(W,H)) → 800×800 q92
                  canonicalize/crop.ts:36-38 → canonical_storage_path
                  │
                  ▼
             RELATÓRIO:
               prepare-direct-images.ts:28 — IMAGE_PX = 800
               resize(800,800, fit:inside) + jpeg q90   ← APLICA-SE A TODA FOTO
               ├─ Stage 1: Sonnet 4.6 VÊ as 6 fotos → JSON estruturado
               └─ Stage 2: Sonnet 4.6 NÃO vê fotos, só o JSON → 15 seções
```

**Chamadas de LLM no fluxo (4 modelos-etapa):**

| # | Propósito | Modelo | Onde |
|---|---|---|---|
| 1 | Gate de qualidade da captura | Haiku 4.5 | `api/capture/validate/route.ts:14` |
| 2 | bbox/cor da íris (p/ crop) | Sonnet 4.6 | `lib/anthropic/client.ts:43` · `canonicalize/sonnet-bbox.ts` |
| 3 | Stage 1 — observação das 6 fotos | Sonnet 4.6 | `lib/anthropic/stage1-scan.ts` |
| 4 | Stage 2 — composição do relatório (sem fotos) | Sonnet 4.6 | `analyze-direct.ts:2429` |

---

## 2. Decisões travadas (NÃO reabrir sem motivo novo)

| Data | Decisão | Motivo |
|---|---|---|
| 2026-05-16 | **Sonnet-direct é o pipeline único.** Modal/SAM/RAG aposentados. | LLM venceu o motor de CV. `analyze-direct.ts:1-14` |
| — | **Upload mantém 4K, sem recompressão.** | "recompressão JPEG client-side degrada a imagem 4K e é inaceitável para iridologia" (`upload.ts:11`). Custo aceito: upload lento e falho em 4G → mitigado com retry exponencial, não com compressão (`upload-invite.ts:37-39`). |
| 2026-06-29 | **NÃO afrouxar limiar de borrado/reflexo junto com mudança de resolução.** | Bundlar cega a medição; e íris mole degrada a Stage 1, que é o produto. |
| 2026-07-17 | **LLM (não CV) identifica a íris no gate.** | Founder: "antes fizemos sem LLM e ficou ruim". Confirmado pelo histórico (§3). |
| 2026-07-17 | **Fotos modelo antes da 1ª foto. Cliente SEMPRE vê; terapeuta pode dispensar.** | Recusa é de técnica, não de limiar (§4.3): quem erra (cliente 59%) é quem precisa ver; terapeuta (20%) já sabe. `010f115`. Imagens em `public/captura/` — íris do FOUNDER (LGPD: nunca de cliente). |

---

## 3. ⚰️ CEMITÉRIO — o que já foi tentado e morreu

### 3.1 MediaPipe FaceLandmarker + raio da íris (motor determinístico)
- **Estado:** código VIVO no repo, dependência INSTALADA, **ninguém chama**.
  `lib/capture/iris-geometry.ts` (landmarks 468–477, `getIrisRadius`, `EYELID_LANDMARKS`),
  `lib/capture/quality-scoring.ts` (7 sub-scores → `overallScore`: distância .35, nitidez .2,
  centralização .2, exposição .15, oclusão .1), `@mediapipe/tasks-vision@0.10.35` no package.json.
- **Funcionava?** Sim — havia círculo-guia sobre o vídeo e o comentário diz "validado por
  teste empírico no iPhone".
- **Por que morreu (2 motivos, ambos válidos):**
  1. **Dependia de vídeo ao vivo (`getUserMedia`) com o ROSTO no quadro.** A captura virou
     câmera nativa (`input capture`) pelo 4K → sem vídeo, sem rosto, sem raio.
  2. **Dava erro demais e o cliente DESISTIA** (founder, 2026-07-17). Fricção matava a conversão.
- **⛔ Não ressuscitar como gate.** Evidência técnica dura: o model card oficial do BlazeFace
  (detector que roda ANTES do landmarker) exige **"pelo menos 70% da bounding box do rosto
  dentro da imagem"**, e o treino tem rosto ocupando 3–70% do quadro. Nosso protocolo é
  **close-up macro de UM olho** → a caixa do rosto teria ~2–5% dentro do quadro.
  Ele falharia justamente nas MELHORES fotos (íris grande) e funcionaria nas piores
  (rosto inteiro, íris pequena) = **gate invertido**.
  Fonte: <https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20(Short%20Range).pdf>
- **Só faria sentido se** a captura voltasse a ter vídeo ao vivo com rosto enquadrado —
  o que conflita com o 4K.

### 3.2 Modal / SAM / RAG (vision-service em Python)
- **Estado:** desligado por default (`MODAL_PIPELINE_ENABLED` != 'true'), código não removido.
- **Por que morreu:** Sonnet-direct venceu. Fase 7.5 abandonada.
- **⚠️ Vestígio perigoso:** `CROP_OUT_SIZE = 800` em `crop.ts:33` existe porque
  **"Modal espera tamanho fixo"**. Modal morreu; o 800 ficou e nunca foi rejustificado
  para consumo por Sonnet. Ver §4.1.

### 3.3 Pré-check de Laplaciano (nitidez sem LLM)
- **Estado:** `lib/capture/laplacian-variance.ts` existe, **não é chamado**. Removido em maio/2026.
- **Contexto:** era o "próximo passo" caso o Haiku fosse o limite. Substituído pelo julgamento do VLM.

### 3.4 Compressão JPEG no client
- **Estado:** `lib/capture/jpeg-compress.ts` (MAX_DIMENSION=2048, q0.85) existe, **não é usado**.
- **Por que:** decisão explícita de manter 4K (§2).

### 3.5 Validação a 512px no gate
- **Morreu em 2026-06-29** (`9693ceb`). A 512px a íris ficava ~200px e as fibras eram
  FISICAMENTE irresolvíveis → "borrado" falso. Subiu para 1536.

### 3.6 Parse de texto livre no gate (regex `\{[\s\S]*\}`)
- **Morreu em 2026-07-17** (`041bdc7`). A 1536px o Haiku passou a divagar → `reason` fora
  do enum → clamp recusava **35,4% das fotos por ERRO DE FORMATO** (59% em 07-13), mascarado
  de "foto ruim". Substituído por tool use + `strict: true` + `tool_choice` forçado.

---

## 4. 🔎 Achados abertos (verificados, aguardando decisão)

### 4.1 ✅ O crop 800×800 está CORRETO — íris a ~640px. (Erro meu, corrigido 2026-07-17)
**Registro do erro para não se repetir:** afirmei que a íris saía a ~320px no crop. **Errado.**
Confundi raio com diâmetro. A conta certa (`crop.ts:60-95`):
```
cropSide = max(2.5 × r, 0.4 × min(W,H))     r = raio em px
íris = 2r  →  2r / 2.5r = 0,8 = 80% do quadro  →  800 × 0,8 = 640px
```
**O crop é justo na íris: 640px de diâmetro, q92, lanczos3.** É bom, está acima com folga do
piso biométrico ISO (150–200px) e é da mesma ordem do que o gate vê a 1536px (~600px) —
ou seja, **gate e relatório são coerentes entre si**. Founder (2026-07-17): "800×800 em torno
da íris dá uma imagem muito boa" — confirmado pelo código. **NÃO subir o 800.**

Nuance do floor: quando `radius_pct < 0.16`, o floor `0.4×min(W,H)` vence e a íris fica
menor que 640px (`íris_px ≈ min(640, 4000 × radius_pct)`). O floor existe de propósito
(C-03) porque o Sonnet SUBESTIMA o raio em olho ocluso por cílios/sombra — cortar justo
num raio subestimado cortaria a íris fora. Trade-off consciente.

### 4.2 ⚠️ O buraco real: ~8% das fotos vão pro relatório SEM crop, com íris a ~119px
- Quando `canonical_storage_path IS NULL` (canonicalização falhou), `prepare-direct-images.ts:28`
  espreme a **foto INTEIRA 4K** para 800px — sem crop. Medido em prod (2026-07-17):
  originais são 3024×4032 (12,2 MP), fator de encolhimento **0,198×** →
  **uma íris de 600px vira ~119px**. Abaixo do piso biométrico ISO (150–200px).
- **Frequência (medida em `reading_images`, n=293):**

  | mês | sem crop |
  |---|---|
  | 2026-05 | 72,7% (canonicalização ainda não estava em uso) |
  | 2026-06 | 17,1% |
  | 2026-07 | **8,3%** |

  Tendência boa, mas 8% ainda é real — e uma leitura tem 6 fotos, então a chance de
  ≥1 foto degradada por leitura é bem maior que 8%.
- **É SILENCIOSO:** D-01 ("never block finalize for canonicalize failure") faz o relatório
  ser gerado com a foto degradada sem ninguém saber. `prepare-direct-images` calcula
  `fallbackCount` — verificar se está sendo persistido/alertado.
- **Ação sugerida (não executada):** medir POR QUE a canonicalização falha nesses 8%
  (erro do Sonnet bbox? download? `radius_pct` inválido?) antes de mexer em qualquer coisa.

### 4.3 A recusa é de TÉCNICA, não de limiar
Mesmo gate, mesmos limiares (n=753, excluindo falha de formato):

| quem | n | erro |
|---|---|---|
| founder | 343 | **20%** |
| resto | 410 | **59%** |

2×2 desconfundindo aparelho vs pessoa:

| | iOS | Android |
|---|---|---|
| founder | 28% (n=134) | 16% (n=199) |
| resto | 59% (n=376) | 59% (n=34) |

→ efeito do **aparelho**: 0–12pp. Efeito de **quem fotografa**: 31–43pp.
**O founder já está na meta de 20%.** O gate é passável; falta transferir a técnica.
Afrouxar limiar para forçar 20% global compraria a métrica e venderia o produto (íris mole → Stage 1).

### 4.4 Composição do erro (quem não é o founder)
`borrado` 31% · `olho_fechado` 17% · `dois_olhos` 5% · `reflexo_total` 5% · `sem_olho` 1%.
`olho_fechado` é quase todo evitável: o prompt ACEITA dedo segurando a pálpebra
("técnica legítima"), mas **o cliente não sabe que pode fazer isso**.

### 4.5 Sem padrão de iridologia
Não existe norma publicada de qualidade de imagem para iridologia. ISO/IEC 29794-6 e 19794-6
são de **biometria NIR + reconhecimento** — não transferem (melanina absorve no visível;
captura controlada; objetivo de casar textura, não inspecionar). **Nosso limiar tem de ser
empírico** — não há de quem copiar.
NIST IREX III: o melhor algoritmo de qualidade sinalizou só **23,6%** das piores falhas;
algoritmos de qualidade correlacionam **<0,35** entre si. → **Nenhum score holístico subjetivo
funciona** ("conte 25 fibras" é exatamente isso). A literatura recomenda: poucos sinais
objetivos + barrar só o absurdo.

---

## 5. Métrica que importa

**Não é a taxa de recusa — é o cliente desistir.** (founder, 2026-07-17: "o cliente tirava a
foto, dava tanto erro que ele desistia; nosso produto não pode ser assim").
Uma recusa que ensina > uma recusa que frustra. Telemetria: `capture_attempts`
(1 linha por foto validada) + `scripts/audit-capture-gate.mjs`.

⚠️ **Pegadinhas da telemetria:** (a) `olho_detectado` é AMBÍGUO — é o reason legítimo de foto
BOA *e* o fallback do clamp de falha; SEMPRE cruzar com `vlm_quality`. (b) `capture_attempts`
só grava se o VLM respondeu E o parse passou — timeout/502 é invisível (viés de sobrevivência).
