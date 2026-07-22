# Temperamento por ESTRUTURA da íris → contribuição dos 4 elementos (Bardon)

**O que é:** o de-para **ESTRUTURA/CONSTITUIÇÃO da íris → contribuição de ELEMENTO** (🔥Fogo/Colérico · 💨Ar/Sanguíneo · 💧Água/Melancólico · 🌍Terra/Fleumático). Substitui, para o cálculo de **temperamento**, a derivação anterior a partir das emoções/cargas — que era "carga/sombra-heavy" e saía desbalanceada (Água dominava, Ar sumia). A estrutura da íris é **equilibrada por natureza** (todo mundo tem uma), lê também o **lado positivo/recurso**, e é o que de fato dá temperamento/comportamento/visão-de-vida.

**Mudança de método (decisão do founder, 2026-07-22):** temperamento sai da **estrutura**, não da emoção. As emoções/cargas continuam alimentando a leitura terapêutica (tabela `tabela-achado-emocao-COMPLETA.md`), mas o **temperamento (4 elementos)** passa a ser lido dos campos ESTRUTURAIS/CONSTITUCIONAIS do Stage 1.

**Fontes (rastreio interno — NUNCA impressas ao cliente):**
- **Dias** — livros M.V. Dias / método Rayid–Denny Johnson (`iridologia-psicoemocional-extracao.md`; refs `A p…`/`B p…`).
- **Bardon** — *Initiation into Hermetics*, perfil de traços por elemento (`temperamentos-elementos-fontes.md` §3).
- **Rayid/Denny Johnson** — tipos estruturais Jóia/Flor/Corrente/Agitador (web, ver Fontes).
- **Constituição iridológica clássica** — linfática(azul)/hematogênica(marrom)/biliar-mista (web, ver Fontes).
- Campos e enums do Stage 1 conforme `apps/web/prompts/stage1-scan.md`.

> ⚠️ **Honestidade de base:** isto é sistema **simbólico/tipológico, não empírico**. Não existe "fato" sobre qual estrutura "é" qual elemento — cada tradição fez escolhas coerentes internamente, e elas às vezes divergem (ver §5). A decisão é de **design** (coerência interna + intuição do cliente de 8ª série), tornada explícita. Nada disto é citado ao cliente: sai só o retrato ("você tende a agir pela cabeça / pelo coração / pela ação / pelo chão"), nunca "elemento Ar / tipo Jóia / constituição linfática".

---

## 0. O nó Bardon × Grego — e como resolvemos (ler antes da tabela)

A constituição iridológica clássica JÁ associa constituição↔temperamento, MAS usando os rótulos **gregos**, que **trocam Água↔Terra** em relação ao Bardon (nosso sistema — ver `temperamentos-elementos-fontes.md` §1–3):

- Clássico/grego: **linfática(azul) = Fleumático** · **biliar(mista) = Colérico** · loose/lymphatic tissue = "água/fleuma".
- No grego, Fleumático = Água e Melancólico = Terra. **No Bardon é o inverso** (Fleumático = Terra, Melancólico = Água).

**Se importássemos o rótulo cru, quebraríamos toda a coerência do produto** (que é Bardon: medo=Água, firmeza=Terra). Então **NÃO importamos o rótulo** — mapeamos **estrutura → ELEMENTO por casamento de TRAÇO** com o perfil de elemento do Bardon (`temperamentos-elementos-fontes.md` §3). Regra:

1. Pega o **traço comportamental** que a estrutura sinaliza (ex.: fibra aberta = sensível/reativa; pigmento-gema = mente analítica).
2. Casa esse traço com o **perfil de virtudes/vícios do elemento no Bardon**.
3. O único elo de rótulo que importamos **cru** é **biliar/mista = Colérico = 🔥Fogo** — porque **Fogo/Colérico e Ar/Sanguíneo NUNCA se movem entre sistemas** (só Água↔Terra trocam). Fogo é o rótulo estável, seguro de importar.

Isso evita o pântano do label-swap e mantém 100% de coerência Bardon.

---

## 1. TABELA — feature estrutural (valor) → elemento(s) + peso + fonte + racional

**Peso:** `ALTO` (âncora primária do elemento) · `MÉDIO` (contribui) · `BAIXO` (modula/desempata) · `MOD` (modulador de eixo, não soma elemento direto).

### 1.1 — Estruturas Rayid (o coração do de-para) e o campo do Stage 1 que as revela

| Estrutura Rayid | campo Stage 1 que a revela | traço (Dias/Rayid) | → elemento | peso | racional (casamento Bardon) |
|---|---|---|---|---|---|
| **JÓIA** (pontos/gema) | **`pigmento_amber`** (depósito concentrado tipo gema) | mental, analítico, perfeccionista, cético, "pouca emoção", comunicação verbal precisa, dirige percepções pelo pensamento interno, busca liberdade/resente controle (Dias A p69; Rayid) | 💨 **Ar** | **ALTO** | Bardon Ar/Sanguíneo = **intelecto/mente**, clareza, diligência mental. "Cerebral/racionalista → mente analítica" casa direto. **Âncora primária do Ar.** ✅ confirma o exemplo do founder |
| **FLOR** (aberturas/pétalas) | **`trama_fibras`=aberta/irregular** + **`lacuna_estrutural`** (aberturas arredondadas tipo pétala) | emocional, centrado no coração, sensível, expressivo, respostas afetivas automáticas, "vivencia depressão/raiva/culpa", tende à exaustão (Dias A p70; Rayid) | 💧 **Água** | **ALTO** | Bardon Água/Melancólico = **sentimentos/emoções**, sensibilidade, compaixão, ternura — e no polo passivo timidez/apatia/retraimento. **Âncora primária da Água.** |
| **CORRENTE** (fibras/faixas retas radiais) | **`radii_solaris`** / estrias fibrilares retas saindo da pupila | social, sinestésico/cinestésico, vinculador, "muito sensível", estabiliza os outros mas se sobrecarrega; **centro MOTOR/instintivo** (Dias A p71; Rayid) | 🔥 **Fogo** + 🌍 **Terra** (centro Instinto — desdobra por polaridade, ver §1.4) | MÉDIO | O centro instintivo/motor = corpo/ação/vínculo. Divide-se em Fogo (ativo: impulso/vínculo dinâmico) e Terra (passivo: constância/corpo). O toque "social/conectar" adiciona leve Ar/extroversão. (ver bridge §3) |
| **AGITADOR** (mistura flor+jóia) | co-ocorrência `pigmento_amber` **e** `trama aberta`/`lacuna` | extremista, inovador, ciclos sucesso/fracasso, unifica os dois hemisférios (Dias A p72) | 💨 Ar **+** 💧 Água (mistura) | MÉDIO | mente(Ar)+coração(Água) juntos = perfil Ar/Água elevado, com tensão. Não cria elemento novo; soma os dois. |
| **Mente Ultra-Realizadora** (anéis de stress) | **`anel_nervoso`** presente | muito mental, "conversa mental repetitiva", hiper-realização, não muda fácil (Dias A p73) | 💨 **Ar** (agitado/tenso) | MÉDIO | reforça Ar (atividade mental), no polo tenso/vício (tagarelice/dispersão). |

### 1.2 — Constituição / cor (peso BAIXO — contestado; ver §5)

| campo / valor | constituição clássica | → elemento | peso | racional |
|---|---|---|---|---|
| **`cor_predominante`** = `verde_acinzentado` / `misto` | **biliar/mista** | 🔥 **Fogo** | **MÉDIO** | biliar = **Colérico** (clássico) = Fogo. **Único elo de rótulo importado cru** (Fogo é estável). Dá ao Fogo uma âncora de cor. |
| `cor_predominante` = `azul` / `azul_acinzentado` | **linfática** | 💧 Água (leve) + 🌍 Terra (leve) | BAIXO | tecido linfático = frouxo/fluido/sensível → Água; mas o rótulo clássico é Fleumático (=Terra no Bardon). **Contestado** → split leve, desempate. |
| `cor_predominante` = `castanho_claro` / `castanho_escuro` | **hematogênica** | 💨 Ar (leve) / 🔥 Fogo (leve) | BAIXO | marrom/hematogênica = "sangue/fígado", fibra densa; uma fonte associa a Sanguíneo/Ar (equilibrado); outra a fogo/sangue. **Fraco e ambíguo** → só desempata, não decide. |

### 1.3 — Trama das fibras (densidade) — eixo Terra ↔ Água

| campo / valor | traço | → elemento | peso | racional |
|---|---|---|---|---|
| **`trama_fibras`** = `compacta_densa` | resiliência constitucional, "aguenta muito antes de sinalizar", robustez/vitalidade de base (glossário Stage 1; `tabela-...COMPLETA.md`) | 🌍 **Terra** | **ALTO** | Bardon Terra/Fleumático = **resistência, firmeza, base, estabilidade, sobriedade, confiabilidade**. Fibra densa = corpo firme/enduring. **Âncora primária da Terra.** |
| `trama_fibras` = `aberta` / `irregular` | mais reativa/sensível, sinaliza cedo, perfil Flor | 💧 **Água** | **ALTO** | fibra frouxa = sensibilidade/porosidade = Flor = Água (ver §1.1). |
| `trama_fibras` = `media` | intermediário | (neutro) | — | não puxa nenhum elemento; deixa os outros campos decidirem. |

### 1.4 — Coroa simpática, anéis e pupila (ativação / eixo ativo-passivo)

| campo / valor | traço | → elemento | peso | racional |
|---|---|---|---|---|
| **`coroa_simpatica`** = espessada/irregular | coroa do **simpático** = mobilização/luta-fuga/impulso (glossário); "eu" dominante/combativo (Dias mapa vetorial) | 🔥 **Fogo** | **MÉDIO** | Bardon Fogo = **vontade, iniciativa, coragem, agressividade, ímpeto**. Ativação simpática = polo ativo/Yang = Fogo. Dá ao Fogo âncora estrutural além da cor. |
| `coroa_simpatica` = fina/regular/ordenada | mobilização bem regulada | 🌍 Terra (leve) | BAIXO | auto-regulação estável = base Terra. |
| **`anel_sodico`** presente | rigidez de atitudes, endurecer, fixação no passado, medo do futuro (Dias A p62) | 🌍 **Terra** (polo vício: teimosia/inércia) | MÉDIO | Terra no lado negativo = teimosia, embotamento, rigidez. Anel sódico = Terra endurecida. |
| **`anel_nervoso`** presente | tensão nervosa, hiper-realização, "mente que não desliga" (Dias A p68) | 💨 **Ar** (polo vício: dispersão/inquietação) | MÉDIO | Ar no lado negativo = inconstância, tagarelice, dispersão. (ver Mente Ultra-Realizadora §1.1) |
| **`pupila`** = `centrada_regular` | eixo neuroendócrino organizado, base estável | 🌍 Terra (leve) | BAIXO | centramento = chão/estabilidade = Terra (recurso). |
| `pupila` = `descentrada`/`deformada` | desregulação de base | (rebaixa Terra) | MOD | tira estabilidade; não adiciona elemento, reduz o "chão". |
| **`bordas_pupilares`** = `achatamentos` | "portal do eneatipo" (Dias A p91) — seleciona caráter/centro | MOD (viés de centro) | MOD | não é elemento fixo: **enviesa qual CENTRO** domina (Mente 5-6-7 / Coração 2-3-4 / Motor 8-9-1), o que por sua vez alimenta Ar / Água / Fogo-Terra (ver §3). |
| `bordas_pupilares` = `regulares` | base sem marca de compulsão | 🌍 Terra (leve) | BAIXO | base neutra/estável = leve Terra. |
| **`padrao_pupilar`** = midríase/miose | estado autonômico (alerta/exaustão) | MOD (intensidade) | MOD | **não some elemento** — modula a INTENSIDADE do retrato (íris em alerta amplifica; em exaustão aplaina). Coerente com a demoção do campo no Stage 1 (v2.7.0, I máx 3). |

### 1.5 — Colarete: eixo introversão ↔ extroversão (o eixo Ativo/Yang ↔ Passivo/Yin)

| campo / medida | traço | efeito no elemento | peso | racional |
|---|---|---|---|---|
| **`anel_interno`/collarette** — distância curta à pupila (colarete "apertado") | **introversão**, inner-directed (Dias A p53) | **+ Água, + Terra** (polo passivo/Yin/nasal) | MOD | introversão = mundo interno/contido = elementos passivos (sentir/assentar). |
| `anel_interno` — distância longa (colarete afastado) | **extroversão**, outer-directed (Dias A p53) | **+ Ar, + Fogo** (polo ativo/Yang/temporal) | MOD | extroversão = mundo externo/social/assertivo = elementos ativos (pensar-para-fora/agir). |

Este é o **eixo horizontal Ativo↔Passivo** do mapa vetorial (`extracao.md` §3): temporal/Yang/ativo ↔ nasal/Yin/passivo. É o que **desempata Fogo de Terra** dentro do centro instintivo, e **Ar de Água** no topo. Sem ele os pares colapsam.

---

## 2. RECEITA codificável — dos campos do Stage 1 → distribuição dos 4 elementos

Entrada: `constituicao_base` (cor, trama, pupila, bordas) + presença/ausência dos campos estruturais (`pigmento_amber`, `radii_solaris`, `anel_nervoso`, `anel_sodico`, `coroa_simpatica`, `lacuna_estrutural`) + medida do `anel_interno`.

**Modelo mental (2 eixos ortogonais, nativos do mapa vetorial):**
- **Eixo do CENTRO** (qual domínio): Mente(💨Ar) — Coração(💧Água) — Instinto(🔥Fogo/🌍Terra).
- **Eixo ATIVO↔PASSIVO** (Yang/Yin, extro/intro): Ativo amplifica 💨Ar + 🔥Fogo; Passivo amplifica 💧Água + 🌍Terra.

**Pseudo-cálculo (somar pontos, depois normalizar para 100%):**

```
ar    = 0; agua = 0; fogo = 0; terra = 0

# --- Âncoras primárias (Rayid via campos raw) ---
if pigmento_amber presente:              ar   += 3      # Jóia = mente analítica
if trama_fibras in [aberta, irregular]:  agua += 3      # Flor = sensível/reativo
if trama_fibras == compacta_densa:       terra+= 3      # constituição firme/enduring
if lacuna_estrutural presente:           agua += 1      # aberturas tipo pétala (Flor)
if radii_solaris presente:               (fogo+=1; terra+=1)  # Corrente = centro motor (desdobra)

# --- Cor / constituição (peso baixo; só biliar é forte) ---
if cor in [verde_acinzentado, misto]:    fogo += 2      # biliar = Colérico (elo estável)
if cor in [azul, azul_acinzentado]:      (agua+=1; terra+=1)   # linfática (contestado → split)
if cor in [castanho_claro, castanho_escuro]: ar += 1    # hematogênica (fraco)

# --- Ativação / anéis / pupila ---
if coroa_simpatica == espessada:         fogo += 2
if coroa_simpatica == fina_regular:      terra+= 1
if anel_sodico presente:                 terra+= 1      # rigidez (Terra-vício)
if anel_nervoso presente:                ar   += 1      # mente agitada (Ar-vício)
if pupila == centrada_regular:           terra+= 1
if bordas_pupilares == regulares:        terra+= 0.5

# --- Eixo Ativo/Passivo (colarete) — multiplicador suave ---
if colarete afastado (extroversão):      (ar*=1.2; fogo*=1.2)   # Yang
if colarete apertado (introversão):      (agua*=1.2; terra*=1.2) # Yin
# bordas_pupilares==achatamentos → +0.15 no elemento do CENTRO do eneatipo indicado

# --- Normalização ---
total = ar+agua+fogo+terra
distribuição = { Ar: ar/total, Água: agua/total, Fogo: fogo/total, Terra: terra/total }
# piso anti-zero: nenhum elemento vai a 0 no texto — sempre há um traço-semente
# (evita "você não tem nada de Fogo"); piso sugerido ~5-8%.
```

**Resumo em 1 frase:** *pigmento-gema → Ar; fibra aberta → Água; fibra densa → Terra; cor biliar + coroa simpática/impulso → Fogo; e o colarete (intro/extro) inclina o todo para o par passivo (Água/Terra) ou ativo (Ar/Fogo).*

Pesos e passos são **placeholders defensáveis, não calibrados empiricamente** — trigger de calibração = rodar em N reais e ver a distribuição (⚠️ calibração do Sonnet exige ASK ao founder; aqui é só a de-para).

---

## 3. Ponte com os 3 CENTROS (Mente / Coração / Instinto) que já calculamos

Os 3 centros já vêm do eneagrama/vetores (`extracao.md` §3; `...COMPLETA.md` guardrail 6). A ponte 3→4 é **honesta e sem forçar**: 3 centros mapeiam 3 elementos direto; o **4º elemento nasce de dividir o centro Instinto pela polaridade Ativo/Passivo**.

| Centro (já calculado) | Tipo Rayid | Campo Stage 1 âncora | → Elemento(s) |
|---|---|---|---|
| **Mente** (intelectual, 5-6-7) | **Jóia** | `pigmento_amber` | 💨 **Ar** |
| **Coração** (emocional, 2-3-4) | **Flor** | `trama` aberta / `lacuna` | 💧 **Água** |
| **Instinto/Motor** (8-9-1) | **Corrente** | `radii_solaris` / fibra densa | 🔥 **Fogo** (instinto ATIVO: vontade/impulso/dominância) **+** 🌍 **Terra** (instinto PASSIVO: corpo/constância/chão) |

→ **O centro Instinto é o único que "abre" em dois elementos.** O que decide se pende a Fogo ou Terra é o **eixo Ativo/Passivo** (colarete extro/intro + coroa simpática): instinto ativo/Yang/extrovertido = 🔥Fogo (dominante, dinâmico, agressivo — vetor instintivo-ativo, `extracao.md` B p62); instinto passivo/Yin/introvertido = 🌍Terra (submisso, tolerante, resignado, assentado — vetor instintivo-passivo).

Assim: **3 centros × (polaridade no centro instintivo) = 4 elementos.** O toque "social/conectar" da Corrente adiciona um respingo de Ar (extroversão), o que é coerente com a Corrente ser também vinculadora.

---

## 4. Checagem de EQUILÍBRIO — os 4 emergem? (vs. a abordagem por emoção)

**A abordagem por emoção era enviesada:** o de-para achado→emoção é "carga/sombra-heavy" — medo/tristeza/ansiedade/luto/raiva-contida todos drenavam para 💧Água/Melancólico, e 💨Ar/Sanguíneo só aparecia via o hack `⚡Ar` (recurso raspado). Resultado: **Água dominava, Ar quase sumia** (documentado em `...COMPLETA.md` tag `⚡Ar`).

**A abordagem por estrutura corrige na raiz**, porque cada elemento ganha **âncora estrutural PRIMÁRIA própria**, não dependente de carga:

| Elemento | Âncora primária (ALTO) | Emerge por conta própria? |
|---|---|---|
| 💨 **Ar** | `pigmento_amber` (Jóia/cerebral) | ✅ **SIM** — e é o maior ganho: Ar deixa de ser recurso-raspado e vira leitura positiva de mente analítica. |
| 💧 **Água** | `trama` aberta/`lacuna` (Flor) | ✅ SIM — mas agora é só "sensível/emotivo", não "todo negativo". Deixa de aspirar tudo. |
| 🌍 **Terra** | `trama compacta_densa` + pupila centrada | ✅ SIM — constituição firme é comum e lida positivamente. |
| 🔥 **Fogo** | cor biliar + `coroa_simpatica` espessada + impulso/dominância | ⚠️ **SIM, mas é o mais fino** — menos campos o ancoram (biliar não é a cor mais comum; coroa espessada é achado). |

**Veredito: o equilíbrio melhora MUITO vs. emoção.** O viés Água→domínio some, e o Ar/Sanguíneo passa a emergir naturalmente (era o buraco #1). Os 4 têm caminho de emergência.

**Riscos residuais honestos:**
- **Fogo é o mais frágil** (menos âncoras). Mitigação: dar peso pleno à `coroa_simpatica` espessada e ao eixo ativo/extroversão, e considerar a cor biliar como MÉDIO (não BAIXO). Monitorar em N real — se Fogo ficar <10% na maioria, adicionar âncoras (ex.: `radii_solaris`, `anel_nervoso` no polo colérico-irritável).
- **Terra pode SOBRAR** — fibra densa + pupila centrada são comuns; muita íris "saudável/organizada" viraria Terra-pesada. Mitigação: o eixo Ativo/Passivo tira densidade-ativa para Fogo; e a fibra `media` é neutra (não conta Terra). Monitorar.
- O **piso anti-zero** garante que nenhum cliente receba "0% de X" (anti-Forer reverso e anti-crueldade): sempre há um traço-semente de cada elemento.

---

## 5. Caveats

1. **Simbólico/tipológico, não empírico.** Nenhuma estrutura "é" um elemento no mundo físico; é correspondência tradicional. Registrado conscientemente (herda a honestidade de `temperamentos-elementos-fontes.md`).
2. **Bardon, não Grego — coerência total.** A constituição clássica associa linfática=Fleumático/biliar=Colérico com rótulos **gregos** (Água↔Terra trocadas vs. Bardon). **Não importamos o rótulo** — mapeamos por traço ao perfil Bardon (§0). Único elo de rótulo cru: biliar=Colérico=Fogo (estável). Se algum dia virarmos Grego, este de-para inteiro precisa reescrita.
3. **Cor é o elo mais fraco e contestado.** As fontes divergem (marrom = Sanguíneo/Ar numa; "sangue/fígado" noutra; azul = Fleumático mas tecido é aquoso). Por isso cor tem peso BAIXO (exceto biliar=Fogo, MÉDIO) e só **desempata** — a decisão é da **estrutura** (Jóia/Flor/densidade/ativação), não da cor.
4. **Fibra densa: Bardon vs. blog.** Uma fonte popular liga fibra densa (hematogênica) a Sanguíneo/Ar "equilibrado"; nós ligamos densidade a 🌍Terra (firmeza/resistência = casamento Bardon direto e o que o glossário do Stage 1 já diz: "resiliência constitucional"). Escolha consciente por coerência Bardon; divergência registrada.
5. **3→4 é ponte, não igualdade.** O 4º elemento vem de **dividir o centro Instinto** pela polaridade Ativo/Passivo — mecanismo explícito, não number-fudging. Se a polaridade (colarete intro/extro) não for legível numa íris, o instinto fica Fogo+Terra em partes iguais (neutro), não força.
6. **Pesos NÃO calibrados.** Os números da §2 são placeholders defensáveis. Calibração real = rodar em N e olhar a distribuição — e (regra do founder) **ASK antes de qualquer calibração do Sonnet**.
7. **Nada citado ao cliente.** Sai só o retrato comportamental ("você tende a processar pela cabeça / pelo coração / pela ação / pelo chão", com o lado dom e o lado lição). Nunca "elemento Ar / tipo Jóia / constituição linfática / Bardon / Rayid".
8. **Produção e Stage 1 intocados.** Este é lastro de laboratório. Nenhuma mudança em prompt de produção.

---

## Fontes (web — rastreio interno)
- Iridology constitutions (linfática/hematogênica/biliar + traços): https://iriscope.org/how-many-iridology-constitutional-types.htm · https://www.lightembody.com/iridology-constitutions.html
- Iris types × temperamentos/elementos (Sanguine/Air, etc.): http://expressingyourtruth.blogspot.com/2011/11/eyes-sanguine-air-sanguine-iris-type-is.html
- Rayid / Denny Johnson (Jóia/Flor/Corrente/Agitador, mental/emocional, intro/extroversão, right/left brain): https://rayid.com/iris-patternsstructures-previous/ · https://www.herbalclinic-swansea.co.uk/iridology/rayid-model-of-iris-examination/ · https://som.org/5A&S/iris.htm
- (Bardon element-trait e o nó Grego×Bardon: `temperamentos-elementos-fontes.md`, já com fontes.)
