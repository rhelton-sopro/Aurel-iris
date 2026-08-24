# Registro de Decisões — Iris Codex

**Por que este arquivo existe (2026-07-31).** Uma decisão do founder sobre o modelo do
Stage 1 se perdeu entre sessões: ninguém sabia dizer, meses depois, o que tinha sido
decidido nem se havia chegado ao código. O registro existia só na memória do assistente —
que o founder não lê, não revisa e não pode corrigir.

**Regras deste arquivo**

1. É **versionado no git**. Sobrevive a qualquer sessão, e o founder pode corrigir.
2. É **append-only**: decisão revogada não se apaga — ganha uma linha nova que a supera,
   com data e razão. O histórico da mudança de ideia é informação.
3. Toda decisão tem **STATUS**: `APLICADA` (com o commit), `PENDENTE` (decidida e ainda não
   no código) ou `SUPERADA` (por qual).
4. Decisão sem status de implementação é decisão pela metade — foi assim que se perdeu.
5. O que é **verificável em código** entra na tabela do fim e é conferido por
   `node scripts/verificar-decisoes.mjs`, que compara o declarado aqui com o código real.

---

## Configuração viva — o que está no ar AGORA

| Item | Decisão | Status | Evidência |
|---|---|---|---|
| Modelo do **Stage 1** (ler a íris) | `claude-sonnet-4-6` | APLICADA | `lib/anthropic/client.ts` · decisão 2026-07-26, **reconfirmada 2026-07-31** com estudo novo |
| Modelo da **localização da pupila** (crop) | `claude-sonnet-5` | APLICADA | `6d3a806` · `lib/canonicalize/pupil-center.ts` |
| Modelo do **Stage 2 — Mapa do Ser** | `claude-sonnet-5` | APLICADA | `lib/emocional/gerar.ts` |
| Modelo do **Stage 2 — Dossiê** | `claude-sonnet-4-6` | APLICADA | decisão 2026-07-20 |
| Método de **crop** | pupila ±500 → 1000×1000 | APLICADA | `6d3a806` · rollback: `CROP_METHOD=bbox` |
| **Relatório principal** | Mapa do Ser | APLICADA | `48b4c00` (2026-07-30) |
| **Dossiê** | opcional, sob demanda, **1 crédito** | APLICADA | `48b4c00` |
| **Leituras anteriores a 30/07** | permanecem no Dossiê, sem oferta de migração | APLICADA | `48b4c00` |
| **Topografia** (hora/anel/olho por campo) | auditoria Jensen — 40 de 44 campos com zona | APLICADA | `4d6a82a` · conferida por `verificar-decisoes.mjs` |
| **PDF — scale do Gotenberg** | `0.95` (⚠️ teto **0.97**) | APLICADA | `b9cb2cd` · acima de 0.97 a largura CSS cai abaixo de 700px e o PDF entra no MODO CELULAR |
| **PDF — paginação** | cada seção e cada Caminho começam em página nova | APLICADA | `bfa6e96` · conferido página a página no PDF real |
| **Verificação do PDF** | local, via Chrome + CDP (sem Docker) | APLICADA | `c37c62a` + `dc5794f` · `scripts/pdf-local.mjs` e `scripts/pdf-paginas.mjs` |
| **Versão do cliente** (Mapa do Ser) | **o terapeuta escolhe bloco a bloco** — caixinha por bloco, os 9; padrão = tudo menos "Perguntas para a sua sessão" | APLICADA | 2026-08-03 · `VersaoClienteButton.tsx` + `blocos=` na rota do PDF · conferida por `smoke-render.mjs` |
| **Escopo da escolha de blocos** | por ENTREGA, nada persistido (duas leituras do mesmo cliente podem sair diferentes) | APLICADA | 2026-08-03 |
| **Fitoterapia tradicional** | do TERAPEUTA — fora da versão do cliente, **sem caixinha** | APLICADA | 2026-08-03 · antes vazava quando o terapeuta marcava "incluir Perguntas" |
| **"Regenerar análise"** | REMOVIDO da UI (era founder-only, nos dois lugares) — resgate manual só por `/admin/regenerar` | APLICADA | 2026-08-03 |
| **Rótulo do Dossiê na tela da leitura** | "Gerar dossiê IRIS (antigo relatório) (1 crédito)" | APLICADA | 2026-08-03 · `AntigoRelatorioButton.tsx` |

---

## Histórico

### 2026-08-13 — AUDITORIA do motor: `baco` e `plexo_solar` mapeados, crash latente corrigido

**Pedido:** *"Stage 1 e Stage 2 funcionando redondo. E os nossos glossários, tabelas de cálculo,
fórmulas. Faça uma auditoria."* Relatório completo em
`apps/web/_motor-lab/lastro/AUDITORIA-motor-2026-08-13.md`.

**O que estava quebrado.** `baco` e `plexo_solar` entraram no glossário do Stage 1 em 26/07 (ancorados
no gráfico oficial do Jensen) e **nunca chegaram à tabela-lastro**. O motor caía em `SEM-LASTRO` e
descartava: o achado não virava emoção, centro, crença nem suporte. **8 ocorrências em 8 das 60
leituras de produção (13%).** E o bloco B do prompt anunciava esse descarte junto com os ignorados de
propósito, na mesma linha *"marcador/modulador"* — quem lia para calibrar não enxergava o furo.

**Decisão do founder:** *"você mapeie… Bora, vamos atacar todos eles"* e, vendo o impacto medido,
*"se você viu que isso tem diferença, pode ir embora, vamos pra cima"*.

**Mapeados** só com vocabulário que já existia na canônica (⇒ família e eixo garantidos):
`baco` 🌍60/💧22/💨18, lastro MTC (Baço=Terra, ruminação) + Jensen · `plexo_solar` 🔥45/💧33/🌍22,
**lastro ESTICADO declarado** (Br/MTC não cobrem plexo solar como órgão; ponte somática, mesma marca
que o `adrenal` já carrega). Centro dos dois = Coração, pela régua topográfica (2-4h).

**🔴 CRASH LATENTE que o mapeamento revelou.** O bloco do eixo integrativo lia `sup.suporte` **sem
guarda**, apesar do comentário logo acima dizer que ele *"independe de haver suporte nutricional pro
campo"*. Nunca estourou porque até então **todo** campo do lastro tinha entrada em `SUPORTES`. Os dois
novos são os primeiros sem — e o `calc()` passou a estourar. **Pego no teste, antes do commit.**

**Impacto medido, e é o que o founder aceitou:** mudam **8 leituras — exatamente as 8**. Médias das
agulhas: mente **29,1 = 29,1** · corpo **33,4 = 33,4** · coração **65,7 → 63,3**. Caso extremo
`aac033d9`: coração **88 → 49**, e a família dominante virou de *Controle e rigidez* para *Ansiedade e
preocupação*. **Contraponto registrado:** é queda grande num gráfico já aprovado; a direção é a certa
(aquelas leituras tinham achados reais sendo jogados fora, então "coração livre 88%" era falsamente
otimista), mas se algum dia incomodar, reverter o commit devolve os dois campos ao descarte — agora
visível, não silencioso.

**Também fechado:** a única das 232 cargas sem família e sem eixo (`"baixa estima → baixa imunidade"`,
que tinha a seta **dentro do nome** e quebrava o `split('→')` do `loadFamilias`) e o descasamento de
`temperamento manifesto reativo`. **Agora 0 sem família, 0 sem eixo.** ⛔ Não reintroduzir nome de
emoção com `→` dentro.

**⏳ Fica aberto (§4 e §5 da auditoria):** o `NUCLEO_CAP=4` torna 40 de 272 emoções (15%) inalcançáveis
e corta **por posição na lista, não por qualidade** — decisão de calibração, não mexida · o nível
"leve" existe na spec e nunca no código · a modulação por `natureza_da_carga` está especificada e não
existe no motor · e os 2 campos novos ainda não têm suporte nutricional nem eixo integrativo (degradam
sem quebrar).

**Status:** APLICADA · golden regravado e aceito como nova base (60 idênticas · 0 diferenças) ·
commits `6548c85` e `df4e451` · **não deployada**.

### 2026-08-13 — ESCALA DA CARGA normalizada, régua marcada, corroboração vira ⊕

**Pergunta do founder:** *"naquelas réguas ali na agulha, tá demarcado em que faixas a agulha tá
andando? Tem que estar preciso."* E depois, o que reabriu tudo: *"a escala vai de quanto a quanto?"*

**O que a medição achou.** A régua desenhada é bipolar (−50 … 0 … +50) e o score ia de 1,00 até um
teto que **mudava conforme a família emocional** — medido rodando o motor num exame com os 38 campos
em I5: **5,87** para uma família de 1 campo, **29,37** para "Medo" (5 campos). Eram onze escalas no
mesmo desenho: 5,87 em *Nojo e aversão* é o máximo que aquela emoção consegue registrar; 5,87 em
*Medo* é 20% do teto dela. Mesma agulha, sentidos opostos. E as **quatro famílias de 1 campo jamais
alcançavam "muito alta"** (teto 5,87 < corte 6,0) — impossível por construção, não por leitura.
Outros dois achados no caminho: o rótulo e a agulha eram **contas diferentes** sobre o mesmo número
(faixa discreta × curva saturante), com a regra de corroboração aplicada por **dois freios distintos**
— teto duro no rótulo, freio macio na agulha —, que podiam discordar entre si; e a régua estava
escrita em **três arquivos**, com a cópia do `fmt()` do motor-calc sem a regra de corroboração —
mostrava "muito alta" onde o cliente lia "alta", e é por esse dump que se calibra.

**A decisão.** 100% = **um achado sozinho na intensidade máxima (I5) = 5^γ = 5,873**. Passar de 100%
é legítimo e significa mais de um achado apontando pra mesma coisa. Cortes **colados na intensidade**
(45% / 70% / 90%), pro rótulo ser leitura direta do que a íris mostrou:
**I1/I2 baixa · I3 média · I4 alta · I5 muito alta · 2ª emoção de um I5 (60%) média.**
Agulha **linear** na escala normalizada — é o que permite cravar a marca de cada faixa na barra
(31,9% · 25,1% · 19,7%). A **corroboração deixa de travar o rótulo e de frear a agulha**: vira a
marca **⊕** ao lado, como já era feito nas crenças. Medida é medida; confiança é anotação.

**O que muda no que está no ar — medido, não estimado.** Em 248 pêndulos de 31 execuções (5 pessoas):
**9 rótulos mudam (3,6%)**, todos do mesmo caso — score ~5,8 saindo de "alta" para "muito alta", que é
exatamente o I5 puro que a decisão quis endereçar. Distribuição: *muito alta* 4% → 8%; as outras três
faixas idênticas. ⚠️ Amostra de **5 pessoas** — suficiente pra dimensionar o impacto, não pra calibrar
corte. Medir nas 60 do golden antes de mexer em corte de novo.

**Contraponto registrado.** A regra antiga *"muito alta = forte E corroborada"* era do founder e foi
afrouxada: agora um único achado I5 alcança "muito alta" sem segundo achado. Foi condição para o
conserto — mantê-la reintroduziria o teto que impede famílias de 1 campo de chegar lá. O ⊕ preserva a
informação sem esconder a medida. Se um dia isso incomodar, o caminho é voltar o teto **no rótulo E na
agulha juntos**, nunca em um só.

**Arquivos:** `_motor-lab/motor-calc.mjs` (fonte única — exporta `MAX_ACHADO`, `CORTES`, `normCarga`,
`nivelDe`, `bipCarga`, `leftCarga`), `_motor-lab/serialize.mjs` (prompt) e `_motor-lab/render-novo.mjs`
(cliente) passam a importar. ⛔ **Não recriar cópia local de nenhuma delas** — a divergência entre as
cópias era o defeito.

**⛔ REPROVADO NO MESMO DIA — as duas peças visuais saíram.** Founder, vendo o render:
*"ficou uns tracinhos na régua, não ficou legal não… tem um desenhozinho depois de cada palavra,
também não ficou legal. Mas esses tracinhos a gente não precisa colocar."*
1. **Marcas de faixa na barra** (linhas em 31,9% · 25,1% · 19,7%) — removidas. Traço vertical sobre a
   barra de gradiente suja o objeto mais bonito do relatório. Se voltar um dia, que seja como entalhe
   curto na borda, nunca linha atravessando. Os pontos exatos ficam registrados no código.
2. **Marca ⊕ no pêndulo** — removida. A informação **não se perdeu**: continua no bloco B do prompt,
   que é quem precisa dela pra dosar a força do texto. O cliente não precisa ver metodologia no
   gráfico. ⚠️ Só o **pêndulo** perdeu o símbolo — o ⊕ das **crenças** é anterior, nunca foi
   questionado, e continua.
⇒ A faixa segue dita em **palavra**, ao lado do rótulo, que é onde ela já funcionava. **A escala
normalizada e a agulha linear FICAM** — o que caiu foi só o desenho, não a régua.

**Status:** APLICADA no working tree, **não commitada, não deployada**. Gates após a remoção:
`smoke-render` ✓ · `eslint` 0 erros · `tsc` sem erro novo (os que aparecem são o backlog conhecido de
testes + `tmp/`).

**⭐ O QUE ISTO CONSERTOU DE VERDADE — descoberto depois, e é maior do que parecia.** O prompt do
Stage 1 tem a **regra de protagonista** (`prompts/stage1-scan.md` §"Escala de intensidade"):
*"em cada íris pode haver no MÁXIMO 1 achado intensidade 5 — o protagonista"*. O motor obedecia; **a
régua não**. Um I5 pontua 5,87 e o corte de "muito alta" era 6,0 ⇒ o sistema **declarava** um
protagonista numa ponta e o **recusava** na outra, rotulando-o com a mesma palavra de um I4 qualquer.
Medido nas 60 de produção: leituras com um pêndulo "muito alta" vão de **12 (20%) para 27 (45%)**, e
19 (32%) têm de fato um achado I5. ⇒ **a mudança não inflou nada — desbloqueou o que a spec já mandava.**

**A questão da distribuição, encerrada — não era da régua.** Medido em 60 leituras / 300 achados:
I1 9,7% · **I2 35,0%** · **I3 32,3%** · I4 16,7% · I5 6,3%. **77% dos achados são I1-I3**, e os
rótulos são 86% baixa/média — os dois batem (a diferença de 9 pontos é o decaimento). A régua espelha
fielmente o Stage 1. E o critério de intensidade **não é vago**: tem âncora visual em cada nível
(sutil / localizado / moderado / expressivo / dominante). ⇒ hipótese de "modelo se refugia no meio"
**descartada**. Os 86% em baixa/média são o **fundo contra o qual o protagonista se destaca** — é
desenho, não defeito.

**⏳ FICA ABERTO, e é de PRODUTO, não de régua:** **18 das 60 leituras (30%) não têm nenhum pêndulo em
alta nem em muito alta** — mapa emocional inteiro em baixa/média, sem destaque. Pode ser fiel (o
próprio prompt admite íris sem protagonista, "raro mas válido") ou pode ser um relatório morno para
quase um terço dos clientes. **Não se decide por número — decide-se olhando as íris.**
**Decisão do founder (13/08):** *"eu não vou olhar. Se você considerar que tá ok, vamos manter assim."*
⇒ **MANTÉM.** Registrado para quando houver sinal: se aparecer queixa de "o relatório não apontou nada
forte", a investigação começa por estas 18, e não do zero.
**Contraponto registrado:** quem escreveu isto assinou a régua, **não** assinou que os 30% estão
corretos — isso exige leitura de íris, que não é competência de quem escreveu.

**⚠️ Registro de um susto que não era:** o founder relatou *"minha raiva contida era alta e agora ficou
média"*. **Não foi esta mudança.** Medido: "raiva contida" sai **média** nos três renders — código
atual, código novo e o render de 29/07, anterior a tudo. O pêndulo dele pontua 3,69 (63% da escala),
e a leitura do lab tem só 3 achados com peso (fígado I3 · radii I2 · musculoesquelético I1). Se
houver um "alta" em algum lugar, é do relatório de PRODUÇÃO, que vem de outra captura — o
`_exame-self.json` é um retrato de 28/07. **Pendente:** conferir no banco.

### 2026-07-31 — RESULTADO do estudo refeito (4.6 × Sonnet 5, pós-fix)
Harness `apps/web/scripts/estudo-modelo-stage1.mts` · 3 amostras × 2 modelos · mesma íris e mesmas 6 canônicas do
estudo de 26/07 · enum vindo de `KNOWN_CAMPOS_LIST` (40 campos, igual produção) · custo $0,996.

| | Jaccard | Jaccard I≥4 | Gabarito | Agulhas (amplitude entre as 3) |
|---|---|---|---|---|
| Sonnet 4.6 `temp=0` | 54% (era 78%) | 42% | 2 de 3 | mente **±0** · coração **±0** · corpo ±5 |
| Sonnet 5 (sem temp) | 52% (era 36%) | **100%** | **3 de 3** | mente **±36** · coração ±8 · corpo ±18 |

**O argumento de 26/07 caiu:** medido com a régua de produção, os dois EMPATAM em Jaccard
(~53%). O 4.6 piorou (78→54) porque o número antigo foi medido com 45 campos, incluindo 5
constitucionais que ele gastava como achado.

⭐ **Mas o Jaccard não é a métrica que decide** — o que decide é quanto o RELATÓRIO balança:
- S5 é 100% determinístico em I≥4 (núcleo pétreo), mas a agulha da MENTE varia **36 pontos**
  (45↔81 = "tensa" ↔ "livre") — o gráfico principal muda de veredito na mesma íris.
- 4.6 é instável em I≥5 (o protagonista troca), mas as agulhas saem IDÊNTICAS nas 3.

⭐⭐ **CAUSA RAIZ do balanço do S5 — não é a cauda fraca nem o γ:** é **FLIP carga↔livre**.
`sistema_nervoso_autonomico` sai PRESERVADO na amostra 1, CARGA(I2) na 2, PRESERVADO na 3.
Idem `sistema_musculoesqueletico`. O S5 emite 8-9 preservados contra 6 do 4.6 — mais campos
na zona ambígua. Testado e REFUTADO: subir o γ (1.1→3) **piora** (±36 → ±58), porque ponderar
intensidade não ajuda quando o campo muda de LADO, não de peso.

### 2026-07-31 — Refazer o estudo de modelo do Stage 1
**Decisão:** refazer a comparação 4.6 × Sonnet 5 antes de qualquer troca.
**Razão:** o estudo de 26/07 mediu o 4.6 **antes** do conserto de topografia
(`4d6a842`+`534cfc2`), e era o falso positivo do fígado que decidia o comparativo. Pior:
aquele harness oferecia **45 campos** ao modelo contra os **40** de produção — os 5 extras
eram constitucionais (`trama_fibras`, `vascularizacao_escleral`, `pupila`,
`bordas_pupilares`, `cor_predominante`), e o 4.6 gastava vagas de achado com eles
(`vascularizacao_escleral` 3/3, `trama_fibras` 2/3). O Jaccard que decidiu a escolha foi
medido com uma régua diferente da de produção.
**Status:** CONCLUÍDO — ver o resultado acima.

**RECOMENDAÇÃO (assistente, 2026-07-31):** **manter o Sonnet 4.6 no Stage 1** e atacar o
fígado por REGRA, não por troca de modelo. Razão: o erro do 4.6 é uma afirmação errada
CONSTANTE (corrigível, e o fix de topografia já provou que responde a regra); o do S5 é o
relatório se **contradizer entre execuções** — a agulha da mente indo de "tensa" a "livre" na
mesma íris é pior que um achado errado estável, porque destrói a confiança do terapeuta no
instrumento. Somado a isso, o swap custaria 3 mudanças técnicas (`temperature`, `max_tokens`
dividido com thinking, constante de modelo por estágio) por um ganho líquido não comprovado.
**Gatilho para reconsiderar:** quando o flip preservado↔carga tiver solução (critério mais
duro de preservado no prompt, ou voto 2-de-3), refazer este mesmo estudo — o S5 já vence em
acurácia (3/3) e é 40% mais rápido.

### ✅ 2026-07-31 — DECISÃO DO FOUNDER: fica no Sonnet 4.6
**Decisão:** o Stage 1 **permanece no `claude-sonnet-4-6`**. Founder, verbatim:
*"fica no 4.6 mesmo, registra a decisão."*
**Status:** APLICADA — nenhuma mudança de código necessária; é o que já está no ar.
Conferido por `node apps/web/scripts/verificar-decisoes.mjs`.

**O que sustenta (medido em 2026-07-31, não herdado):**
- As agulhas do 4.6 não variam entre execuções (mente ±0, coração ±0) — o S5 balança a
  mente em 36 pontos, o que faz o gráfico principal mudar de veredito na mesma íris.
- O erro histórico do fígado **foi corrigido**: hoje o 4.6 acha estômago em **3/3** (I4/I5/I4),
  intestino delgado em 2/3, e o fígado que resta é **I2 nas três**, na zona anatomicamente
  CERTA (~7:30-8:15h OD, conforme a tabela auditada), com ressalva explícita do próprio
  modelo ("sinal sutil", "difícil de distinguir com certeza"). Não é mais o falso positivo
  topográfico de antes.
- Combinar os dois modelos foi testado e **descartado**: união compra 1 ponto de Jaccard
  (62%→63%) por 2× o custo e reintroduz o fígado; interseção derruba o Jaccard dos achados
  para 33%. Ver a tabela de combinação abaixo.

**Quando reabrir:** só com o flip preservado↔carga resolvido. O estudo se refaz com
`npx tsx apps/web/scripts/estudo-modelo-stage1.mts 3` (~$1) — harness preservado no repo
de propósito, para a comparação futura usar a MESMA régua desta.

| combinar 2 modelos | Jaccard achados | preservados | Stage 1 inteiro | gabarito | custo |
|---|---|---|---|---|---|
| 4.6 sozinho | 54% | 71% | **62%** | 2/2/1 | $0,15 |
| S5 sozinho | 52% | 68% | 61% | 3/3/3 | $0,18 |
| interseção | **33%** | 78% | 59% | 3/3/2 | $0,33 |
| união | 60% | 66% | 63% | 2/2/2 | $0,33 |

### 2026-07-26 — Stage 1 fica no Sonnet 4.6
**Decisão:** Stage 1 inteiro no `claude-sonnet-4-6`; Sonnet 5 **apenas** para localizar a pupila.
**Razão:** critério de **reprodutibilidade**, não acurácia. Jaccard médio (3 amostras, mesma
imagem): 4.6 = 78% · S5 = 36% · Opus 5 = 44% · GPT 5.6 = 50%. S5 e Opus **rejeitam
`temperature`** — não há como pedir determinismo. Com Stage 1 instável, o mesmo cliente
regerando recebe outro exame. Na pupila o S5 é decisivo (erro 68px vs 245px).
**⚠️ Contraponto registrado na época:** no gabarito do founder o **S5 era mais acurado**
(2 de 3 critérios contra 1 de 3 do 4.6 — estômago 3/3 e quase nenhum falso fígado). A
decisão pesou estabilidade acima de acurácia; não foi resultado unânime.
**Status:** APLICADA — e é o que está em produção hoje.

### 2026-07-20 — Sonnet 4.6 nos dois estágios (Dossiê)
**Decisão:** Stage 1 e Stage 2 do Dossiê no 4.6.
**Razão:** no Stage 2 o Sonnet 5 regride a voz (3.634 palavras contra 6.032; "raiva" 0× contra
6×; copia a fórmula do mapa). O ganho do Opus no Stage 1 era marginal e N=1.
**Status:** APLICADA. O Mapa do Ser, criado depois, nasceu no Sonnet 5 — divergência
intencional, não resíduo.

---

### ✅ 2026-07-31 — Cobrança do Dossiê: RESOLVIDA sem migration
**Decisão:** o Dossiê sob demanda consome **1 crédito próprio**. Founder: *"Se a pessoa
dessas novas fotos quiser o dossiê, ela pode fazer, cobra um crédito."*
**Status:** APLICADA (`48b4c00`).
**⚠️ Correção de uma análise minha anterior:** eu havia dito que exigiria migration no
billing. Não exigiu. O bug do `convert_reservation_to_consume` (converte por `reading_id`)
só aparece com **duas reservas ATIVAS** na mesma leitura — e no fluxo real a do Mapa do Ser
já está `converted` quando o Dossiê é pedido. Bastou `readingHasActiveReservation()` (só
status `active`): o Dossiê reusa a ativa órfã em vez de criar outra, então nunca há duas
ativas e o débito fecha 1:1. UI avisa antes de gastar (rótulo "(1 crédito)" + confirmação).

### 2026-07-31 — Revisão do PDF com verificação visual local
**Decisão:** montar geração + rasterização local do PDF, para o assistente conferir antes de
entregar. Founder: *"dá um jeito de visualizar. Você gerou o PDF e encontra caminho."*
**Status:** APLICADA — `scripts/pdf-local.mjs` (CDP `Page.printToPDF`, mesmos parâmetros da
rota) e `scripts/pdf-paginas.mjs` (PDFium + screenshot → PNG por página).
**Achados que só apareceram por olhar:** cabeçalho do Caminho ficava órfão com meia página
em branco (`.qhead` sem `break-after:avoid`); e as regras que eu tinha escrito para
`.st-txt`/`.st-lab` eram **inertes** — essas classes não existem no HTML gerado.

### 2026-07-31 — Bloco 5: "onde você está" SAI da legenda (emoção não é lugar)
**Decisão:** a legenda do Mapa emocional passa a ser
`● Bolinha = quanto isso pesa hoje · Esquerda = mais peso · Direita = pra onde afrouxa`.
Founder: *"'onde' remete a estado, essa expressão não é indicada para falar da emoção."*
E sobre o novo lado direito: *"'afrouxa' já caminha alguma coisa para recurso."*
**Razão:** "onde você está" fixa a emoção como um **lugar onde a pessoa mora** — o cliente
lê a bolinha como veredito de identidade. "Quanto pesa hoje" é passageiro, e "pra onde
afrouxa" é **direção**, não destino — o que também alinha a figura com a regra já escrita
no prompt e no motor de que **o antídoto NÃO é força presente**, e sim a saída.
**⛔ Escopo — só terminologia.** O modelo bipolar, os pares carga⟷antídoto, o desenho, os
níveis e o bloco 7 ficam **exatamente como estavam**. O founder avaliou e aprovou o modelo:
*"ali os locais, os nomes, está tudo certo"*.
**Alternativas descartadas na conversa:** renomear o bloco para "O pêndulo das emoções" com
explicação da metáfora (founder preferiu manter **Mapa emocional**); e uma proposta minha,
mais ampla, de trocar o modelo bipolar — **rejeitada por ter errado o alvo**, a crítica era
de terminologia, não de concepção.
**Status:** APLICADA — `_motor-lab/render-novo.mjs` (fonte única; a prod importa esse mesmo
módulo via `lib/emocional/render.ts`). Smoke `scripts/smoke-render.mjs` verde.
**Nota:** as ocorrências restantes de "onde você está" no HTML são do roteiro de aterramento
(`metodo7.mjs`, *"olha devagar pro lugar onde você está"*) — ali é lugar **físico**, o corpo
na sala. Uso correto, mantido de propósito.

### 2026-07-31 — Público: dizemos **"terapeuta"**, sem qualificador. Nunca "psicólogo" nem "psicanalista"
**Decisão do founder:** *"minha decisão é: não vamos falar psicólogo nem psicanalista. Vamos falar
simplesmente terapeuta. E aí no marketing, no tráfego, a gente direciona para essa galera também."*
**Razão:** "terapeuta" é guarda-chuva — não invoca conselho, não obriga ninguém a se declarar, e
deixa o enquadramento com quem já é dono dele por lei (o profissional). É a execução, no nível da
palavra, do princípio de **nunca vestir a roupa da Psicologia** — que é exatamente o que a Nota
Técnica CFP de 03/03/2023 ataca no caso da Constelação Familiar (incompatível *"enquanto método ou
técnica da Psicologia"* — vedação de **rótulo**, não de pessoa).
**Contraponto do founder, aceito e incorporado ao estudo:** quando o CFP veio tirar a Constelação da
psicologia, ela **já tinha pegado** — a nota chegou tarde e não matou o mercado. Ler a régua do
conselho como muro é ler errado o que aconteceu; é um jogo em que se entra para ganhar, conhecendo
as regras. Minha ressalva remanescente, registrada: a Constelação tinha **massa crítica antes** da
nota e nós ainda não temos — por isso a disciplina de rótulo é o que sustenta a jogada.
**Escopo operacional:**
- ✅ Segmentar tráfego por interesse (psicologia, psicanálise, terapias integrativas) é permitido.
- ⛔ O **criativo não muda de língua** por audiência: nenhum anúncio, LP ou peça diz "para psicólogos".
- ⛔ Nunca usar CRP/conselho como prova, selo ou endosso ("indicado para psicólogos" é proibido).
**Decorrência de posicionamento (mesma conversa):** as dores do terapeuta **D3 (permissão/medo de
conduzir)** e **D5 (como mostro que meu trabalho é diferente)** passam a ser a frente de comunicação.
A LP hoje abre pela reação do cliente; a dor que faz o terapeuta comprar é dele. ⚠️ A alavanca do
duplo público **não morre** — o UAU do cliente vira **prova** de que a dor foi resolvida, e deixa de
ser a abertura. ⚠️ D3 **não pode ser nomeada de fora** (acusa a autoimagem e a pessoa fecha a página).
**Fonte:** `Estatégia comercial e mkt/ESTUDO-DORES-DO-TERAPEUTA.md` (31/07/2026).
**Status:** DECIDIDA — falta aplicar em `LP-COPY.md` v2 e nas peças.

### 2026-07-31 — Bloco 7 na tela: rótulo do Caminho legível + "Carga alta" duplicada
Três defeitos vistos pelo founder na página (computador), na leitura `c3841fbf`.

**1. BUG — "⚠ Carga alta" saía DUAS vezes.** O render somava um `<span class="conduct-lab">`
próprio e tentava remover o do `CONDUCT` com `.replace(/^⚠ Carga alta/,'')`. A regex nunca
casava, porque `CONDUCT` (em `metodo7.mjs`) **começa com a tag**, não com o texto. Agora usa
`CONDUCT` direto. **Status:** APLICADA — verificado no HTML: 2 → 1 ocorrência.

**2. Fonte do `Caminho N · carga → antídoto` (`.q-eyebrow`).** Estava **11px, caixa alta e
espaçada** na tela contra 14px no PDF — a tela ficara 27% menor que o print, ao contrário da
relação de sempre. **Decisão do founder: 16px, SEM caixa alta.** Caixa alta com tracking é o
que fazia a linha parecer apertada, e piora com nome de carga longo, que quebra em 2 linhas.
Print acompanhou (14 → 17px), senão o PDF ENCOLHERIA a linha.
**⚠️ O CSS de produção do bloco 7 mora nos HTML de `relatorio-novo/`** — `relatorio-completo.html`
vira `STYLE` e `b6-terapeuta-proto.html` vira `B6CSS`. Não são mockups inertes. A regra
existia **duplicada** nos dois; as duas foram atualizadas (vence a do proto, que vem depois).
**Status:** APLICADA — conferido por screenshot via Chrome/CDP: `font-size:16px`,
`text-transform:none`.

**3. Chave crua da canônica vazando no nome do Caminho.** Saiu
`irritação que "sobe" do visceral ao mental → Serenidade` no lugar de `Irritação que sobe`.
O `nome=` é escrito pelo Sonnet e ele às vezes copia a chave em vez do rótulo.
**Decisão do founder: consertar por REGRA no render, não no prompt** — assim não depende de o
modelo obedecer. Criada `rotuloCarga()`, régua ÚNICA (override do eixo > dicionário `PEND` >
limpeza), usada pelo bloco 5 **e** pelo bloco 7.
**Ganho colateral:** os dois blocos passaram a exibir **o mesmo rótulo** para a mesma emoção —
antes divergiam. **Status:** APLICADA — verificado renderizando a leitura real `c3841fbf`.

**Alternativa descartada:** endurecer o prompt do bloco 7 (seria calibração de Sonnet, e mais
frágil que a regra determinística).

### 2026-07-31 — Bloco 7: 20 rótulos duplicados (achado meu, olhando o PDF)
**Como apareceu:** não foi reportado — apareceu ao rasterizar o PDF pra conferir a fonte do
cabeçalho. É o retorno concreto do fluxo "gero → olho → corrijo".

**O defeito:** cada texto de `m.fixo` (em `metodo7.mjs`) **já abre com o seu**
`<span class="say-lab">`, e o render somava outro rótulo a partir de `m.labs[k]`. Saíam duas
vezes: "Porta A", "Porta B", "Fechar" e o do movimento 7 — **4 por Caminho, 20 no documento**.
É a MESMA causa do "⚠ Carga alta" duplicado: rótulo emitido pelos dois lados.

**Por que ficava feio além de repetido:** o rótulo do render saía como `<p>`, e dentro de
`.say` o seletor **`.say p`** (Palatino 17px itálica) tem especificidade MAIOR que `.say-lab`
e vencia. A cópia de cima saía grande e serifada; a de baixo, correta. Corrigido também o
rótulo do slot do movimento 7, que era `<p>` pelo mesmo motivo → virou `<span>`.

**"Micro-passo" ainda imprimia.** A decisão de 2026-07-29 (o movimento 7 deixou de prescrever
tarefa e passou a perguntar) trocou o rótulo do **slot**, mas o **texto fixo** ficou com o nome
velho. Renomeado para **"Levar pra sessão"** — o que o próprio texto diz ("Leva isso pra nossa
sessão"). ⚠️ **Não** foi renomeado para "O que já dá pra agora" porque colidiria com o rótulo
do slot, que fica logo abaixo: seriam dois blocos com o mesmo nome. Founder pode trocar a
palavra; é uma linha em `metodo7.mjs`.
**Contraponto:** o founder autorizou "trocar pelo nome novo" sem saber da colisão — o nome
escolhido é meu, não dele.

**Efeito colateral medido:** o PDF caiu de **37 para 34 páginas**.
**Status:** APLICADA — conferido no PDF real, páginas 19 e 20.
**⚠️ `m.labs` ficou sem uso** em `metodo7.mjs`; mantido como dado, mas o render não lê mais.

### 2026-08-01 — ✅ SUPERA 2026-06-13: "a íris lembra o que a pessoa esqueceu de si" está LIBERADA
**Decisão do founder, verbatim:** *"esse guardrail aí… não, isso aí não é do guardrail não, isso aí
você tira. Essa frase é muito legal sim, a íris lembra o que a pessoa esqueceu de si, perfeito."*
**O que muda:** a proibição registrada em 11 e 13/06/2026 (guardrail anti-oráculo, item 5.3 das
premissas) **cai para esta frase**. Ela é a headline da LP em produção (`apps/web/app/page.tsx`) e a
capa do deck — e permanece. A reformulação "a leitura revela o que a pessoa esqueceu de si" passa a
ser alternativa de estilo, **não** correção obrigatória.
**O que permanece:** o guardrail anti-oráculo continua valendo contra o abuso real — a íris não
adivinha futuro, não dá veredito e não sabe nada que a pessoa deva obedecer. Quem conduz é o
terapeuta; quem se reconhece é o cliente.
**⛔ Para os agentes de marketing:** ninguém reescreve, evita ou sinaliza essa frase como violação.
**Status:** APLICADA — `PREMISSAS-DO-PRODUTO.md` §5.3 e registro de correções. Nenhuma mudança de
código: a LP já estava assim.

### 2026-08-01 — As dores D5 e D3 governam TODO material, com regra de aterrissagem
**Decisão do founder:** os materiais passam a sair com base nas dores escolhidas no estudo.
Verbatim: *"a nossa narrativa pode falar de uma coisa nada a ver, mas vai chegar sempre no fim
nessas dores."*
**A regra:** o **gancho é livre** (curiosidade, íris, história, ciência — o que fisgar); o **pouso
não é**. Toda peça termina em **D5** (*como mostro que meu trabalho é diferente* → o objeto de prova)
ou **D3** (*será que eu posso atender* → a segurança de conduzir).
**Divisão:** D3 = gancho, topo de funil, orgânico. D5 = caixa, landing, fechamento.
**Razão da divisão:** quem mais sente D3 é quem **ainda não atende** — e o comportamento provado desse
público é comprar formação para adiar o primeiro atendimento. LP construída só em D3 enche o trial de
gente sem cliente em quem usar. D5 é a dor de quem já atende: tem cliente, gasta crédito, renova.
**Fora:** D1 (captação — o produto não gera tráfego) e D2 (cobrar — ajuda com a prova, não resolve a
culpa). D4 (desgaste) entra só como reforço dentro de D3, nunca como frente, e **nunca** como
substituto de supervisão.
**Travas:** D3 não pode ser nomeada de fora (acusa a autoimagem → ela fecha a página; entregar o
remédio, nunca o diagnóstico) · vocabulário de renda proibido (zero ocorrências em 372 comentários
reais) · léxico nativo é **medo**, **transbordar**, **"é exatamente isso"** · o UAU do cliente não
morre, vira **prova** e deixa de ser abertura.
**Status:** APLICADA em `PREMISSAS-DO-PRODUTO.md` §3.3 (fonte que todo agente lê antes de produzir).
PENDENTE na LP — ver proposta em `Estatégia comercial e mkt/LP-V2-CIRURGIAS.md`.

### 2026-08-01 — PDF: folha em branco, hierarquia do Caminho invertida, corpo -7%
Revisão do founder no PDF. **37 → 32 páginas** no total (34 após os rótulos duplicados).

**1. FOLHA TOTALMENTE EM BRANCO (pág. 9), entre a linha do tempo e as Heranças.**
Founder: *"uma folha ficou totalmente em branco. Essas coisas não podem acontecer."*
**Causa:** o `<hr class="div">` mora **entre** as `<section>`, fora das duas. Como
`section.block:not(:first-of-type){break-before:page}` faz toda seção começar em página nova,
o separador não separa nada no PDF — e com margem de 56+50px, quando a seção anterior
terminava perto do rodapé ele transbordava e **ganhava uma folha inteira só pra ele**.
**Decisão:** `hr.div{display:none}` **no print** (na tela continua).
⚠️ **SUPERA** o ajuste de margem 34/30 → 56/50 de 2026-07-31: o "ar entre seções" que o
founder pediu passou a ser a própria virada de página.
**⭐ Mecanismo novo:** `apps/web/scripts/pdf-paginas-vazias.mjs` mede a TINTA de cada página
e acusa as vazias. Conferir 32 páginas no olho não escala — e falhou: eu tinha olhado o PDF
e não vi. **Rodar sempre antes de entregar PDF.**

**2. HIERARQUIA DO CAMINHO INVERTIDA.** Founder: *"o caminho, preocupação constante →
confiança no futuro, essa parte tem que crescer mais"* e *"aquela parte da preocupação, a
confiança que também é dela, diminua esse cabeçalho para todos"*.
O par `carga → antídoto` (`.q-eyebrow`) virou o **título** do Caminho — 19px tela / 21px print
— e a frase em prosa (`.qtitle`) virou **apoio** em itálico — 17,5px tela / 19px print.
⚠️ **SUPERA** o "aumenta bastante" de 31px de 2026-07-31, que valia enquanto a prosa ERA o
título. É também a opção que o founder tinha **recusado** na conversa da véspera.

**3. TEXTO DE CORPO −7%.** Founder: *"a fonte padrão de texto poderia diminuir um pouquinho"*
+ *"37 páginas tá muita coisa"*. ⚠️ **Mudança de rumo consciente:** em 2026-07-31 ele havia
pedido o oposto (*"esse texto está muito pequeno... e assim para os demais"*, +10%). O novo
valor fica **entre** o original e o de ontem — títulos e rótulos ficam nos tamanhos novos, só
a leitura corrida cede. Valores anteriores estão nos comentários do CSS.

**4. RÓTULOS ÓRFÃOS (achado meu, no PDF).** Só cabeçalho de seção e do Caminho tinham
`break-after:avoid`; qualquer outro rótulo podia fechar a página com o conteúdo na seguinte —
*"Uma frase para dizer em voz alta"* (`.subhead`) fazia isso. Regra estendida a 18 classes,
levantadas do HTML gerado, não de memória.

**⚠️ Efeito colateral a decidir:** com o corpo menor, o **Caminho 1 deixou de cair em página
própria** e agora divide a folha com a abertura do bloco 7. A regra sempre foi
`.qsec:not(:first-of-type)`, então o Caminho 1 nunca teve quebra forçada — antes ele caía
sozinho por acidente de altura. Visualmente ficou bom, mas a linha da tabela acima diz "cada
Caminho começa em página nova". **Founder decide se força a quebra também no primeiro.**

**Status:** APLICADA — PDF regerado e conferido; `pdf-paginas-vazias` acusa 0 páginas vazias.

### 2026-08-02 — GUARD de página em branco DENTRO da rota de PDF
**Decisão do founder:** *"para gerar o PDF, a gente já tem que ver antes de gerar o PDF para
não ter mais páginas em branco"*. E, quando detectar: **corrige sozinho e entrega**.

**Por que na rota e não só num script:** o defeito depende de ONDE o texto cai, e isso muda
com os dados de cada pessoa — um teste com leitura-modelo nunca cobriria. E a versão
"script que eu rodo" já falhou uma vez: eu tinha o rasterizador e não rodei nas 32 páginas.

**Como:** `lib/pdf/paginas-vazias.mjs` infla o content stream de cada página e conta os
operadores de texto. Medido no Mapa do Ser real: **páginas normais 32 a 210 operadores, a
página em branco exatamente 0** — por isso o critério é `=== 0`, sem limiar chutado.
⛔ **Zero dependência nova** (só o `zlib` do Node). ⚠️ **FAIL-OPEN**: qualquer erro de
parsing devolve `ok:false` e não acusa nada — detector quebrado não pode atrapalhar entrega.

**Fluxo na rota:** confere o CORPO (antes do merge, que é o único pedaço regerável) → se
achar vazia, **regera com `scale` 0,95 → 0,93** (cabe mais por página, o texto reflui, a
órfã desmancha) → se ainda sobrar, **ENTREGA ASSIM MESMO** e loga. Founder descartou
bloquear o download: *"não consigo baixar o PDF"* com o terapeuta na frente do cliente é
pior que uma folha a mais. O retry só acontece se houver folga de tempo (não pode virar 504).
⚠️ **É heurística, não prova** — refluir pode, em tese, criar outra órfã.
⚠️ Descer o `scale` é seguro por construção: o perigo é o TETO (0,97 → modo celular), nunca
o piso; 0,93 foi valor de produção até 31/07.

**Validação (não é opinião):** reintroduzi a regressão do `hr.div` de propósito, o detector
acusou a página 9, e restaurei. Mais 6 testes em `lib/pdf/paginas-vazias.test.ts`.
**⭐ Um deles guarda o modo de falha que MENTE:** o Chromium escreve texto em HEXADECIMAL
(`<002C> Tj`); o regex do protótipo exigia `)` antes do `Tj`, não casava nada e o detector
marcava TODAS as páginas como vazias com total confiança.

**Um detector só:** `scripts/pdf-paginas-vazias.mjs` passou a importar o mesmo módulo. A 1ª
versão rasterizava com Chrome + `sharp` (~2 min); agora são milissegundos, sem browser.
**Status:** APLICADA — build da Vercel verde, `tsc` sem erro fora de teste, 6/6 testes novos.

### 2026-08-02 — DUAS fontes no relatório, via variável (o PDF tinha QUATRO)
**Founder:** *"a fonte tem parte que está em uma fonte, parece que a outra parte está em
outra, e isso precisa ser padronizado."* Estava certo, e era pior do que parecia.

**Medido, não achado:** o documento declarava **cinco** pilhas de `font-family` e o PDF saía
com **quatro famílias embutidas**:

| | fonte | origem |
|---|---|---|
| serifada pretendida | Palatino Linotype | 36 declarações |
| serifada **acidental** | **Georgia** | 5 regras com `Palatino,Georgia,serif` — sem o "Linotype" no início, o Windows não tem fonte chamada só "Palatino" e cai em Georgia (`.cren-txt`, `.secnum`, `.toc-n`, `.toc-t`, `.cf-nome`) |
| sem serifa pretendida | Segoe UI | pilha `ui-sans-serif,system-ui,…` |
| sem serifa **acidental** | **Arial** | `"Inter",sans-serif` em `.say p.pause` — **a Inter não está instalada em lugar nenhum** e o documento não tem um único `@font-face` |

**Decisão:** duas variáveis, `--serif` e `--sans`, no `:root`; **as 42 declarações passaram a
usá-las**. ⛔ Regra nova não declara `font-family` literal.
**Verificação (é objetiva):** as fontes `/BaseFont` embutidas no PDF gerado têm que ser só
essas duas famílias. Depois do fix: Palatino Linotype ×4 pesos + Segoe UI ×4 pesos, nada mais.

**⚠️⚠️ LIMITE QUE EU NÃO TINHA DECLARADO:** meu PDF local é gerado pelo Chrome do **Windows**,
com as fontes do Windows. O Gotenberg roda em **Linux** no Render, e Palatino Linotype e
Segoe UI são fontes da Microsoft que quase certamente **não existem naquele contêiner** — lá
tudo cai no fallback genérico. Ou seja: **meu PDF local confere geometria e paginação com
fidelidade, mas NÃO confere tipografia.** Quando eu disse "conferi o PDF" nos dias anteriores,
isso nunca incluiu qual fonte de fato aparece em produção.
**Consequência:** a padronização acima é correta em qualquer plataforma, mas só um
`@font-face` com a fonte embarcada garante que o PDF de produção use a fonte pretendida.
**PENDENTE — decisão do founder:** embarcar fonte exige fonte com licença para isso, e
Palatino Linotype e Segoe UI são proprietárias da Microsoft. Trocar por uma serifada aberta
equivalente é decisão de marca (a LP usa Fraunces + Raleway — já divergente do relatório).

### 2026-08-02 — Mapa emocional menor no PDF
**Founder:** *"o mapa emocional no PDF a fonte está muito grande, pode diminuir uns dois
pontos"* + *"os gráficos também dá uma diminuidazinha, está destoando do resto"*.
Rótulos −2px (`.grouplab` 17→15, `.pl-carga/.pl-resource` 19→17, `.pl-anti` 17→15,
`.pl-shadow` 16,5→14,5, `.pend-desc` 15→13,5). O **gráfico** não tinha override nenhum no
print — herdava a tela (trilho 13px, bolinha 21px) e no papel pesava mais que qualquer outro
elemento; agora trilho 10px e bolinha 17px. ⚠️ Tudo **só no print**; a tela mantém o mockup
aprovado. **Status:** APLICADA — conferido na página 13 do PDF real.

### 2026-08-02 — FONTES EMBARCADAS no PDF (e o que produção usava de verdade)
**Founder:** *"vamos padronizar na fonte do nosso relatório"* + *"acesse o PDF, baixe o PDF,
e olha no PDF que fonte que tá"*.

**⭐ MEDIDO EM PRODUÇÃO, não suposto.** Baixei o PDF pela rota real (sessão da conta do
founder via admin API, mesma técnica do `gen-magiclink.mjs`) e li as fontes embutidas:

| | desenhado | **o que produção usava** |
|---|---|---|
| serifada | Palatino Linotype | **Liberation Serif** (clone da Times) |
| sem serifa | Segoe UI | **Noto Sans** |
| `→` e `●` | — | Liberation Sans |

**NENHUMA** das fontes do desenho existe no contêiner Linux do Gotenberg. O cliente recebia
*Times + Noto Sans* — par que briga — e não o *Palatino + Segoe UI* aprovado. O "fontes
diferentes" que o founder viu era isso, não a seta.

**Decisão:** embarcar as fontes em **base64 dentro do HTML**. ⛔ Não por URL: se o Gotenberg
falhasse ao buscar, cairia no fallback CALADO — o mesmo modo de falha que estamos matando.
- **Inter** (SIL OFL) no lugar da Segoe UI — já era a intenção do CSS original.
- **TeX Gyre Pagella** (GUST Font License), clone livre da Palatino, no lugar da Palatino
  Linotype. ⛔ Palatino Linotype e Segoe UI são da Microsoft e **não podem** ser embarcadas.
- Capa, cabeçalho e rodapé recebem o mesmo tratamento — senão ficariam numa fonte e o corpo
  em outra **dentro do mesmo PDF**. A troca é feita na rota por string, não em
  `REPORT_FONTS`, porque mudar o token mexeria no Dossiê e na tela do terapeuta.
- 9 faces · 213 KB de fonte · gerado por `scripts/gerar-fontes-embutidas.mjs`.

**⚠️ Sobra 1 glifo:** a seta `→` (U+2192) não existe nem na Inter nem na Pagella (subconjunto
latin), então continua caindo numa fonte do sistema. A bolinha `●` foi resolvida **desenhando
um círculo em CSS** em vez de usar o caractere — assim sai igual em qualquer máquina.
Resolver a seta exigiria gerar um subconjunto de fonte só pra ela.

**⭐ O PDF local passou a ser fiel também na tipografia:** `scripts/_render-para-pdf.mjs`
injeta as mesmas fontes. Antes eu conferia com as fontes do Windows e produção usava outras —
o furo declarado na entrada anterior.

### 2026-08-02 — TRAVA da crase (5ª vez) e da font-family literal
Errei a **quinta** crase em comentário CSS dentro da template string (`.section-body`).
Reconhecer o padrão não bastou. `scripts/smoke-render.mjs` agora falha ANTES do import, com
**linha e trecho**, em vez do enigmático `ReferenceError: body is not defined`. E falha
também se aparecer `font-family` literal no HTML (tem que ser `var(--serif)`/`var(--sans)`).
Ambas as travas foram **provadas disparando** antes de eu confiar nelas.

### 2026-08-02 — "Em poucas palavras" com o tamanho e a cor do relatório antigo
**Founder:** *"em poucas palavras, quero que você deixe exatamente como era o nosso relatório
antigo, no tamanho e cor também"*. Valores tirados do DOSSIÊ (`.section-body` em
`report-print-document.tsx`): **13,5pt (18px), line-height 1,9, cor #2A2A2A**. Antes era
16,5px em #26403f.
**⚠️ Escopo:** só a prosa. As **perguntas** (`.maieutica`) ficaram no teal atual — o relatório
antigo não tem pergunta maiêutica no bloco 1, então não existe "como era" para elas. Se o
founder quiser, é trocar o `color` de uma regra.

### 2026-08-02 — Título do bloco 5: eu tinha errado o alvo
O founder criticou *"onde você está"* em 31/07 lendo a página em voz alta (*"tá lá, 5, mapa
emocional, onde você está?"*). Eu troquei a **legenda do gráfico**; o **título H2** continuou
`Onde você está — e pra onde dá pra ir`, em corpo muito maior. Agora:
**`O que pesa — e pra onde afrouxa`**, no mesmo vocabulário aprovado.
**Lição:** quando ele lê a tela em voz alta, o alvo é o que está ESCRITO ali, no maior corpo —
não o detalhe que eu escolhi olhar.

### 2026-08-02 — Densidade: caixas da linha do tempo menores + fim da seção-por-página
**1. Caixas da linha do tempo.** Founder: *"aqueles quadradões tomam muito espaço, poderiam
ser menores — pode até diminuir o texto, mas essas caixas azuis diminuírem"*. Não havia
**nenhum** ajuste de impressão para elas: usavam os recuos generosos da tela (padding 20/22,
`.mrow` 14,5px, `.key .q` 16,5px). Agora padding 12/16, `.mrow` 13px, `.key .q` 14px.
⚠️ A regra de 1 coluna do `.mrow` é de CELULAR (≤560px) e nunca valeu no papel.
**Resultado:** duas caixas inteiras por página; antes uma ocupava quase a folha.

**2. ⚠️ SUPERA a decisão de 2026-07-31 "cada seção começa em página nova" (`bfa6e96`).**
Founder: *"tem um espação nessa página que poderia colocar o diagrama de mente, coração e
corpo… a gente está tendo muito espaço em branco, isso tem que ser otimizado, não pode ficar
desse jeito. Questões que é importante começar numa página, tudo bem, mas aqui não faz
sentido."*
**Medido antes de mexer:** a regra custava **2 folhas** e deixava a página do índice com 2/3
em branco. Com `break-before:auto`, o bloco 2 sobe para a página do índice — que é exatamente
o que ele pediu. **31 → 30 páginas** (com a compactação da linha do tempo junto).
**⛔ O que NÃO mudou:** `.qsec:not(:first-of-type){break-before:page}` — cada **Caminho**
continua começando em página nova. E os `break-inside:avoid` dos blocos coesos continuam,
então nada se parte no meio; a diferença é só que a seção seguinte aproveita a folha.
**Como reverter:** uma linha, trocar `break-before:auto` de volta por `page`.

### 2026-08-03 — BLOCO 7 "Repertório de suporte" no ar
**Decisão do founder:** copiar o §7 do dossiê para o Mapa do Ser, entre crenças e perguntas;
**o cliente vê**, com moldura de investigação; MTC/Ayurveda como **camada de leitura**.

**⭐ O bloco é 100% DETERMINÍSTICO — o Sonnet não escreve nada dele.** Lista e textos vêm do
motor + `lastro/tabela-carencias-LASTRO.md`. Três ganhos: (1) **não há como fabricar
carência**; (2) **leituras JÁ GERADAS ganham o bloco sem regerar** — o founder baixa o PDF de
uma leitura antiga e o bloco está lá; (3) **nenhuma calibração de Sonnet** foi necessária.
⇒ o markdown continua com 7 blocos; a exibição tem 8. `diDe()` faz a ponte.

**Ordenação por CONVERGÊNCIA** (nº de achados independentes que sustentam o nutriente), a
mesma régua da corroboração das crenças. Na leitura real do founder: complexo B e magnésio
com 4 sinais cada, zinco/fibras/água com 2.

**Guardrails implementados em CÓDIGO, não só em comentário:**
- sem dose, frequência, duração ou nome de exame — nada disso existe na tabela;
- **sem a FORMA do nutriente** ("magnésio", nunca "magnésio glicinato") — é a única
  divergência deliberada do dossiê, porque este bloco vai ao CLIENTE e forma específica
  funciona como ordem de compra;
- **o bloco SOME inteiro** se nenhum achado sustentar suporte. Sair curto é honesto;
- **TETO de 4 nos suportes de sinal único** — sem ele saíam 8 isolados junto com 4
  convergentes, e lista longa de "pode ser isso, pode ser aquilo" é o formato que serve pra
  qualquer pessoa (alarme Forer). Os convergentes não têm teto. ⚠️ O que é cortado vai pro
  log, não some calado;
- **MTC/Ayurveda NÃO são nomeadas.** As 9 regras absolutas proíbem citar escola no documento.
  "Deficiência de Qi do Baço" virou "o que você não digere — comida ou acontecimento — o
  corpo trata no mesmo lugar". A tradição informa a frase; o nome dela fica no lastro.

**Dois defeitos de duplicação pegos ANTES de subir** (mesma família dos rótulos duplicados):
1. o "porquê" vinha do CAMPO, então complexo B e magnésio — ambos sustentados pelo fígado —
   saíam com **a mesma frase**. Criada uma segunda tabela, **porquê por NUTRIENTE**.
2. a "leitura" simbólica é do campo, e vários nutrientes dividem o campo → repetia dentro dos
   itens. Saiu dos itens e virou uma lista **deduplicada** no fim do bloco.

**Status:** APLICADA. Build verde, 0 páginas vazias, 31 páginas, linha de base de testes
inalterada. ⏳ Falta o veredito do founder em prod.

### 2026-08-03 — EXCEÇÃO: MTC e Ayurveda passam a ser NOMEADAS ao cliente
**Founder:** *"a gente pode abrir uma exceção para a MTC e a Ayurveda"*.
⚠️ **SUPERA parcialmente as 9 regras absolutas** (`feedback_iris_codex_seven_rules`), que
proíbem citar autor/escola no documento. A regra continua valendo para **todo o resto**; a
exceção é **só para Medicina Tradicional Chinesa e Ayurveda**, e **só no bloco 7**.
⛔ Continua proibido erva, fórmula, prática e dose — elas explicam o PADRÃO, nada mais.

19 campos ganharam texto atribuído, na voz do cliente. Sai assim:
`MEDICINA TRADICIONAL CHINESA — quando a energia do fígado estagna, o impulso que não saiu
vira calor guardado` · `AYURVEDA — é território do calor: excesso aqui aparece como pavio curto`.

**Efeito colateral bom:** a linha neutra que eu tinha escrito existia SÓ porque não dava pra
nomear a escola — era paráfrase da frase da MTC. Com a exceção aberta virou repetição, então
ela some quando há atribuição. **Terceira duplicação do mesmo tipo pega neste bloco.**
**Status:** APLICADA.

**Onde o bloco aparece (o founder procurou no lugar errado):** o relatório é renderizado pelo
MESMO módulo na tela e no PDF, então o bloco está nos dois — em `/leituras/<id>` (a página
mostra o relatório inteiro embaixo) e em `/leituras/<id>/emocional`. **Não precisa regerar
leitura:** o bloco é determinístico e deriva do markdown já guardado.

### 2026-08-03 — Bloco 7 reformulado + BUG do índice recursivo
**Founder, três coisas:**
1. *"'O que as tradições leem no mesmo lugar' eu não achei necessária"* → seção **removida**.
   A atribuição virou **nota de BASE no topo**, uma vez: *"Base: os achados desta leitura de
   íris, interpretados à luz da nutrição, da Medicina Tradicional Chinesa e do Ayurveda."*
   ⚠️ Os textos por campo continuam no lastro, prontos, se voltar a fazer falta.
2. *"não achei interessante deixar como sinal… do que mais é requerido para o menos"* → o chip
   **"N sinais" SAIU**. A ordem (convergência) continua mandando, e a **barra da esquerda**
   codifica a força. Grupos renomeados: **"O que a leitura mais sugere"** / **"O que a leitura
   sugere de forma pontual"**. ⚠️ Os nomes são meus — ele pediu "um termo legal" e não travou
   qual. Evitei "carência" de propósito: afirmaria falta, e a régua é hipótese.
3. Moldura: **não é diagnóstico** + **sugere investigação** — aprovadas por ele, mantidas.

### 🐛 2026-08-03 — ÍNDICE RECURSIVO na página da leitura
**Founder:** *"cliquei no repertório de suporte e o link abriu uma página dentro dessa página,
parece recursivo"*. Estava certo, e valia para **todos** os links do índice.
**Causa:** em `/leituras/<id>` o relatório é embutido num `<iframe srcDoc>` — e documento
carregado por `srcDoc` **não tem URL própria**, herda a do PAI. Então `href="#b7"` resolvia
para `/leituras/<id>#b7` e o iframe carregava a página da leitura dentro de si.
**Por que não dá pra consertar com script:** o sandbox é `allow-same-origin` **sem**
`allow-scripts`, de propósito (o HTML vem de saída de modelo).
**Fix:** `MapaDoSerEmbed` remove os `href="#…"` só na cópia embutida. O índice continua
listando, sem ser clicável ali. ✅ Em `/leituras/<id>/emocional` (injeção direta, URL própria)
e no PDF os links seguem funcionando.
**Status:** APLICADA.

### 2026-08-03 — Complexo B: agrega, mas diz QUAIS Bs
**Founder:** *"ali é o complexo B? ou tem algumas Bs específicas? a gente poderia melhorar"*.
Sim — e a fisiologia é bem específica por órgão: estômago→**B12** (fator intrínseco),
adrenal→**B5**, boca/garganta→**B2**, cérebro e fígado→**B9+B12**, nervoso→**B1/B6/B12**.

**⚠️ Mas quebrar em vitaminas separadas CUSTARIA o sinal mais forte do bloco.** Medido na
leitura real do founder: "complexo B" tem **4 achados independentes** porque AGREGA. Quebrado
em B12/B5/B2 viram três entradas de 1 achado cada — todas caindo no grupo "de forma pontual".
Seria **perder convergência por excesso de precisão**.

**Decisão (proposta minha, aprovada por ele):** a entrada continua agregando e ganha uma linha
`Nesta leitura, sobretudo B9 e B12.`, montada a partir dos campos que de fato dispararam.
⛔ Especifica qual VITAMINA, nunca a FORMA (B12, não "metilcobalamina") — a regra da forma,
que existe porque este bloco vai ao cliente, continua valendo.
**Status:** APLICADA.

### 2026-08-03 — Índice do relatório volta a navegar: iframe com URL própria
**Founder:** *"eu clico e não vai para lugar nenhum, deveria descer na página"*.
Meu conserto anterior (remover os `href="#…"` da cópia embutida) matou a recursão **e a
navegação junto** — meia solução.

**Conserto inteiro:** o iframe passou de `srcDoc` para **`src` com URL real**
(`/leituras/<id>/emocional/documento`, rota nova que devolve o documento como `text/html`).
Com URL própria o documento tem base própria, e `#b7` volta a ser âncora interna: **rola
dentro do quadro, sem recarregar nada**. Os links do índice foram restaurados.
- mesma origem de propósito — a página pai lê `contentDocument` para medir a altura;
- `sandbox` removido: `allow-same-origin` sozinho já dava acesso ao documento, e o documento
  não tem script nenhum (é gerado pelo nosso render, com escape em todo texto de modelo);
- o render na página da leitura **continua rodando**, mas só para SABER se o markdown ainda
  casa com o desenho — falhando, mostra o aviso em vez de um quadro vazio.

**Lição:** consertei o sintoma (recursão) sem devolver a função (navegar). Meia solução passa
no teste de "o bug sumiu" e falha no de "a coisa funciona".
**Status:** APLICADA.

### 🐛 2026-08-03 — Eu apaguei as figuras do transgeracional com um regex largo
**Founder:** *"no 4, heranças transgeracionais, a imagem sumiu"*.
**Causa: minha.** Para matar a recursão de âncora dentro do iframe (`08a6d6f`) eu removia
`href="#..."` do HTML embutido. Só que o diagrama transgeracional desenha os pictogramas com
**33 `<use href="#g-adulto">`** — SVG referencia símbolo por âncora. O regex apagou todos e a
árvore de gerações inteira sumiu da tela.
**Já estava consertado** por acidente: `045138a` (o conserto do índice) trocou `srcDoc` por
URL própria e eliminou o `semAncoras`.
**Trava adicionada** em `scripts/smoke-render.mjs`: falha se houver menos de 20
`<use href="#...">` no HTML. Provada disparando contra o regex antigo.
**Lição:** regex largo em cima de HTML acerta o que você não estava mirando. `href="#"` não é
só link de âncora — em SVG é referência de símbolo.
**Status:** APLICADA.

### 2026-08-03 — "Complete seu cadastro" passa a DIZER o que falta
**Caso real:** a Juliana não conseguia acessar. Investigado: conta saudável, e-mail
confirmado, **trial ativo com 1 leitura**. O que travava era o **gate de perfil completo** —
faltavam `cep`, `address_number`, `city` e `state`. O cadastro inicial coleta telefone,
especialidades e CPF; **o endereço só é pedido em `/perfil/completar`**, e ela não concluiu.
**Não era só ela:** 2 de 8 contas recentes estavam paradas com exatamente os mesmos 4 campos.

**O defeito de produto:** o gate SABIA o que faltava (`missing: ['address']`) e a tela não
mostrava — repetia "faltam alguns dados" e reexibia o formulário inteiro. Quem devia um
campo era devolvido a cada navegação sem descobrir qual, e concluía que o cadastro não salva.
**Fix:** `describeGaps()` + banner nomeando o que falta, na voz de quem lê
("Falta só: o endereço (CEP, número, cidade e estado)").

**Verificado e SEM mudança necessária — CEP que o ViaCEP não acha JÁ é aceito** (founder
perguntou): no formulário a mensagem é aviso e não bloqueia o envio; no servidor a validação
é `cepIsValidBR`, que checa **só o formato de 8 dígitos** e nunca consulta o ViaCEP. CEP novo
ou rural passa, desde que cidade e estado sejam digitados.

**Também descartado como causa (medido, não suposto):** envio de e-mail. Disparei OTP para a
conta do founder, o Supabase aceitou e o e-mail chegou — para ele e para ela.
**Status:** APLICADA. ⏳ Pendente decidir se o endereço passa a ser pedido no cadastro inicial,
que eliminaria a classe do problema em vez de sinalizá-la.

### 2026-08-03 — Bloco 8: adaptógenos SAEM, título travado, e o que a revisão do founder pegou
**Adaptógenos removidos** (founder: *"pode tirar"*). Era a única categoria com **interação
farmacológica real**, já restrita ao terapeuta, e entregava **uma linha**. O peso regulatório
não compensava. ⚠️ A tabela continua no lastro se um dia voltar.
**Título travado:** `Pequenas mudanças que cabem no seu dia` — escolhido entre 3 opções.
⚠️ Contraponto registrado: é o mais longo (pode quebrar em 2 linhas no celular) e o único que
promete resultado, então é também o que mais se aproxima de conselho. Founder escolheu ciente.

**⚠️⚠️ O QUE ESTA REVISÃO ENSINOU — eu declarei a fonte resolvida e não estava.**
Founder: *"essa fonte tá diferente da nossa. Eu já pedi pra corrigir e não foi corrigido."*
Ele estava certo. Depois de embarcar Pagella+Inter eu **introduzi três coisas novas** que
puxavam fonte de fora, e não reconferi:
- a seta `→` (U+2192) — não existe em nenhuma das duas → puxava Segoe UI/Liberation Sans.
  Agora é **desenhada em CSS** (borda girada 45°); na prosa do método virou ponto médio.
- os símbolos **⚠️ e ◆ que eu mesmo escrevi** → puxavam **Cambria Math**.
**Lição:** "resolvido" numa medição não sobrevive às minhas próprias edições seguintes. A
verificação (ler os `/BaseFont` do PDF) tem que rodar a CADA entrega, não uma vez.

**Texto interno vazou para o documento do cliente** (bug meu, do bloco 8): a anotação da
camomila — *"só quando o eixo sustenta, é o default mais batido da categoria"* — era nota de
lastro **para mim**. Idem o hedge da ashwagandha e um "não vai no documento do cliente".
**Regra:** o campo `det` do lastro é TEXTO DE PRODUTO. Anotação minha vai em comentário, nunca
na coluna que o render emite.

**Espaço entre seções** (founder: *"tem que dar um espaço de saltar duas linhas, e pra todos"*)
— efeito colateral de eu ter tirado a quebra de página por seção: com `hr.div{display:none}` a
margem sumiu junto e as seções colaram. Agora o `<hr>` é **espaçador invisível**
(`border:0;height:0;margin:52px`) com `break-avoid` dos dois lados — o ar volta sem ele poder
ganhar uma folha inteira de novo (bug de 01/08).

**Crenças repetia o título** (rótulo e h2 eram a mesma frase, mesmo defeito já corrigido no
bloco 7). H2 virou *"As regras que você repete sem perceber"* — frase do próprio prompt do
bloco. **Status:** APLICADA.

### 2026-08-04 — TRÊS teses aprovadas: D5, D3 e a "falta de instrumento"
**Decisão do founder:** *"gostei dessa terceira tese, então a gente vai trabalhar a D3, D5 e a terceira
tese."* Resolve o contraponto que a Nefertiti deixou em aberto em `CAMPANHAS-3-LPS.md` §A.0: vale a
**leitura ampla** da regra de aterrissagem — o gancho pode ser do tamanho de uma página, desde que o
pouso seja em D5 ou D3. A "falta de instrumento" (selo 🟢 forte no estudo, fora da numeração D1–D5)
é tese legítima de landing e pousa em D3.

| | Rota | Tese | Momento |
|---|---|---|---|
| 1 · A segunda porta | `/` (existe) | Você é refém do que o cliente consegue trazer | **dentro** da sessão |
| 2 · O objeto de prova | `/prova` (existe) | O seu melhor trabalho é invisível | **depois** da sessão |
| 3 · A direção na mão | `/sessao` (a construir) | A sessão começa do zero toda vez | **antes** da sessão |

**Princípio do founder que sustenta as três, verbatim:** *"um terapeuta compra para resolver uma dor
DELE, não a dor do cliente."* Isso confirma e reforça a ordem canônica de §3.3 — a reação do cliente
é **prova**, nunca abertura.
**⏳ Em aberto na mesma conversa:** se a copy pode usar argumento econômico (o founder disse *"mostrar
que ele vai ganhar dinheiro com o Iris Codex"*), o que hoje colide com a trava de vocabulário de renda.
Ver a entrada seguinte quando decidido.
**Status:** DECIDIDA — arquitetura em `Estatégia comercial e mkt/CAMPANHAS-3-LPS.md`. `/sessao` a construir.
**🔴 Bloqueio anterior a qualquer campanha:** `apps/web` não tem instrumentação (sem UTM, sem pixel, sem
campo de origem no signup). Sem isso, três landings produzem três resultados ilegíveis. Ver §D.1.

### 2026-08-10 — E-mail repetido no link de convite: **reaproveita, nunca nega**
**O caso (produção, 09/08 — Daniel Negri).** Ele abriu o link de convite do terapeuta, digitou o
e-mail com que **já era cliente daquele mesmo terapeuta** (cadastro de 18/07, 1 leitura pronta) e
recebeu na tela o erro cru do Postgres: `duplicate key value violates unique constraint
"clients_therapist_email_unique"`. Sem saída nenhuma. Na mesma manhã, criando a conta de terapeuta
dele, o botão travou em **"Verificando..."** para sempre — a conta *tinha sido criada* (11:53:57) e
a sessão estava ativa; quem travou foi a tela.

**Decisão do founder, verbatim:** *"Um e-mail como terapeuta não pode negar, por exemplo, quando ele
coloca o e-mail, quando ele vai fazer o exame, quando outro terapeuta manda um link para ele."*
Escolhida a opção **reaproveitar e seguir**: mesmo e-mail + mesmo terapeuta = mesma pessoa, então o
cadastro existente é reusado e o cliente vai direto para a captura. Campos em branco são completados
com o que ele digitou; **nada que o terapeuta já preencheu é sobrescrito**; observação nova é anexada.

**Contraponto registrado (o founder decidiu assumir):** quem tiver o link em mãos e digitar o e-mail
de *outro* cliente do mesmo terapeuta cai na captura daquele cadastro — as fotos entrariam no
prontuário errado. As alternativas eram conferir a data de nascimento antes de reusar (barraria
cliente legítimo com cadastro antigo incompleto) ou só trocar por uma mensagem amigável (continuaria
negando). Prevaleceu não negar.

**Regra que fica:** o path público do convite **nunca** devolve `error.message` do Postgres para a
tela do cliente final. E **nada depois de um OTP válido pode impedir a navegação** — as ações
pós-verificação (`ensureTrialStartedAction`, `markTherapistInviteUsedAction`) são nice-to-have e
agora vivem dentro de `try/catch`. A migration 0050 já previa a queda de rede nessa ação; o que
ninguém tratou foi o lado da UI, que ficava preso no spinner.
**Status:** APLICADA — `app/actions/invites.ts`, `app/(auth)/signup/page.tsx`,
`app/convite-terapeuta/[token]/TherapistInviteSignupForm.tsx`; regressão coberta em
`app/actions/invites.test.ts`.

### 2026-08-11 — Lateralidade: "right iris" do Jensen = **olho DIREITO do cliente** = OD
**Pergunta aberta desde 26/07**, registrada como ressalva na `AUDITORIA-GLOSSARIO-TOPOGRAFIA.md`:
*"A convenção de lado NÃO está resolvida. Jensen escreve 'right iris'/'left iris'. O glossário usa
OD/OE. **Isto precisa da confirmação do founder** — ela decide metade dos vereditos de lateralidade."*

**Decisão do founder, verbatim:** *"com certeza é olho direito do cliente, tá tranquilo isso aí."*

⇒ `right iris` (Jensen) = `OD` (glossário) = `eye: 'right'` (captura) = olho direito **do cliente**,
anatômico. As três convenções são a mesma, e as afirmações posicionais do livro podem ser comparadas
DIRETO com o glossário, sem espelhamento.

**Por que travava:** metade dos vereditos da auditoria de topografia dependia disso. Tabela de
lateralidade errada é pior que nenhuma — erra com precisão e confiança, e o erro entra igual em todas
as leituras.

**Status:** APLICADA no registro; destrava a tabela de-para do redesenho Stage 1a/1b
(`docs/TOPOGRAFIA-JENSEN-2004.md`). Restam 4 pendências lá: validar setor a setor com zoom, extrair a
íris esquerda (não é espelho — o gráfico põe SPLEEN à esquerda onde a direita tem LIVER), escola da
linha do tempo, e `vaso_transversal`.

### 2026-08-12 — Nasal/temporal: o parágrafo do `stage1-scan.md` estava **INVERTIDO** nos dois olhos
**Não é a mesma pergunta de 11/08.** Aquela resolveu *qual olho* é "right iris" (= olho direito do
cliente) e continua valendo. Esta é outra: **onde fica 3h dentro da imagem**. Ficou aberta, ninguém
tinha notado, e o prompt afirmava o oposto do gráfico oficial:

    antes:  OD → 9h = NASAL · 3h = TEMPORAL   |   OE → 3h = NASAL · 9h = TEMPORAL
    agora:  OD → 3h = NASAL · 9h = TEMPORAL   |   OE → 9h = NASAL · 3h = TEMPORAL

**Prova, em duas fontes independentes:**
1. **Gráfico canônico** (`livros/551115800-iridology-chart.pdf`, Jensen/Ellen Jensen 2004,
   rasterizado a 300dpi). Os rótulos anatômicos externos decidem sozinhos, porque nariz é nasal e
   orelha é temporal por definição: na íris **R**, FACE · NOSE · EYE · JAW estão à **direita** da
   imagem e NECK · OUT/MID/INNER EAR · MASTOID · SHOULDER à esquerda. Na íris **L**, o espelho exato.
2. **Foto real** (`be53fde0`, olho esquerdo): a carúncula — o canto nasal — está à **esquerda** da
   imagem; o canto direito é o externo, com cílios longos e ângulo agudo. ⇒ nasal em ~9h no OE.

⭐ **O que NÃO estava errado: as horas do glossário.** Conferidas uma a uma contra o gráfico e todas
batem — `tireoide ~3h OD / ~9h OE` (THYROID em 3h na R, 9h na L) · `coracao ~2-3h OE` (HEART com a
AORTA em ~2-3h na L) · `pulmoes ~3h OE / ~9h OD`. O endereçamento sempre esteve certo; **só a legenda
estava trocada**. Nenhuma zona foi mexida.

**Por que importava:** o prompt manda usar nasal/temporal como CHECAGEM obrigatória antes de
classificar ("Em que olho o sinal está? Essa hora cai na zona canônica?"). Com a régua invertida, um
achado localizado corretamente podia ser descartado ou reatribuído na conferência. Sintoma medido: na
**mesma leitura**, execuções diferentes descreveram o mesmo sinal como *"lado temporal de OD (~3h)"* e
*"lado nasal (9h) de OD"*.

**Status:** APLICADA — `apps/web/prompts/stage1-scan.md`, §Convenção de coordenadas horárias, mais
uma "âncora de verificação" com os rótulos do gráfico para o modelo se corrigir sozinho. ⚠️ Só afeta
leituras NOVAS: exames já gravados não reprocessam, e por isso o golden set continua 60/60.

### 2026-08-12 — Peso do achado `indeterminada` no motor: **fica como está** (não mexer)
**Founder:** *"vamos ficar como estávamos… estava funcionando muito bem."*

Proposta testada e **descartada**: achado com `natureza_da_carga='indeterminada'` entrar a meio
peso, e `motivo='limitacao_tecnica'` não entrar. Hoje ele entra com peso cheio (`intensidade^γ`),
igual a qualquer outro.

**O que motivou a proposta:** 13% dos achados saem `indeterminada` (30 de 225, medidos em 30
execuções de Stage 1 sobre 5 leituras). O Stage 2 roteia `limitacao_tecnica` para "campos
não-conclusivos" — nota fria, bloqueada das outras seções — mas o motor os conta na agulha.
O texto exclui e o gráfico conta. Era também a porta do falso positivo do fígado: 5 de 17
declarações diziam *"impossível confirmar ou descartar"* e mesmo assim pesavam.

**Por que foi descartada — medido, não achismo.** Aplicada, deslocou **49 das 58** leituras, e as
três médias subiram: mente **+4,6** · coração **+1,0** · corpo **+2,2**. Nenhuma desceu. Pior caso
(`69b472aa`): corpo **26 → 68**. Os dois únicos achados do corpo eram ilegíveis, saíram, o centro
ficou com `t=0` e aí bateu a **zona quieta** (`motor-calc.mjs:509`, centro sem tensão ganha +1,0 de
livre) — o corpo foi tratado como *varrido e limpo* justamente porque ninguém conseguiu varrer.
⇒ Trocaria um viés por outro, e o outro é pior: *"não consegui ver"* virando *"está livre"* é a
mesma coisa que já incomoda nos preservados.

**Contraponto registrado (fica aberto):** a incoerência texto × gráfico continua de pé, e o
diagnóstico segue válido. Se um dia for reaberto, o caminho não é descartar — é fazer a incerteza
puxar a agulha para o **meio**, aumentando o `α` daquele centro (a agulha é `(l+α)/(t+l+2α)`, então
mais incerteza aproxima de 50% em vez de aproximar de "livre"). ⚠️ `α` é calibrado contra o mockup
aprovado (~26/83/21), então exige medição.

**Status:** REVERTIDA — `motor-calc.mjs` intocado, golden 58/58 idênticas (as 2 restantes são
capturas novas que entraram na janela).

---

## 2026-08-13 — ⛔ REPROVADO: "o prompt escolhe qual emoção é a mais provável"

**Quem decidiu:** founder (propôs a hipótese e autorizou o A/B de 20 leituras).
**Status:** REPROVADO por medição. Não sobe. Código removido do `serialize.mjs`.

**A hipótese.** O motor escolhe a emoção de cada campo por **posição na tabela de lastro**, não
por evidência — o achado da íris diz *onde* e *quanto*, nunca *qual das emoções daquele campo*.
A ideia era oferecer ao modelo, no bloco B, as emoções **irmãs** do mesmo campo, para ele decidir
pela `descricao_visual` (que já recebe no bloco A) em vez de aceitar a primeira da lista.

**O teste.** 20 leituras reais de produção, cada uma nos dois braços — controle (bloco B como está
no ar) e tratamento (bloco B + o menu). 40 gerações, **US$ 9,10**, zero erros. Métrica: sobreposição
de vocabulário entre os relatórios **dentro** de cada braço.

| | sobreposição |
|---|---|
| controle | 40,4% |
| tratamento | 40,2% |

**Por que isso é "não funcionou" e não "quase".** A diferença de 0,2 p.p. está dentro do ruído.
A prova está na **similaridade cruzada**: a mesma leitura, nos dois braços, deu 44,5% de
sobreposição entre si — ou seja, o modelo **usou** o menu (o texto mudou), mas a variação que o
menu introduz tem a mesma magnitude da variação normal de duas execuções iguais. Ele trocou uma
palavra por outra, não trocou de leitura.

**Contraponto registrado:** o problema que motivou a hipótese **continua de pé** — a escolha da
emoção segue sendo posicional, e isso é arbitrariedade real dentro do motor. O que o teste mata é
*esta solução*, não o problema. Um segundo round plausível seria deixar o motor escolher pelo
**nível do pêndulo** em vez da posição; não foi testado. ⚠️ Antes de tentar de novo, ler
`_motor-lab/lastro/AUDITORIA-motor-2026-08-13.md` §6 — o experimento custa ~US$ 9 e já foi pago
uma vez.

---

## 2026-08-13 — teto de saída sobe de 24.000 para 32.000 tokens

**Quem decidiu:** founder.
**Status:** APLICADA.

**O que estava acontecendo.** `MAX_TOKENS = 24000` em `lib/emocional/gerar.ts` é teto rígido: ao
atingir, a API **para no meio da frase**. Medido no A/B: 4 de 40 gerações bateram exatamente
24.000 e terminam truncadas dentro do **bloco 7**, no meio dos Caminhos —
*"...sem precisar controlar o qu"*, *"...s2: Lembre de uma vez rec"*. Em produção real são
**2 de 22 (9%)**. O cliente recebe um documento que acaba no meio de uma pergunta de sessão,
e paga-se o preço cheio por ele.

**Por que 32.000.** As gerações que não truncam param sozinhas entre 15.000 e 23.700 — a mediana
fica perto de 20.000. 32.000 dá folga de ~35% sobre o maior relatório completo já observado sem
abrir espaço para o modelo se alongar: ele para quando termina, não quando pode. Custo: só sobe
nos relatórios que de fato precisavam do espaço; os demais não mudam.

**Contraponto registrado:** o teto é um **sintoma**. A causa é o bloco 7 crescer com o número de
emoções no vocabulário — e hoje o vocabulário cresceu (o teto de 4 por campo saiu no `5783aae`).
Se o truncamento voltar com 32.000, a resposta certa não é 40.000: é limitar o **número de
Caminhos** que o bloco 7 escreve.

---

---

## 2026-08-13 — a escala da carga tem TETO: o máximo é 100%

**Quem decidiu:** founder — *"O máximo é 100%. Não pode dar mais do que 100%, correto?"*
**Status:** APLICADA. Supera a parte da entrada de hoje mais cedo que dizia *"passar de 100% é
legítimo"* — era minha, e estava errada.

**O que o founder lembrou, e estava certo.** Que o I5 tem um **atenuante** de grupo e também um
**agravante** de grupo. São exatamente estes, e ambos existem no código:

| | onde | o quê |
|---|---|---|
| atenuante | `emoCarga[e] += w · DECAY^rank` | a 2ª emoção do campo vale 60% da 1ª, a 3ª 36%… |
| atenuante | `famScore`: `+= w_i · (int_i/5)^2` | irmão fraco na família quase não soma |
| **agravante** | `emoCarga[líder] = max(emoCarga[líder], famScore[domFam])` | **é este que furava o teto** |

**Um ajuste no que foi dito:** um I5 sozinho, sem agravante nenhum, **já dá exatamente 100%** —
`w = 5^γ = 5,873` é o próprio `MAX_ACHADO`. O agravante não é o que o leva a 100%; é o que o
faz **passar** de 100%.

**Medido antes de aplicar.** Dos 495 rótulos das 60 leituras, **13 (2,6%) passavam de 100%**, em
13 leituras distintas. Nos **13**, o `famScore` da família dominante batia exatamente o
percentual — nenhum caso vinha de convergência de campos ou de soma por rank. Máximo: **150%**.

**Por que isso importava mesmo sem o cliente ver.** O percentual não é impresso no documento. Mas
o bloco B do prompt manda a frase literal — o Sonnet chegou a ler *"150% da escala"*. Percentual
de uma escala que passa da escala não é leitura, é vazamento.

**Custo medido:** `normCarga` ganhou `Math.min(1, …)`. **0 rótulos mudam** (os 13 já eram "muito
alta", pois >90%) e **12 agulhas** andam para a direita, todas para a posição 17 — o extremo
passa a ser um ponto só, em vez de espalhado entre as posições 3 e 17.

**Contraponto registrado (fica aberto):** o teto tirou o uso da faixa −33…−48 da régua (posições
2 a 17). O pêndulo mais carregado possível ainda desenha a 17% da borda, e a ponta da régua nunca
é alcançada. Se o founder quiser que 100% desenhe no extremo, o coeficiente da `bipCarga` vai de
27 para 42. ⚠️ Isso recalibra **todas** as agulhas de carga, não só as 12 — por isso não foi
feito junto.

**Nota de processo:** quem pegou isto foi o `golden-set.mjs` com o campo `pendulo`, acrescentado
horas antes na mesma sessão (`652b23f`). Ele acusou as 13 leituras com "(rótulo igual)" — a
deriva de percentual SEM troca de rótulo, que é o caso mais sutil dos três que ele compara. Sem
esse campo o gate teria dito "60 idênticas".

---

---

## 2026-08-13 — o que o exame NÃO CONSEGUIU VER não vira emoção (+ a 5ª faixa)

**Quem decidiu:** founder — e mudou de ideia no mesmo dia, depois de ver o custo medido.
**Status:** ⛔ **REVERTIDA, não subiu.** O motor está exatamente como antes; todos os relatórios
continuam mostrando as emoções, inclusive as que nascem de achado não-visto.

**A reversão, e por quê.** As duas regras chegaram a ser construídas e medidas (tudo abaixo é
real). O founder autorizou aplicar aceitando o custo (*"vamos com a 1"*) — mas em seguida pediu
para testar a mudança irmã no Stage 1, o teste reprovou aquela mudança, e a decisão final foi
manter tudo parado: *"vamos deixar como está... Não vamos subir nada... E deixa mostrando as
emoções"*.

⚠️ **O que fica desta entrada:** a MEDIÇÃO, que continua válida e cara de refazer. Se um dia isto
voltar à mesa, os números abaixo já estão prontos — não repetir o trabalho. O que NÃO vale mais é
o veredito.

### Como chegamos aqui

O founder observou que os valores dos pêndulos pareciam repetitivos entre relatórios e pediu que
a resposta viesse de **cálculo**, não de escolha nossa: *"tem que ser com base num cálculo, não a
gente aqui pensando e determinando como é que é"*.

Medido: o exame entrega **7 informações** por achado e o cálculo usava **1** (a intensidade).
Como a intensidade só tem 5 valores, os pêndulos caíam sempre nos mesmos números, com 5 faixas de
5 pontos completamente vazias na régua.

**Quatro hipóteses testadas em laboratório** (cópia do motor validada contra produção: 0
diferenças antes de qualquer modificação), todas sobre as 60 leituras reais:

| hipótese | valores distintos (base 25) | rótulos que mudam |
|---|---|---|
| `natureza_da_carga` como a spec escreveu | 25 | **0** |
| `natureza_da_carga`, variante mais forte | 32 | **0** |
| confiança puxando a agulha pro meio | 27 | **0** |
| lateralidade (dois olhos × um olho) | 46 | 40 |

As três primeiras são **becos sem saída** e ficam registradas para ninguém refazer. A da
`natureza_da_carga` não funciona por um motivo concreto: dos 4 valores da regra, o único que
abaixaria (`em_reorganizacao_ativa`) **nunca aparece** nos exames reais, e o valor mais comum
depois do `cronica_sustentada` (o `indeterminada`, 27%) a regra nem menciona. A lateralidade
funcionava, e foi **reprovada pelo founder** (*"esse negócio dos dois olhos não ficou legal"*).

### As duas regras aplicadas — nenhuma delas inventada aqui

Ambas já estavam escritas em `_motor-lab/lastro/score-emocoes-SPEC.md` e **nunca foram
construídas**. Mais forte que isso: o **prompt do Stage 2 já mandava as duas** (§ "Display
qualitativo" e § "Nível a partir da intensidade": *"muito alta / alta / média / baixa / **leve**"*
e *"`indeterminada` **não entra**"*). O modelo recebia instrução e dado se contradizendo.

**1. Achado não-visto não gera emoção.** 27% dos achados (118 de 435) vêm com
`natureza_da_carga: indeterminada`, e 115 deles declaram também o `motivo_indeterminacao` — sempre
de visibilidade (midríase tapando a zona, limite técnico da foto). Nenhum achado de outra natureza
traz motivo: o campo significa **"não consegui ler aqui"**, não "não sei datar".

**2. A 5ª faixa ("leve").** 237 das 495 emoções — quase metade — estavam no mesmo balaio "baixa".
Corte em 25%, que separa I1 (17%) de I2 (36%).

### Medições

| | antes | depois |
|---|---|---|
| repetição de emoções entre as 60 leituras (top 5) | 25,5% | **21,5%** |
| agulhas grandes (mente/coração/corpo) | 29 / 63 / 33 | **29 / 63 / 33** |
| leituras sem nenhuma emoção | 0 | **0** |

⚠️ **A variante que descartava o achado inteiro foi medida e REPROVADA:** movia a agulha da mente
18 pontos em média, com salto de 52, e deixava 3 leituras vazias. O achado não-visto **continua
contando** para o centro, o elemento e o bloco 7 — só não entra no leque de emoções.

### O custo, aceito conscientemente

O gráfico é redesenhado a cada visualização; o texto fica salvo. Então relatório antigo não "fica
como está": **26 das 60 mudam**, **16 ficam com buraco** (o texto nomeia uma emoção que o gráfico
não tem mais — 47 pêndulos rejeitados) e **4 trocam a família dominante**.

**Contraponto registrado:** as alternativas eram refazer os 16 (≈US$ 4, mas o cliente que já leu
receberia texto diferente) ou segurar a mudança para a próxima leva. O founder escolheu aplicar,
com a diretriz *"o que já tá feito, deixa feito. Agora a gente vai fazer daqui pra frente, achando
os erros de agora pra corrigir"*.

### ⚠️ Remendo consciente, que fica aberto

Em **3 das 60 leituras, TODO** achado emocional está marcado como não-visto — a pupila dilatada
tapou tudo, e a única coisa legível era o padrão pupilar, que não gera emoção. Aplicar a regra ali
deixaria o relatório **sem nenhuma emoção**. Nessas, a regra não entra e vale o comportamento
antigo.

⛔ Isto **não é a resposta certa**, é um remendo para não gerar relatório vazio. A resposta certa é
uma destas duas, e as duas são decisão de PRODUTO, não de cálculo:
- **(a)** o relatório dizer que as fotos não permitiram ler, oferecendo recaptura;
- **(b)** o gate de captura barrar a midríase antes de virar leitura.

⭐ O fato de fundo continua de pé e é o mais grave desta sessão: **5% das leituras hoje produzem
um relatório emocional inteiro — mapa, crenças, perguntas de sessão — a partir de achados que o
próprio exame declarou que não conseguiu ver.**

---

## 2026-08-13 — ⛔ REPROVADO por medição: avisar o Stage 1 que "a midríase só tapa o meio"

**Quem decidiu:** founder mandou fazer (*"faz isso no Stage 1"*) e mandou testar antes de subir
(*"vamos testar... faça a leitura e compare"*).
**Status:** REPROVADO. Bloco removido de `prompts/stage1-scan.md`. Nada subiu.

**A hipótese.** A midríase dilata a pupila e obscurece o que está encostado nela (colarete, zona
pericentral, eixo pituitário-adrenal), mas **não alcança** a zona ciliar nem a periferia. Medido
nas 60 leituras: em leituras com midríase, 43% dos campos CENTRAIS saem indeterminados contra 18%
dos campos da BORDA — a varredura em geral acerta. Mas em 3 leituras ela desistiu geral e marcou
como ilegíveis até `figado_vesicula` e `sistema_linfatico`. A ideia era dizer isso ao prompt.

**O teste.** A/B honesto: mesmas fotos, mesmo modelo (`claude-sonnet-4-6`), `temperature 0.0`
(determinístico), mesma ferramenta com o enum vindo do glossário VIVO (40 campos — ⚠️ o script
antigo `test-haiku-vs-sonnet-stage1.mjs` tem a lista CHUMBADA e desatualizada, sem `baco` nem
`plexo_solar`; não reusar). Braço "velho" = arquivo atual MENOS o bloco novo, para isolar só esta
mudança e deixar a correção nasal/temporal nos dois lados. 4 leituras × 2 braços, **US$ 1,25**.

**O resultado — a regra fez o CONTRÁRIO do que devia:**

| leitura | achados na BORDA: velho → novo |
|---|---|
| 39689d6d | melhorou (apareceu `figado_vesicula`) |
| c15a0752 | 3 → **2** |
| be53fde0 | 3 → **1** |
| c3841fbf | 3 → **1** |

**1 melhorou, 3 pioraram.** E o que sumiu foi exatamente o que a regra queria salvar: sistema
circulatório, linfático, fígado, tireoide, intestino grosso, adrenal. No lugar entraram campos do
CENTRO. Ou seja: o bloco não aumentou a leitura da periferia, **embaralhou** os achados.

**Alarme falso meu, registrado para calibrar confiança:** na 1ª leitura as intensidades mudaram
muito (pigmento âmbar I5→I2) e eu levantei isso como risco sistêmico. Nas 3 seguintes o achado
mais forte continuou I5 nos dois braços. Era caso isolado — **n=1 não sustentava o alarme**.

⚠️ **Limite do teste, declarado:** as leituras que de fato exibem o defeito (`69b472aa`,
`e46f3b68`, `0a75c429`) **perderam as fotos** para o expurgo de 24h — as linhas de
`reading_images` sobrevivem, os objetos no bucket não. Só deu para testar em leituras sem o
defeito, ou seja, o teste provou que a regra **piora o que estava certo**, não que ela falha em
consertar o que estava errado. Para testar o caso real é preciso pegar uma captura NOVA com
midríase, dentro da janela de 24h.

**O que fica aberto:** o problema original é real (o Stage 1 às vezes desiste de zona que a pupila
não tapa) e **a solução não é instruir no prompt** — isso está medido. Qual é, não se sabe.

---

---

## 2026-08-17 — a repetição do relatório: 5 consertos + a régua dos pêndulos recalibrada

**Origem:** reclamação de CLIENTES REAIS — *"a pessoa lê num bloco, a frase repete em outro bloco,
depois em outro"*. **Quem decidiu:** founder, ao longo do dia.
**Status:** APLICADA.

### O diagnóstico (2 estudos, no repo)
`_motor-lab/lastro/ESTUDO-repeticao-relatorio-2026-08-17.md` (medição) +
`LAUDO-redacao-repeticao-2026-08-17.md` (leitura editorial do Bob, 18 relatórios lidos).

**A causa não era o modelo — era o prompt entregando a frase pronta** com uma lacuna para trocar
(`"o que essa [carga] estava tentando proteger?"`, `"um cantinho já basta"`). Com 4,8 Caminhos por
relatório, a mesma frase saía 5 vezes. Medido nos 25 de produção: `s6` com **67%** de igualdade
interna e **85%** entre clientes; **24 frases literalmente idênticas** em relatórios de pessoas
diferentes (uma delas em 9 clientes).

⭐ **A causa a montante, achada pelo Bob e confirmada no motor:** a lista já vinha duplicada.
Em **58 das 60 leituras (97%)**, 2+ dos cinco primeiros pêndulos são da MESMA FAMÍLIA — o cliente
recebia 5 exercícios para 3 temas. *"Sem deduplicar a lista de origem, reescrever os Caminhos
melhora o texto e não melhora a leitura."*

### Os cinco consertos
1. **Rodízio de ângulos** — o motor manda, por Caminho, um ângulo diferente por movimento, com
   ponto de partida derivado da própria leitura (senão o Caminho 1 de todo cliente saía igual).
2. **Um Caminho por TEMA** — dedup por família, piso 3. O MAPA continua completo (lá a função é painel).
3. **Uma CRENÇA por tema** — mesmo critério. Era o último lugar onde a lista duplicada sobrevivia.
4. **Bloco 2: cada marcador com trabalho próprio** — o ranking dos 3 centros era enunciado **5 vezes**.
5. **Regra do NOME (4-6 vezes)** — founder: *"o nome é importante repetir, mas não tanto. Tem que ter
   bom gosto."* Uma rodada intermediária derrubou de 7 para 2 e o texto esfriou.

### A régua dos pêndulos — coeficiente 27 → 42
**Founder, verbatim:** *"se a régua vai de menos 50 a 50 e o zero no meio, até 48 acho que está ok"*.
Ele viu no relatório dele: a `preocupação` marcava **100% da escala** e a agulha parava na posição 17
— só **66% do caminho** entre o meio e a borda. Lia como "passou do meio", não como "no talo".
⚠️ Isto **supera** a resposta dele de 13/08 (*"deixe assim… nunca no máximo, mas perto do máximo"*):
a implementação de então entregou o "nunca no máximo" e **não** entregou o "perto do máximo".
**Efeito:** 100% → posição 2. As faixas deixam de ser espremidas (`muito alta` de 2,7 → 4,2 pontos).
Verificado nas 495 agulhas: nenhuma fora da régua, nenhuma encostando na borda, faixas em ordem.

### ⚠️ Dois erros MEUS no caminho, medidos e corrigidos — ficam registrados
- **Tirei a AÇÃO do fecho.** Apliquei uma regra que estava parada no working tree (*"nunca prescrever
  tarefa"*) sem medir o custo: os fechos viraram pergunta hipotética e o passo sumiu de **30 em 33**
  para **2 em 29**. O Bob pegou: *"era a única coisa que o cliente levava embora para fazer"*.
  O defeito nunca foi a ação ser ação — era a mesma frase de abertura 5 vezes. **Revertido.**
- **Entupi o TEMPLATE de saída com regras** e a geração saiu **sem os movimentos `s5` e `s7`** em
  todos os Caminhos. O molde mostra a FORMA; as regras vão abaixo dele. **Corrigido e reverificado.**

### ℹ️ Onde o laudo editorial ERROU (registrado para não "consertarem" de novo)
O Bob apontou `"Método somático · Sopro da Origem"` como violação de marca. **NÃO é.** O prompt
autoriza explicitamente (*"marca própria — permitida"*; o checklist diz *"exceto Sopro da Origem"*).
O veto do Sopro da Origem é de **vocabulário** (centelha divina, atravessar) e da **landing page**.

### Medido (3 leituras, tudo aplicado)
| | produção | agora |
|---|---|---|
| subtítulo dos Caminhos | 62% | **17%** |
| dar voz à sensação (`s3`) | 53% | **15%** |
| o sentido (`s6`) | 60% | **20%** |
| tocar no corpo (`s2`) | 55% | **20%** |
| fechos com passo concreto | 12/15 | **8/10** |
| nome da pessoa | 3 a 7 | **5 a 6** |

### 🔴 Segunda passada do laudo — dois BLOQUEIOS achados depois do primeiro commit

O laudo releu a versão consertada e achou duas coisas que **impediam o push**. As duas confirmadas
no material antes de mexer:

**1. Forer LITERAL entre clientes.** A frase *"As pessoas leem você como alguém tranquila, que dá
conta de tudo sem esforço"* — **23 palavras idênticas** — saiu em relatórios de DUAS clientes
diferentes, no marcador cuja função é justamente provar que a leitura é só dela. O prompt não dava
essa frase; o modelo convergiu sozinho a partir de *"o que as pessoas leem errado"*. ⇒ Proibida a
abertura-fórmula; o mal-entendido agora exige cena (quem lê errado, em que situação).

**2. 🔴 O PISO DE 3 DESFAZIA A PRÓPRIA DEDUPLICAÇÃO — bug meu.** Numa leitura com só 2 temas reais,
a dedup devolvia 2 Caminhos e o piso completava o 3º puxando um **sinônimo do 1º** — dois Caminhos
indo para o mesmo destino ("Sossego"), *pior que antes do conserto*. ⇒ **Piso removido.** Quem tem
2 temas recebe 2 Caminhos. Verificado nas 60: **zero leituras com Caminhos da mesma família**
(distribuição: 2 caminhos ×1 · 3 ×12 · 4 ×17 · 5 ×30).

Junto foram travadas mais duas fórmulas que o laudo mediu: *"é a mesma coisa que"* (4 vezes seguidas
no `@RAIZ`, 12 de 12 bullets) limitada a um par; e a **formulação** do `s7` — o motor manda o TIPO de
gesto, mas a frase tem de citar algo concreto DESTA pessoa, senão o modelo converge sozinho (duas
clientes receberam *"a frase que você costuma engolir"* quase palavra por palavra).

**Medido depois (3 leituras novas):** trechos de prosa repetidos entre clientes **28 → 7** (e os 7
restantes são rótulo de estrutura ou a frase-ritual, que é repetição legítima) · *"As pessoas leem
você como"* **2 → 0** · *"é a mesma coisa que"* **8 → 2** · os seis movimentos completos em 100% dos
Caminhos · zero Caminhos da mesma família.

**Onde o laudo ERROU e retirou:** ele mesmo foi à fonte e confirmou que `"Método somático · Sopro da
Origem"` está autorizado (`prompt §8`) — o veto é de **vocabulário**, não de assinatura de método.

⚠️ **CONTINUA ABERTO, e é o que o cliente mais sentiu:** a abertura e o bloco *"Como você funciona
por dentro"* falam das mesmas coisas — **37% antes, 37% depois**. Nenhuma trava de prompt pegou,
porque os dois blocos são legitimamente sobre a mesma pessoa. ⭐ A saída não é instrução: é **dar ao
bloco 2 um eixo próprio**, como a Linha do tempo tem (tempo/idade/cena) — decisão de PRODUTO.
Founder ciente; decidiu subir o que está pronto e tratar isto depois.

**Contraponto registrado:** 2 de 10 fechos ainda saem sem passo, e *"Essa semana"* ainda abre 4 de 10
— o founder viu e decidiu **deixar por ora** (*"acho até ok"*). E a landing promete *"quatro ou cinco
Caminhos"*: com a dedup, 13 de 60 leituras entregam **3**. ⚠️ Ou a copy muda, ou o piso sobe para 4.

---

---

## 2026-08-20 — ⛔ TRÊS TENTATIVAS FALHARAM no eco entre os blocos 1 e 2 — e o que aprendemos

**Status:** REVERTIDAS as três. Guardado só o que se sustentou por medição.

### O problema
O bloco 1 (*"Em poucas palavras"*) e o bloco 2 (*"Como você funciona por dentro"*) falam das mesmas
coisas — **37%** de sobreposição de palavras-conteúdo. É o eco que o cliente descreveu como
*"lê num bloco, repete em outro"*, e acontece na **segunda página**, o que contamina o resto.

### As três tentativas, e por que cada uma falhou
| # | a teoria | a instrução | resultado |
|---|---|---|---|
| 1 | "o modelo repete por descuido" | trava *"cada bloco avança, nenhum reconta"* | **37% → 37%.** Zero efeito. |
| 2 | "o bloco 2 não tem verbo próprio" | bloco 1 = *o que você sente* · bloco 2 = *como as partes agem entre si* | **37% → 40%.** O modelo OBEDECEU (marcas de mecânica 4,0 → 9,3 por relatório) e a sobreposição SUBIU. |
| 3 | "falta a virada" | um centro tem de **corrigir** a impressão do bloco 1, na 1ª frase | a virada saiu em **1 de 3** — a mesma proporção que a produção já tinha por acaso. |

⭐ **Três teorias diferentes, três instruções, zero resultado. Isso é sinal de que o problema NÃO
está no prompt.**

### A explicação que se sustenta (do laudo, com prova no material)
O laudo achou uma leitura em que a sobreposição é ALTA e **não incomoda em nenhuma linha** — porque
ali o bloco 2 **desmente** o bloco 1 (*"sua mente é o lugar mais livre… o problema não nasce aí"*).
⇒ **O que cansa não é reencontrar a palavra; é o bloco 2 CONFIRMAR em vez de VIRAR.**

⛔ **Mas a virada não é escolha de redação — é propriedade do DADO.** Ela só existe quando o centro
que o bloco 1 acusa é justamente o que está **livre**. Quando o dado dá, o modelo faz. Quando não dá,
ele **não inventa** — e é correto que não invente. **Pedimos ao prompt uma coisa que só o motor pode
entregar.**

### O custo de manter, que motivou a reversão
A tentativa 2 transformou o `@CORPO` em diagrama:
> antes: *"o primeiro movimento é se proteger — travar, recuar, ficar de guarda"* (cena, se sente)
> depois: *"o corpo dispara primeiro, a mente entra depois"* (ordem dos módulos)

### ✅ O que FICOU (sustentou-se por medição)
1. **O bloco 1 MOSTRA, não explica** — proibida cadeia causal de 3 elos e conector de mecanismo no
   `@MICRO`. Se o bloco 1 já explica o mecanismo, o bloco 2 fica sem ter o que dizer.
2. **`@CORPO` e `@TENSAO`: cena, não diagrama** — a guarda contra o fluxograma fica, mesmo sem a causa.

### ⚠️ Erro de método meu, registrado
A primeira medição comparou **pessoas diferentes**: o script pegava "as 3 leituras mais recentes" e a
lista mudou entre as rodadas. O laudo pegou. O trio agora é **fixo** no script. ⛔ Comparação de
prompt só vale sobre as MESMAS leituras.

### ⏭️ Se um dia for reaberto
Não escrever a quarta instrução. As saídas reais são de PRODUTO: (a) aceitar os ~40% como o normal de
dois blocos sobre a mesma pessoa; (b) o **motor** decidir quando existe virada (ele sabe qual centro
está livre e qual o bloco 1 vai acusar) e só então pedi-la; (c) fundir os dois blocos — ⚠️ o laudo
desaconselha: o corte entre eles é o silêncio onde o cliente respira e onde o terapeuta pausa na
devolutiva.

---

## 2026-08-20 (tarde) — ✅ O MOLDE DA NEGAÇÃO: 6 regras, e desta vez a medição SUBIU

**Status:** APLICADA (prompt) + APLICADA (legenda da linha do tempo). Aguarda o olho do founder nos PDFs.

### O problema, medido em 25 relatórios de produção
Não era "o modelo nega muito" — era **a mesma frase de negação na mesma posição**, documento após
documento. O terapeuta lê três leituras na semana e vê a mesma linha três vezes.

| a frase | onde | produção |
|---|---|---|
| *"E não é só o peso que veio de trás"* | abertura do `@RESILIENCIA` | **22/25** |
| *"uma crença não é uma opinião…"* | `@LEAD` das Crenças | **22/25** |
| *"repetir X não é lealdade — lealdade de verdade é Y"* | `@DIFICIL` | **25/25** |
| *"você é alguém que **aprendeu**…"* | predicado do reframe | **20/25** |
| *"a única forma de se sentir segura"* | fecho do reframe | **11/25** |
| *"a ferida e a força vieram juntas"* | `@RESILIENCIA` | 5/25 |

⭐ **A distinção que fez a diferença:** negação em **abertura de parágrafo** (o olho pousa ali) é
outra coisa de negação **no meio da frase** (invisível). O alvo é a abertura. E `@PERGUNTA` do bloco 3
(*"o que já não precisa mais ser provado, hoje?"*) é negação **sem adversário** — não corrige ninguém,
propõe. Fica, e é o modelo: o bloco 3 tem a menor densidade de negação do documento e foi o eleito
pelo laudo editorial.

### As 6 regras que entraram
1. `@RESILIENCIA` **não abre com negação** — a primeira palavra é afirmativa; diga o que a linhagem **deu**.
2. `@DIFICIL` é o **único** marcador do bloco 4 que pode refutar — e a fórmula *"não é lealdade — lealdade de verdade é"* está proibida. `@DIFICIL` e `@RESILIENCIA` **não podem ambos abrir refutando** (eram parágrafos vizinhos).
3. `@LEAD` das Crenças **não define por negação** — abre pelo que a crença **FAZ**.
4. O **reframe fica** (a negação aqui é o coração do relatório: *"você NÃO é o que te disseram que você é"*), mas **uma vez por documento, e só no bloco 1**.
5. O predicado do reframe **não pode ser *"é alguém que aprendeu"*** — use o verbo do caso dela.
6. A acusação citada vem **entre aspas**, do vocabulário DESTA leitura, e **não pode ser "difícil"**.

### O resultado — 3 leituras do trio FIXO, prompt novo contra produção
| | produção (25) | v5 (3) |
|---|---|---|
| *não é só o peso* | 22/25 | **0/3** |
| *não é uma opinião* | 22/25 | **0/3** |
| *é alguém que aprendeu* | 20/25 | **0/3** |
| *não é lealdade* | 25/25 | 1/3 |
| *a única forma* | 11/25 | 1/3 |
| negação abrindo marcador | 1,0 por relatório | **0,3** |
| negações no total (inclui as invisíveis) | 55,7 | 55,3 |

⭐ **A última linha é a prova de que a régua estava certa:** o total de negações **não mudou** — o que
saiu foi a negação **visível**, na abertura. Não empobrecemos o texto; tiramos o carimbo.

⚠️ **O que NÃO mudou, e não era o alvo:** molde geral entre clientes (trechos de 8+ palavras repetidos
41 → 42; marcadores abrindo com as mesmas 3 palavras 22 → 23). Continua aberto.

### ⛔ Ainda escapa (1 de 3 cada)
*"não é lealdade"* e *"a única forma"*. Com N=3 não dá para dizer se é resíduo ou ruído — ⏭️ conferir
na próxima leva sem gastar API nova.

### 📄 O PDF ficou mais curto — e não é destas regras
33→29 · 33→23 · 34→30 páginas (ANTES × NOVO). A queda inteira está no **bloco 9**: os Caminhos caíram
de 5 para 3/2/4 pela **dedup por família** de `aa9bb26` — decisão tomada e registrada. Gabriela é o
caso "1 leitura em 60" que tem só **2 temas reais** e por isso recebe 2 Caminhos. Esperado, não é bug.

### 🕐 Legenda dos três estados da linha do tempo
O bloco 3 mostrava *"ainda ativo"*, *"em processo"* e *"fechado"* sem dizer o que significavam. Agora
tem legenda logo abaixo do trilho — e ela **só lista os estados que aquela leitura tem**.

### Gates
`smoke-render` OK · `pnpm lint` 0 erros / 25 warnings (baseline) · golden: **nenhuma agulha mudou**
(32 idênticas · 28 com diferença **com e sem** a legenda — as 28 são anteriores a hoje).

---

## 2026-08-23 — o relatório sai INTEIRO ou não sai — e documento cortado NÃO cobra o terapeuta

**O que aconteceu.** A terapeuta **Nailli** gerou o Mapa do Ser da cliente **Evelyn** (leitura
`e595730d`, 13h49) e recebeu um documento com **3 blocos de 7**, cortado no meio da primeira frase
do bloco 3 (*"Três marcos"*). Ele foi gravado como pronto, exibido como pronto, e **o crédito dela
foi debitado**. Ninguém foi avisado de nada. Quem descobriu foi o founder, lendo.

### A causa: 79% do que pagamos é PENSAMENTO, não texto

O Sonnet 5 **pensa por padrão** (thinking adaptativo — omitir o parâmetro NÃO desliga, ao contrário
do Opus 4.8/4.7) e esse raciocínio é contado em `output_tokens` e **consome o mesmo `max_tokens` do
texto**. Medido nos **29 relatórios de produção** (28/07 → 23/08):

| | tokens de saída | texto (~3,5 chars/token) | pensamento |
|---|---|---|---|
| média | 20.100 | ~4.300 | **15.936 — 79%** |
| faixa | 14.747 a 32.000 | 3.889 a 4.692 | 70% a 82% |

- Custo médio do Stage 2: **US$ 0,227**, dos quais **US$ 0,159 é pensamento** que ninguém lê.
- **O texto é ESTÁVEL** (~4.300 tokens sempre). Quem varia é o pensamento. Por isso o relatório
  corta: não é texto demais, é deliberação demais.
- O de 23/08 foi **95% pensamento** — o pico da série inteira.

⚠️ **O comentário em `gerar.ts` que dizia *"se voltar a truncar, a resposta NÃO é subir o teto, é
limitar quantos Caminhos o bloco 7 escreve"* está errado na premissa.** Foi escrito em 13/08
achando que o consumidor do teto era o TEXTO. O consumidor é o pensamento — limitar o bloco 7 não
devolve teto nenhum.

### Decisão 1 — as 6 regras anti-negação de 20/08 VOLTAM ATRÁS

`f104bc9` (as 6 regras contra o molde da negação) foi o **único** deploy entre o último relatório
inteiro e o quebrado — e o de 23/08 foi o **primeiro** relatório de produção gerado sob elas.
Seis proibições com contagem (*"22 de 25"*, *"16 de 25"*) e verificação cruzada entre marcadores
vizinhos multiplicaram a deliberação antes de cada parágrafo.

**STATUS: APLICADA** — `7d3252f` reverte **só o prompt**. A legenda da linha do tempo (`1145e03`)
FICA. Os números do ganho revertido ficam registrados na entrada de 20/08 (tarde): *"não é só o
peso"* 22/25→0/3, *"não é uma opinião"* 22/25→0/3, *"é alguém que aprendeu"* 20/25→0/3. **O ganho
era real** — o que não dá é pagá-lo com relatório pela metade.

⏭️ A repetição que essas regras matavam **voltou**. Tratar por um caminho que não torre token.

### ⚖️ CONTRAPONTO — o founder recusou subir o teto

Minha recomendação foi **subir o teto de 32k para 64k e MANTER as regras**: `max_tokens` é uma
tesoura, não uma meta — só corta se passar, e paga-se apenas o que sai. Sozinho isso teria salvado o
relatório da Evelyn inteiro.

O founder decidiu o contrário: *"além disso, eu quero que economize token. Prefiro voltar ao que era
dia 20 e depois a gente trabalhar com essas repetições."* E o argumento que fecha a questão é dele:
**com o teto de 32k e o prompt antigo, 10 relatórios seguidos saíram inteiros.** O teto nunca foi o
problema. `MAX_TOKENS` fica em **32.000**.

### Decisão 2 — INTEIRO OU NADA, e cortado não cobra

Palavra do founder: **"Não pode cobrar do terapeuta."**

**STATUS: APLICADA.** O gerador agora devolve `completo`, decidido por **duas provas independentes**
— nenhuma das duas basta sozinha:

1. `stop_reason === 'max_tokens'` → pega o corte mesmo com os 7 blocos presentes (os cortes de 10/08
   e 11/08 foram **dentro** do bloco 7, com o título já escrito);
2. contagem de `# ` < 7 → pega o documento incompleto que terminou sozinho.

Quando não está completo, a rota do terapeuta:

- **não grava `report_emocional`** — a página entra em modo leitura só de ver essa coluna
  preenchida, e voltaria a exibir metade de relatório como pronta;
- **não grava `report_emocional_generated_at`** — ⭐ este é o ponto que quase passou: esse campo é a
  **prova de sucesso** que o backstop da página (`leituras/[id]/page.tsx`) e o cron usam para
  debitar reserva órfã. Pular só o consume inline **não bastaria**: o crédito seria debitado no
  próximo carregamento da página;
- **não purga a foto** (retida para resgate) e **não incrementa `regeneration_count`**;
- **guarda o texto pago** em `report_emocional_metadata` (`incompleto: true` + `markdown_parcial`) —
  a API foi paga, o texto não se perde;
- **deixa a reserva ATIVA** — a próxima tentativa reusa a mesma, sem cobrar duas vezes;
- **avisa na tela**: *"O relatório saiu incompleto (N de 7 partes) e foi descartado. Nenhum crédito
  foi cobrado — pode gerar de novo."*

`stop_reason` e `blocos` passam a ser gravados no metadata. Sem eles, a única forma de descobrir um
corte era comparar `tokens_out` com o teto na mão — foi assim que **dois relatórios cortados em
10/08 e 11/08** (ambos em 24.000, o teto da época) foram entregues sem ninguém notar.

A rota founder-only (`/emocional`) ganhou a mesma trava: lá não há crédito a proteger, mas guardar
metade como pronta é o mesmo defeito.

### ⏭️ Em aberto

- **Relatório da Evelyn continua quebrado** e o crédito da Nailli continua debitado (a trava é para
  daqui pra frente; não desfaz o de hoje). Refazer custa ~US$ 0,46. Founder: *"ainda não, primeiro
  conserta."*
- **Economizar token de verdade** é mexer no quanto o modelo pensa — `output_config: { effort }`,
  hoje no padrão máximo (`high`), nunca testado neste produto. ⛔ É calibração: exige o founder e
  medição antes/depois.

### Gates
`pnpm lint` 0 erros / 25 warnings (baseline) · `tsc` sem erro novo (os 30 são débito conhecido de
`*.test.ts` e `tmp/`) · `vitest lib/emocional` 8/8.

---

## 2026-08-23 (noite) — teto 40.000 + sentinela em 30.000: o corte era o sintoma, não a doença

**Palavra do founder, que inverteu o desenho:**

> *"Põe 40 mil de limite. Mas se passar de 30, me manda um e-mail, porque aí tem alguma coisa errada — antes não estava passando, não estava ficando tão caro, agora está ficando caro."*

De manhã ele havia **recusado** subir o teto (registrado como contraponto na entrada anterior). O que mudou entre uma coisa e outra foi a medição do dia: ficou claro que **consumo alto é o sintoma, e o corte era só a forma como esse sintoma aparecia** quando o teto era baixo demais para escondê-lo. Subir o teto tira o corte; a sentinela deixa o sintoma visível. **Os dois números andam juntos — mudar um sem o outro cega o alarme.**

### Os dois números

| | valor | por quê |
|---|---|---|
| `MAX_TOKENS` | 32.000 → **40.000** | o teto é uma TESOURA, não uma meta: só corta se passar, e paga-se apenas o que sai. Subir não encarece o dia a dia. |
| `ALERTA_TOKENS` | **30.000** (novo) | em 29 relatórios de produção a saída ficou entre **14.747 e 25.489**; a maior geração INTEIRA já medida foi **27.208**. Passar de 30.000 está fora da faixa conhecida — é sintoma, não variação. |

⛔ **A nota antiga de `gerar.ts` foi REMOVIDA por estar errada na premissa:** dizia *"se voltar a truncar, a resposta NÃO é subir o teto, é limitar quantos Caminhos o bloco 7 escreve"*. Ela supunha que quem consumia o teto era o TEXTO. Medido: **79% da saída é pensamento do Sonnet 5**; o texto é estável em ~4.300 tokens. Limitar o bloco 7 não devolve teto nenhum.

### O aviso

`lib/notifications/notify-mapa-alerta.ts` — e-mail via Resend para `FOUNDER_EMAILS` (os dois founders, não o suporte: é decisão de dono). Dois motivos:

- 🔴 **incompleto** — saiu com menos de 7 blocos e foi DESCARTADO. Diz o que o founder precisa saber sem abrir nada: a terapeuta não foi cobrada, o crédito segue reservado, a foto foi retida, e o link direto do `/admin/regenerar`.
- 🟡 **caro** — saiu INTEIRO e foi entregue, mas passou de 30.000. Nenhuma ação; é vigilância de custo.

⛔ **Retentativa automática foi RECUSADA pelo founder**, com a proposta na mesa (ela teria coberto a terapeuta antes de ela ver o problema, ao custo de uma geração extra só no caso de falha). Decisão dele: *"não tenta nada, só me avisa na hora"* — quem regera é ele, à mão.

### E o aviso que não é e-mail

Pedido literal: *"e deixo um aviso para quando a gente começar a sessão aqui, você me falar"*.

`apps/web/scripts/relatorios-com-problema.mjs` — lista os incompletos pendurados e os caros dos últimos 30 dias, com nome de terapeuta, de cliente e o link de regerar. **Só lê o banco: não gera nada, não gasta API.** Rodar no início da sessão e avisar o founder.

### O que ficou provado hoje e vale mais que os consertos

**O prompt tem ORÇAMENTO de proibições — medido 4 vezes, mesmo exame, mesmo modelo:**

| prompt | ⛔ | saída | resultado |
|---|---|---|---|
| produção (revertido hoje) | 59 | 27.208 | ✅ inteiro |
| + 3 regras anti-"cheiro de IA" | ~62 | 24.955 | ✅ inteiro (**gastou menos**) |
| as 6 regras de 20/08 | 70 | 32.000 | ⛔ 3 blocos de 7 |
| + 4 regras + 7 edições | 71 | 32.000 | ⛔ 3 blocos de 7 |

⛔ **A tese de "regra barata × regra cara" MORREU na medição.** Passei o dia sustentando que o problema eram as regras que mandam o modelo reler o documento, e que proibir uma frase era de graça. As 4 regras da última tentativa eram **todas locais** — quebrou igual. **Não é o tipo, é a quantidade.** Duas vezes acima de 70: quebrou. Duas vezes abaixo de 62: terminou. Comentário de engenharia dentro do prompt também pesa.

**Para entrar regra nova, tem que SAIR regra velha.** O caminho não testado é TROCAR, com teto de ~62 proibições.

**⭐ E o achado que não custa orçamento nenhum: regra perde para EXEMPLO.** Dois exemplos ✅ do prompt saíram **palavra por palavra** no relatório da cliente, em duas gerações independentes — inclusive a **primeira frase** do documento. A "cabeça girando" que se repetia 5 vezes **não era muleta do modelo: foi plantada pelo prompt.** Trocar os dois exemplos é a edição de maior retorno do arquivo. Não foi feita — ficou para a próxima sessão.

### Gates
`pnpm lint` 0 erros / 25 warnings (baseline) · `tsc` 30 erros, todos pré-existentes em `*.test.ts` e `tmp/` · `vitest lib/emocional lib/notifications` 25/25 · script de pendências rodado contra produção.

---

## 2026-08-23 (fecho) — o prompt entregava a frase pronta: 90% dos relatórios abriam as Crenças igual

**Achado do Bob, MEDIDO por mim nos 29 relatórios de produção.** O carimbo entre clientes não era mania do modelo: **estava escrito no prompt como exemplo e como spec**, e ele copiava.

| o que o prompt entregava pronto | relatórios que copiaram |
|---|---|
| a **definição de crença** do bloco 6 (forma espelhada *"não é X: é Y"*) | **26 de 29 — 90%** |
| a metáfora que vinha junto (*"combinado silencioso"*) | **18 de 29 — 62%** |
| o ✅ da primeira frase do bloco 1 | 2 de 29 — 7% |

⚠️ **CORREÇÃO DE ROTA:** eu havia dito ao founder, seguindo o Bob, que trocar o exemplo do bloco 1 era *"a edição de maior retorno do arquivo"*. **Medido, é 7%** — e os 2 casos eram as duas gerações da MESMA cliente, porque a emoção principal do exame dela batia com a do exemplo. O de verdade era o do bloco 6, em 9 de cada 10 relatórios. Régua do dia: **n=2 do mesmo cliente não é frequência.**

### O que foi feito (custo: ZERO proibição — 59 antes, 59 depois; +900 bytes)

1. O ✅ do bloco 1 passou a usar uma **emoção diferente de propósito**, com aviso de que o exemplo é FORMA, nunca palavra.
2. A spec do `@LEAD` do bloco 6 saiu da forma espelhada **e perdeu a metáfora**: enquanto a frase bonita estivesse escrita ali, ele ia continuar copiando. A definição virou "para você entender, não para copiar", com o número medido junto.

### Medição (1 geração paga, mesmo exame da Evelyn, prompt novo)

```
7/7 blocos · end_turn · 25.526 tokens de 40.000 · US$ 0,283
  "não sai sozinha"        sim -> NÃO
  "não é uma opinião"      sim -> NÃO
  "combinado silencioso"   sim -> NÃO
  exemplo NOVO copiado?    NÃO   <-- o risco que justificou o teste
```

O modelo escreveu a própria imagem (*"Uma preocupação chama a outra, numa fila que não acaba"*) e o próprio `@LEAD` (*"o que decide, no automático, se você pede ajuda, se fala o que sente, se se permite parar"*) — concreto e desta cliente, no lugar da definição de catálogo.

⭐ **E o gasto não subiu:** 25.526 contra 27.208 da mesma leitura antes. Tirar frase pronta do prompt **não custa orçamento e ainda sai mais barato** — é o oposto de empilhar proibição, que quebrou duas vezes hoje.

### A lei que fica

**REGRA PERDE PARA EXEMPLO.** Antes de escrever proibição nova (que custa orçamento e pode estourar o teto), procure se o próprio arquivo já entrega a frase pronta — em exemplo ✅ ou em spec. Trocar sai de graça e rende mais.

### Gates
`pnpm lint` 0 erros / 25 warnings · `tsc` no baseline · `smoke-render` OK (9 blocos, anti-Forer 13% com teto de 35%).

---

## 2026-08-24 — o bloco 7 troca de mão: o Método Somático sai, as PERGUNTAS ANCORADAS voltam

**Decisão do founder**, depois de 8 meses com o método no documento e de uma sessão inteira lendo PDFs lado a lado:

> *"Vamos pegar o nosso método somático e colocar na prateleira. E no lugar dele, o prompt exato do nosso modelo antigo de perguntas — o roteiro de anamnese. Aqui é terapia. Essas perguntas são fazer uma terapia por meio de perguntas."*

**O que decidiu junto:** as perguntas vão **também para a cliente** (o `OMITIR_NA_VERSAO_CLIENTE` virou `[]`); o método vai **pra prateleira, não pro lixo**; e a versão atual do relatório fica **salva e legível**.

### ⭐ O MECANISMO — "abrir a gaveta" (palavra do founder)

> *"Aqui fala que você tem uma raiva de fundo. Você consegue lembrar a última vez que sentiu raiva? É como se fosse abrir a gaveta da dor. Quando abre a gaveta, dá a oportunidade de a gente mexer na gaveta. Agora entra na cena. Existe alguma parte do corpo que te chama a atenção? Aí a pessoa fala: tem, tem sim. E o terapeuta: coloca atenção nisso agora."*

**Cinco tempos, em TODAS as perguntas:** 1 nomeia o achado · 2 **abre a gaveta** (chama a lembrança) · 3 entra na cena · 4 **o corpo chama** (pergunta de SIM ou NÃO) · 5 **a atenção** ("coloca a atenção nisso agora").

⭐⭐ **A emoção precisa estar ABERTA pra ser trabalhada.** Pergunta sem gaveta aberta é conversa sobre o assunto, não terapia.
⭐ **A variação é na PALAVRA, nunca no mecanismo.** Foi o erro que custou 3 rodadas: eu tratei a cena como uma opção entre cinco e a limitei a 3 em 10 — e as perguntas viraram reflexão de cabeça. A cena é o mecanismo; o que varia é a redação.

### Correções de rota (todas medidas, todas minhas)

| eu escrevi | o founder cortou | o que a medição disse |
|---|---|---|
| âncora podia ser um **recurso/força** | *"aqui é terapia, a gente fala de achados"* | **0 de 49** primeiras perguntas do Dossiê ancoravam numa força |
| *"leva o ar até ali, respira uma vez"* | *"isso não existe, não é princípio somático"* | "respir" em **2%** das 391 perguntas do Dossiê. O gesto é de **ATENÇÃO** |
| proibi a cena lembrada | *"a anterior eu achei melhor, traz o sensorial"* | a cena era **18%** do Dossiê — eu tinha zerado |
| *"lendo isso agora"* | — | fura a regra do próprio prompt (bloco 1): metade das vezes **quem lê é o terapeuta** |

### O LUGAR × A TEXTURA (founder, 24/08 — revoga metade da decisão de 27/07)

- ⛔ **O LUGAR nunca aparece na pergunta.** *"A gente não sabe onde é."* Oferecer o lugar PLANTA a resposta e destrói a prova de que a leitura tocou algo.
- ✅ **A TEXTURA foi LIBERADA** (*"quente ou frio, parado, se mexendo"*), **condicionada**: *"se tiver, repara como é"*. No papel a resposta dela ainda não aconteceu — ela responde ao terapeuta, e o terapeuta continua dali.
- O bloco 1 foi alinhado à mesma régua.

### O lastro — para eu não inventar de novo

`_motor-lab/lastro/levar-ao-corpo.md`. Quatro escolas, **autores escondidos** (regra 8): **Clean Language** (Grove) — a pergunta 3, *"and whereabouts is X?"*, é literalmente o tempo 4, e o princípio "só as palavras da pessoa" é a origem da regra do lugar · **Focusing** (Gendlin) — felt sense, e o passo "receber" é por que NÃO se promete resultado · **Somatic Experiencing** (Levine) — titração é a origem do *"se nada vier, tudo bem"* · **Hakomi** (Kurtz) — primeiro a atenção, depois o experimento; sempre voluntário.
⚠️ O que está marcado como síntese **é síntese** — não consegui o verbatim de Gendlin nem de Kurtz.

### Código

- `render-novo.mjs`: `block7()` escolhe o leitor pelo que o documento TEM. `block7Perguntas` (lista numerada) e `block7Metodo` (`@CAMINHO`) convivem. ⛔ **Não apagar `block7Metodo`**: o markdown fica no banco e o HTML é derivado na hora — sem ele, os relatórios já entregues perderiam o bloco 7 **em silêncio**.
- Prompt congelado em `prompts/stage2-relatorio-v1-metodo-somatico.md`.
- `_lab-gerar.mjs`: teto 32k → **40k**, alinhado com produção. Estava medindo com régua mais curta e podia reprovar aqui o que produção entregaria inteiro.

### 🐛 Dois defeitos que a troca revelou (e mataram junto)

1. **O prompt tinha DOIS formatos de saída contraditórios** pro mesmo bloco — `- s2:…s7:` (que o render lê) e `- chegar:…passo:` (que o prompt mandava). Quando o modelo obedecia ao formato escrito, o render **descartava mais da metade das falas em silêncio**: 20 passos renderizados contra 48.
2. **A proibição de oferecer o lugar morava só no bloco 1**, com uma remissão 330 linhas depois. Furou duas vezes em dois dias. **Remissão é mais fraca que texto** — agora está escrita nos dois lugares.

### Orçamento de proibições

43 → **44 regras** (patamar medido que funciona: 43; quebra em 51-52). O bloco novo **liberou** orçamento: saiu com 19 regras a menos que o método. ⭐ Cardápio de formulação não é proibição — foi assim que a variedade subiu sem custar teto.

### Custo — medido, e SUBIU

Mesma leitura (founder), método × perguntas: **18.978 → 24.268 tokens** (+28%, ~R$ 0,32/relatório). Não é o texto, que está do mesmo tamanho: são **cinco tempos obrigatórios em dez perguntas**, contra um esqueleto fixo que o modelo só preenchia. ⚠️ Corrigi duas vezes neste dia uma afirmação minha de que teria **barateado** — era n=1.

### Gates
`smoke-render` OK · **29 de 29 relatórios já entregues renderizam inteiros, 0 fallback** (o gate que mais importava) · `pnpm lint` 0 erros / 25 warnings · `tsc` 30 erros, todos pré-existentes em `*.test.ts` e `tmp/`.

### ⏭️ Em aberto

- **A agulha dos 3 centros.** Medido nos 80 exames: **57% recebem o mesmo desenho** (mente tensa / coração livre / corpo tenso) e a **mente sai tensa em 94%**. Causa achada: o lado "livre" vem só de `sistemas_preservados`, e **66% dele aponta pro coração** (pulmões, coração, linfático são o que a íris mais mostra íntegro). Os atenuadores de constituição estão mal calibrados: pupila centrada dispara em 40%, **trama compacta em 1 de 80**. Simulei normalizar por centro — o desenho comum cai de 57% pra 10%, mas a agulha passa a medir "comparado aos outros" e o founder ficaria **"livre" numa mente que ele reconhece como o que mais pesa**. **Founder decidiu: deixa como está.** ⭐ O conserto barato, quando quiser: mexer nos LIMIARES dos bônus, não na fórmula.
- O tempo 5 (a atenção) saiu em **7 das 10** perguntas — os outros quatro tempos em 10/10.

---

## Como usar

- **Ao tomar uma decisão:** registrar aqui na mesma sessão, com razão e status.
- **Ao aplicar:** trocar o status para `APLICADA` e colar o commit.
- **Ao mudar de ideia:** nova entrada que supera a anterior. Nunca editar a antiga.
- **Antes de subir algo que muda configuração:** `node scripts/verificar-decisoes.mjs`.
