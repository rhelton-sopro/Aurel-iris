# Estudo de CÁLCULO do relatório novo — o que o motor precisa computar

**Data:** 2026-07-22. **Objetivo:** mapear, para cada bloco do relatório aprovado, O QUE precisa ser calculado e COM QUAL metodologia — o "motor de números" (a metade determinística do híbrido; a outra metade é o LLM escrevendo a prosa). Base: os 6 blocos aprovados + a `tabela-lastro-CANONICA.md` (travada, auditada).

> **Arquitetura híbrida:** o CÓDIGO calcula tudo que é número (centros, scores, perfil de elementos, seleção) de forma determinística e única por pessoa; o LLM recebe esses números + o leque de emoções/crenças e ESCREVE os 6 blocos na voz do cliente (8ª série, anti-Forer). O LLM não inventa número; o código não escreve prosa.

---

## VISÃO GERAL DO FLUXO

```
Stage 1 (achados + preservados + constituição)
        │
        ▼
  PASSO 0 — o LEQUE: cada campo → tabela-lastro → {elemento(s)%, centro, emoções(polo), crenças}
        │
        ├──▶ (A) SCORE por intensidade ......... base de tudo
        ├──▶ (B) EMOÇÕES (mapa emocional) ....... agregação por família + squash
        ├──▶ (C) 3 CENTROS (topográfico) ........ tensão/livre por zona → agulha
        ├──▶ (D) PERFIL DE ELEMENTOS (interno) .. 2 somatórios → magnitude + balanço
        └──▶ (E) SELEÇÃO top-N .................. o que entra em cada bloco
        │
        ▼
  LLM escreve os 6 blocos consumindo os números + o leque
```

---

## PASSO 0 — O LEQUE (campo → lastro)

Para CADA achado e CADA preservado, o motor resolve o `campo` na tabela-lastro e puxa: **elemento(s) + %**, **centro** (Mente/Coração/Corpo), **emoções** (no polo certo: achado→🔴 desequilíbrio, preservado→🟢 equilíbrio) e **crenças**. É a matéria-prima de todos os cálculos e da prosa. **Por isso a tabela tem que ser exaustiva.**

**⚠️ REQUISITO — o motor precisa CLASSIFICAR cada campo antes de calcular:**
1. **Sinais EXTRA-IRIDOLÓGICOS (médicos, NÃO emocionais) → PULAR no motor emocional.** Regra já existente (`docs/system-niveis-atencao.md`): `{vascularizacao_escleral, arco_senil_periferico}` (e `anel_sodico` quando I≥4) são **sinais sistêmicos/médicos** (ícone 🔬), disparados por `intensidade≥4` OU descrição com "icterícia/amarelado/amarelo-âmbar" (o **amarelo** = eixo hepatobiliar). **Eles NÃO têm leitura emocional** e NÃO entram no leque/elementos/centros. Estão corretamente FORA da tabela-lastro. (Ex.: o `vascularizacao_escleral I5` do Helton — o achado "mais gritante" do exame — é justamente esse caso: **excluído de propósito**, não é lacuna.) No máximo viram uma nota médica no **dossiê do terapeuta** — nunca no doc emocional do cliente. ⚠️ `anel_sodico` é DUPLO: tem leitura emocional (via `sistema_circulatorio` = rigidez/apego) E pode disparar o flag médico quando I≥4 — mantém o emocional.
2. **Alias / chave diferente** (ex.: Stage 1 emite `manchas_psoricas`; a tabela guarda sob `sistema_imune`). → tabela de aliases campo→campo.
3. **Marcadores / localizadores** (`anel_interno`, `pigmento_amber`, `lacuna_estrutural`, `cripta`): NÃO carregam elemento próprio — herdam da ÁREA e/ou marcam o QUANDO (linha do tempo). → **não entram no somatório de elementos**; alimentam a linha do tempo e o tema da área.

**Classificação do campo (Passo 0):** `emocional` (→ leque completo) · `extra-iridológico/médico` (→ pula no emocional; dossiê só) · `marcador/localizador` (→ linha do tempo + tema da área, sem elemento) · `modulador constitucional` (→ recurso/lente).

---

## METODOLOGIA DOS CÁLCULOS-NÚCLEO

### (A) Score por intensidade — a base
O Stage 1 dá `intensidade` 1-5 por achado. É o único número objetivo da íris. Todo score deriva dele. Já é uma compressão perceptual (o próprio Sonnet comprime), então **NÃO** empilhamos Stevens/Fechner por cima — usamos peso quase-linear `intensidade^γ`, **γ ≈ 1,1** (1,0 = linear puro; 1,3 = dá mais destaque aos gritantes). Modulação por `natureza_da_carga`: `em_reorganizacao_ativa` desce 1 nível (já caminha pro livre); `indeterminada` não gera; demais mantêm.

### (B) Emoções — agregação por FAMÍLIA (mapa emocional, bloco 5)
Uma emoção não vem de um órgão só — vem da **família de campos** que a alimentam. Por isso ela discrimina mesmo quando um campo é igual entre pessoas.
```
score(emoção) = squash( Σ_campos-da-família  intensidade^γ )
squash(S) = S / (S + k)      // satura perto do topo: 1 achado gritante não engole os outros
```
Ex.: **raiva** = família {fígado, radii, coroa_simpática}. No Helton: fígado I4 + radii I4 → raiva ALTA. No Miguel: fígado I4 + radii I3 → raiva média-alta. **Mesmo fígado, radii separa** — é o DNA.
Lado: veio de **achado** → carga (polo 🔴); veio de **preservado** → recurso (polo 🟢).

### (C) 3 Centros topográficos (bloco 2 — Mente·Coração·Corpo)
Cada campo tem um `centro` (Mente/Coração/Corpo; se duplo, divide o peso 0,5/0,5).
```
tensão(centro)  = Σ_achados-do-centro   ( intensidade^γ × peso_centro )   [modulado por natureza]
livre(centro)   = Σ_preservados-do-centro ( peso_pres × peso_centro ) + zona_quieta
agulha(centro)  = livre / (tensão + livre)      // 0 = tudo tensão (esquerda/âmbar) · 1 = tudo livre (direita/verde)
```
`peso_pres`: vital_ativo = 2,0 · neutro = 1,5. `zona_quieta`: centro sem nenhum achado = preservado (conta como livre) — foi o que acertou o Miguel (mente clara = força, não ausência).

### (D) Perfil de elementos — INTERNO (o que colore a prosa)
Dois somatórios por elemento, usando o elemento% de cada campo:
```
carga⁻(elem)   = Σ_achados      ( intensidade^γ × fração_elem )
recurso⁺(elem) = Σ_preservados  ( peso_pres     × fração_elem ) + constituição
magnitude(elem) = squash( carga⁻ + recurso⁺ )        // quanto o elemento está presente
balanço(elem)   = recurso⁺ / (carga⁻ + recurso⁺)     // 0 = puro desequilíbrio · 1 = puro recurso
```
**Escalas independentes** (NÃO somam 100 — forçar 100 achata todo mundo). Cada elemento = um mostrador (magnitude + balanço). É **interno**: a IA lê "Fogo forte e carregado / Água forte e equilibrada" e COLORE o texto — o cliente nunca vê "X% Fogo". Constituição entra no recurso: pupila centrada → Terra (centramento); trama compacta → Terra (vitalidade); bordas regulares → Terra (estabilidade).

### (E) Seleção top-N
- **Emoções (mapa):** top ~6 cargas (por score) + ~4 recursos. Nunca as 60.
- **Achados protagonistas (bloco 1):** top 3 por intensidade.
- **Linha do tempo (bloco 3):** todos os nós de `linha_temporal`, ordenados por idade; status (a_resolver/em_processo/resolvido) decide cor e se ganha "Chaves".
- **Heranças (bloco 4):** 1-2 padrões dos achados `herdada_constitucional` + fecho de resiliência.
- **Perguntas (bloco 6):** top ~4-5 cargas do mapa + 1 recurso.

---

## O QUE CADA BLOCO PRECISA CALCULAR

| # | Bloco | Consome | Cálculo (código) | O que o LLM faz |
|---|---|---|---|---|
| 1 | Em poucas palavras | top 3 achados | (E) seleção top-3 por intensidade → suas emoções (A/B) | tece os 3 achados como emoção + 1 pergunta maiêutica |
| 2 | Como você funciona (Mente·Coração·Corpo) | achados + preservados + constituição por centro | **(C) 3 centros** + agulha; tensão dominante×secundário; **(D) perfil de elementos** p/ colorir | escreve os 3 centros, facetas, "mesma raiz 2 lados", etc., ancorado nos números |
| 3 | Linha do tempo emocional | `linha_temporal[]` | ordena por idade; mapeia status→cor; nó→emoção (B) | narra cada nó (emoção+comportamento+situação) + Chaves |
| 4 | Heranças transgeracionais | achados `herdada_constitucional` + tema | (E) escolhe 1-2 padrões; fecho resiliência | monta a corrente + hipótese + frase + ritual |
| 5 | Mapa emocional (pêndulos) | achados + preservados | **(B) score das emoções** por família + squash; (E) top 6 cargas + 4 recursos | escreve os pêndulos carga⟷antídoto + fecho (recurso=remédio) |
| 6 | Perguntas p/ a sessão | mapa do bloco 5 | (E) top 4-5 cargas + 1 recurso | escreve os "Caminhos" (processo somático 5 tempos) |

O **perfil de elementos (D)** e o **leque de crenças** atravessam TODOS os blocos como coloração interna (a IA "sabe" que o Fogo do Helton está inflamado e escreve com esse tom), mas nunca viram "X% Fogo" no texto.

---

## EXEMPLO COMPLETO — Helton (self), computado dos dados reais

**Achados:** **vascularizacao_escleral I5 → EXTRA-IRIDOLÓGICO/médico, pulado no emocional (correto — não é lacuna)** · figado I4 · radii I4 · anel_interno I4 (marcador→só linha do tempo) · intestino_grosso I3 · sist_nervoso_autonomico I3 · rim I2 · eixo_pituitario_adrenal I1.
→ **Achados emocionais reais que entram no motor:** figado I4 · radii I4 · intestino_grosso I3 · nervoso I3 · rim I2 · eixo I1 (o "mais forte" da leitura emocional passa a ser o **fígado I4**, não o vascular).
**Preservados:** coração(neutro) · pulmões(neutro) · linfático(neutro) · musculoesquelético(**vital**).

### Perfil de elementos (D) — γ=1 (ilustrativo), k a calibrar
| elemento | carga⁻ | recurso⁺ | magnitude (bruta) | **balanço** | leitura |
|---|---|---|---|---|---|
| 🔥 Fogo | 5,6 | 1,0 | 6,6 | **16% livre** | forte e **bem carregado** (raiva contida, ferve) |
| 💧 Água | 4,5 | 3,4 | 8,0 | **43%** | forte, mais equilibrada (sente e tem recurso) |
| 🌍 Terra | 4,3 | 3,6 | 7,9 | **45%** | forte e equilibrada (base sólida) |
| 💨 Ar | 2,6 | 1,0 | 3,5 | **28%** | baixo e carregado (mente que rumina) |

→ Leitura interna que a IA usa: *"Fogo dominante e inflamado; Água e Terra fortes mas com recurso; Ar baixo."* Bate com "ferve rápido, guarda a raiva, tem base". **Discrimina** (o Miguel racional daria Ar mais alto e mais livre).

### 3 Centros (C) — ilustrativo
- **Corpo/Instinto:** tensão alta (fígado+radii+intestino+rim) → agulha à esquerda (reage rápido).
- **Mente:** tensão média (nervoso autônomo) → meio.
- **Coração:** achados ~0 + coração preservado(neutro) → **agulha à direita (livre/inteiro)**.
Bate com o mockup aprovado (Mente 26 / Coração 83 / Corpo 21).

---

## LACUNAS E DECISÕES ABERTAS (pra você bater o martelo)

1. **Lista de classificação dos campos** — o motor precisa da lista canônica de quais campos do Stage 1 são `emocional` vs `extra-iridológico/médico` vs `marcador` vs `modulador`. A base já existe (`system-niveis-atencao.md` dá o set médico: vascularizacao_escleral, arco_senil_periferico, anel_sodico≥I4). → montar a lista fechada dos ~42 campos do glossário do Stage 1 marcados por classe (rápido; garante que nenhum sinal físico vaze pro emocional e nenhum emocional seja pulado). **NÃO** dar leitura emocional aos médicos — o `vascularizacao_escleral` fica fora de propósito.
2. **Aliases** (`manchas_psoricas`→`sistema_imune`): fazer a tabela de aliases (rápido).
3. **Parâmetros** (sua chamada): **γ** (1,0–1,3; proponho 1,1) · **k** da saturação (calibrar nos 3 exames reais pra os números "fazerem sentido") · **pesos preservado** (vital 2,0 / neutro 1,5).
4. **Ranking de preservados** (1º/2º/3º mais preservado que você pediu): o Stage 1 só dá 2 níveis (vital_ativo/neutro). Ranking fino exigiria campo novo no Stage 1 = mexer no canônico (ASK).
5. **pulmões no recurso**: hoje elemento% = 💧Água (carga=tristeza); o polo recurso é respiração/leveza, que você associou a Ar. Decidir se o recurso puxa Ar (precisa marcar o elemento do POLO, não só do campo).

---

## PRÓXIMO (depois que você validar a metodologia)
1. Completar a tabela com os campos físicos + aliases (agente).
2. Escrever o **motor** (código que faz A–E) e rodar nos 3 exames reais pra calibrar γ e k.
3. Escrever o **prompt Stage 2** que consome os números + o leque. ⛔ calibrar Sonnet = ASK antes.
