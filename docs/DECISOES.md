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
| Modelo do **Stage 1** (ler a íris) | `claude-sonnet-4-6` | APLICADA | `lib/anthropic/client.ts` · decisão 2026-07-26 |
| Modelo da **localização da pupila** (crop) | `claude-sonnet-5` | APLICADA | `6d3a806` · `lib/canonicalize/pupil-center.ts` |
| Modelo do **Stage 2 — Mapa do Ser** | `claude-sonnet-5` | APLICADA | `lib/emocional/gerar.ts` |
| Modelo do **Stage 2 — Dossiê** | `claude-sonnet-4-6` | APLICADA | decisão 2026-07-20 |
| Método de **crop** | pupila ±500 → 1000×1000 | APLICADA | `6d3a806` · rollback: `CROP_METHOD=bbox` |
| **Relatório principal** | Mapa do Ser | APLICADA | `48b4c00` (2026-07-30) |
| **Dossiê** | opcional, sob demanda, **1 crédito** | APLICADA | `48b4c00` |
| **Leituras anteriores a 30/07** | permanecem no Dossiê, sem oferta de migração | APLICADA | `48b4c00` |
| **Versão do cliente** (Mapa do Ser) | tudo menos "Perguntas para a sua sessão"; caixinha inclui | APLICADA | `48b4c00` |

---

## Histórico

### 2026-07-31 — Refazer o estudo de modelo do Stage 1
**Decisão:** refazer a comparação 4.6 × Sonnet 5 antes de qualquer troca.
**Razão:** o estudo de 26/07 mediu o 4.6 **antes** do conserto de topografia
(`4d6a842`+`534cfc2`), e era o falso positivo do fígado que decidia o comparativo. Pior:
aquele harness oferecia **45 campos** ao modelo contra os **40** de produção — os 5 extras
eram constitucionais (`trama_fibras`, `vascularizacao_escleral`, `pupila`,
`bordas_pupilares`, `cor_predominante`), e o 4.6 gastava vagas de achado com eles
(`vascularizacao_escleral` 3/3, `trama_fibras` 2/3). O Jaccard que decidiu a escolha foi
medido com uma régua diferente da de produção.
**Status:** EM CURSO — harness `_audit-posfix.mts` (importa `KNOWN_CAMPOS_LIST`, sem enum
hardcoded). Founder decide depois do resultado.

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

## Como usar

- **Ao tomar uma decisão:** registrar aqui na mesma sessão, com razão e status.
- **Ao aplicar:** trocar o status para `APLICADA` e colar o commit.
- **Ao mudar de ideia:** nova entrada que supera a anterior. Nunca editar a antiga.
- **Antes de subir algo que muda configuração:** `node scripts/verificar-decisoes.mjs`.
