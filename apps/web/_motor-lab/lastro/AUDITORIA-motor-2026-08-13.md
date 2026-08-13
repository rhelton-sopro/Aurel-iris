# AUDITORIA DO MOTOR — Stage 1 → Stage 2, glossário, tabelas e fórmulas

**Data:** 2026-08-13 · **Pedido do founder:** *"o que eu quero? Stage 1 e Stage 2 funcionando redondo.
E os nossos glossários, nossas tabelas para cálculo, as nossas fórmulas. Veja se isso tudo está
redondinho funcionando. Faça uma auditoria."*

**Método:** tudo medido, nada presumido. Cobertura das tabelas conferida contra a canônica; a costura
Stage 1 → Stage 2 conferida contra o glossário; incidência real medida nas **60 leituras de produção**
(`report_findings`, `superseded_at IS NULL`). Custo de API: **zero** — é leitura de banco e conta local.

---

## Veredito em uma linha

**O motor está redondo.** Achei **três defeitos** — dois campos órfãos que eram descartados em
silêncio, uma emoção que o motor não conseguia resolver, e um **crash latente** que só apareceu ao
consertar o primeiro. **Os três foram corrigidos no mesmo dia** e o golden aceito como nova base.
Sobra **uma decisão** que é sua (o corte posicional do vocabulário, §4) e duas divergências entre spec
e código (§5) que não bloqueiam nada.

**Estado final:** 40 campos no lastro · 31 carregam peso · 267 cargas e 149 recursos, cada uma em
exatamente um eixo · **0 sem família, 0 sem eixo** · golden 60 idênticas.

---

## 1. O que está íntegro ✅

| Verificação | Resultado |
|---|---|
| **Eixos** (carga ⟷ antídoto) | 267 cargas + 149 recursos, cada uma em **exatamente um** eixo. Zero órfãos, zero typos, zero duplicatas. |
| **Campos que carregam peso** | **29 de 38** na medição inicial — **31 de 40** depois de mapear `baco` e `plexo_solar`. Todos têm os dois polos (carga E recurso) e crença; os 29 originais têm também suporte nutricional e eixo integrativo. ⏳ os 2 novos ainda **não** têm suporte nem eixo integrativo — degradam sem quebrar (ver §2). |
| **Campos "mudos"** | 9 — e são **exatamente** os marcadores e moduladores que o motor ignora por desenho. Coerência, não defeito. |
| **Antídoto em produção** | **0 pêndulos sem antídoto** nas 60 leituras. |
| **Contrato de campos** | Tudo que o lastro sabe interpretar, o Stage 1 sabe emitir. Nenhum campo morto na tabela. |
| **Golden** | 60 idênticas · 0 diferenças, após regravar. |
| **Gates** | `smoke-render` ✓ · `check-eixos` ✓ · `verificar-decisoes` ✓ · `eslint` 0 erros · `tsc` sem erro novo. |

**Onde vão os 436 achados que o Stage 1 emitiu nas 60 leituras:**

| destino | n | % |
|---|---|---|
| entram no cálculo (viram emoção, centro, crença, suporte) | 311 | 71% |
| marcador — sem peso, **por desenho** | 70 | 16% |
| modulador — sem peso, **por desenho** | 32 | 7% |
| visto — adjuvante, **por desenho** | 15 | 3% |
| ❌ **descartado em silêncio** | 8 | 2% |

---

## 2. Defeito VIVO — dois campos órfãos 🔴

`baco` e `plexo_solar` estão no glossário do Stage 1 (o modelo **pode** emiti-los, o Zod aceita) e
**não existem na tabela-lastro**. O motor cai no ramo `SEM-LASTRO` e **descarta**: o achado não vira
emoção, nem centro, nem crença, nem suporte. Some.

**Incidência real:** 8 ocorrências (`plexo_solar` 6 · `baco` 2) em **8 das 60 leituras (13%)**.

**⚠️ E era pior do que parecia:** o bloco B do prompt anunciava esses descartes na linha
*"(ignorados — marcador/modulador: …)"*, junto com os que são ignorados de propósito. Quem lesse o
bloco B para calibrar via "marcador/modulador" e não enxergava o furo.
**✅ CORRIGIDO em 13/08** (`serialize.mjs`): as duas listas agora são separadas, e a dos órfãos sai
marcada com ⚠️ e o motivo real.

### ✅ RESOLVIDO no mesmo dia — os dois campos foram MAPEADOS

Decisão do founder: *"você mapeie. Bora, vamos atacar todos eles."* Feito, e a régua aceita.

- **`baco`** — 🌍Terra 60 · 💧Água 22 · 💨Ar 18. Lastro: **MTC** (Baço = Terra; transformar e
  transportar; 思 = pensamento excessivo) + **Jensen** (banda própria no gráfico oficial).
  Cargas: ruminação · não-assimilar · preocupação · falta de reserva/apoio · dispersão mental.
- **`plexo_solar`** — 🔥Fogo 45 · 💧Água 33 · 🌍Terra 22. ⚠️ **Lastro ESTICADO declarado:** Br/MTC não
  cobrem plexo solar como órgão; a ponte é somática (centro visceral do poder pessoal). Mesma marca
  que o `adrenal` já carrega. Cargas: desvalorização · sobressalto · senso de inferioridade · ruminação.
- **Centro dos dois = Coração**, pela régua topográfica (faixa temporal/medial 2-4h), coerente com o
  `Centro:` escrito no lastro deles.

**Regra que tornou isso seguro:** mapeados **só com vocabulário que já existia na canônica** ⇒ família
e eixo vieram garantidos, e a cobertura seguiu completa (0 sem família, 0 sem eixo).

**🔴 BUG PRÉ-EXISTENTE que o mapeamento revelou — e que teria quebrado produção.** O bloco do eixo
integrativo lia `sup.suporte` **sem guarda**, apesar de o comentário logo acima dizer que ele
*"independe de haver suporte nutricional pro campo"*. Nunca estourou porque, até 13/08, **todo** campo
do lastro tinha entrada em `SUPORTES` (os 9 sem entrada são marcador/modulador e saem no `continue`
antes). `baco` e `plexo_solar` são os primeiros campos que entram no cálculo **sem** suporte
nutricional — e o `calc()` passou a estourar `Cannot read properties of undefined (reading 'suporte')`.
Pego no teste, antes do commit. Corrigido com `sup?.suporte ?? []`.

**Impacto medido nas 60 leituras:** mudam **8 — exatamente as 8** que tinham achado nesses campos.
Médias das agulhas: mente **29,1 → 29,1** · corpo **33,4 → 33,4** · coração **65,7 → 63,3**.
O caso extremo é `aac033d9`, coração **88 → 49** (e a família dominante virou de *Controle e rigidez*
para *Ansiedade e preocupação*). A direção é a certa: aquelas leituras tinham achados reais sendo
jogados fora, então o "coração livre 88%" era falsamente otimista. **Golden regravado e aceito como a
nova base** (60 idênticas · 0 diferenças).

---

## 3. ✅ RESOLVIDO — a única emoção que o motor não conseguia resolver

> ⚠️ **Correção da primeira versão desta auditoria.** Eu a descrevi como "entrada malformada". Não era.
> Ela segue a convenção psicossomática documentada (`sintoma → emoção-base`, a seta que liga os dois).
> O defeito real era outro, e só apareceu medindo.

`tabela-lastro-CANONICA.md`, campo `sistema_imune`: `"baixa estima → baixa imunidade"`.

**A causa real:** o `clean()` do `loadFamilias` faz `.split('→')[0]` — e nesta emoção **a seta está
dentro do próprio nome, entre aspas**. A chave virava `"baixa estima` e nunca casava com nada. Era a
única das 232 cargas sem família **e** sem eixo; se chegasse ao leque, desenharia um pêndulo com
*"(SEM ANTÍDOTO — furo na canônica)"* na tela do cliente. Nunca disparou (0 em 60).

**⛔ Tentei consertar na busca e MEDI que não resolve** — indexar a parte antes da seta (como o `eixoDe`
já faz) não ajuda: numa das entradas a canônica é *mais longa* que o mapa de famílias, e nesta a seta
está dentro do nome. **O descasamento era de dado, não de busca.** O comentário no `loadFamilias`
registra isso para ninguém tentar de novo.

**✅ Resolvido no dado:** a entrada saiu da canônica — era redundante (`baixa autoestima` já está no
mesmo campo, no mesmo eixo Autoestima, e é exatamente a emoção-base que ela descrevia). E o
descasamento de `temperamento manifesto reativo` (a canônica tinha `, submisso↔sedutor` a mais que o
mapa de famílias) foi corrigido igualando os dois textos.

**Estado agora: 0 sem família · 0 sem eixo, nos dois lados.** ⛔ Não reintroduzir nome de emoção com
`→` dentro — o parser não tem como distinguir do separador.

---

## 4. Decisão sua — o corte do vocabulário é POSICIONAL, não qualitativo ⚠️

`NUCLEO_CAP = 4` (`motor-calc.mjs`) pega **as 4 primeiras emoções de cada bloco de elemento** de cada
campo. O resto nunca é alcançável.

**Medido: 40 das 272 emoções escritas na canônica (15%) são inalcançáveis.** Entre elas:

> rancor/desejo de vingança · hostilidade/rivalidade · crítica crônica · **ciúme** ·
> orgulho/dureza · impaciência

O cap existe por um bom motivo — cortar paleta genérica que reintroduz Forer. **Mas ele corta por
POSIÇÃO NA LISTA, não por qualidade.** "Ciúme" é inalcançável porque alguém a digitou em 5º lugar,
não porque seja genérica. Quinze por cento do vocabulário curado é peso morto, e a parte que morre é
escolhida pela ordem de digitação.

**Caminhos possíveis:** subir o cap (reintroduz risco de Forer) · reordenar as listas da canônica
colocando as específicas primeiro (trabalho manual, sem risco) · deixar como está.
**Não mexi.** É calibração, e calibração é sua.

---

## 5. Spec × código — duas divergências pré-existentes ⚠️

Achadas no caminho, **nenhuma é da mudança de 13/08**:

1. **Nível "leve" não existe no código.** `stage2-relatorio-novo-DRAFT.md` §57 lista cinco níveis
   (*muito alta / alta / média / baixa / **leve***). O código sempre teve quatro — nem antes nem
   depois da normalização houve "leve". Ou a spec perde o nível, ou o código ganha.
2. **Modulação por `natureza_da_carga` não implementada.** A spec (§247) manda
   *"em_reorganizacao_ativa desce 1 nível; indeterminada não entra"*. **Não existe no motor** — grep
   por `natureza_da_carga` em `motor-calc.mjs` volta vazio. Liga na entrada de 2026-08-12 do
   `DECISOES.md`, onde tratar `indeterminada` foi medido e revertido por deslocar 49 de 58 leituras.

---

## 6. O que ficou aberto de antes (não é desta auditoria)

**18 das 60 leituras (30%) não têm nenhum pêndulo em alta nem muito alta.** Decisão do founder em
13/08: manter, sem auditar as íris. Registrado no `DECISOES.md` com o contraponto.

---

## Como repetir esta auditoria

```
node _motor-lab/check-eixos.mjs          # cobertura carga ⟷ antídoto
node scripts/smoke-render.mjs            # (de dentro de scripts/) render + travas
node scripts/verificar-decisoes.mjs      # config viva x DECISOES.md
node scripts/golden-set.mjs comparar     # deriva contra as 60 congeladas
```

As contagens de campo, incidência e cobertura deste documento foram feitas com scripts descartáveis
sobre `parseLastro()` e `calc()` — nenhuma delas exige API.
