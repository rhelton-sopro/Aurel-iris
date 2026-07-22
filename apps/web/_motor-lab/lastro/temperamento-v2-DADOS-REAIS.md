# Temperamento v2 — TESTE EM DADOS REAIS (self / daniel / miguel)

**Data:** 2026-07-22. **Pergunta:** dá pra derivar um temperamento (4 elementos Bardon: 🔥Fogo · 💨Ar · 💧Água · 🌍Terra) **equilibrado e discriminante** do que o Stage 1 JÁ produz hoje, SEM tocar no Stage 1?

**Método:** apliquei a receita v1 (`temperamento-por-estrutura.md` §2) aos 3 outputs reais do Stage 1 (`_exame-self.json`, `_exame-daniel.json`, `_exame-miguel.json`), lendo TODOS os canais que carregam sinal (não só os 3 enums cegos): `cor_predominante` + constituição descrita, `outros_sinais_globais`, os `achados_de_atencao` de campo estrutural (pigmento âmbar, radii, anel nervoso, lacuna, manchas psóricas) com intensidade/lateralidade, `anel_interno`/collarette, e `sistemas_preservados`.

> ⚠️ Honestidade herdada: sistema simbólico/tipológico, não empírico. Nada disto vai ao cliente como rótulo. Lastro de laboratório — Stage 1 e produção **intocados**.

---

## VEREDITO EM UMA LINHA

**❌ NÃO (na prática) / PARCIAL na teoria.** A receita **RODA** nos 3 outputs, mas produz **a mesma distribuição para as 3 pessoas** (Ar≈Fogo co-dominantes ~30–40% · Terra ~24–28% · Água no piso ~6–10%). Ela **reproduz a cegueira da AUDITORIA um nível acima**: os campos que discriminariam ou são invariantes (enums sempre `media`/`centrada`/`regular`), ou são **ubíquos** nos 3 (âmbar + radii + verde/mista), então não separam ninguém. E a **Água não consegue emergir** — sua âncora (trama aberta / lacuna) está ausente. Precisa de extensão mínima no Stage 1 (ver §5).

---

## 1. Sinais extraídos por exame (o que cada canal carrega)

| canal | SELF (Rhelton, ~45) | DANIEL (~49) | MIGUEL (~55, metabolizador) |
|---|---|---|---|
| `cor_predominante` / constituição | verde_acinzentado — biliar/mista | **misto** — "biliar dominante OE, linfática-mista OD" | verde_acinzentado — "mista verde-âmbar" (biliar) |
| pigmento âmbar (const. + carga) | âmbar-dourado pericentral bilat. + carga hepatobiliar 5-7h (int 4) | âmbar hepatobiliar 5-7h (int 4) + pancreático (int 3) | âmbar-dourado pericentral **de base constitucional** + carga 5-7h (int 4) |
| `radii_solaris` | presente bilateral (int **4**) | **DOMINANTE** bilateral (int **5**) | finos bilaterais (int **3**) |
| anel nervoso (`sistema_nervoso_autonomico`) | **presente** (int 3) | **presente** (int 3) | **AUSENTE** (campo não emitido) |
| `lacuna_estrutural` (âncora de Água/Flor) | ausente | **presente** (int 3) | ausente |
| `manchas_psoricas` | ausente | ausente | **DOMINANTE** (int 5) — não mapeado a elemento |
| `trama_fibras` (eixo Terra↔Água) | **media** | **media** | **media** ("nem compacta nem aberta") |
| `pupila` / `bordas_pupilares` | centrada / regulares | centrada / regulares | centrada / regulares |
| `coroa_simpatica` (âncora primária de 🔥Fogo) | **não reportada** | **não reportada** | **não reportada** |
| `anel_sodico` (Terra-vício) | não mencionado | não mencionado | **explicitamente ausente** |
| collarette / `anel_interno` — distância intro/extro | "denticulado irregular" — **distância não informada** | "ondulação" — distância não informada | "ondulação setorial" — distância não informada |

**Já se vê o problema:** os 3 compartilham a MESMA assinatura estrutural (âmbar + radii + verde/mista + trama media + pupila centrada). O que varia (anel nervoso, lacuna, manchas psóricas, intensidade do radii) é fraco, mora nos `achados`/carga, e não move a distribuição de forma decisiva.

---

## 2. As 3 derivações lado a lado (receita v1 §2, pesos flat + piso 6%)

**Racional — que sinal puxou que elemento:**
- 💨 **Ar** ← pigmento âmbar (Jóia/mente analítica, +3) + anel nervoso (mente agitada, +1)
- 🔥 **Fogo** ← cor biliar/mista (Colérico, elo estável, +2) + radii solaris (centro motor, +1)
- 🌍 **Terra** ← radii (motor passivo, +1) + pupila centrada (+1) + bordas regulares (+0.5)
- 💧 **Água** ← lacuna estrutural / trama aberta (Flor/sensível). **Só o Daniel tem (+1). Self e Miguel = zero → piso.**

| pontos brutos | SELF | DANIEL | MIGUEL |
|---|---|---|---|
| Ar | 3 +1 = **4.0** | 3 +1 = **4.0** | 3 +0 = **3.0** |
| Fogo | 2 +1 = **3.0** | 2 +1 = **3.0** | 2 +1 = **3.0** |
| Terra | 1+1+0.5 = **2.5** | 1+1+0.5 = **2.5** | 1+1+0.5 = **2.5** |
| Água | **0** | 1 = **1.0** | **0** |

**Distribuição normalizada (piso 6% p/ Água quando zero):**

| Elemento | **SELF** | **DANIEL** | **MIGUEL** |
|---|---|---|---|
| 💨 Ar | **40%** | **38%** | **33%** |
| 🔥 Fogo | **30%** | **28%** | **33%** |
| 🌍 Terra | **24%** | **24%** | **28%** |
| 💧 Água | **6%** (piso) | **10%** | **6%** (piso) |

(Testei também **ponderando por intensidade** do radii/pigmento — 5 vs 4 vs 3. Muda magnitudes em ±3-4 pts, NÃO muda o formato: Ar/Fogo co-dominantes, Terra terceiro, Água no piso, nos três. O problema é estrutural, não de calibração de peso.)

---

## 3. TESTE DE DISCRIMINAÇÃO — ❌ FALHA

**Os 3 saem quase IDÊNTICOS.** Spread máximo em qualquer elemento ≈ 7 pontos. O ranking é o mesmo perfil para todos: **Ar/Fogo co-dominantes → Terra → Água no piso.**

- **Self (founder):** esperado = cerebral + "gasolina/ferve rápido" = Ar+Fogo alto. Sai Ar 40 / Fogo 30 ✅ — mas **isso não prova nada**, porque Daniel e Miguel saem igual. O perfil "cerebral e esquentado" virou o **default de qualquer íris com âmbar + radii + verde** — ou seja, um resultado com **cara de Forer** no nível do temperamento ("todo mundo é mental e fogoso").
- **Miguel, 55, "metabolizador":** deveria plausivelmente pender a Terra/Água (acúmulo, fleuma metabólica, manchas psóricas dominantes). Sai Ar 33 / Fogo 33 — **igual aos outros**. As manchas psóricas (seu achado #1, int 5) **não têm mapeamento a elemento** na receita, então o traço mais forte dele é invisível ao temperamento.
- **Daniel:** único com um respingo a mais de Água (10% via lacuna) e o radii mais denso (int 5) — mas some no ruído.

**Causa-raiz (confirma a AUDITORIA):**
1. Os 3 enums estruturais são **invariantes** (`media`/`centrada`/`regular` em 3/3) → não entram na conta como discriminantes; só somam Terra fixo pra todo mundo.
2. Os canais que DE FATO variam e teriam sinal bom (pigmento âmbar, radii, cor) são **ubíquos** nestes 3 — todos têm âmbar hepatobiliar + radii + verde/mista. Logo **também não discriminam**.
3. O pigmento âmbar é lido como **Jóia→Ar ALTO**, mas nos 3 JSONs ele é descrito como **carga hepatobiliar em 5-7h** (campo `figado_vesicula`, `cronica_sustentada`), **não** como gema constitucional espalhada. Mapear carga-de-fígado → traço-de-personalidade é **erro de categoria** — e infla Ar para todos igualmente.

---

## 4. TESTE DE EQUILÍBRIO — ❌ FALHA (Água impossível; Fogo e Terra "presos")

| Elemento | Emerge por conta própria nos dados reais? |
|---|---|
| 💨 **Ar** | Inflado e semi-artificial. Âncora primária (pigmento âmbar) é ubíqua **e** é carga, não constituição. Único diferenciador real = anel nervoso (que Miguel não tem). |
| 🔥 **Fogo** | **Preso na cor.** Sua âncora primária de verdade — `coroa_simpatica` espessada — **nunca é capturada** (0/3). Fogo vive só de "cor biliar/mista", que é ~constante nos 3 → Fogo não discrimina, só existe porque a cor é verde/mista. |
| 🌍 **Terra** | **Constante e não-discriminante.** Vem de pupila centrada + bordas regulares + radii — todos quase universais → Terra é um ~24-28% fixo pra qualquer um. |
| 💧 **Água** | **NÃO EMERGE.** Suas âncoras (trama `aberta`/`irregular`, `lacuna_estrutural`) estão ausentes. Como `trama_fibras` é **sempre `media`** (neutro, não puxa Água nem Terra), o eixo Terra↔Água **colapsa** e a Água fica presa no piso 6% em 2 de 3. |

**Conclusão de equilíbrio:** a promessa da v1 ("cada elemento ganha âncora primária própria") **não se realiza no dado real**. Duas das quatro âncoras primárias estão mortas na prática: a de **Água** (trama nunca compromete com `aberta`) e a de **Fogo** (`coroa_simpatica` nunca é emitida). Sobram Ar (via pigmento ubíquo) e Terra (via enums invariantes) — que é justamente por que todos saem Ar/Terra-ish com Fogo pendurado na cor.

---

## 5. VEREDITO + MENOR EXTENSÃO NECESSÁRIA no Stage 1

**Não dá para derivar temperamento discriminante e equilibrado só com o Stage 1 atual.** A receita v2 (derivação pura do output) está teoricamente correta e é codificável, mas o **substrato de entrada é cego**: enums invariantes + sinais bons porém ubíquos + duas âncoras primárias (Água, Fogo) que o Stage 1 não emite.

### Não adianta só "camada de derivação" (opção B da auditoria)
Parsear `outros_sinais_globais` não resolve, porque o texto livre dos 3 diz a MESMA coisa (âmbar pericentral + radii + collarette irregular). O sinal que falta **não está escondido no texto — ele não foi capturado.**

### Menor extensão que resolve (em ordem de custo/impacto)

**TIER 1 — 1 campo novo: `tipo_estrutural` enum `{joia, flor, corrente, agitador, indeterminado}`** (Rayid, lido do GESTALT da íris, não de métrica fina).
- É o **coração do de-para** (§1.1 / §3 da receita): dá a Ar (joia), Água (flor) e Fogo/Terra (corrente) uma **âncora primária decisiva e mutuamente exclusiva**, em vez de todos herdarem "âmbar→Ar".
- Ler o **padrão dominante da íris inteira** é mais robusto em foto comum do que comprometer os enums finos (`trama`/`bordas`), que a auditoria alerta serem ruído. Um único campo, uma decisão de tipo.
- **Sozinho, já quebra o empate** entre os 3: um "flor" sairia Água-heavy, um "joia" Ar-heavy, um "corrente" motor (Fogo/Terra) — coisa que hoje é impossível.

**TIER 2 — +1 campo: `orientacao_colarete` enum `{apertado, medio, afastado}`** (distância do collarette à pupila = eixo intro↔extro / ativo↔passivo).
- É o **desempatador que a receita §1.5 exige** e que hoje **falta 100%** (os 3 dizem "irregular/ondulado" mas nunca a distância). Sem ele, o centro Instinto não se divide em Fogo vs Terra e a Água não consegue subir pelo lado passivo.
- Com Tier 1 + Tier 2 os **4 elementos** ganham caminho de emergência **e** discriminação.

**TIER 3 (opcional, provável calibração não campo-novo):** fazer o Stage 1 **emitir `coroa_simpatica`** quando presente (hoje 0/3) — é a âncora primária real do 🔥Fogo. Enquanto ela não vier, Fogo fica pendurado só na cor.

### Recomendação
A **menor extensão que torna a v2 viável = 1 campo** (`tipo_estrutural`). Para **equilíbrio pleno dos 4 + o split Fogo/Terra**, **2 campos** (`+ orientacao_colarete`). Ambos são **captura nova, gestalt, não-métrica** — não "refazem" nada do scan existente e não tocam os enums problemáticos; adicionam a leitura tipológica que a receita pressupõe e que hoje simplesmente não é feita.

> ⚠️ Adicionar campo ao Stage 1 = mexer no canônico → **ASK ao founder** antes (regra de calibração do Sonnet). Este doc só define O QUE precisaria, não altera nada.

---

## Anexo — por que não escalar por intensidade "salva"
Rodando com peso ∝ intensidade (radii 5/4/3; pigmento; manchas): Daniel sobe um pouco em Fogo/motor (radii 5), Miguel ganharia Água/melancólico SE mapeássemos manchas psóricas (hoje não mapeadas). Mesmo assim os 3 permanecem **Ar/Fogo-dominantes com Água suprimida**, porque a fonte do desequilíbrio (trama sempre `media`, coroa nunca emitida, âmbar ubíquo) não muda com peso. Calibrar peso ≠ criar sinal.

---

## ⭐⭐ ACHADO (2026-07-22): ABORDAGEM TOPOGRÁFICA DISCRIMINA (ideia do founder)
Em vez de emoção→elemento (que não discriminou), somar os achados por CENTRO/ZONA (peso=intensidade) DISCRIMINA nos 3 exames reais:

| | Mente | Coração | Instinto |
|---|---|---|---|
| self | 41% | 0% | 59% |
| daniel | 35% | 13% | 52% |
| miguel | 16% | 11% | 74% |

Diferentes de verdade (self=mental+visceral, coração=0/preservado; miguel=visceral 74%; daniel=equilibrado). Usa a ZONA que o Stage 1 JÁ captura → **ZERO mudança no Stage 1**.

**Por que funciona:** a distribuição ESPACIAL (onde a carga mora) difere por pessoa, mesmo quando os TIPOS de achado são parecidos. É a leitura TOPOGRÁFICA/vetorial (Método Vetorial: superior=Mente, temporal=Coração, inferior=Instinto).

**Ponto do founder (preservação):** zona quieta ≠ ausência do elemento. Coração 0% do self = coração PRESERVADO (recurso), não "sem coração". → o motor deve pontuar preservação + tensão, não só tensão.

**RECEITA v3 (a construir):** (1) somar achados por centro (peso=intensidade) + somar preservados por centro → distribuição Mente/Coração/Instinto; (2) Centro→elemento: Mente→Ar · Coração→Água · Instinto→Fogo(fígado/radii/coroa)+Terra(intestino/apego/músculo); (3) o eixo ativo/passivo (colarete) e o pigmento afinam. UNIFICA com o bloco 2 (3 centros). Validar center→elemento nos 3 exames.

---

## ⭐⭐⭐ PRINCÍPIO GOVERNANTE (founder 2026-07-22): EQUILIBRAR O INSTRUMENTO, NÃO O RESULTADO
Há DOIS "equilíbrios" e são erros opostos:
- ✅ **Instrumento equilibrado (certo):** o olhar do Stage 1 + o mapa devem conseguir DETECTAR cada elemento igualmente bem. Se a pessoa É Ar, o sistema tem que conseguir dar Ar.
- ❌ **Resultado equilibrado (tendencioso):** forçar todo output pra 25/25/25/25 — impõe a suposição (falsa?) de que a população é igual. PROIBIDO.
→ A "normalização por cobertura" que eu propus escorregava pro ❌ (forçava output). DESCARTADA nesse formato. Consertar o INSTRUMENTO; o resultado da pessoa é o que for.

**Miguel Ar=6 = cegueira do instrumento, não verdade:** só capturamos mente como CARGA (ruminação); mente clara/organizada (Ar-recurso) é invisível → Ar zera falsamente. Injustiça REAL do instrumento. Consertar de verdade ⇒ capturar o sinal mental/Jóia que o Stage 1 não emite bem (volta ao gap do tipo_estrutural).

## v3 com split do radii (instrumento, legítimo — 'gasolina que pensa' = Fogo+Ar)
radii_solaris = Fogo .5 / Ar .5. Resultado (cargas+preservação):
| | Fogo | Ar | Água | Terra | domina |
|---|---|---|---|---|---|
| self | 30 | 21 | 28 | 21 | Colérico |
| daniel | 29 | 19 | 32 | 20 | Água |
| miguel | 23 | 6 | 22 | 49 | Fleumático |
Discrimina (self=Colérico "ferve rápido" ✓; miguel=Fleumático/visceral ✓). Fogo desinflou (self 53→30), Ar do self subiu (13→21). Ar do Miguel segue baixo = o gap acima.

## PENDENTE — pesquisa `distribuicao-temperamentos-populacao.md` (termômetro)
Founder: os 4 são ~iguais na população? viés regional/Brasil (via constituição miscigenada)? Usar SÓ como sanity-check (se der 95% colérico = instrumento quebrado), nunca pra forçar.

---

## 🎯 VALIDAÇÃO DE CAMPO (founder conhece Miguel, 2026-07-22): INSTRUMENTO ERROU
Founder: "Miguel é extremamente RACIONAL, pouco intuitivo." → deveria ser 💨 Ar ALTO (tipo Jóia = mente analítica). Instrumento deu **Ar 6, Terra 49** (Fleumático). **ERRO claro num caso real.**
**Prova decisiva:** a abordagem por CARGA, sozinha, é cega ao elemento quando ele é FORÇA/qualidade. Mente racional do Miguel = força (sem carga de ruminação) → instrumento lê "sem Ar". O pigmento/âmbar dele é igual aos outros 2 → dado atual NÃO separa o racional.
**⇒ NECESSÁRIO (não mais opcional): capturar o sinal ESTRUTURAL (tipo Jóia/Flor/Corrente, gestalt) que o Stage 1 não emite.** Sem ele, erramos gente real. Isto reabre a decisão da MENOR EXTENSÃO do Stage 1 (campo `tipo_estrutural`) — agora com evidência de campo a favor.
