# Auditoria do glossário canônico contra as fontes — topografia iridológica

**Data:** 2026-07-26 · **Origem:** o Stage 1 marcou `figado_vesicula` como carga em 3/3 amostras na íris do founder, contra o gabarito dele (âmbar pericentral = estômago + intestino delgado, NÃO fígado). Investigando *por quê*, a suspeita saiu do modelo e caiu no mapa.

**Fonte auditada:** `livros/458440796-Bernard-Jensen-Iridology-pdf.pdf` — único dos 3 PDFs do Jensen no acervo com camada de texto extraível (os outros 15 livros são digitalizados como imagem; exigem OCR). Texto extraído com `pdftotext -layout`; OCR do próprio PDF tem ruído, mas as passagens citadas abaixo estão legíveis e foram transcritas literalmente.

**Objeto auditado:** `apps/web/lib/anthropic/stage1-glossary.ts` → `GLOSSARY[]`, campo `zona`. 38 dos 42 termos têm zona declarada (4 são constitucionais). O bloco "Glossário canônico — 42 termos" do `prompts/stage1-scan.md` é **gerado** desse array, então corrigir lá corrige o prompt.

---

## ⚠️ Ressalvas que limitam este documento

1. **Uma escola.** Jensen (escola americana) é a mais difundida e a única citável aqui. A escola alemã (Deck/Angerer/Schnabel) tem topografia própria; Lo Rito/Birello têm mapa embriológico. Divergência entre escolas é esperada — o problema é o glossário divergir da escola que ele mesmo cita (usa "zona 6 Jensen" e "zona 7 Jensen" em dois campos).
2. **A convenção de lado NÃO está resolvida.** Jensen escreve "right iris" / "left iris". O glossário usa OD/OE. Se "right iris" = olho direito do cliente (leitura padrão) e OD = olho direito do cliente, as afirmações são comparáveis e os vereditos abaixo valem. **Isto precisa da confirmação do founder** — ela decide metade dos vereditos de lateralidade.
3. **Não é auditoria completa.** 15 dos 38 campos têm afirmação posicional localizada no Jensen. Os outros 23 não foram encontrados nesta fonte e ficam **não verificados** — não "certos".

---

## ⭐ FONTE CANÔNICA ENCONTRADA — usar esta, não a prosa (2026-07-26)

`livros/551115800-iridology-chart.pdf` — **o gráfico oficial, com procedência completa**:

> *"Developed by **Bernard Jensen, D.C., Ph.D.** with revisions by **Ellen Jensen, Ph.D., D.Sc.** © 2004 — Bernard Jensen International — bernardjensen.org"*

Supera tudo o que auditei antes (livros de 1980/1982 e o gráfico anônimo CMG de 2011). Lido por rasterização a 4,5× + zoom por região. **Todos os vereditos abaixo foram reescritos contra esta fonte.**

### Os 7 anéis, nomeados por TECIDO (não por número)

A legenda "IRIS ZONES" do gráfico resolve a instabilidade de numeração que eu havia encontrado entre as duas edições — o sistema real não é numerado, é por tipo de tecido:

| ordem (pupila → borda) | nome oficial |
|---|---|
| 1 | **STOMACH** — nutritive zone |
| 2 | **INTESTINES** — nutritive zone |
| 3 | **BLOOD & LYMPH** — humoral zone |
| 4 | **MUSCULATURE** |
| 5 | **BONY STRUCTURE** |
| 6 | **SUPERFICIAL LYMPH & BLOOD** |
| 7 | **SKIN & ORIFICES** |

*(as 4 externas formam a "CILIARY ZONE" por chave no gráfico)*

**É assim que o glossário deve descrever a coordenada radial** — por nome de tecido, que é estável e citável, não por número 1-7, que muda entre edições.

### ⚠️ TRÊS RETRATAÇÕES minhas contra esta fonte

1. **`figado_vesicula` — a lateralidade do glossário está CERTA.** Eu afirmei que fígado é "só íris direita". **Errado.** O gráfico oficial mostra banda `LIVER` a ~8h na íris DIREITA **e** a ~8h na íris ESQUERDA (verificado por zoom nas duas). Há ainda uma segunda banda `LIVER` a ~3:30-4h na íris direita. `OE+OD` do glossário está correto. **O que continua errado é só a HORA** (5-7h; a 5-7h o gráfico mostra KIDNEY, PELVIC, URINARY BLADDER, PENIS/VAGINA, RECTUM, ANUS).
2. **`sistema_linfatico` — glossário CERTO** (zona 6, corroborado por 3 fontes). Retratado acima.
3. **`coluna_lombar` — glossário provavelmente CERTO.** No gráfico oficial a coluna (CERVICAL→THORACIC→LUMBAR→SACRUM→COCCYX) corre em ~3-4:30h, com LUMBAR a ~4h. O glossário diz 4-5h ≈ correto. A citação "lumbar area is from 5 to 8 o'clock" do livro grande fala de **nervos lombares**, não de vértebras — eu confundi os dois. **Retratado.**

### Estado final: 3 erros sobrevivem

| # | campo | glossário | gráfico oficial 2004 | o que está errado |
|---|---|---|---|---|
| 1 | `figado_vesicula` | Temporal inferior OE+OD (**5-7h**) | `LIVER` a **~8h em AMBAS** as íris + 2ª banda a ~3:30-4h em OD | ❌ a HORA (lateralidade OK) |
| 2 | `intestino_grosso` | **Periferia/borda externa** | ASCENDING/TRANSVERSE/DESCENDING COLON no anel **INTESTINES**, 2º a partir da pupila | ❌ o ANEL (4 fontes) |
| 3 | `tireoide` | ~2-3h **OE**, ~9-10h **OD** | `THYROID` banda grande a **~2-3h em OD**; a ~9-10h em OE | ❌ lateralidade INVERTIDA (2 fontes) |

---

## 🔴 Erros confirmados — SUPERSEDED pela seção acima (mantido como histórico do raciocínio)

### 1. `figado_vesicula` — posição E lateralidade erradas

| | |
|---|---|
| **Glossário** | `Temporal inferior OE+OD (5-7h)` |
| **Jensen (p. ~4756 do texto extraído)** | *"When a patient has been treated successfully for a chronic liver ailment, delicate white intermeshed lines begin filling in the formerly dark gray **area just preceding 8 o'clock in the right iris**."* |
| **Zona radial (Jensen, lista das 7 zonas)** | *"6. Spleen, thyroid, liver"* — **zona 6**, terço externo |
| **Veredito** | ❌ Errado em três eixos: hora (5-7h vs ~8h), lateralidade (bilateral vs **só íris direita**) e zona (ausente vs zona 6) |

**Por que isso é o erro mais caro:** o fígado é órgão do lado direito do corpo, e praticamente toda escola o coloca **só na íris direita**. Declarar `OE+OD` autoriza o modelo a achar fígado nos dois olhos. E como o glossário dá **só a hora**, sem a zona, o modelo não tem como recusar um pigmento **pericentral** (zona 1-2) como hepático — foi exatamente o que aconteceu na íris do founder.

**Correção proposta:** `Zona 6 (terço externo), ~7:30-8h, ÍRIS DIREITA (OD) apenas — órgão lateralizado`.

### 2. `intestino_grosso` — está no anel errado

| | |
|---|---|
| **Glossário** | `Periferia/borda externa` |
| **Jensen** | *"In the left iris the center of the transverse colon begins at eleven o'clock and ends at around one o'clock where the descending colon drops down to the sigmoid colon at about five o'clock. The sigmoid colon turns radially outward just prior to seven o'clock, **where the rectum and anus proceed outward to the periphery of the iris**."* + zona 2 = *"Intestinal area"* |
| **Veredito** | ❌ O cólon é **zona 2** (logo fora do colarete, anel INTERNO). Só o **reto/ânus** avança para a periferia. O glossário generalizou a exceção. |

**Consequência:** qualquer mancha escura periférica é candidata a `intestino_grosso` pelo glossário, quando naquele anel moram pele, linfático e circulatório (zona 7).

### 3. `sistema_linfatico` — cita a zona do Jensen e erra o número

| | |
|---|---|
| **Glossário** | `Coroa periférica (zona 6 Jensen)` |
| **Jensen** | *"6. Spleen, thyroid, liver · **7. Skin, lymphatic and circulatory systems**, sweat glands, motor and sensory nerves"* |
| **Veredito** | ❌ Linfático é **zona 7**, não 6. A zona 6 é baço/tireoide/fígado. (`pele_tegumentar` cita "zona 7 Jensen" e está ✅ correto.) |

### 4. `tireoide` — lateralidade invertida ⚠️ *precisa da confirmação do founder*

| | |
|---|---|
| **Glossário** | `Cervical (~2-3h OE, ~9-10h OD)` |
| **Jensen** | *"The thyroid gland... is located between **2 and 3 o'clock in the right iris and 9 and 10 in the left iris**."* |
| **Veredito** | ❌ Invertido — **se** "right iris" = OD |

⚠️ **Cuidado com este:** na mesma obra, o pulmão aparece com o padrão OPOSTO — *"In the **left** iris the two lobes of the left lung are found between **2 and 3 o'clock** while in the **right** iris the three lobes of the right lung are located between 9 and 10 o'clock."* Ou seja, 2-3h é pulmão esquerdo no olho esquerdo, mas tireoide na íris direita. Pode ser característica real do mapa (a topografia não é espelhada), pode ser erro de edição/OCR. **Não mexer sem cruzar com uma 2ª fonte.**

### 5. `coluna_lombar` — faixa muito estreita

| | |
|---|---|
| **Glossário** | `4-5h (homolateral único)` |
| **Jensen** | *"The lumbar area is from **5 to 8 o'clock**."* |
| **Veredito** | ❌ Faixa quase sem sobreposição com a do glossário |

### 6. `sistema_reprodutor` — aproximação que apaga a lateralidade

| | |
|---|---|
| **Glossário** | `Inferior medial (~6h)` |
| **Jensen** | *"...the male testes, at **5 o'clock in the left iris, 7 o'clock in the right** iris. The vagina, at **7 o'clock in the left iris and 5 o'clock in the right**, extends **from Zones 4 through 7**."* |
| **Veredito** | ⚠️ Não exatamente errado, mas ~6h achata duas posições distintas (5h e 7h, com lado) e omite a extensão radial (zonas 4-7) |

---

## Tabela completa dos 38 campos

Legenda: ✅ concorda · ❌ divergente · ⚠️ subespecificado/ambíguo · — não encontrado nesta fonte

| campo | glossário (zona declarada) | Jensen (citação localizada) | veredito |
|---|---|---|---|
| `figado_vesicula` | Temporal inferior OE+OD (5-7h) | "just preceding 8 o'clock in the right iris"; zona 6 | ❌ ver §1 |
| `rim` | Inferior (6h) ambos | "Near 6 o'clock in both irides... the kidneys" | ✅ |
| `sistema_urinario` | Inferior (rim → ureter → bexiga) | "The bladder is located just prior to 5 o'clock in the right iris and just after 7 o'clock in the left" | ⚠️ direção certa, sem hora/lado |
| `pulmoes` | Temporal superior (~3h OE, ~9h OD) | "left lung... between 2 and 3 o'clock [left iris]; right lung... between 9 and 10 o'clock [right iris]"; brônquios em zona 3 | ✅ |
| `coracao` | Superior esquerda OE (~2-3h) | "the heart area is located in the left iris at 3 o'clock **in Zone 3**, usually on the autonomic nerve wreath line" | ✅ hora/lado · ⚠️ falta zona 3 + "sobre o colarete" |
| `estomago` | Pericentral, anel interno | zona 1 = "Stomach area"; "the central area surrounding the pupil... corresponds to the stomach" | ✅ |
| `intestino_delgado` | Estroma intermediário | "The small intestine takes up the area in **Zone 2** from seven o'clock to eleven o'clock in the left iris" | ⚠️ "estroma intermediário" é vago; é **zona 2** |
| `intestino_grosso` | Periferia/borda externa | cólon em zona 2; só reto/ânus vai à periferia | ❌ ver §2 |
| `sistema_linfatico` | Coroa periférica (zona 6 Jensen) | zona **7** = "Skin, lymphatic and circulatory" | ❌ ver §3 |
| `pele_tegumentar` | Anel periférico extremo (zona 7 Jensen) | zona 7 = "Skin..." | ✅ |
| `sistema_circulatorio` | Coroa periférica + anel periférico | zona 7 = "...circulatory systems" | ✅ |
| `tireoide` | ~2-3h OE, ~9-10h OD | "between 2 and 3 o'clock in the right iris and 9 and 10 in the left" | ❌ ver §4 (⚠️ 2ª fonte) |
| `pancreas` | ~7-8h OE preferencial | zona 3 inclui pâncreas; hora não localizada | ⚠️ zona 3, hora não confirmada |
| `adrenal` | Sobre o rim (5:30-6h) | zona 3 inclui "Adrenal glands" | ⚠️ compatível; zona 3 ausente no glossário |
| `coluna_toracica` | 3-5h (homolateral único) | "thoracic nerves go from 8 to 11 o'clock and 1 to 5 o'clock"; costelas "between 1 and 2 o'clock in the left iris and between 10 and 11 in the right" | ⚠️ nervos ≠ vértebras; faixa do glossário só cobre parte |
| `coluna_lombar` | 4-5h | "The lumbar area is from 5 to 8 o'clock" | ❌ ver §5 |
| `coluna_cervical` | 10-11h (homolateral único) | não localizado (a passagem de vértebras cita quiropraxia a "eleven o'clock in the right iris") | — |
| `sacro_coccyx` | 5-6h | não localizado | — |
| `sistema_reprodutor` | Inferior medial (~6h) | testículos 5h OE / 7h OD; vagina 7h OE / 5h OD; "extends from Zones 4 through 7" | ⚠️ ver §6 |
| `cerebrum_motor` | 12-1h OD, 11-12h OE | "the head at 12 o'clock, the back of the skull at 1 o'clock in the left iris and 11 o'clock in the right"; centro de equilíbrio "just prior to one o'clock" | ⚠️ compatível, sem confirmação do split motor/sensorial |
| `cerebellum_sensory` | 11-12h OD, 12-1h OE | idem acima (posterior = 1h OE / 11h OD) | ⚠️ idem |
| `pineal_hipotalamica` | Centro ~12h ambos | zona 4 inclui "pituitary gland, pineal gland"; "animation life center at 12 o'clock" | ⚠️ compatível; zona 4 ausente |
| `eixo_pituitario_adrenal` | Collarete a 12:30h, ambos | pituitária em zona 4; adrenal em zona 3 — o glossário funde dois eixos num ponto | ⚠️ construto do projeto, não do Jensen |
| `boca_garganta` | ~1-2h OE, ~10-11h OD | não localizado | — |
| `sistema_imune` | Sistêmico (espalhado) | n/a (não é campo topográfico) | — |
| `sistema_musculoesqueletico` | Estroma intermediário-periférico | zona 7 inclui "motor and sensory nerves"; ossos/músculo não localizados por hora | ⚠️ |
| `anel_interno` (colarete) | Anel periférico à pupila | "About one third of the distance outward from the pupil is the most useful landmark in the iris, the autonomic nerve wreath" | ✅ |
| `anel_nervoso` | Anel concêntrico no estroma médio | mencionado como "nerve ring" | ✅ |
| `anel_sodico` | Periferia da íris | mencionado (arcus/sodium ring) | ✅ |
| `coroa_simpatica` | Fronteira ciliar/periférica | = autonomic nerve wreath (ver `anel_interno`) | ⚠️ possível colisão conceitual com `anel_interno` |
| `rosario_linfatico` | Periferia (manchinhas) | compatível com zona 7 | ✅ |
| `radii_solaris` | Linhas radiais da pupila | mencionado | ✅ |
| `manchas_psoricas` | Dispersas no estroma | mencionado | ✅ |
| `pigmento_amber` | Concentrado em zona específica | n/a (é tipo de marca, não zona) | — |
| `padrao_pupilar` | Centro pericentral | capítulo próprio sobre pupila | ✅ |
| `lacuna_estrutural` | Zona específica | n/a (tipo de marca) | — |
| `cripta` | Zona específica | n/a (tipo de marca) | — |

**Resumo:** 4 erros confirmados (`figado_vesicula`, `intestino_grosso`, `sistema_linfatico`, `coluna_lombar`) + 1 erro provável dependente de 2ª fonte (`tireoide`) + 11 subespecificados + 5 não localizados + 12 corretos + 5 não-topográficos.

---

## 🚨 As zonas radiais NÃO são estáveis nem dentro do mesmo autor (2026-07-26)

Lido por rasterização + leitura visual da p.10 de `157928975-Bernard-Jensen-Iridology-Simplified.pdf` (o PDF não tem camada de texto; renderizado com pymupdf a 3.2×). O diagrama "THE IRIS IS DIVIDED INTO 7 ZONES" é legível e lista:

> **1** STOMACH · **2** INTESTINES · **3** HEART, BRONCHI, PANC., ADREN., PIT., PINEAL, G. BLADDER · **4** PROSTATE, UTERUS, SKELETON · **5** BRAIN, LUNG, LIVER, SPLEEN, KIDNEYS, THYROID, ETC. · **6** MUSCLES, MOTOR NERVES, LYMPHATIC, CIRCULATORY · **7** SKIN, SENSORY NERVES

Contra a lista do OUTRO livro do mesmo autor (`458440796-Bernard-Jensen-Iridology`, texto extraído):

| zona | Iridology (1982) | Iridology Simplified (1980) | concorda? |
|---|---|---|---|
| 1 | Stomach | STOMACH | ✅ |
| 2 | Intestinal | INTESTINES | ✅ |
| 3 | adrenais, coração, aorta, plexo solar, **rins, pâncreas** | coração, brônquios, pâncreas, adrenais, **pituitária, pineal**, vesícula | ❌ |
| 4 | **brônquios, pituitária, pineal** | **próstata, útero, esqueleto** | ❌ |
| 5 | cérebro, **órgãos reprodutivos** | cérebro, pulmão, **FÍGADO**, baço, **rins, tireoide** | ❌ |
| 6 | baço, **tireoide, FÍGADO** | músculos, nervos motores, **linfático, circulatório** | ❌ |
| 7 | pele, **linfático, circulatório**, nervos motores e sensoriais | pele, nervos sensoriais | ⚠️ parcial |

**Consequência para o projeto:** a coordenada radial existe e é obrigatória (as duas obras afirmam isso), mas **o número da zona não é citável como verdade** — muda entre edições do mesmo autor. Portanto:

- ❌ **NÃO** adicionar `zona: 1-7` ao glossário como se fosse fato bibliográfico. Seria trocar um erro (ausência) por outro (falsa precisão).
- ✅ O que É citável e estável nas duas obras: **a fronteira do colarete a 1/3 do raio**, e **o que fica DENTRO dela**.

### Três coisas que a p.10 resolve definitivamente

1. **Convenção de lado (a pergunta que estava travando os vereditos):** *"There are over 90 known specific areas mapped on each iris, and **they are both different**. **The right iris responds to the right side of the body** and the left responds to the left side. Therefore, there are over 180 divisions."* → cada íris mapeia o próprio lado do corpo. Fígado é órgão do lado direito ⇒ **íris direita**. **O veredito §1 (`figado_vesicula` deve ser unilateral OD) está confirmado.**
2. **O colarete tem posição medível:** *"Starting from the pupil outward, the first major feature lies **1/3 the way out** and forms the iris frill or autonomic nerve wreath."* → landmark radial objetivo, computável a partir de centro+raio.
3. **`intestino_grosso` está DENTRO do colarete:** *"On the inside of the wreath is found the stomach, small and large intestines."* → confirma o erro §2 por **segunda fonte independente**. O glossário põe o cólon na periferia; ele está no terço interno.

Também: *"The wreath itself represents the autonomic nervous system"* → confirma a sobreposição conceitual entre `anel_interno`, `coroa_simpatica` e `sistema_nervoso_autonomico`, todos descrevendo a mesma estrutura.

---

## ⚖️ RETRATAÇÃO + esclarecimento: hora é estável, NÚMERO de zona não (2026-07-26)

### Retratação do erro §3 (`sistema_linfatico`)

**Eu estava errado.** Acusei o glossário de pôr o linfático na zona 6 quando seria 7. Cruzando o acervo:

| fonte | rosário linfático |
|---|---|
| `Manual Para La Práctica de La Iridología` | *"el rosario linfático (**zona 6**)"* · *"Congestión linfática generalizada (zona 6)"* |
| Jensen **Simplified** (diagrama p.10) | zona 6 = *"MUSCLES, MOTOR NERVES, **LYMPHATIC**, CIRCULATORY"* |
| Jensen grande, **prosa** | *"Lymphatic... shown in **Zone 6**"* |
| Jensen grande, **lista das 7 zonas** | zona 7 ← **único discordante** |

`sistema_linfatico: Coroa periférica (zona 6 Jensen)` **está correto**. São **3 erros confirmados**, não 4. Corrigido em §3 abaixo.

### O esclarecimento que muda o encaminhamento

Eu tratei "as zonas do Jensen divergem" como se toda a coordenada radial fosse inutilizável. Isso confunde duas coisas:

- **A HORA é estável entre fontes.** Fígado a ~8h OD e tireoide a 2-3h OD aparecem iguais no texto do Jensen grande E no gráfico `347591698-Iridology-Chart-1.pdf`. Rim a ~6h em três fontes. **Não há conflito de hora nos campos que checei.**
- **A ESTRUTURA radial também é estável:** pupila → anel do estômago → colarete (mesentério/intestinos) → bandas de órgãos → pele/linfático na borda. Isso é idêntico nas duas obras do Jensen e no gráfico.
- **O que divergiu foi só a NUMERAÇÃO 1-7** atribuída a cada órgão entre as duas edições do Jensen.

**Encaminhamento corrigido:** usar hora (citável) + estrutura radial descrita em termos de landmark (*dentro/fora do colarete*, *banda de órgãos*, *borda externa*), e **não** o número da zona. Isso preserva a coordenada radial que o Stage 1 precisa sem depender do que é instável.

### Gráfico `347591698-Iridology-Chart-1.pdf` (4ª fonte)

⚠️ **Procedência auto-declarada como fraca:** a p.1 diz *"This material was reconstructed from various **unverified** sources"* (CMG Archives, 2011). Vale como **triangulação**, não como autoridade. Lido por rasterização a 4× + rotação (os marcadores horários vermelhos na borda dão a orientação; as 45 subdivisões finas convertem por hora ≈ subdivisão ÷ 3,75 — verificado em 8→30, 9→34, 12→45).

| campo | leitura do gráfico (íris DIREITA) | concorda com |
|---|---|---|
| `LIVER` | banda no marcador **8h**, subdiv. 30-31 | ✅ Jensen grande ("just preceding 8 o'clock in the right iris") |
| `THYROID` | subdiv. 10-11 → **~2,8h** | ✅ Jensen grande ("2 and 3 o'clock in the right iris") |
| `KIDNEY` | marcador **6h**, subdiv. 22-24 | ✅ Jensen (ambos) + glossário |
| estrutura radial | pupila → ANTERIOR/POSTERIOR STOMACH → colarete recortado (MESENTERY / SMALL INTESTINES / ASCENDING·TRANSVERSE COLON / PYLORUS / CAECUM) → bandas de órgãos (LIVER, GALL BLAD., PANCREAS, KIDNEY, LUNG…) → **SKIN + LYMPHATIC & CIRCULATORY na borda** | ✅ confirma erro §2 (cólon é interno, não periférico) — **3ª fonte** |

**Saldo:** os erros §1 (fígado) e §4 (tireoide) sobem de "1 fonte" para **2 fontes independentes + coerência anatômica**. O erro §2 (intestino grosso) tem **3 fontes**.

---

## 🔑 O achado estrutural (maior que os erros pontuais)

Jensen localiza qualquer marca com **duas coordenadas**, não uma:

> *"The seven zones are: 1. Stomach area · 2. Intestinal area · 3. Adrenal glands, heart and aorta, solar plexus, kidneys, pancreas · 4. Bronchial tubes, pituitary gland, pineal gland · 5. Brain and reproductive organs · 6. Spleen, thyroid, liver · 7. Skin, lymphatic and circulatory systems, sweat glands, motor and sensory nerves"*
>
> *"The zone arrangement, **superimposed upon** the twelve radial 'clock' divisions, each with its ten subdivisions, provides an excellent means for locating any iris marking with precision."*

**O glossário codifica só a hora.** Dos 38 campos, apenas 2 mencionam zona radial (e um deles com o número errado). Consequência direta e demonstrada: o pigmento âmbar **pericentral** (zona 1-2) da íris do founder foi rotulado `figado_vesicula` — a zona 6 do Jensen. Mesmo se a hora batesse, a profundidade não bateria; mas o modelo não tinha a profundidade para checar.

E a seção **"Convenção de coordenadas horárias (CRÍTICO)"** do `stage1-scan.md` (linhas 113-160) ensina exclusivamente hora. Não há uma linha sobre como determinar o anel radial.

Isso explica um resultado que nenhum modelo resolveu: `intestino_delgado` apareceu em 0/3, 0/3, 1/3 e 0/3 amostras (Sonnet 4.6, Sonnet 5, Opus 5, GPT 5.6) — e `estomago` só aparece com crop bom. **Os dois campos do gabarito do founder são definidos por anel radial**, e o prompt só ensina hora.

---

---

## As fontes concordam entre si? (verificado 2026-07-26)

**Não é possível verificar a partir do texto: a topografia mora nos MAPAS (imagens), não no texto corrido.** 11 dos 16 PDFs têm camada de texto; busquei `hígado|fígado|fegato|liver` próximo de hora/setor/zona em todos. Resultado:

- **Só o Jensen descreve posições em frases.** Nos outros, o órgão aparece em prosa mas a coordenada não — ela está na figura. O manual espanhol cita *"los sectores abdominales, hígado, genitales, riñón, recto"* sem dar as horas.
- **O `Manual Para La Práctica de La Iridología` declara no sumário que usa "Mapa según el doctor Bernard Jensen".** Logo não contradiz Jensen — é derivado dele. "Concordância" aqui é parcialmente trivial.
- **Confirmação independente do sistema de 2 coordenadas:** o sumário do mesmo manual tem **"Topografía radial"** E **"Topografía anular (círculos concéntricos)"** como seções separadas, com as zonas nomeadas (`Zona pupilar`, `Zona de la corona nerviosa`, `Zona ciliar`, `Zona gástrica`). Reforça o achado estrutural acima por uma 2ª fonte.
- **As escolas DIVERGEM estruturalmente**, então esperar concordância universal é errado: Lo Rito/Birello usam mapa **embriológico** (cabeça do embrião a 12h, corpo desenvolvendo em sentido **anti-horário**) — topografia diferente, não variação da mesma. A escola alemã é primariamente constitucional.

**Para resolver de verdade:** OCR das legendas dos mapas, ou leitura humana das figuras. É tarefa delimitada (5 PDFs sem texto + as figuras dos 11 com texto), não pesquisa aberta.

---

## Faltam campos? (verificado 2026-07-26)

Contagem de menções de sinais nomeados, somando as 11 fontes com texto:

| sinal | menções | está nos 42? |
|---|---|---|
| lacuna | 232 | ✅ `lacuna_estrutural` |
| cripta | 133 | ✅ `cripta` |
| pigmento (genérico) | 103 | ✅ `pigmento_amber` |
| psórica | 46 | ✅ `manchas_psoricas` |
| arco senil / arcus | 45 | ⚠️ dentro de `sistema_circulatorio`, sem campo próprio |
| anel nervoso | 29 | ✅ `anel_nervoso` |
| radii solares | 26 | ✅ `radii_solaris` |
| **transversal** | **24** | ❌ **NÃO EXISTE** |
| anel sódico | 21 | ✅ `anel_sodico` |
| tofos (linfáticos) | 12 | ✅ `rosario_linfatico` |
| favo/colmeia (panal) | 12 | ⚠️ subtipo de lacuna, sem representação |
| heterocromia | 9 | ⚠️ extraída no bbox, não é campo do Stage 1 |
| Schnabel | 9 | — é nome de AUTOR (Rudolf Schnabel), não sinal |

### 1 candidato real a campo novo: `transversal`

O `Manual Para La Práctica de La Iridología` tem seção dedicada (*"Señales transversales"*, p.137) e trata como sinal de peso: *"recorrido transversal y zigzagueante, interpretado como un signo de peor pronóstico"*, *"señal transversal de adhesión entre las 6 y las 7 horas, que presenta una ramificación"*.

⚠️ **GUARDRAIL:** a interpretação clássica da transversal é **oncológica** (*"para que una transversal tenga un valor pronóstico de tendencia cancerí[gena]..."*). Isso colide de frente com o enfoque não-médico do produto. Se entrar, entra como **observação visual** (vaso que cruza as fibras) sem qualquer leitura prognóstica — e o Stage 2 precisa de regra explícita proibindo o salto.

### 1 atributo faltando, não campo novo: subtipos de lacuna

*"También se denominan lagunas de colmenas, de panal o de abeja"* — os subtipos (favo/colmeia, folha, torpedo) carregam significados distintos na literatura. Hoje `lacuna_estrutural` só diz "formato folha/ova, abertura (open or closed)". Melhor como **enum de subtipo** no campo existente do que como campo novo.

### 2 candidatos a CONSOLIDAÇÃO (talvez sobrem campos, não faltem)

- **`eixo_pituitario_adrenal`** — construto do projeto, não do Jensen: funde pituitária (zona 4) com adrenal (zona 3), em zonas radiais diferentes. Não achei correspondência bibliográfica.
- **`coroa_simpatica` vs `anel_interno`** — os dois descrevem o *autonomic nerve wreath* / colarete. Possível duplicação: o modelo pode emitir os dois para o mesmo sinal.

---

## Próximos passos propostos

1. **Confirmar a convenção de lado com o founder** — "right iris" do Jensen = OD? Decide os vereditos de lateralidade (§1, §4).
2. **OCR dos 15 livros digitalizados** para cruzar `tireoide` e resolver os 5 campos não localizados. Prioridade: `Manual de Iridologia`, `Iridologia Aplicada à Prática`, `dictionary-of-iridology`.
3. **Adicionar `zona` (1-7) ao `GLOSSARY[]`** — hoje inexistente para 36 dos 38 campos. É a correção de maior alcance.
4. **Corrigir os 4 erros confirmados** em `stage1-glossary.ts` + `pnpm generate:schema-artifacts`.
5. **Só depois** ensinar o Stage 1 a reportar zona + hora.

⚠️ Itens 3 e 4 mudam o prompt do Stage 1 → mudam os achados → mudam o relatório. Mesma classe de blast radius do crop (`6d3a806`): exige UAT antes de rollout.
