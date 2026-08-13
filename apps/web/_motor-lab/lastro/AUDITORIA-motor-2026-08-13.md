# AUDITORIA DO MOTOR — Stage 1 → Stage 2, glossário, tabelas e fórmulas

**Data:** 2026-08-13 · **Pedido do founder:** *"o que eu quero? Stage 1 e Stage 2 funcionando redondo.
E os nossos glossários, nossas tabelas para cálculo, as nossas fórmulas. Veja se isso tudo está
redondinho funcionando. Faça uma auditoria."*

**Método:** tudo medido, nada presumido. Cobertura das tabelas conferida contra a canônica; a costura
Stage 1 → Stage 2 conferida contra o glossário; incidência real medida nas **60 leituras de produção**
(`report_findings`, `superseded_at IS NULL`). Custo de API: **zero** — é leitura de banco e conta local.

---

## Veredito em uma linha

**O motor está redondo.** Dos 29 campos que carregam peso, **nenhum** tem furo de tabela. Achei
**dois defeitos reais** (um vivo, pequeno; um latente), e **três decisões** que são suas, não minhas.

---

## 1. O que está íntegro ✅

| Verificação | Resultado |
|---|---|
| **Eixos** (carga ⟷ antídoto) | 268 cargas + 149 recursos, cada uma em **exatamente um** eixo. Zero órfãos, zero typos, zero duplicatas. |
| **Campos que carregam peso** | **29 de 38.** Todos os 29 têm: os dois polos (carga E recurso), crença, suporte nutricional e eixo integrativo. **Zero lacunas.** |
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

**O que FALTA e é decisão sua** — três saídas, e a escolha é de iridologia, não de código:
1. **Mapear** `baco` e `plexo_solar` na tabela-lastro (elementos, centro, emoções 🔴/🟢, crenças).
   É a saída completa e exige o seu conhecimento.
2. **Tirar** os dois do glossário do Stage 1, para o modelo não poder emiti-los.
3. **Deixar como está**, agora que o descarte é visível. São 2% dos achados.

---

## 3. Defeito LATENTE — entrada malformada na canônica 🟡

`tabela-lastro-CANONICA.md`, linha 499, campo `sistema_imune`:

```
🔴 emoções: baixa autoestima (Dias) · desilusão/trauma localizado (Dias) · "baixa estima → baixa imunidade" (Dias)
```

A terceira **não é uma emoção** — é uma nota de mecanismo (causa → efeito) escrita dentro da lista de
emoções. Ela é lida como emoção, **não tem eixo**, e geraria um pêndulo com
*"(SEM ANTÍDOTO — furo na canônica)"* na tela do cliente.

**Nunca disparou:** 0 ocorrências nas 60 leituras. Ela é a 3ª do campo, entra com peso `DECAY²=0,36`
e raramente alcança o leque. **É armadilha, não incêndio** — mas é a única emoção da canônica inteira
sem eixo, e some com uma linha de edição.

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
