# AUDITORIA — o Stage 1 alimenta o temperamento-por-estrutura de forma equilibrada?

**Data:** 2026-07-22. **Pergunta do founder:** se o Stage 1 captura os marcadores estruturais de forma desbalanceada, o temperamento não funciona. Auditar.

## VEREDITO: ❌ NÃO. Os campos-chave são INVARIANTES + o tipo Rayid é AUSENTE.

### Evidência — 3 exames reais (self, daniel, miguel)
| campo | self | daniel | miguel | enum (valores possíveis) |
|---|---|---|---|---|
| `trama_fibras` | media | media | media | compacta_densa / **media** / aberta / irregular |
| `pupila` | centrada_regular | centrada_regular | centrada_regular | **centrada_regular** / descentrada / deformada / miose / midriase |
| `bordas_pupilares` | regulares | regulares | regulares | **regulares** / achatamentos / descentralizacoes / irregulares |
| `cor_predominante` | verde_acinzentado | misto | verde_acinzentado | (variou um pouco) |

**3 pessoas diferentes → 3 valores IDÊNTICOS** nos campos que a receita mais usa. O schema TEM os valores discriminantes (densa/aberta, miose/midríase, achatamentos), mas o modelo **default no neutro/meio** toda vez. Sinal de discriminação ≈ 0.

### Furos adicionais
1. **Tipo Rayid (Jóia/Flor/Corrente) NÃO é capturado** — busca por "joia/flor/corrente" na saída = nada. As âncoras PRIMÁRIAS da receita (`temperamento-por-estrutura.md`) não existem no output.
2. **`pigmento_amber` é ACHADO/carga**, não sinal constitucional. Tem até heurística F4 de "pigmento órfão" (localizador de trauma pareado a órgão). O pigmento CONSTITUCIONAL (Jóia=Ar) aparece só como TEXTO LIVRE em `outros_sinais_globais` ("tonalidade âmbar-dourada pericentral").
3. O sinal estrutural BOM (pigmento, radii, collarette, cor) existe — mas **preso em `outros_sinais_globais` (prosa)**, não estruturado.

## Implicação
A receita estrutura→elemento está correta em teoria, mas **não roda no dado atual do Stage 1**: os enums estruturais não discriminam, o Rayid não existe, e o pigmento constitucional não é sinal estruturado. Rodar assim = mesmo temperamento pra todos.

## Opções (decisão do founder — toca a regra "não mexer no Stage 1")
- **A. Calibrar/estender o Stage 1** pra (i) comprometer-se decisivamente em trama/pupila/bordas (não jogar no meio) e (ii) capturar tipo estrutural (Jóia/Flor/Corrente) + pigmento constitucional como SINAL. → mexe no canônico (calibração) — ASK. Provavelmente necessário.
- **B. Camada de derivação** que lê `outros_sinais_globais` (texto livre) + cor e EXTRAI os sinais estruturais (pigmento→Jóia, radii, collarette, abertura de fibra). Não toca o scan do Stage 1; mas parseia prosa (menos determinístico). O sinal bom JÁ está lá em texto.
- **C. Medir mais exames** antes de decidir (3 é amostra pequena — mas a invariância em 3/3 já é forte).
- ⚠️ Risco de fundo: parte dos marcadores finos (trama/bordas) pode não ser confiável em foto comum → forçar decisão = ruído. O sinal MAIS confiável é o que já aparece no texto (pigmento/cor/radii/collarette).
