# ESTUDO — a repetição no relatório: o que repete, por quê, e o que dá pra fazer

**Data:** 2026-08-17 · **Origem:** reclamação de clientes ("o relatório está muito repetitivo").
**Amostra:** os **25 relatórios** de produção que têm texto salvo (`readings.report_emocional`),
os mais recentes primeiro. Zero API — só leitura de banco e análise de texto.

> **Veredito em uma linha:** a repetição é **real, medida e estrutural** — e a causa não é o modelo
> desobedecendo, é o **prompt entregando a frase pronta** com uma lacuna para trocar. Com 4,8 caminhos
> por relatório, a mesma frase sai 5 vezes.

---

## 1. O que repete DENTRO do mesmo relatório

O bloco "Perguntas para a sua sessão" traz em média **4,8 caminhos**, e cada caminho tem os mesmos
movimentos (`s2`, `s3`, `s5`, `s6`, `s7`). Medindo a semelhança entre os caminhos do **mesmo**
relatório, movimento a movimento (100% = frase idêntica):

| movimento | semelhança entre os caminhos | o que é |
|---|---|---|
| **s6** | **67%** | "o que essa ___ estava tentando proteger?" |
| `sub` | 54% | "Da ___ a uma ___ que também é sua" |
| `s3` | 52% | "se essa ___ pudesse falar…" |
| `s5` | 50% | "agora lembra de uma vez em que…" |
| `s2` | 46% | "lembra de uma vez recente… um cantinho já basta" |
| `s7` | 31% | o fecho — o menos repetitivo |

**Exemplo real**, os quatro `s2` do mesmo relatório (`4bf98d31`, 15/08):

> Lembra de uma vez recente em que **engoliu uma raiva**. Deixa essa cena voltar — e nota onde ela mora
> no corpo agora, só nota, **um cantinho já basta**.
> Lembra de um momento recente em que **sentiu que precisava fazer mais**… nota onde a pressa mora no
> corpo — **um cantinho já basta**.
> Lembra de uma noite recente em que **a cabeça girou**… nota onde esse peso mora — **um cantinho já basta**.
> Lembra de algo recente que **te deixou remoendo**… nota onde essa preocupação mora no corpo —
> **um cantinho já basta**.

É a mesma frase quatro vezes, trocando o miolo.

**Entre blocos diferentes** (não só dentro do de perguntas): **15 dos 25 relatórios (60%)** têm um
trecho de 8+ palavras repetido em dois blocos distintos. Os pares mais frequentes:
`Mapa emocional ⟷ Perguntas` (12 ocorrências) · `Como você funciona ⟷ Heranças` (8) ·
`Em poucas palavras ⟷ Perguntas` (8).

---

## 2. O que repete ENTRE CLIENTES DIFERENTES — o dano maior

Comparando o mesmo movimento em relatórios de **pessoas diferentes**:

| movimento | semelhança entre clientes |
|---|---|
| **s6** | **85%** |
| **s3** | **79%** |
| s2 | 59% |
| s5 | 55% |
| s7 | 52% |

E **24 frases são literalmente idênticas** em relatórios de clientes distintos:

| aparece em | a frase |
|---|---|
| **9 clientes** | *"o que essa preocupação estava tentando proteger em você"* |
| 5 clientes | *"o que essa irritação estava tentando proteger em você"* |
| 5 clientes | *"o que essa rigidez estava tentando proteger em você"* |
| 4 clientes | *"o que essa dificuldade de soltar estava tentando proteger em você"* |

⚠️ **Isto é o alarme Forer voltando pela porta dos fundos.** O motor foi calibrado para reduzir a
sobreposição de **emoções** entre leituras — e conseguiu (medido em 13/08: 25,5% → 21,5%). Mas a
sobreposição de **frases do bloco de perguntas** nunca foi medida, e é onde ela está.

---

## 3. A CAUSA — o prompt entrega a frase pronta

Não é o modelo inventando nem se repetindo por preguiça. Ele está **obedecendo**.
Em `prompts/stage2-relatorio-novo-DRAFT.md`:

```
l.315  | 3 | Deixar falar     | "se essa [carga] pudesse falar, o que ela queria ter dito?"
l.318  | 6 | Colher o sentido | "o que essa [carga] estava tentando proteger em você?"
l.332  Regras das falas: … Titração sempre: "um cantinho já basta".
```

O molde é fixo; só `[carga]` varia. Multiplicado por 4,8 caminhos, dá exatamente o que os clientes
estão vendo. **O `s6`, que tem o molde mais literal, é o mais repetido (67% interno / 85% entre
clientes). O `s7`, cuja instrução descreve a INTENÇÃO em vez de dar a frase, é o menos repetido (31%).**

Isso já estava registrado como padrão conhecido em `feedback_prompt_examples_leak_to_output`:
exemplo dentro do prompt vaza para o texto final. Aqui não é nem exemplo — é instrução literal.

---

## 4. 🔴 Descoberta paralela — uma regra escrita que NUNCA foi para produção

O prompt do working tree tem, no `s7`:

> ⛔ **NUNCA prescrever tarefa** ("esta semana, escolha/diga/peça/escreva") … o formato é
> **"Tem alguma coisa hoje que você já pode [verbo]?"** … o verbo **nunca repete** entre Caminhos,
> senão os 4 fechos ficam idênticos.

**Medido nos 118 caminhos de produção:**

| | |
|---|---|
| no formato exigido ("já pode") | **0 (0%)** |
| no formato **proibido** ("essa semana, escolha…") | **108 (92%)** |

**Motivo:** essa regra existe **apenas no working tree, não commitada.** Produção nunca a recebeu.
Mesmo padrão da correção nasal/temporal do Stage 1, que ficou 3 dias parada. ⚠️ Não é o modelo
ignorando a regra — é a regra que nunca chegou nele.

⭐ E a regra do `s7` é **exatamente o desenho da solução**: descreve a intenção, proíbe a repetição
entre caminhos, e manda o verbo sair do eixo daquele caminho. Ela só nunca foi aplicada aos outros
movimentos — nem a si mesma, porque não subiu.

---

## 5. As soluções, da maior alavanca para a menor

### A. Trocar frase-pronta por intenção + proibição de repetir ⭐ recomendada
Aplicar a todos os movimentos o desenho que o `s7` já tem: dizer **o que o movimento precisa fazer**,
não **como se diz**, e travar *"não repetir o molde entre caminhos do mesmo relatório"*.
- **Ataca a causa**, não o sintoma.
- **Custo:** uma rodada de medição (comparar antes/depois nas mesmas leituras).
- **Risco:** sem molde, a qualidade da fala pode cair ou derivar. Mitigação: oferecer **3-4 moldes
  alternativos por movimento** e exigir rodízio, em vez de nenhum molde.

### B. Rodízio determinístico de molde, decidido pelo motor
O motor já sabe quantos caminhos vão sair e em que ordem. Ele pode **mandar no bloco B qual molde
cada caminho usa**, de um banco.
- **Vantagem decisiva:** não depende da boa vontade do modelo — é garantido e testável.
- É a mesma lógica que já resolveu o anti-Forer dos exercícios (sobreposição 67% → 13%).
- **Custo:** escrever o banco de moldes. Maior que A, e some com A: A define a intenção, B garante a variação.

### C. Variar a FORMA do caminho, não só as palavras
Nem todo caminho precisa dos mesmos movimentos. O caminho 1 (a carga mais alta) vem completo;
os seguintes vêm em forma curta — 3 movimentos. Deixa de ler como formulário preenchido cinco vezes.
- ⚠️ Decisão de produto, não de prompt: muda o que o terapeuta recebe.

### D. Reduzir o número de caminhos
4,8 é muito para uma estrutura fixa. Com 3, a repetição cai por construção.
- ⚠️ Reduz valor entregue e contradiz a copy da landing ("quatro ou cinco caminhos"). **Só se o
  founder quiser.**

### E. Subir a regra do `s7` que já está escrita
Independente de tudo acima. Hoje 92% dos fechos estão no formato **proibido**.
- **Custo quase zero**, e é regra já pensada e escrita.
- ⚠️ Ainda assim muda o texto de todo relatório novo → medir antes.

---

## 6. O que NÃO fazer

- ⛔ **Pedir ao modelo "não repita"** sem tirar o molde. Ele vai continuar obedecendo à instrução
  literal, que é mais forte que o pedido genérico.
- ⛔ **Mexer nos moldes sem medir.** Toda mudança aqui atinge 100% dos relatórios novos. A régua
  existe: `golden-set.mjs` + esta análise, que é reprodutível.
- ⛔ **Regerar os relatórios antigos** sem decisão do founder — o cliente já leu o dele.

---

## Como repetir esta medição

A análise é reprodutível em minutos, sem custo: puxar `readings.report_emocional`, separar os
caminhos por `@CAMINHO`, extrair as falas por `- sN:` e comparar (a) entre caminhos do mesmo
relatório e (b) o mesmo movimento entre relatórios diferentes. As três métricas que importam:
**semelhança interna por movimento**, **semelhança entre clientes por movimento** e
**contagem de frases literalmente idênticas entre clientes**.

⭐ **Sugestão:** essas três métricas deveriam entrar no `golden-set.mjs`, como o campo `pendulo` entrou
em 13/08. Hoje o gate mede o motor determinístico e **não olha uma linha do texto que o Sonnet escreve** —
foi exatamente por isso que essa regressão chegou ao cliente antes de chegar à gente.
