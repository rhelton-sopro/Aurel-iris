# Topografia canônica + esqueleto legível por IA

**Fonte:** `livros/551115800-iridology-chart.pdf` — *Iridology Chart, developed by Bernard Jensen D.C. Ph.D. with revisions by Ellen Jensen Ph.D. D.Sc., © 2004, Bernard Jensen International.* Procedência completa; supera os livros de 1980/1982 e qualquer gráfico sem autoria.

**Convenção do gráfico (declarada nele):** marcadores horários 1-12 em triângulos na borda, **12h no topo**, sentido horário. Cada íris tem seu próprio mapa — *"they are both different"* (Jensen, Simplified p.10). Cada íris responde ao **lado do corpo correspondente**.

---

## 1. Os 7 anéis, por TECIDO (legenda oficial "IRIS ZONES")

Ordem da pupila para a borda. **Usar o nome, nunca o número** — a numeração 1-7 muda entre edições do próprio Jensen; o nome do tecido é estável.

| ordem | id proposto | nome no gráfico | cor no gráfico |
|---|---|---|---|
| 1 | `estomago` | STOMACH — nutritive zone | verde-água |
| 2 | `intestinos` | INTESTINES — nutritive zone | pêssego |
| 3 | `sangue_linfa` | BLOOD & LYMPH — humoral zone | rosa |
| 4 | `musculatura` | MUSCULATURE | roxo |
| 5 | `ossea` | BONY STRUCTURE | cinza |
| 6 | `linfa_superficial` | SUPERFICIAL LYMPH & BLOOD | azul claro |
| 7 | `pele` | SKIN & ORIFICES | azul escuro |

Os anéis 4-7 formam a **CILIARY ZONE** (chave no gráfico). O **colarete** (COLLARETTE, marcado no gráfico) é a fronteira entre `intestinos` e `sangue_linfa`, a ~1/3 do raio.

---

## 2. ⭐ A ESTRATÉGIA: não dar o mapa ao modelo

Este é o ponto central do desenho, e vem de medição, não de preferência.

**O que foi medido (2026-07-26):**
- Perguntando ao Sonnet 4.6 *"onde está o pigmento dourado?"* **sem permitir nome de órgão**, ele acerta: respondeu "11h-2h, e a metade inferior é menos densa", batendo com a medição determinística (topo 0,086-0,113 · fundo 0,012-0,025).
- No Stage 1 completo, com os 42 campos disponíveis, o **mesmo modelo** escreveu *"zona temporal inferior OD (~5-7h) com pigmentação âmbar"* — **fabricou a posição para justificar o rótulo `figado_vesicula`**, e ainda acrescentou qualificador afirmando que estava se diferenciando do anel pericentral.

**Conclusão:** dar a tabela de órgãos ao modelo cria raciocínio rótulo-primeiro. Ele escolhe o órgão por associação (âmbar → fígado) e depois descreve uma posição que sustente a escolha. **Tirar o nome do órgão do vocabulário de saída elimina o incentivo.**

### O contrato novo

O modelo reporta **coordenada + evidência**. O código faz o **de-para** coordenada → campo, deterministicamente, contra a tabela da seção 3.

```
Stage 1a (modelo VÊ)  →  { olho, hora_ini, hora_fim, anel, tipo_marca, intensidade, fotos_confirmadas }
                          ↓
Mapeamento (CÓDIGO)   →  lookup na topografia oficial → campo canônico
                          ↓
Stage 1b (modelo QUALIFICA) → natureza da carga, correlações, sobre campos JÁ resolvidos
```

**O que cada peça resolve:**

| problema medido hoje | como o contrato resolve |
|---|---|
| Posição fabricada para justificar rótulo | O rótulo não é entrada do modelo. Posição é a saída, não a defesa. |
| Coordenada radial ausente (36 de 38 campos sem anel) | `anel` é campo **obrigatório** do schema, com enum de 7 nomes de tecido |
| Cruzamento com a foto sem flash é honor-system (1/7 a 5/10 citam) | `fotos_confirmadas: number[]` obrigatório — validator rejeita achado cromático sem a foto sem-flash na lista |
| Enum aceita campo constitucional em achados (`trama_fibras I2`) | Constitucionais saem do enum de achados por construção |
| Erros do glossário (fígado/tireoide/intestino grosso) | Corrigir **uma** tabela de dados conserta todos os consumidores |
| Zona→órgão instável entre rodadas | Duas coordenadas obrigatórias reduzem o espaço de saída; e o mapeamento é determinístico |

### Schema proposto (esqueleto)

```ts
/** Anel de tecido — nomes oficiais do gráfico Jensen 2004. Pupila → borda. */
export type AnelTecido =
  | 'estomago' | 'intestinos' | 'sangue_linfa'
  | 'musculatura' | 'ossea' | 'linfa_superficial' | 'pele'

/** Tipo de marca observável. Vocabulário FECHADO e puramente visual. */
export type TipoMarca =
  | 'pigmento_ambar' | 'pigmento_marrom' | 'mancha_branca' | 'mancha_escura'
  | 'lacuna' | 'cripta' | 'radial_escura' | 'anel_concentrico'
  | 'fibras_afrouxadas' | 'fibras_compactas' | 'opacidade' | 'vaso_transversal'

export interface ObservacaoPosicional {
  olho: 'OD' | 'OE'
  /** Hora decimal no relógio da íris. 12h = topo, sentido horário. Ex.: 7.5 */
  hora_ini: number
  hora_fim: number
  anel: AnelTecido
  tipo_marca: TipoMarca
  intensidade: 1 | 2 | 3 | 4 | 5
  /** Índices das fotos (1-6) onde o sinal foi confirmado. Cromático EXIGE a foto sem flash. */
  fotos_confirmadas: number[]
  descricao_visual: string
}
```

**Por que esse formato é o mais fielmente legível por qualquer IA:**

1. **Hora decimal, não prosa.** `7.5` não admite interpretação; "temporal inferior" admite três.
2. **Convenção declarada uma vez, no schema** — 12h no topo, sentido horário — em vez de espalhada por uma seção de 47 linhas que o modelo pode aplicar pela metade.
3. **Enum fechado em vez de texto livre.** Com `strict: true` na tool, a API **garante** que o valor é do enum. Hoje o Stage 1 não usa `strict` (TODO aberto em `stage1-scan.ts:144`).
4. **Duas coordenadas obrigatórias.** O modelo não consegue "esquecer" o anel: sem ele o JSON é inválido.
5. **Evidência estrutural, não retórica.** `fotos_confirmadas` é verificável por regra; "confirmado na imagem 3" em prosa não é.
6. **Zero nome de órgão no vocabulário do modelo.** Remove a associação cromática que causou o erro do fígado.

---

## 3. Tabela topográfica — extração do gráfico oficial

**Status:** primeira passada da íris DIREITA, lida do gráfico oficial ampliado (`CHART2-R`). Hora aproximada pelos marcadores 1-12. ⚠️ **A validar setor a setor com zoom** antes de virar código — esta passada é para fixar o formato.

### Íris DIREITA (OD)

| hora | `sangue_linfa` / `musculatura` | `ossea` | `linfa_superficial` / `pele` |
|---|---|---|---|
| 11-12h | POSTERIOR BRAIN, CEREBELLUM, SINUS | — | LYMPHATIC & CIRCULATORY |
| 12h | CEREBRUM, CORPUS CALLOSUM, THAL, HYPOTH, MEDIAL BRAIN, PONS, PIT, P (pineal) | — | BRAIN |
| 12-1h | FRONTAL BRAIN, FOREHEAD TEMPLE, FRONTAL SINUS | — | SKIN, FACE |
| 1-2h | EYE, UPPER JAW, NOSE, TONGUE MOUTH, LOWER JAW, TONSILS | — | SKIN |
| 2-3h | PHARYNX, LARYNX, VOCAL CORDS, PT (paratireoide) | — | THROAT |
| **3h** | **THYROID** (banda), TRACHEA, ESOPHAGUS, THY (timo) | CERVICAL | U. BACK |
| 3-4h | **LIVER** (banda), THORACIC | SCAP | CIRCULATORY SYSTEMS |
| 4-5h | LUMBAR, SACRUM, COCCYX, PAN BODY | — | LYMPHATIC, L. BACK |
| 5h | URINARY BLADDER, PRO UT, PENIS/VAGINA, URETH, PERINEUM PUBIS | — | — |
| 5-6h | **KIDNEY** (banda) | — | PELVIC |
| 6h | ADRENAL, APPEND, CECUM | HIP THIGH KNEE FOOT, GROIN | — |
| 6-7h | PERITONEUM, ABDOMINAL WALL, PELVIS | — | L. ABDOMEN, SKIN |
| 7-8h | TESTES/OVARY, DIAPHRAGM UPPER ABDOMEN | — | U. ABDOMEN |
| **8h** | **LIVER** (banda), GALLBL, PAN HEAD, DUO | — | — |
| 8-9h | RIBS, LOWER BREAST, ARM, HAND | THORAX | PLEURA |
| 9h | LUNG (lobo inferior/médio/superior) | — | THORAX |
| 9-10h | BRONCHIOLES, HEART, THY, UPPER BREAST | SHOULDER | LUNG |
| 10h | INNER/MID/OUT EAR, MASTOID, NECK | SHOULDER | SKIN, NECK |
| 10-11h | MEDULLA, CEREBELLUM | NECK | LYMPHATIC & CIRCULATORY |

**Anel `intestinos` (2º), circunferencial** — não segue hora de órgão: ASCENDING COLON, TRANSVERSE COLON, CECUM, DUO, SM INT (small intestine), PYLORUS, PEY PT (Peyer's patches), MES (mesentério), HF (flexura hepática), SF (flexura esplênica), AUTONOMIC NERVOUS SYSTEM (o colarete recortado).

**Anel `estomago` (1º)** — ANTERIOR STOMACH / POSTERIOR STOMACH, e a coluna vertebral projetada (ATLAS, CERVICAL, THORACIC, LUMBAR, SACRUM) na borda pupilar.

### 🆕 O que o gráfico de 2004 tem e os livros antigos não

Achados novos ao comparar com o Jensen de 1982:

- **Painel "BRAIN FLAIR" separado** (leque acima de cada íris) com áreas **psicológicas** nomeadas: `ANIMATION LIFE`, `EGO PRESSURE`, `MENTAL ABILITY`, `SEX IMPULSE`, `SEX/MENTAL AREA`, `ANXIETY`, `APPREHENSION`, `INHERENT MENTAL`, `ACQUIRED MENTAL SPEECH`, `SENSORY LOCOMOTION`, `5 SENSE AREA`, `EQUILIBRIUM`, `DIZZINESS CENTER`, `VISUAL AREA`, `EPILEPTIC CENTRE`. **Relevante para o produto:** é conteúdo psico-emocional dentro do gráfico oficial do Jensen — não é enxerto de outra escola.
- **Subdivisões glandulares novas:** `PT` (paratireoide) e `THY` (timo) separados da tireoide; pâncreas dividido em `PAN HEAD` / `PAN BODY` / `PAN TAIL`.
- **Flexuras nomeadas:** `HF` (hepática) e `SF` (esplênica) no anel intestinal.
- **`SOL PLX`** (plexo solar) e `AORTA` marcados.
- **Coluna vertebral em dois lugares:** projetada na borda pupilar (anel 1) **e** como banda radial (CERVICAL→COCCYX) no anel ósseo.
- Zonas nomeadas por **tecido** em vez de numeradas (ver §1).

---

## 3a. EXTRAÇÃO VERIFICADA — íris DIREITA (setor a setor, zoom por quadrante)

Método: recorte por quadrante do gráfico oficial a 4,5×, leitura direta, hora pelos marcadores triangulares 1-12. ✅ = verificado neste zoom.

### ✅ OD 12h → 3h

| hora | anel | áreas |
|---|---|---|
| 12h | `sangue_linfa` / `ossea` / `pele` | CEREBRUM · CORPUS CALLOSUM · THAL · HYPOTH · FRONTAL BRAIN · SINUS · *(externo: BRAIN)* |
| ~1h | `sangue_linfa` / `ossea` | FOREHEAD TEMPLE · FRONTAL SINUS · EYE · SKIN · *(externo: FACE)* |
| 1-2h | `ossea` | UPPER JAW · NOSE · TONGUE MOUTH · LOWER JAW |
| 2-3h | `ossea` | TONSILS · PHARYNX · LARYNX · VOCAL CORDS · *(externo: THROAT)* |
| **~2:40-3:20h** | **`musculatura`** | **THYROID** (banda larga) · **PT** (paratireoide) e **THY** (timo) = ovais na borda do colarete · TRACHEA · ESOPHAGUS |

### ✅ OD 6h → 9h

| hora | anel | áreas |
|---|---|---|
| ~5:45-6:15h | `ossea` / `sangue_linfa` | HIP THIGH KNEE FOOT · GROIN · **ADREN** (oval) · **APPEND** |
| ~6:15-6:45h | `ossea` / `sangue_linfa` | PERITONEUM · ABDOMINAL WALL · PELVIS |
| ~6:45-7:15h | `musculatura` | **TESTES/OVARY** |
| ~7:15-7:45h | `ossea` | DIAPHRAGM · UPPER ABDOMEN |
| **~7:30-8:15h** | **`musculatura`** | **LIVER** · **GALLBL** e **PAN HEAD** (ovais na borda do colarete) |
| ~8:15-8:45h | `ossea` / `sangue_linfa` | HAND · ARM |
| ~8:45-9h | `linfa_superficial` | RIBS · LOWER BREAST · THORAX |

**⭐ Prova definitiva do erro nº 1 (`figado_vesicula`):** na faixa **5-7h**, onde o glossário do projeto coloca o fígado, o gráfico oficial mostra HIP/THIGH/KNEE/FOOT, GROIN, PERITONEUM, ABDOMINAL WALL, PELVIS, TESTES/OVARY, ADREN e APPEND. **Nenhum fígado.** O fígado está a **7:30-8:15h**, anel `musculatura`, com vesícula e cabeça do pâncreas adjacentes.

**Correção a aplicar em `GLOSSARY[]`:**
```
figado_vesicula
  antes: 'Temporal inferior OE+OD (5-7h)'
  depois: 'Anel musculatura, ~7:30-8:15h, ambas as íris (banda também em ~3:30-4h na OD).
           Vesícula (GALLBL) e cabeça do pâncreas adjacentes na borda do colarete.'
```

⏳ **Faltam:** OD 3h→6h · OD 9h→12h · íris ESQUERDA completa (4 quadrantes).

---

## 3c. MAPA HORA-A-HORA, OS DOIS OLHOS — só evidência forte

**Critério de inclusão (diretriz do founder):** entra o que está legível no gráfico oficial E, quando existe, corroborado pelo texto do livro. Fica de fora o que aparece solto ou em leitura única duvidosa.

**Convenção:** 12h no topo, **sentido horário nas duas íris** (verificado nos marcadores triangulares do gráfico). A hora NÃO se espelha entre olhos; o que se espelha é o conteúdo.

### ÍRIS DIREITA (OD)

| hora | áreas (fora → dentro) | evidência |
|---|---|---|
| 12h | CEREBRUM · CORPUS CALLOSUM · THAL · HYPOTH · FRONTAL/MEDIAL BRAIN · SINUS · PONS · PIT · P(ineal) no colarete | gráfico |
| ~1h | FOREHEAD TEMPLE · FRONTAL SINUS · EYE | gráfico |
| 1-2h | UPPER JAW · NOSE · TONGUE MOUTH · LOWER JAW | gráfico |
| ~1:45h | **HEART** (marca vermelha menor) · BRONCHUS | gráfico *(o coração principal é OE)* |
| 2-3h | TONSILS · PHARYNX · LARYNX · VOCAL CORDS | gráfico |
| **~2:40-3:20h** | **THYROID** (banda) · **PT** (paratireoide) · **THY** (timo) · TRACHEA · ESOPHAGUS | **gráfico + livro** (*"2 and 3 o'clock in the right iris"*) |
| ~3:20-3:45h | CERVICAL · THORACIC · SCAP | gráfico |
| ~3:45-4h | banda **LIVER** secundária + **PAN BODY** — ⚠️ **em aberto**, nenhum livro documenta | só gráfico |
| ~4-4:45h | LUMBAR · SACRUM · COCCYX · LYMPHATIC | gráfico |
| **~4:30-5h** | **URINARY BLADDER** · PRO UT · PENIS/VAGINA · URETH · PERINEUM PUBIS | **gráfico + livro** (*"bladder just prior to 5 o'clock in the right iris"*) |
| **~5:30h** | **KIDNEY** (banda larga) | **gráfico + livro** (*"near 6 o'clock in both irides"*) |
| ~5:45-6:15h | HIP THIGH KNEE FOOT · GROIN · **ADREN** · **APPEND** | gráfico |
| ~6:15-6:45h | PERITONEUM · ABDOMINAL WALL · PELVIS | gráfico + livro (*"pelvis ~7 o'clock in the right"*) |
| ~6:45-7:15h | **TESTES/OVARY** | gráfico |
| ~7:15-7:45h | DIAPHRAGM · UPPER ABDOMEN | gráfico |
| **~7:30-8:15h** | **LIVER** · **GALLBL** · **PAN HEAD** | **gráfico + livro** (*"just preceding 8 o'clock in the right iris"*) |
| ~8:15-8:45h | HAND · ARM | gráfico + livro (*"arm and hand at 8 o'clock in the right"*) |
| ~8:45-9:15h | RIBS · LOWER BREAST · THORAX · PLEURA | gráfico + livro (*"pleura, thorax and ribs between 8 and 9 in the right"*) |
| **~9-9:45h** | **LUNG** (lobo inferior/médio/superior) · BRONCHIOLES · **HEART** (vermelha) · **THY** | **gráfico + livro** (*"right lung between 9 and 10 o'clock"*) |
| ~9:45-10h | UPPER BREAST · SHOULDER | gráfico |
| ~10h | NECK · INNER/MID/OUT EAR · MASTOID | gráfico |
| **~10:30-11h** | **MEDULLA** · CEREBELLUM | **gráfico + livro** (*"medulla... 11 o'clock in the right"*) |
| ~10:45h | **PAN** (oval no colarete) | gráfico |
| ~11-12h | POSTERIOR BRAIN · MEDIAL BRAIN · CORPUS CALLOSUM · SINUS · **HF** (flexura hepática) no anel intestinal | gráfico |

### ÍRIS ESQUERDA (OE)

| hora | áreas | evidência |
|---|---|---|
| 12h | CEREBRUM · CORPUS CALLOSUM · MEDIAL/POSTERIOR BRAIN · SINUS · PONS · **P** · **PIT** no colarete | gráfico |
| ~12:30-1h | CEREBELLUM · MEDULLA | gráfico + livro (*"medulla at 1 o'clock in the left iris"*) |
| ~1h | MASTOID · INNER EAR | gráfico |
| ~1:30-2h | MID EAR · OUT EAR · NECK | gráfico |
| ~2h | SHOULDER · **PAN** (oval no colarete) | gráfico |
| **~2:15-3h** | **HEART** (banda vermelha grande) · **AORTA** · BRONCHIOLES · **THY** | **gráfico + livro** (*"the heart area is located in the left iris at 3 o'clock in Zone 3, usually on the autonomic nerve wreath line"*) |
| **~2:30-3:30h** | **LUNG** (lobo superior/inferior) · UPPER BREAST · PLEURA | **gráfico + livro** (*"left lung... between 2 and 3 o'clock"*) |
| ~9-9:40h | **THYROID** (banda) · **PT** · **THY** · TRACHEA · ESOPHAGUS | **gráfico + livro** (*"9 and 10 in the left iris"*) |
| ~9:15h | **HEART** (marca menor) · BRONCHUS | gráfico |
| ~9:40-10h | VOCAL CORDS · LARYNX · PHARYNX · TONSILS | gráfico |
| ~10h | TONGUE MOUTH · LOWER JAW · NOSE · UPPER JAW | gráfico |
| ~10:30-11h | EYE · FRONTAL SINUS · TEMPLE FOREHEAD | gráfico |
| ~11-12h | FRONTAL BRAIN · THAL · HYPOTH · **SF** (flexura esplênica) no anel intestinal | gráfico |
| **~8h** | **LIVER** · **PAN BODY** | só gráfico ⚠️ |
| ~7-8h | SPLEEN · DIAPHRAGM · UPPER ABDOMEN · ARM · HAND | gráfico *(baço é órgão esquerdo — coerente)* |
| ~5-7h | ANUS/RECTUM · SCROTUM/PERINEUM · KIDNEY · PELVIS · GROIN | gráfico |
| ~4-5h | URINARY BLADDER · PENIS/VAGINA · PRO UT · LUMBAR · SACRUM · COCCYX | gráfico |

### ✅ OE 3h→6h e 6h→9h (fecham a íris esquerda)

| hora | áreas | evidência |
|---|---|---|
| ~3h | **SOL PLX** (plexo solar, oval) · RIBS · LOWER BREAST · THORAX | gráfico |
| **~3:45-4:15h** | **SPLEEN** (banda) · **PAN TAIL** (oval no colarete) · ARM · HAND | **gráfico** + lista de zonas do Jensen (*"6. Spleen, thyroid, liver"*) |
| ~4:15-4:45h | DIAPHRAGM · UPPER ABDOMEN | gráfico |
| ~4:45-5:15h | **OVARY / TESTES** | gráfico |
| ~5-5:45h | PELVIS · PERITONEUM · ABDOMINAL WALL · GROIN | gráfico |
| ~6h | KIDNEY · HIP THIGH KNEE FOOT · **ADRENAL** | gráfico + livro (*"6 o'clock in both irides"*) |
| ~6:30-7:30h | URINARY BLADDER · PENIS/VAGINA · PRO UT · RECTUM · ANUS · SCROTUM/PERINEUM · URETH | gráfico + livro (*"bladder just after 7 o'clock in the left iris"*) |
| ~8h | banda **LIVER** + **PAN BODY** · LUMBAR · SACRUM · COCCYX · THORACIC · SCAP | só gráfico ⚠️ |

### ⭐ O PAR ESPELHADO RESOLVE A LATERALIDADE DO FÍGADO (definitivo)

Com as duas íris ampliadas, o desenho fica evidente e anatomicamente coerente:

| íris | hora | complexo |
|---|---|---|
| **DIREITA** | ~7:30-8:15h | **LIVER + GALLBL + PAN HEAD** |
| **ESQUERDA** | ~3:45-4:15h | **SPLEEN + PAN TAIL** |

Fígado é órgão do lado **direito**; baço, do lado **esquerdo**. Cabeça do pâncreas fica à direita (junto ao duodeno), cauda à esquerda. **O gráfico posiciona os dois complexos em espelho, cada um na íris do seu lado.**

**Conclusão travada:** o complexo hepatobiliar documentado — o que o livro descreve e o único que tem a vesícula ao lado — é **íris DIREITA, ~7:30-8:15h**. Minha retratação anterior ("é bilateral") estava baseada em ver a palavra LIVER na íris esquerda **sem notar que era outra banda, no setor das costas, com PAN BODY** — não o complexo hepatobiliar.

⚠️ **Fica em aberto (não entra no glossário):** há uma banda rotulada `LIVER + PAN BODY` no setor dorsal de **ambas** as íris (OD ~3:45-4h, OE ~8h), espelhadas entre si. Nenhum texto do acervo a documenta. Registrada, não codificada.

### 🆕 CAMPOS AUSENTES no glossário, com lastro no gráfico

Resposta à pergunta "tem mais itens para colocar?":

| campo novo | posição verificada | lastro |
|---|---|---|
| **`baco`** (spleen) | OE ~3:45-4:15h, anel `musculatura`, com PAN TAIL | banda própria no gráfico + lista de zonas do Jensen |
| **`plexo_solar`** | OE ~3h (oval `SOL PLX`) | gráfico + lista de zonas (*"3. ...solar plexus..."*) |

E o `pancreas` do glossário (`~7-8h OE preferencial`) está **errado por simplificação**: o gráfico divide em **PAN HEAD** (OD ~8h, junto ao fígado), **PAN TAIL** (OE ~4h, junto ao baço) e **PAN BODY** (setor dorsal de ambas). Uma posição só não representa o órgão.

### Anéis internos (circunferenciais, não seguem hora de órgão)

- **`estomago` (anel 1):** ANTERIOR/POSTERIOR STOMACH · CARDIA · PYLORUS · e a **projeção da coluna na borda pupilar**: ATLAS · CERVICAL · THORACIC · LUMBAR · SACRUM
- **`intestinos` (anel 2):** ASCENDING/TRANSVERSE/DESCENDING COLON · CECUM · SIGMOID · DUO · SM INT (small intestine) · **PEY PT** (placas de Peyer, área pontilhada) · **MES** (mesentério) · **HF**/**SF** (flexuras hepática e esplênica) · APPEND · o colarete recortado = **AUTONOMIC NERVOUS SYSTEM**

### ⚠️ Guardrails a PRESERVAR na versão nova (decisão do founder)

Enriquecer o mapa **não pode** reabrir o que já foi fechado:
- `padrao_pupilar` continua **demovido** (v2.7.0): intensidade máxima 3, **nunca** o achado de maior intensidade, e não emitir se a pupila for normal.
- As regras anti-exagero de **esclera** e **pupila** permanecem — o mapa novo dá mais precisão dentro da íris, não licença para inflar o que está fora dela.

## 3b. Revisão cruzada: gráfico 2004 × texto do livro grande (1982)

Cada afirmação posicional que consegui localizar no texto de `458440796-Bernard-Jensen-Iridology`, conferida contra a leitura do gráfico oficial:

| campo | livro grande (1982), citação | gráfico 2004 (minha leitura) | confere? |
|---|---|---|---|
| fígado | *"just preceding **8 o'clock in the right iris**"* | LIVER a 8h OD | ✅ |
| tireoide | *"between **2 and 3 o'clock in the right iris** and 9 and 10 in the left"* | THYROID a ~3h OD | ✅ |
| rim | *"Near **6 o'clock in both irides**"* | KIDNEY a 5-6h OD | ✅ |
| bexiga | *"just prior to **5 o'clock in the right iris** and just after 7 o'clock in the left"* | URINARY BLADDER a 5h OD | ✅ |
| pulmão | *"right lung... between **9 and 10 o'clock**"* | LUNG a 9h / 9-10h OD | ✅ |
| coração | *"the left iris at **3 o'clock** in Zone 3, usually on the autonomic nerve wreath line"* | HEART a 9-10h em OD (⇒ ~3h em OE) e o gráfico o põe colado no colarete | ✅ |
| medula | *"**1 o'clock in the left iris and 11 o'clock in the right**"* | MEDULLA a 10-11h OD | ✅ |
| braço/mão | *"**4 o'clock in the left** iris and **8 o'clock in the right**"* | ARM, HAND a 8-9h OD | ✅ |
| pelve | *"about 5 o'clock in the left iris and **7 o'clock in the right**"* | PELVIS a 6-7h OD | ✅ |
| intestino delgado | *"takes up the area in **Zone 2** from seven o'clock to eleven o'clock in the left iris"* | SM INT no anel `intestinos` (2º) | ✅ |
| cólon | transverso 11h→1h; sigmoide vira radialmente ~7h; *"rectum and anus proceed outward to the periphery"* | ASCENDING/TRANSVERSE COLON no anel `intestinos`; ANUS/RECTUM avançam para fora | ✅ |
| **costelas** | ⚠️ **o livro se contradiz**: *"Pleura, thorax and ribs are between 3 and 4 o'clock in the left iris and between **8 and 9 in the right**"* (p.~10660) vs *"ribs... between 1 and 2 o'clock in the left iris and between **10 and 11 o'clock in the right**"* (p.~13966) | RIBS a 8-9h OD | ✅ **com a 1ª**; o gráfico resolve a contradição interna do livro |

**Resultado: 12 de 12 conferem.** O gráfico 2004 não contradiz o livro de 1982 em nenhum ponto localizável — e resolve uma contradição que o livro tem consigo mesmo (costelas).

**Isso reposiciona os conflitos que eu havia reportado:** o que divergia era (a) a **numeração 1-7** das zonas entre as duas edições — resolvido pelos nomes de tecido; e (b) o **glossário do projeto** contra as fontes. **As fontes concordam entre si; era o glossário que estava fora.**

---

## 4. Pendências antes de virar código

1. **Validar a tabela setor a setor** com zoom (24 recortes: 12 horas × 2 íris). Esta passada é primeira leitura.
2. **Extrair a íris ESQUERDA** — não é espelho simples da direita (o gráfico mostra SPLEEN à direita da L onde a R tem LIVER).
3. **Decidir a escola da linha do tempo** — Jensen rejeita cronologia radial; se mantém, declarar Lo Rito ou Marcos V. Dias como fonte. Ver `memory/research_glossary_temporal.md`.
4. **Decidir sobre `vaso_transversal`** — sinal real (24 menções, capítulo próprio no manual espanhol), mas a leitura clássica é oncológica; entra como observação visual apenas, com regra no Stage 2 proibindo o salto prognóstico.
5. Este redesenho **muda o contrato Stage 1 → Stage 2**. Blast radius maior que o do crop (`6d3a806`).
