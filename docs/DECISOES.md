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

## Como usar

- **Ao tomar uma decisão:** registrar aqui na mesma sessão, com razão e status.
- **Ao aplicar:** trocar o status para `APLICADA` e colar o commit.
- **Ao mudar de ideia:** nova entrada que supera a anterior. Nunca editar a antiga.
- **Antes de subir algo que muda configuração:** `node scripts/verificar-decisoes.mjs`.
