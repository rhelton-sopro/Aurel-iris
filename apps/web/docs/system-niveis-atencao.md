# Níveis de atenção visual em §2 (v2.5.4)

Mapeamento intensidade do Stage 1 → ícone visual no Stage 2 §2 (Mapa
Orgânico).

## Propósito

Antes de v2.5.4, §2 listava sistemas sem hierarquia visual. Terapeuta
lendo o relatório precisava reconstruir mentalmente a hierarquia de
expressão dos achados. F7 introduz marcação visual única por sistema
na Categoria A, baseada em intensidade do Stage 1 e em flag específica
para sinais extra-iridológicos.

## Tabela de mapeamento

| Ícone | Nome do nível | Disparo | Significado |
|---|---|---|---|
| 🔬 | Sinal extra-iridológico — investigação médica recomendada | `campo` ∈ {`vascularizacao_escleral`, `anel_sodico`, `arco_senil_periferico`} **com `intensidade≥4`** OU `descricao_visual` contém "ictericia"/"ictérica"/"amarelado"/"amarelo-âmbar"/"icterícia escleral" | Sinal sistêmico visível além da íris que pode requerer investigação médica formal além da iridologia. |
| 🔴 | Prioritário para investigação (integrativa) | Achado intra-iridológico com `intensidade ∈ {4, 5}`, `natureza` ativa, e que **NÃO** se enquadra em 🔬 acima | Sinal expressivo, hipótese integrativa que merece complementação clínica. |
| 🟡 | Observação relevante | `intensidade = 3`, `natureza` ativa | Sinal moderado, componente do quadro. |
| ⚪ | Sinal sutil | `intensidade ∈ {1, 2}`, `natureza` ativa | Sinal de menor expressão, registrar sem inflar peso clínico. |
| ◯ | Campo não-conclusivo | `natureza='indeterminada'` (Categoria C) | Documentação de limitação da observação. NÃO é hipótese clínica. |

## Aparição por categoria

| Categoria | Ícones permitidos |
|---|---|
| A — Sistemas que requerem atenção | 🔬, 🔴, 🟡, ⚪ |
| B — Sistemas em bom funcionamento | (sem ícone, uniforme) |
| C — Campos não-conclusivos | ◯ |

## Regra regulatória

NUNCA usar nestas seções:
- "Atenção alta/máxima/urgente/grave"
- "Risco elevado/crítico/preocupante"
- "Diagnóstico/patologia/doença"

SEMPRE preferir:
- "Sinal sugere", "hipótese integrativa"
- "Para investigação", "para complementar"
- "Profissional habilitado" quando recomendar conduta

## Nota visível ao cliente

Inserida no parágrafo de abertura da §2:

> Os ícones ao lado de cada sistema indicam o nível de expressão do
> sinal nesta leitura. Não são classificações médicas — são hipóteses
> integrativas a explorar em sessão com seu terapeuta.

## Coerência com §15 (Síntese Rápida)

§15 já usa 🔴 🟢 💛 ✨ para categorias diferentes:

| Seção | Significado do ícone |
|---|---|
| §2 | NÍVEL DE EXPRESSÃO do sinal (intensidade) |
| §15 | CATEGORIA temática (fragilidade, força, emoção, potência) |

Não há conflito porque os contextos visuais são distintos
(parágrafos vs cards). 🔴 em §2 = I=4-5 ativo; 🔴 em §15 = categoria
"Fragilidades".

## Histórico de versões

- **v2.5.4** (2026-05-24): introdução dos 5 níveis na Categoria A
  + ícone ◯ na Categoria C.

## Trigger empírico

- Evanilce regen=6 tinha `vascularizacao_escleral I=5` com
  descrição mencionando "icterícia escleral" — sinal extra-iridológico
  que ficou subordinado em §2 sem nomeação explícita do registro
  visual. F7/🔬 nomeia.
- 3 indeterminados invisíveis no §2 da Evanilce regen=6 — gap de
  transparência. F7/◯ + F6/Categoria C nomeiam.
