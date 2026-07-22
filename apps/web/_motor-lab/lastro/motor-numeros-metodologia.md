# Motor de Números — metodologia (Stage 2 híbrido)

> Como o **código (JS)** transforma o output determinístico do Stage 1 em números (barras, %, agulhas, idade) que o LLM só narra. O número é **lastro interno** — na maioria dos blocos NÃO é impresso (evita falsa precisão / Forer).
>
> ⚠️ **Honestidade de rigor (regra do produto).** Nada aqui é estatística inferencial: não há população nem amostra rotulada. É um **modelo de pontuação composta (composite scoring / MCDA value function)** e, no temperamento, uma **composição ipsativa** (partes-de-um-todo, relativa à própria pessoa). O nome técnico correto de cada peça está marcado. Não fazer overclaim.

---

## ⭐ STACK RECOMENDADO (defaults)

| Escolha | Default | Por quê (1 linha) |
|---|---|---|
| **Normalização — temperamento (soma 100)** | **share / composição** (parte-do-todo) | é a única normalização que garante soma 100 e é intra-pessoa (não precisa de população). |
| **Normalização — 3 centros e eixos (0-100 independentes)** | **squash saturante a âncora fixa** (não min-max amostral) | sem população não existe "máximo da amostra"; ancoramos num teto teórico e saturamos. |
| **Peso da intensidade (ordinal 1-5 → peso)** | **quase-linear, `peso = intensidade^γ` com γ≈1.0–1.3** | o `1-5` já é uma compressão perceptual feita pelo Stage 1; empilhar outra curva forte (Stevens/log) comprime duas vezes. Ver Cálculo 1. |
| **Agregação dentro de um balde/centro** | **soma ponderada** (média aritmética compensatória) para carga; **considerar geométrica só se quiser penalizar desequilíbrio** | carga emocional é acumulativa (compensável); ver Cálculo 2/§Agregação. |
| **Arredondamento p/ inteiros que somam 100** | **método do maior resto / Hamilton (largest remainder)** | não-enviesado, some 100 exato, gera inteiros "quebrados" que variam por pessoa (mata o 40/30/20/10 Forer). NÃO d'Hondt/Sainte-Laguë (enviesam). |
| **Carga → rótulo (alta/média/baixa)** | **lookup ordinal em faixas ancoradas** + modificador de `natureza_da_carga` | rubrica desenhada, monótona; o rótulo é bucketizado, então a curva fina do peso quase não muda o resultado. |

**Fontes canônicas:** OECD/EU-JRC (2008) *Handbook on Constructing Composite Indicators* (normalização, ponderação, agregação, compensabilidade, análise de robustez); Becker, Paruolo, Saisana & Saltelli (2017) *Weights and importance in composite indicators: closing the gap*; Saisana, Saltelli & Tarantola (2005, JRSS-A) *Uncertainty and sensitivity analysis…*; Stevens (1957) lei de potência / Fechner (log); método do maior resto (Hamilton/Hare). URLs no fim.

---

## Cálculo 1 — CARGA EMOCIONAL (nível + comprimento de barra)

**Nome técnico:** função de valor ordinal (scoring rubric) com modificador contextual. NÃO é estatística.

**Método.** A intensidade `1-5` é ORDINAL. O mapa da SPEC (§Passo 2) já é uma **âncora de faixa** desenhada — mantê-la:

```js
// faixa central por intensidade (do SPEC), depois modula por natureza
const BANDA = { 5:[92,95], 4:[82,90], 3:[55,68], 2:[30,40], 1:[18,25] };
const NIVEL = { 5:'muito alta', 4:'alta', 3:'média', 2:'baixa', 1:'leve' };

function cargaBarra(intensidade, natureza) {
  let i = intensidade;
  if (natureza === 'em_reorganizacao_ativa') i = Math.max(1, i - 1); // desce 1 nível
  if (natureza === 'indeterminada') return null;                     // não gera emoção
  const [lo, hi] = BANDA[i];
  return { pct: Math.round((lo + hi) / 2), nivel: NIVEL[i] };        // ponto médio da faixa
}
```

**A pergunta central — 5 pesa mesmo ~5× o 1? Linear, convexo ou saturante?**
Resposta honesta e curta: **para a CARGA, quase não importa, porque o display é bucketizado** (alta/média/baixa). A curva só muda algo nas fronteiras de faixa. Recomendo **quase-linear**. Racional de fundo (importa mais no Cálculo 2):

- **Weber-Fechner** (percepção ∝ log do estímulo) e **Stevens** (percepção ∝ estímulo^n, com n variando por modalidade: brilho ~0.33 saturante, choque elétrico ~3.5 convexo) descrevem a compressão entre **estímulo físico** e **sensação**. Aqui não temos estímulo físico: o `1-5` **já é** um julgamento de magnitude que o Stage 1 (LLM) emitiu — ou seja, **já é a "sensação", já veio comprimido**. Aplicar Stevens/log por cima seria comprimir duas vezes.
- Por isso o default é `peso = intensidade^γ`, **γ≈1.0–1.3** (linear a levemente convexo). γ>1 faz o achado forte dominar um pouco; γ<1 achataria. Deixe γ como **uma constante única do motor** (tunável), não por-pessoa.

**Caveat.** Tratar ordinal como intervalo (5−4 = 4−3 = "1 unidade") é uma **suposição de modelagem**, não medição. É prática comum e defensável para Likert (Norman 2010 mostra que estatística paramétrica é robusta a isso), mas deve ser declarada. O ponto-médio da faixa é escolha de design, não estimativa.

---

## Cálculo 2 — TEMPERAMENTO % (4 elementos, soma 100)

**Nome técnico:** **composição / share ipsativo** (parte-do-todo relativa à pessoa) + **arredondamento pelo maior resto (Hamilton)**.

**Normalização = share.** É a escolha certa quando o total é fixo (100) e não há população. Fórmula:

```js
// 1) balde: cada achado cai num elemento (DE-PARA — decisão founder aberta)
// 2) peso = intensidade^γ  (γ do motor; γ=1 => linear)
function temperamento(achados, gamma = 1.15) {
  const soma = { Fogo:0, Agua:0, Ar:0, Terra:0 };
  for (const a of achados) {
    if (a.natureza === 'indeterminada') continue;
    let i = a.intensidade;
    if (a.natureza === 'em_reorganizacao_ativa') i = Math.max(1, i - 1);
    soma[baldeElemento(a.campo)] += Math.pow(i, gamma);
  }
  // (opção founder: somar contribuição de recursos ao Sanguíneo/Ar — ver nota)
  const total = Object.values(soma).reduce((x, y) => x + y, 0) || 1;
  const shares = Object.fromEntries(
    Object.entries(soma).map(([k, v]) => [k, (v / total) * 100])
  );
  return maiorResto(shares); // inteiros que somam 100
}
```

**Arredondamento — maior resto / Hamilton (largest remainder).** Arredondar cada share pra inteiro NÃO garante soma 100 (pode dar 99 ou 101). O método do maior resto resolve e é **não-enviesado**:

```js
function maiorResto(shares, alvo = 100) {
  const ent = Object.entries(shares);
  const piso = ent.map(([k, v]) => [k, Math.floor(v), v - Math.floor(v)]); // [chave, piso, resto]
  let faltam = alvo - piso.reduce((s, [, p]) => s + p, 0);
  piso.sort((a, b) => b[2] - a[2]); // maiores restos primeiro
  for (let i = 0; i < piso.length && faltam > 0; i++, faltam--) piso[i][1] += 1;
  return Object.fromEntries(piso.map(([k, p]) => [k, p]));
}
```

**Por que Hamilton e não d'Hondt/Sainte-Laguë:** d'Hondt (métodos divisores) **enviesa pró-maior**, Sainte-Laguë pró-menor. Para "mostrar % que somam 100 sem distorcer", o maior resto é o padrão neutro. (Ressalva conhecida: Hamilton sofre o "paradoxo de Alabama" se o *alvo* mudar — irrelevante aqui, alvo é sempre 100.)

**Isto entrega o que o founder pediu:** shares reais → inteiros como `42/37/16/5` (quebrados, únicos por pessoa), nunca `40/30/20/10` (redondo = dedo-duro de template/Forer) nem `42,7%` (falsa precisão).

**Nota — Sanguíneo (decisão founder aberta na SPEC §19):** se o coração PRESERVADO/vital contar como Ar/Sanguíneo, some sua contribuição-recurso ao balde ANTES do share. Metodologicamente é legítimo (muda a composição), só precisa ser **declarado no DE-PARA** e aplicado igual pra todos.

**Agregação — aritmética vs geométrica aqui:** dentro do balde use **soma/aritmética** (compensatória) — carga do mesmo elemento é aditiva, faz sentido acumular. Geométrica seria errada aqui (um balde com um único achado zeraria mal). Ver Cálculo /§ quando geométrica encaixa.

---

## Cálculo 3 — TRÊS CENTROS (Mente / Coração / Instinto), 0-100 INDEPENDENTES

**Nome técnico:** três **sub-índices independentes** com **normalização por saturação a âncora fixa** (não min-max amostral, não share).

**Chave:** os centros **não somam 100** ("pode ser mente E coração grandes juntos"). Cada um é seu próprio índice. Como não há população pra fazer min-max, use uma **função saturante** que leva a soma bruta de sinais daquele centro pra `[0,100]`:

```js
// soma ponderada dos SINAIS que alimentam cada centro (SPEC §85-92),
// depois satura a 0-100 com hipérbole (Michaelis-Menten / meia-saturação)
function centro(sinais, k = 8) {          // k = meia-saturação: score bruto que dá 50
  let S = 0;
  for (const s of sinais) S += Math.pow(s.intensidade, 1.15) * (s.pesoSabor ?? 1);
  return Math.round(100 * S / (S + k));   // 0..100, satura suavemente, nunca passa 100
}
// instinto: dois motores (raiva/luta + medo/fuga) — soma os dois com o "sabor" dominante
// mente: sinais mentais (anel nervoso, ruminação, pigmento)
// coração: sinais afetivos (coração, pulmões, aberturas)
```

**Por que saturante aqui (e não no temperamento):** aqui o score bruto **não tem teto natural** (pessoa pode ter muitos sinais de instinto). A hipérbole `S/(S+k)` dá um 0-100 estável, monótono, com retorno decrescente (2º achado de instinto soma menos que o 1º) — que é justamente o comportamento **Weber-Fechner/Stevens saturante** apropriado quando o que importa é "quão marcado", não "quantos". `k` calibra onde fica o "médio". A alternativa `100*(1-exp(-S/τ))` é equivalente em espírito.

**Origem na íris (founder exigiu):** cada centro guarda os `sinais[]` que o geraram (lastro interno; some no doc do cliente). O score É análise de dado real da íris, não achismo.

---

## Cálculo 4 — EIXOS DE TENSÃO (agulha 0-100 em eixo BIPOLAR)

**Nome técnico:** **índice de diferença normalizada / escala bipolar** (mesma família do diferencial semântico e de índices de "vantagem relativa"; 50 = equilíbrio).

**Método.** Cada eixo tem dois polos (ex. Interior⟷Exterior). Some o peso dos sinais de cada polo e tire a vantagem relativa:

```js
function eixo(pesoEsq, pesoDir) {           // ex. Interior vs Exterior
  const eps = 1e-6;
  const agulha = 50 + 50 * (pesoDir - pesoEsq) / (pesoDir + pesoEsq + eps);
  return Math.round(agulha);                // 0 = todo Esq, 100 = todo Dir, 50 = equilíbrio
}
```

Propriedades boas: **bounded [0,100]**, **simétrico**, **50 = balanço** (e 50 também quando não há sinal nenhum — bom default honesto). Para o eixo **Interior⟷Exterior** lastreado na distância colarete↔pupila, converta a distância normalizada `d∈[0,1]` direto em agulha (`agulha = round(100*d)`), sem os dois polos.

**Caveat.** Não repetir eixos que já vivem no mapa emocional (SPEC §100). A agulha é derivada, determinística, única por pessoa; "colarete-pupila" é lastro, não imprime.

---

## Cálculo 5 — LINHA DO TEMPO (distância colarete↔pupila → idade)

**Nome técnico:** **mapeamento geométrico / curva de calibração** (interpolação afim de coordenada radial normalizada → idade).

**Método.** Normalize o raio entre a borda da pupila (0) e o colarete (1) e mapeie linearmente pra faixa etária:

```js
function idadeDeRaio(r, rPupila, rColarete, idadeMin = 0, idadeMax = 42) {
  const t = (r - rPupila) / (rColarete - rPupila);      // 0..1 (posição radial normalizada)
  return Math.round(idadeMin + clamp01(t) * (idadeMax - idadeMin));
}
```

Use **afim (linear)** salvo se o lastro da tradição especificar uma escala não-linear (aí troca `t` por `f(t)`). É uma **régua**, não uma medição.

**⚠️ Caveat de honestidade forte.** O "anel do tempo" da iridologia **não tem validação biomédica**. Isto é um **dispositivo simbólico/terapêutico**, não cronologia factual. Manter no enquadre emocional/comportamental do produto (não-médico) e nunca vender como "idade exata do evento".

---

## Quanto os PESOS realmente importam (resposta ao founder, com evidência)

**Resposta direta: menos do que a intuição diz.** Na literatura de índices compostos, **o peso nominal que você atribui NÃO é igual à influência real** da variável no resultado; e **normalização + agregação + estrutura de correlação frequentemente pesam MAIS que os pesos**.

- **Becker, Paruolo, Saisana & Saltelli (2017), *Weights and importance: closing the gap*:** "o peso atribuído a uma variável não pode ser lido diretamente como medida de importância". A influência real é o **first-order sensitivity index Sᵢ (razão de correlação de Pearson)** — a redução esperada da variância do índice se aquela variável fosse fixada. Mostram variáveis com **peso nominal idêntico (0.2)** e importância real de **0.21 a 0.30** só por causa de correlação; e casos em que componentes podem ser **removidos** sem mudar quase nada o resultado.
- **Saisana, Saltelli & Tarantola (2005, JRSS-A)** e o **OECD/JRC Handbook (2008):** a escolha de **normalização e de agregação** costuma mexer os rankings tanto ou mais que os pesos → por isso robustez exige análise de incerteza/sensibilidade, não só "escolher pesos bons".

**No NOSSO motor, o que é decisivo (não os pesos finos):**
1. **O DE-PARA `achado→elemento/centro`** (a atribuição). Trocar o balde de `anel_interno` (Água↔Terra) muda o resultado MUITO mais que ajustar γ de 1.0 pra 1.3.
2. **A forma de normalização/agregação** (share vs saturação; aritmética vs geométrica).
3. **Se recursos contam** (Sanguíneo/coração preservado).
4. **A bucketização** (na carga, o rótulo alta/média/baixa engole variações finas de peso).

**Como TESTAR nos nossos dados (Monte Carlo nos pesos — codificável):**

```js
// perturbar γ e o vetor de pesos por-intensidade; medir com que frequência
// o rótulo dominante (elemento/centro) VIRA. Alta taxa de flip = frágil.
function sensibilidade(achados, N = 2000) {
  const base = elementoDominante(temperamento(achados, 1.15));
  let flips = 0;
  for (let n = 0; n < N; n++) {
    const g = 0.8 + Math.random() * 0.8;              // γ ~ U(0.8, 1.6)
    if (elementoDominante(temperamento(achados, g)) !== base) flips++;
  }
  return flips / N;                                   // taxa de inversão do dominante
}
```

Rodar isso nos exames reais (Helton/Daniel/Miguel/self) e reportar a **taxa de flip do dominante** e do **secundário**. Complementar com **OAT** (one-at-a-time: mudar um DE-PARA por vez) e, se quiser rigor, o **Sᵢ (razão de correlação)** de cada escolha sobre o output. Expectativa (baseada na literatura + na bucketização): **dominante estável, secundário e as % exatas sensíveis** → o valor honesto do relatório está na DIREÇÃO (dominante), não no número fino.

---

## Caveats de honestidade (colar no prompt / na ata)

- **Ordinal, não intervalo.** `intensidade 1-5` é ordinal; qualquer peso-intervalo é suposição de modelagem declarada, não medição.
- **Sem população → não é inferência.** É **composição intra-pessoa (ipsativa)** e **pontuação composta (MCDA)**, não estatística amostral. Nada de "p-valor", "média populacional", "percentil". Nome certo: *modelo de pontuação composta / composição relativa à própria pessoa*.
- **Número por baixo, não impresso** (exceto onde o founder decidir) — evita falsa precisão e Forer.
- **Anti-Forer por construção:** todo número nasce dos achados específicos daquela íris (via DE-PARA + intensidade + natureza); pessoas diferentes → números diferentes. O maior resto garante inteiros quebrados e únicos.
- **Iridologia = enquadre simbólico/emocional, não médico.** Centros e linha do tempo não têm validação biomédica; produto é leitura terapêutica, não diagnóstico.

---

## Fontes

- OECD/EU/EC-JRC (2008). *Handbook on Constructing Composite Indicators: Methodology and User Guide.* https://www.oecd.org/content/dam/oecd/en/publications/reports/2008/08/handbook-on-constructing-composite-indicators-methodology-and-user-guide_g1gh9301/9789264043466-en.pdf
- Becker, Paruolo, Saisana & Saltelli (2017). *Weights and importance in composite indicators: Closing the gap.* Ecological Indicators. https://pmc.ncbi.nlm.nih.gov/articles/PMC5473177/
- Saisana, Saltelli & Tarantola (2005). *Uncertainty and sensitivity analysis techniques as tools for the quality assessment of composite indicators.* J. R. Statist. Soc. A. https://rss.onlinelibrary.wiley.com/doi/abs/10.1111/j.1467-985X.2005.00350.x
- El Gibari, Gómez & Ruiz — *On the methodological framework of composite indices* (revisão de ponderação/agregação/robustez). https://pure.port.ac.uk/ws/files/8559735/On_the_methodological_framework_of_composite_indices.pdf
- Stevens's power law (lei de potência) e Weber-Fechner (log). https://en.wikipedia.org/wiki/Stevens%27s_power_law
- Agregação pela média geométrica / penalização de desequilíbrio (compensabilidade). https://www.mdpi.com/2079-3197/10/4/64
- Método do maior resto / Hamilton (apportionment). https://link.springer.com/chapter/10.1007/978-3-031-09016-5_4
- Norman (2010). *Likert scales, levels of measurement and the "laws" of statistics.* Adv. Health Sci. Educ. (robustez de paramétrica sobre ordinal).
