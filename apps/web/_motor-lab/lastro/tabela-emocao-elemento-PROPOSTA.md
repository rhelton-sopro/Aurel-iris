# Tabela Emoção → Elemento (PROPOSTA p/ aprovação do founder)

**Decisão de método (founder, 2026-07-22):** o temperamento (4 elementos Bardon) NÃO sai direto do órgão — sai da **EMOÇÃO**. Cadeia:

> **órgão/estrutura → emoção(ões) → elemento(s)**   ex.: fígado → raiva → 🔥 Fogo

Vantagem: reusa a camada de emoções que o motor JÁ calcula (os pêndulos) → o temperamento vira **re-agregação das mesmas emoções por elemento** (uma fonte de verdade). Casa com o achado da pesquisa (`motor-numeros-metodologia.md`): **o de-para é o que mais pesa** — então é aqui que investimos rigor, não no γ.

Cada emoção tem **1 elemento predominante + (opcional) 1 secundário**, com frações que somam 1.0. Vários achados podem empurrar o mesmo elemento (compõem/somam).

## As 4 assinaturas (Bardon)
- 🔥 **Fogo / Colérico** — raiva, irritação, impulso, controle, impaciência, força de vontade, coragem.
- 💨 **Ar / Sanguíneo** — alegria, entusiasmo, sociabilidade, leveza, comunicação, otimismo.
- 💧 **Água / Melancólico** — medo, tristeza, mágoa, ressentimento, sensibilidade, apego ao passado.
- 🌍 **Terra / Fleumático** — apego/retenção, calma, estabilidade, paciência, ruminação lenta, preocupação, teimosia.

## Tabela (predominante + secundário)
| Emoção | Predominante | Secundário | Racional |
|---|---|---|---|
| Raiva (aberta) | 🔥 Fogo 1.0 | — | fogo puro |
| Raiva contida | 🔥 Fogo 0.7 | 💧 Água 0.3 | fogo segurado por dentro (água introverte) |
| Irritação que sobe | 🔥 Fogo 1.0 | — | pavio curto |
| Impulso / reatividade | 🔥 Fogo 1.0 | — | gut/luta |
| Controle | 🔥 Fogo 0.7 | 🌍 Terra 0.3 | vontade + rigidez |
| Impaciência | 🔥 Fogo 0.7 | 💨 Ar 0.3 | pressa |
| Medo (de base) | 💧 Água 1.0 | — | água pura |
| Alerta / hipervigilância | 💧 Água 0.6 | 🔥 Fogo 0.4 | medo (água) + ativação/luta (fogo) |
| Tristeza / mágoa | 💧 Água 1.0 | — | melancólico |
| Ressentimento | 💧 Água 0.6 | 🔥 Fogo 0.4 | raiva guardada dentro da água |
| Contenção aprendida | 💧 Água 0.6 | 🌍 Terra 0.4 | segurar-se (melancólico + retenção) |
| Apego / não largar | 🌍 Terra 1.0 | — | retenção pura |
| Ruminação | 🌍 Terra 0.6 | 💧 Água 0.4 | remoer lento + fundo emocional |
| Ansiedade / preocupação | 🌍 Terra 0.5 | 💧 Água 0.5 | remoer (terra) + medo (água) |
| Teimosia / rigidez | 🌍 Terra 0.7 | 🔥 Fogo 0.3 | inércia + vontade |
| Alegria | 💨 Ar 1.0 | — | ar puro |
| Entusiasmo / expansão | 💨 Ar 1.0 | — | sanguíneo |
| Vínculo / amor | 💨 Ar 0.5 | 💧 Água 0.5 | conexão (ar) + afeto profundo (água) |
| Dispersão (sombra) | 💨 Ar 0.7 | — | inconstância sanguínea |

## Cálculo do temperamento %
`score(elemento) = Σ_emoções [ peso_intensidade(emoção) × fração(emoção, elemento) ]`
→ normaliza os 4 scores pra 100 (composição ipsativa) → arredonda por **maior-resto/Hamilton** (inteiros que somam 100, únicos, sem parecer template). Dominante + secundário = os 2 maiores.

## ⚠️ DECISÕES ABERTAS (founder)
1. **Recursos contam?** Emoções LIVRES (alegria livre, firmeza) expressam temperamento (a pessoa É alegre/firme), mas hoje só medimos intensidade nas CARGAS. Opções: (a) só cargas [mais medido]; (b) cargas + recursos com peso menor [mais fiel ao "quem a pessoa é"]. É a antiga dúvida "Sanguíneo conta o coração preservado?".
2. **Calibração das frações secundárias** (0.3/0.4/0.5): são meu rascunho. A pesquisa diz que o PREDOMINANTE é ~80% do resultado; o secundário afina. Dá pra medir sensibilidade por Monte Carlo depois. Prioridade = acertar o predominante.
3. **Órgão→emoção** (o 1º hop) já vive em `tabela-lastro-MASTER.md` + `iridologia-psicoemocional-extracao.md` — revisar se algum órgão precisa de emoção/elemento adicional.

## Exemplo — Helton
Cargas: raiva contida(int4) · contenção aprendida(int4) · irritação que sobe(int4) · alerta(int3) · apego(int3) · medo de base(int2).
→ 🔥 Fogo = raiva contida(4×0.7=2.8) + irritação(4×1.0=4.0) + alerta(3×0.4=1.2) = **8.0**
→ 💧 Água = raiva contida(4×0.3=1.2) + contenção(4×0.6=2.4) + alerta(3×0.6=1.8) + medo(2×1.0=2.0) = **7.4**
→ 🌍 Terra = contenção(4×0.4=1.6) + apego(3×1.0=3.0) = **4.6**
→ 💨 Ar = 0 (nenhuma carga sanguínea) = **0**
→ normaliza (20.0 total) → Fogo 40 / Água 37 / Terra 23 / Ar 0 → Hamilton → **🔥40 · 💧37 · 🌍23 · 💨0**. Colérico dominante, Melancólico colado. (Ar 0 mostra por que a decisão #1 importa: sem contar recursos, a alegria livre dele não aparece.)
