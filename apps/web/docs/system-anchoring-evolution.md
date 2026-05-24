# Evolução do ANCHORING — silêncio → transparência (v2.5.0 → v2.5.4)

Documento de decisão arquitetural sobre o tratamento de achados
`natureza='indeterminada'` no Stage 2.

## Estado em v2.5.0 — "skip global"

Princípio: **achado indeterminado é ruído de leitura, não fato clínico**.
Decisão de design: silenciar completamente em prosa narrativa pra evitar
o anti-padrão Cristiane regens 1-2 onde §7 inventou "Magnésio pra adrenal"
e §8 inventou "depleção adrenal em curso" a partir de achado indeterminado.

**Regra escrita em ANCHORING_PRINCIPLE_V2_5:**
> "PROIBIDO mencionar em §2, §5, §7, §8, §10, §13 — mesmo de passagem.
> PERMITIDO mencionar UMA VEZ em §12 como nota técnica."

**Efeito esperado:** Stage 2 nunca inventa hipótese clínica a partir de
indeterminado.

**Efeito observado:** Stage 2 silencia COMPLETAMENTE os indeterminados.
Evanilce regen=6 tinha 3 (eixo_pituitario_adrenal, pineal_hipotalamica,
anel_interno) e nenhum apareceu no relatório — terapeuta lendo não
sabia que existiam.

## Tensão de design

Dois objetivos legítimos em conflito:

1. **Anti-invenção** (motivação original do skip global): impedir
   Sonnet de transformar limitação de leitura em diagnóstico falso.
2. **Transparência clínica** (motivação que emergiu pós-UAT): permitir
   que o terapeuta saiba o que NÃO foi possível avaliar, pra calibrar
   conversa com cliente e decidir se vale repetir fotografia.

Skip global resolve (1) mas falha em (2). O ANCHORING v2.5.0 priorizou
(1) sem dar atenção a (2) porque o anti-padrão visto era invenção, não
silenciamento.

## Estado em v2.5.4 — "silêncio em prosa, transparência em lista"

Princípio refinado: **achado indeterminado é ruído de leitura E é
fato auditável**. O ruído não pode virar hipótese; mas a limitação
de observação deve ser documentada.

**Regra atualizada em ANCHORING_PRINCIPLE_V2_5:**
> "PROIBIDO transformar achado de natureza 'indeterminada' em prosa
> narrativa ou hipótese clínica em §2 Categoria A, §5, §7, §8, §10,
> §13. PERMITIDO listar achado indeterminado APENAS em §2 Categoria C
> ('Campos não-conclusivos') com formato fixo de declaração de
> limitação — nunca como prosa elaborada, nunca como hipótese.
> PERMITIDO mencionar UMA VEZ em §12 como nota técnica."

**Mecanismo:** Categoria C em §2 é LISTA bullet com formato rígido
de UMA frase (campo + motivo). Motivo pertence a set fechado de 3
opções. Anti-invenção preservado: a estrutura impede que Categoria
C vire prosa elaborada ou hipótese clínica.

## Anti-padrão protegido (anti-invenção mantido)

A v2.5.4 NÃO reabre a porta pra invenção porque:

1. **Categoria C é LISTA, não prosa.** Sonnet não pode elaborar
   parágrafo de hipótese clínica em formato bullet de 1 frase.
2. **Motivo é set fechado.** Sonnet não pode "inventar motivo" tipo
   "este achado sugere desregulação adrenal não confirmada". O motivo
   tem que ser uma das 3 opções: midríase obscureceu, qualidade
   fotográfica, sobreposição de zonas.
3. **JAMAIS em §5/§7/§8/§10/§13.** Categoria C é exceção isolada em
   §2. Outras seções continuam proibidas de mencionar indeterminados
   como hipótese.
4. **Auto-checagem dedicada.** O bloco F6 do system.md tem checagem
   explícita: "algum item tem hipótese? REMOVA".

## Tabela comparativa

| Aspecto | v2.5.0 (skip global) | v2.5.4 (categoria C nomeada) |
|---|---|---|
| Indeterminado em §2 Categoria A | ❌ proibido | ❌ proibido |
| Indeterminado em §2 Categoria C | (Categoria C não existia) | ✅ permitido, lista rígida |
| Indeterminado em §5 | ❌ proibido | ❌ proibido |
| Indeterminado em §7 | ❌ proibido | ❌ proibido |
| Indeterminado em §8 | ❌ proibido | ❌ proibido |
| Indeterminado em §10 | ❌ proibido | ❌ proibido |
| Indeterminado em §13 | ❌ proibido | ❌ proibido |
| Indeterminado em §12 | ✅ permitido UMA menção como nota técnica | ✅ permitido UMA menção como nota técnica |
| Hipótese clínica a partir de indeterminado | ❌ proibido em todo lugar | ❌ proibido em todo lugar |
| Transparência ao terapeuta sobre limitação | ⚠️ só em §12 (escondido em prosa) | ✅ em §2 Categoria C (visível) + §12 |

## Trigger empírico

Evanilce regen=6 (`e8976f11-f404-4e34-8fa3-3f2047d0e4ea`,
v2.5.3 method_version `sonnet_2x_0.2.2`):

3 indeterminados no Stage 1:
- `eixo_pituitario_adrenal` I=2 (midríase obscureceu collarete)
- `pineal_hipotalamica` I=2 (midríase obscureceu zona 12h interna)
- `anel_interno` I=3 (midríase obscureceu zona pericentral)

Stage 2 §2 da regen=6 apresentou 3 ativos + 5 preservados + 0
indeterminados. Os 3 indeterminados ficaram completamente invisíveis
no relatório. Terapeuta lendo o relatório não sabia que esses campos
não puderam ser avaliados.

v2.5.4 resolve adicionando Categoria C que listaria esses 3 com
motivo único cada um.

## Decisões futuras

Após UAT v2.5.4 estabilizar, considerar:

- Adicionar Categoria C em §12 também (referência cruzada ao §2 com
  perguntas de anamnese específicas pros campos não-conclusivos).
- Permitir que Categoria C seja invocada por outros gates de
  qualidade (não só midríase): qualidade fotográfica baixa, fotos
  faltantes, reflexo sobreposto.
- Promover F5 (pareamento pigmento_amber obrigatório) caso
  warnings F4 recorrerem mesmo com F3 ativo.

## Histórico

- **v2.5.0** (2026-05-24): ANCHORING_PRINCIPLE_V2_5 introduzido com
  skip global de indeterminados.
- **v2.5.4** (2026-05-24): evolução pra categoria C nomeada após
  Evanilce regen=6.
