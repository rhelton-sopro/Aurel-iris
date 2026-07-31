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
| **Versão do cliente** (Mapa do Ser) | tudo menos "Perguntas para a sua sessão"; caixinha inclui | APLICADA | `48b4c00` |

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

## Como usar

- **Ao tomar uma decisão:** registrar aqui na mesma sessão, com razão e status.
- **Ao aplicar:** trocar o status para `APLICADA` e colar o commit.
- **Ao mudar de ideia:** nova entrada que supera a anterior. Nunca editar a antiga.
- **Antes de subir algo que muda configuração:** `node scripts/verificar-decisoes.mjs`.
