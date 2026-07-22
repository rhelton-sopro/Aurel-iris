# Score Emocional — especificação de cálculo (vira o prompt do Stage 2)

Como transformar o output do **Stage 1** (achados) no relatório novo (doc do cliente). Determinístico, não-aleatório, único por pessoa. Display qualitativo (alta/média/baixa/livre) — o número existe por baixo, mas NÃO é impresso (evita falsa precisão / Forer).

> **📐 ORDEM DOS BLOCOS (6, final — 2026-07-22):** 1 Em poucas palavras · **2 Como você funciona por dentro** (Mente·Coração·Corpo, topográfico) · 3 Linha do tempo emocional · 4 Heranças transgeracionais · 5 Mapa emocional (pêndulos) · 6 Perguntas para a sua sessão. O antigo bloco de **temperamento (4 elementos Bardon)** foi **fundido** no bloco 2 e os elementos **arquivados** (ver seções abaixo). Este SPEC cobre o cálculo dos blocos 2 e 5 e o craft do bloco 6; os blocos 1/3/4 são de craft de prosa (mockups no `relatorio-novo/`).

## ⭐ REGRAS OBRIGATÓRIAS DO PROMPT (não podem ficar de fora — decisão founder)
1. **FORÇA das DUAS fontes, sempre:** `sistemas_preservados` **E** `constituicao_base` (pupila centrada = centramento · trama compacta = vitalidade · bordas regulares = estabilidade). NUNCA mostrar só os preservados — a força ficaria subrepresentada. Varrer as duas em toda leitura.
2. **Só os PRINCIPAIS** (top ~6 cargas + ~4-5 recursos), NUNCA os 60 pêndulos inteiros.
3. **Display qualitativo** (alta/média/baixa/livre/vital) — número por baixo, nunca impresso.
4. **ZERO iridologia** no texto do cliente; voz 2ª pessoa, 8ª série, envolvente.
5. **NÃO inventar força** além do que a íris mostra (preservado + constituição) = falso conforto/Forer-positivo proibido.

## ⛔ TEMPERAMENTO (4 ELEMENTOS BARDON) — ARQUIVADO, NÃO ENTRA
**DECISÃO FINAL 2026-07-22 (saga do temperamento encerrada).** Largamos os rótulos Colérico/Sanguíneo/Melancólico/Fleumático e o cálculo por % de elemento. Motivos provados no laboratório:
1. **Por CARGA emoção→elemento não discrimina** e ERRA gente real: os 3 exames reais saem quase idênticos (Ar/Fogo co-dominantes, Água no piso) e o Miguel — racional confirmado pelo founder = 💨Ar alto — deu Ar 6 / Terra 49 (Fleumático). Ver `temperamento-v2-DADOS-REAIS.md`.
2. **Por ESTRUTURA (Rayid Jóia/Flor/Corrente) não é confiável de capturar:** 5 rodadas Sonnet na mesma foto self = 4 respostas diferentes (Jóia2/Flor1/Corrente1/Mista1, nenhuma "alta"). Precisaria +1-2 campos novos no Stage 1 (`tipo_estrutural`, `orientacao_colarete`) + foto de alta qualidade — não temos.
3. **Viés Brasil:** fígado/raiva se repete → quase todo mundo vira Colérico (sem sentido discriminante).

O bloco de temperamento vira o retrato pelos **3 CENTROS topográficos** (abaixo). A viz dos 4 elementos foi guardada (não deletada) em `relatorio-novo/_ARQUIVO-relatorio-temperamento-4elementos.html`, caso volte no futuro com Stage 1 estendido.

## ⭐ BLOCO 2 — "Como você funciona por dentro" (Mente · Coração · Corpo) — TOPOGRÁFICO
Fusão dos antigos bloco 2 (retrato 10s / 3 centros) + bloco 3 (temperamento) — diziam a mesma coisa. Mockup aprovado (founder: "fechou, vamos pra cima") = `relatorio-novo/b2-retrato-completo.html`. Cliente lê **Mente / Coração / Corpo** (modo de pensar / sentir / agir); "Instinto" = nome INTERNO do centro corporal.

### Fonte do score = TOPOGRAFIA (zona da íris), não emoção→elemento
O que discrimina é ONDE a carga mora (distribuição espacial), não o TIPO de achado. Prova nos 3 reais: self M41/C0/I59 · daniel 35/13/52 · miguel 16/11/74 — três perfis nitidamente diferentes, usando a ZONA que o Stage 1 **JÁ captura** → ZERO mudança no Stage 1, sem Rayid, sem foto perfeita. Lastro: Método Vetorial (Dias) — superior=Mente · temporal/medial=Coração · inferior/visceral=Instinto — convergente com Eneagrama (3 centros de inteligência).

### Cada achado → CENTRO (mapa canônico)
Cada `campo` do Stage 1 carrega uma **componente de centro** — coluna "Componente de CENTRO" da `tabela-achado-emocao-COMPLETA.md` (artefato canônico, os 42 campos). Resumo do de-para:
- **MENTE** (mental/analítico, topo ~11-1h): `pineal_hipotalamica`, `sistema_nervoso_autonomico`/anel nervoso, `cerebrum`, e o *modo Mente* (ruminação/análise/controle/antecipação, que muitos campos carregam como componente secundária).
- **CORAÇÃO** (afeto/vínculo, medial/temporal): `coracao`, `pulmoes`/peito, `boca_garganta`/expressão, `linfatico` (empatia sem limite).
- **CORPO/INSTINTO** (visceral/sobrevivência, inferior ~4-8h): `figado_vesicula`, `radii_solaris`, `coroa_simpatica`, `estomago`, `intestino_grosso`, `rim`, `adrenal`/`eixo_pituitario_adrenal`, `sacro_coccyx`, `sistema_reprodutor`, `sistema_urinario`, `musculoesqueletico`.
Campos de dupla componente (ex. `estomago` = Mente-Instinto; `figado` = Coração-Instinto) **dividem o peso** entre os dois centros (0.5/0.5, ou a proporção que a tabela indicar). Campos estruturais (pupila, trama, bordas) NÃO entram aqui — são recurso/constituição (ver "livre").

### Cada centro tem DOIS lados: TENSÃO e LIVRE (a correção que acerta o Miguel)
⚠️ Zona quieta ≠ ausência do centro. Coração 0% de carga do self = coração **PRESERVADO** (recurso), não "sem coração". Mente clara do Miguel (racional, sem ruminação) = mente **LIVRE** (força visível), não "sem mente". Por isso o motor pontua **preservação + tensão**, não só tensão — senão a força vira invisível e erramos gente real.
- **TENSÃO do centro** = Σ (`intensidade` dos achados atribuídos ao centro), modulada por `natureza_da_carga` (mesma regra do Passo 2 abaixo).
- **LIVRE do centro** = sinal de recurso na zona: (a) `sistemas_preservados` cujo campo cai no centro (`vital_ativo` > `neutro`); (b) **ausência de carga** na zona (zona quieta = preservada); (c) `constituicao_base` que reforça o centro (pupila centrada → Mente/eixo organizado; trama compacta → Corpo/vitalidade).

### DISPLAY = agulha na barra tensão ⟷ livre (por centro)
Não é % que soma 100 (isso era o Bardon, arquivado). Cada centro = **uma agulha** numa barra bipolar: extremo esquerdo = TENSÃO cheia, extremo direito = LIVRE cheio. Posição da agulha = quanto o centro pende pra livre vs tensão:
`posicao_livre (0-100) = livre / (tensão + livre)` (mais tensão → agulha à esquerda/âmbar; mais livre/preservado → à direita/verde). Ex. mockup Helton: Mente 26% (tensão-heavy: rumina) · Coração 83% (livre: afeto intacto) · Corpo 21% (tensão-heavy: reage rápido). Os 3 centros são **independentes** (pode-se ser tenso ou livre em vários ao mesmo tempo).
**Cada nível DIZ algo** (o gráfico tem que comunicar): tensão-Mente="cabeça que não desliga, rumina/antecipa"; livre-Mente="pensa claro, sem ruminar"; tensão-Corpo="reage rápido, gatilho curto"; livre-Coração="afeto inteiro, se liga com facilidade". O texto muda com o SABOR do Corpo/Instinto (⚠️ 2 motores): **raiva/luta** (`figado`,`radii`,`coroa_simpatica`) → "ferve rápido"; **medo/fuga** (`rim`,`adrenal`,`sacro`,`sist_nervoso_autonomico`) → "reage se protegendo, em alerta".

### O TEXTO RICO (herdado do temperamento, ancorado nos centros) — ordem do mockup
Antes de ler (enquadramento objetivo: "você não respondeu nada, foi lido no que seus olhos carregam") → 3 centros com barra + parágrafo → **caixa "Em resumo"** → **tensão dominante × secundário** (peça central: os dois centros que puxam pra lados diferentes) → **facetas** (Mente·como pensa / Coração·como sente / Corpo·como age / Como planeja / Nas relações) → **"A mesma raiz, dois lados"** (força↔sombra pareadas — onde mora o "tá falando comigo") → **"O mal-entendido sobre você"** (pico emocional) → **"Quando aperta, você vira…"** (sob estresse, comportamental) → **"O que te acende · o que te apaga"** (2 colunas) → fecho ligando o padrão ("o corpo dispara, mente e coração seguram → você acumula; não é falta de força, é força segurada").

### Regra de caso EQUILIBRADO (anti-Forer, herdada do estudo de formato)
Sem rótulo de tipo. Se os 3 centros ficam parecidos, NÃO dizer "você tem um pouco de tudo" (Forer) → discriminar pela DINÂMICA ("seu corpo dispara mas a cabeça segura", "seu fogo sai no trabalho, sua água em casa"), nunca por rótulo genérico. A régua de sempre: toda frase passa no teste "serviria pra qualquer um? → cortar/ancorar no dado específico".

### CORES dos 3 centros (fixas, identidade — iguais p/ todos)
Mente = **azul** `#2c6480` · Coração = **verde** `#2f7a54` · Corpo/Instinto = **âmbar/laranja** `#b5701a`. Barra tensão⟷livre = gradiente âmbar (tensão) → verde (livre). (Os eixos/agulhas variam por pessoa; as cores dos centros, não.)

## Entradas (do Stage 1, sem tocar nele)
- `achados_de_atencao[]`: `{ campo, intensidade (1-5), natureza_da_carga, lateralidade }`
- `sistemas_preservados[]`: `{ campo, polaridade_funcional (vital_ativo | neutro) }`
- `correlacoes_observadas[]`: `{ campos[2], natureza }`

## Passo 1 — campo → emoção(ões)
Usar a **tabela-lastro** (`tabela-lastro-MASTER.md` + `iridologia-psicoemocional-extracao.md`). Cada `campo` abre um LEQUE de emoções (fígado → raiva/ressentimento/frustração…). O Sonnet escolhe a(s) que encaixam com o contexto da pessoa (anamnese/history) — não todas.

## Passo 2 — CARGA (vem dos achados)
Nível a partir da `intensidade`:
| intensidade | nível | barra (%) |
|---|---|---|
| 5 | muito alta | 92-95 |
| 4 | alta | 82-90 |
| 3 | média | 55-68 |
| 2 | baixa | 30-40 |
| 1 | leve/sutil | 18-25 |

Modular por `natureza_da_carga`:
- `cronica_sustentada` → mantém (entranhada)
- `aguda_recente` → mantém, tom "recente/ainda móvel"
- `em_reorganizacao_ativa` → **desce 1 nível** (já caminha pro livre)
- `herdada_constitucional` → base
- `indeterminada` → **NÃO gera emoção** (pula)

## Passo 3 — LIVRE (recursos)
Duas fontes (usar as DUAS — não só os preservados, senão a força fica subrepresentada):
**(a) `sistemas_preservados`:**
- `vital_ativo` → **vital** (barra 88-92) — recurso forte
- `neutro` → **livre** (barra 78-84)
Cada preservado → emoção-recurso (polo positivo): coração→alegria/amor · pulmões→fôlego/vitalidade · musculoesquelético→firmeza/base vital · linfático→limites saudáveis (não carrega o mundo dos outros) · sistema_reprodutor→vínculo/criatividade · etc.
**(b) `constituicao_base` (recursos constitucionais):**
- `pupila: centrada_regular` → **centramento / eixo organizado** ("um chão por dentro") — livre 82-86
- `trama_fibras: compacta_densa` → **vitalidade constitucional** (resiliência de base) — vital
- `bordas_pupilares: regulares` → estabilidade
⚠️ NÃO inventar força além do que a íris mostra (preservado + constituição organizada) = seria falso conforto / Forer-positivo. Se a íris tem pouca força real, dizer menos — a força PRINCIPAL da pessoa também aparece no TEMPERAMENTO (os dons) e nas HERANÇAS (resiliência herdada), então o relatório inteiro não fica pesado mesmo que este bloco tenha mais carga.

## Passo 4 — não mencionado = neutro
Emoção cujo campo não apareceu nem como achado nem como preservado → **não entra no mapa** (nem carga nem livre). Sem inventar.

## Passo 5 — COMPOSTAS (correlações)
`correlacoes_observadas` → emoção composta reforçada (ex.: fígado + marca da infância = "contenção aprendida"; nervoso + collarete = "alerta que não desliga"). Nudge pequeno (+, não conta gigante). Também vira NARRATIVA no texto de fecho.

## Passo 6 — SELEÇÃO (principais, NÃO os 60)
- CARGA: achados ordenados por `intensidade` DESC → top **5-6** emoções.
- LIVRE: preservados → **3-4** emoções-recurso.
- Total ~8-10 no mapa. A biblioteca dos 60 pêndulos fica interna (motor/lastro), nunca impressa inteira.

## Passo 7 — DISPLAY
- Barra GROSSA (~19px), comprimento = o % do nível. Carga = âmbar; livre = teal/verde.
- Rótulo: **alta / média / baixa / leve** (carga) · **vital / livre** (recurso).
- Fecho: 1-2 frases ligando a maior carga ao maior recurso ("sua carga mora em X; sua força está livre em Y").
- Voz do cliente (2ª pessoa, 8ª série, envolvente). ZERO iridologia no texto.

## Exemplo — Helton (self)
Achados: fígado I4 crônica · radii I4 · anel_interno I4 · intestino_grosso I3 · nervoso I3 · rim I2. Preservados: coração(neutro) · pulmões(neutro) · musculo(vital_ativo) · linfático(neutro).
→ CARGA: raiva contida (alta) · contenção aprendida [fígado+timeline] (alta) · irritação que sobe (alta) · alerta que não desliga [nervoso+collarete] (média) · apego (média) · medo de base (baixa).
→ LIVRE: firmeza (vital) · alegria & amor (livre) · fôlego (livre).

---

# MAPA DE 10 SEGUNDOS — ⛔ SUPERSEDED (fundido no BLOCO 2 acima)
Este bloco era um "retrato em 10s" SEPARADO do temperamento. **Foi fundido** com o temperamento no bloco único **"Como você funciona por dentro"** (ver "⭐ BLOCO 2" no topo). Motivo: os dois diziam a mesma coisa (3 centros × 4 elementos = redundância). O que sobreviveu está na receita topográfica do bloco 2.

**Descartado na fusão:** a fileira de **"pares de tensão" como eixos separados** (Interior⟷Exterior, Analisar⟷Sentir, Acelerar⟷Parar, Controlar⟷Confiar). No mockup final a tensão virou UMA frase — "dominante × secundário" entre os centros (ex.: "a sua tensão vive entre a mente e o corpo") — mais limpa e sem repetir o mapa emocional (bloco 5). Se algum dia o founder quiser os eixos de volta, o lastro deles era: distância collarete↔pupila (Interior⟷Exterior, Método Vetorial) e razão de carga entre centros para os demais.

---

# BLOCO 6 (FECHO) — "Perguntas para sua sessão" — cálculo/craft
> Numeração atualizada: com o temperamento fundido no bloco 2, o relatório tem **6 blocos** (1 Em poucas palavras · 2 Como você funciona · 3 Linha do tempo · 4 Heranças · 5 Mapa emocional · 6 Perguntas). Este era "bloco 7" na numeração antiga.
Nome escolhido pelo founder (era "roteiro de anamnese"; "anamnese" = jargão, fere 8ª série). Fecha o relatório (fecho ATIVO: manda a pessoa adiante com as perguntas, em vez de mensagem genérica). Lastro = §12 REAL de produção (`system.md`) + relatório do Miguel (`Leitura-Miguel-Reis-2026-07-19.pdf`).

## Fonte das perguntas (promptável)
Cada pergunta ANCORA numa emoção CARREGADA do mapa de pêndulos (bloco 5) — NÃO no órgão/idade (o Miguel de produção ancora em "fígado/vesícula/pâncreas" = JARGÃO, proibido no doc novo; e usa "pontas de fio" = "fio" BANIDO). Aqui a âncora é a emoção. Seleção: top ~4-5 cargas do mapa + **1 pergunta ancorada numa FORÇA/recurso** (equilibra o bloco; move do Miguel Q8: "vira a mesma determinação pra dentro") + 1 pergunta-fecho personificada.

## Estrutura de CADA pergunta (3 tempos — do §12 real, confirmado no Miguel)
1. **Âncora hedge da leitura** ("A leitura mostra/aponta/sugere…") em cima da emoção.
2. **Pergunta biográfica — o "puxão"** (aberta, leva à memória/vida real; NÃO direciona a resposta; UMA pergunta principal por item). ← ⚠️ o tempo que meu 1º mockup tinha comprimido; é o que faz doer bonito.
3. **Corpo-agora** ("o que você sente no corpo agora, lendo isto — se é que sente algo") + micro-movimento ("nomeie", "fique uns segundos", "note onde travou"). Aberto, sem místico.

## Adotado do Miguel
- **Linha de permissão** (após o intro): "Se algo vier forte ao corpo enquanto você lê, não precisa ter resposta — basta notar onde chegou."
- **Pergunta-fecho personificada** (à prova de Forer): "o que, dentro de você, ainda está esperando que você pergunte como está? Se isso tivesse um corpo, onde estaria — e o que estaria pedindo?"

## Regras (canônicas)
8ª série · ZERO iridologia (emoção, nunca órgão) · sem gíria (proibidos: "fio", "rolar", metáfora "gasolina") · anti-Forer (discrimina) · aberta, não direciona · tom clínico-integrativo, sem místico · voz 2ª pessoa. O "nasce de:" é lastro interno — some no doc do cliente.

## Exemplo — Helton (v1 lista, `out/b7-perguntas-sessao.html`)
6 perguntas: 1 raiva contida · 2 alerta que não desliga (+ medo de base) · 3 contenção aprendida (não pedir ajuda) · 4 apego/soltar · **5 FORÇA virada pra dentro** (firmeza) · 6 fecho personificado. + envio caloroso.

## ⭐ EVOLUÇÃO (DECISÃO founder 2026-07-21): "PERGUNTAS DO SOPRO DA ORIGEM" — MÉTODO SOMÁTICO
Cada pergunta deixa de ser um convite de 1 linha e vira um **PROCESSO SOMÁTICO de 5 tempos** que a pessoa caminha sozinha. **NOMES FINAIS:** título do bloco = **"Perguntas para a sua sessão"** (seção "7"), subtítulo = **"Método somático · Sopro da Origem"** (marca PRÓPRIA do founder — permitido, ≠ citar autor/escola externa; os autores-fonte ficam ESCONDIDOS no prompt, nunca no doc). Cada item = **"Caminho N"** (nomeado pela SAÍDA carga→alívio, ex. "Caminho 1 · Raiva contida → Serenidade"; NÃO "Pêndulo" nem "Emoção carregada" — nomear pela ferida foi rejeitado). **1 pergunta por pêndulo** (6 no Helton). Bloco completo: `out/b7-perguntas-sopro.html` (+ `relatorio-novo/`); protótipo de 1: `b7-processo-proto.html`. Founder: "esse é o nosso processo, gostei" — aceitou que cada pergunta ocupe mais espaço.
**DECISÃO (tentativa, revisitar): as perguntas-processo vão SÓ pro TERAPEUTA** (não o doc do cliente). "isso a gente vê depois."
**Os 5 TEMPOS** (lastro completo + stems/frases = `motor-perguntas-processo.md`): **1 Chegar** (voz permissiva Erickson + controle/segurança Satir) · **2 Tocar a carga no corpo** (felt sense Gendlin + submodalidades PNL + TITRAÇÃO na frase: "um cantinho já basta / se nada vier, tudo bem") · **3 Deixar falar** (Clean Language — sensação em ABERTO, nunca afirmar = anti-Forer; "tem mais alguma coisa?") · **4 Trazer o outro lado** (RÓTULO exibido = "Trazer o outro lado"; "Pendular" é jargão, cortado. Técnica = pendulação Levine = o nosso pêndulo âmbar⟷verde; ancorar no recurso REAL da íris; "tocou E voltou = já é força" Satir) · **5 Micro-passo** (precisão Metamodelo PNL + passa o bastão: PDF ABRE, sessão PROCESSA).
**REGRAS DO MÉTODO:** ⚠️ calor pode ser universal (voz), mas ÂNCORA + CONTEÚDO saem da íris (senão o acolhimento vira Forer). Titração obrigatória em carga 4-5. Mandar pra sessão em: trauma precoce, luto, carga crônica alta, convite que não fecha em ~30s. Uso PNL/Erickson só AUTO-GUIADO e transparente (nunca sugestão oculta). Frases-modelo do motor = gabarito de ESTRUTURA/TOM → prompt DEVE reescrever no vocabulário da leitura (senão vazam literal = Forer; audit de prod já pegou).

⚠️ ABERTO (founder decide antes do prompt): (a) nº de perguntas — com o formato-processo, cada uma pesa muito → recomendação: **poucas e fundas (4-5)**, não 10; (b) bloco roda 3-mov compacto OU cobre os 5 tempos ao longo do bloco.

---

# MOTOR DE NÚMEROS — decisões acumuladas (2026-07-22)
**ⓘ ESTADO:** a saga elemento/temperamento (abaixo) foi **encerrada** — os 4 elementos saíram (ver "⛔ TEMPERAMENTO ARQUIVADO" no topo). Estas notas ficam como HISTÓRICO do porquê. O de-para que AINDA vale é `campo → emoção` (alimenta o **mapa emocional**, bloco 5) e `campo → CENTRO` (alimenta o **bloco 2** topográfico). O de-para `emoção → elemento` **não é mais usado** (era a fonte do temperamento, que foi arquivado).
**TABELA CANÔNICA DE-PARA (o que sobrevive)** = `achado → emoções` (+ componente de CENTRO). Artefato que MAIS decide o resultado (~80%). **Mora ENTRE Stage 1 e Stage 2**: Stage 1 SCAN intocado (emite achados); a tabela mapeia; **Stage 2 CONSULTA a tabela (piso determinístico) E INTUI emoções extras por cima** (= o híbrido). Arquivo canônico: `tabela-achado-emocao-COMPLETA.md` (42 campos, emoções + fonte + componente de centro). Órgão→emoção sai do lastro (Bradley/Hay/MTC/Dias/nativo).
**⚠️ 42 CAMPOS no glossary** (não 38). Tabela final lista os 42 (estruturais marcados como recurso/constituição, não carga).

## ⛔ HISTÓRICO — elemento/temperamento (2 tentativas, ambas descartadas)
Guardado só pra não re-litigar. **Nada disto entra no relatório.**
1. **Temperamento por EMOÇÃO→elemento (1ª tentativa):** `intensidade → emoção → elemento → % Bardon`. MEDO=💧Água (Bardon+MTC). Problema: de-para carga/sombra-heavy → soma desbalanceada (Água 40% · Fogo 23% · Terra 23% · Ar 13%) que NÃO dá pra equilibrar sourceando (alegria não é "carga"). E não discrimina (3 exames ≈ iguais).
2. **Temperamento por ESTRUTURA (pivô, 2ª tentativa):** ler da constituição (Rayid Jóia→Ar, Flor→Água, Corrente→Fogo/Ar, trama densa→Terra). Problema: os enums estruturais do Stage 1 saem invariantes (media/centrada/regular em 3/3) e o tipo Rayid não é confiável de capturar (5 rodadas Sonnet = 4 respostas). Precisaria +campos no Stage 1 = mexer no canônico.
→ **AMBAS morreram. Solução final = TOPOGRÁFICA** (soma por CENTRO/zona, com tensão+livre) — ver bloco 2 no topo. Discrimina, usa dado existente, sem tocar o Stage 1, sem rótulo de elemento.

# PROMPT (Stage 2 novo) — FONTE DA VERDADE (diretiva founder 2026-07-21)
O novo prompt Stage 2 é ancorado no **MOCKUP** (os 7 blocos em `relatorio-novo/`, a VOZ, a premissa **8ª série — uma pessoa da 8ª série entende tudo**) + este SPEC. Do **prompt de produção atual** (`apps/web/prompts/system.md`) pegar **SÓ o que presta e serve**: anti-Forer, "sai da íris não do achismo", guardrails não-médicos/LGPD, como ele LÊ/aterra o achado. **NÃO** herdar a estrutura nem a voz clínica/jargão do prompt de produção — é justamente o que estamos substituindo (o founder: "o prompt atual não tem essas coisas"). Arquitetura = **HÍBRIDO ENXUTO**: código calcula os números (ver `motor-numeros-metodologia.md`), LLM escreve a prosa + os 6 Caminhos.

---

⚠️ Regra viva: calibrar Sonnet no Stage 2 = ASK ao founder antes. Este SPEC é o lastro pra montar o prompt, não muda o Stage 1.
