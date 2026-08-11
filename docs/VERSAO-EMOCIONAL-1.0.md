# Versão Emocional 1.0 — o retrato congelado (2026-08-11)

**Decisão do founder:** congelar Stage 1 + Stage 2 como estão HOJE, antes da calibração dos
campos invisíveis. *"Se a gente precisar falar 'ó, não gostei', vamos voltar pra 1.0."*

Tag do git: **`emocional-1.0`**

---

## Por que congelar ANTES

As mudanças em discussão (endereço radial dos campos, peso/clareza no preservado, piso de 4
para 2) parecem locais ao Stage 1, mas não são. A cadeia:

    preservado → centro[c].l (livre)         achado → centro[c].t (tensão)
    AGULHA = (l + α) / (t + l + 2α) × 100          α = 1.2

Ou seja, mexer no Stage 1 **reescreve os gráficos** e pode reordenar os blocos
determinísticos 6, 7 e 8, que já estão no ar e aprovados. E o `α` foi calibrado contra um
resultado aprovado pelo founder (*"Ajustado p/ bater o mockup aprovado (Helton ~26/83/21)"*)
— sem régua congelada, essa calibração se perde em silêncio.

## O que compõe a versão 1.0

### Prompts
- `apps/web/prompts/stage1-scan.md` — Stage 1 (o exame da íris)
- `apps/web/lib/anthropic/stage1-glossary.ts` — glossário dos 44 campos
- `apps/web/lib/anthropic/stage1-schema.ts` — schema da saída
- `apps/web/_motor-lab/prompts/` — Stage 2 (Mapa do Ser)
- `METHOD_VERSION = 'sonnet_2x_0.2.2'`

### Motor (`apps/web/_motor-lab/motor-calc.mjs`)
| constante | valor | o que faz |
|---|---|---|
| `GAMMA` | 1.1 | expoente de intensidade |
| `K` | 6 | saturação do squash S/(S+k) |
| `W_PRES` | `{ vital_ativo: 2.0, neutro: 1.5 }` | peso do preservado — **é isto que a "clareza 1-5" substituiria** |
| `BASELINE_LIVRE` (α) | 1.2 | prior da agulha; calibrado contra o mockup aprovado |
| `DECAY` | 0.6 | decaimento por rank dentro do campo |

### Render
- `apps/web/_motor-lab/render-novo.mjs` — 9 blocos, fórmula da agulha na linha ~113

### Lastro
- `apps/web/_motor-lab/lastro/` — tabelas canônicas, famílias, carências, integrativas

## O golden set

`apps/web/_motor-lab/golden/emocional-1.0.json` — o que o motor produz hoje em **60
leituras reais**:

- agulhas mente/coração/corpo
- nº de achados e de preservados
- famílias emocionais e a dominante
- itens do bloco 7 (Repertório) e categorias do bloco 8 (Integrativas)
- hash do documento renderizado

**Médias de referência: mente 28 · coração 65 · corpo 33.**

⛔ Não contém texto de relatório nem nome de cliente — só números, rótulos e hash. Serve
para detectar mudança sem carregar dado de cliente no repo.

## Como usar

**Ver se algo mudou** (depois de qualquer calibração):

    cd apps/web && node scripts/golden-set.mjs comparar

Sai leitura a leitura: `mente 28→31 · bloco 7 mudou (10→8 itens) · documento mudou`.

**Voltar para a 1.0:**

    git checkout emocional-1.0 -- apps/web/prompts apps/web/lib/anthropic/stage1-glossary.ts \
      apps/web/lib/anthropic/stage1-schema.ts apps/web/_motor-lab

⚠️ Voltar o código NÃO reverte os `report_findings` já gravados com a versão nova — o Stage 1
é caro e não roda de novo sozinho. Leituras geradas na versão nova continuam como estão; o
rollback vale para as próximas.

**Regravar o golden** (só quando uma versão nova for APROVADA, nunca para "consertar" um
diff indesejado):

    node scripts/golden-set.mjs

## O que vem depois da 1.0 (proposto, não aplicado)

1. Endereço radial + critério nos campos que nunca dão achado — coração, pulmões,
   musculoesquelético, boca/garganta. Ver `_motor-lab/lastro/PROPOSTA-calibracao-campos-invisiveis.md`.
2. Clareza 1-5 no preservado (hoje é binário: 76% saem como `neutro`, que é silêncio e não
   força). Substitui `W_PRES` e **exige recalibrar o α**.
3. Piso de preservados de 4 para 2 — ⚠️ medido: 45% das leituras já saem com menos de 4, então
   o ganho aqui é pequeno.
4. Bloco novo: dimensão arquetípica. Ver `lastro/tabela-arquetipos-PROPOSTA.md`.

**Critério de aceite de qualquer uma delas:** rodar `golden-set.mjs comparar` e olhar o que
mexeu. Agulha do founder deve continuar perto de **26/83/21** — foi ela que aprovou o gráfico.
