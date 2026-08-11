# PROPOSTA de calibração — os 4 campos que nunca viram achado

**Status: PROPOSTA. Nada aplicado.** Calibração de Stage 1 muda TODOS os relatórios,
inclusive os blocos já aprovados no ar — só entra com aprovação explícita do founder.

## O problema, medido

Em 40 leituras reais, quatro campos **nunca** foram reportados como achado — só como
preservados, e em quase toda leitura:

| campo | achado | preservado |
|---|---:|---:|
| sistema_musculoesqueletico | **0** | 32 (80%) |
| pulmoes | **0** | 28 (70%) |
| coracao | **0** | 25 (63%) |
| sistema_linfatico | 2 | 17 |

Consequência: as famílias emocionais que moram nesses campos (**Vínculo e afeto**,
**Tristeza e perda**) nunca aparecem como sombra. E a "luz" do relatório é quase sempre a
mesma para pessoas diferentes — Forer estrutural, nascido no Stage 1.

## A causa

Comparando com um campo calibrado:

    figado_vesicula  [SEMPRE achado]
      zona : "Anel MUSCULATURA (4º de 7), ~7:30-8:15h, íris DIREITA apenas"
      carga: "Pigmento âmbar DENSO e CONCENTRADO na faixa 7:30-8:15h... NÃO
              pericentral, NÃO difuso... Pigmento difuso na íris inteira NÃO
              qualifica (é constitucional)."

    coracao          [NUNCA achado]
      zona      : "Superior esquerda OE (~2-3h)"
      carga     : "Lacunas, manchas, anel circular"
      preservado: "Zona limpa, pupila centrada"        ← ⚠️

Dois defeitos:

1. **O critério de preservação não é do campo.** "Pupila centrada" é marcador GLOBAL —
   quase toda íris tem. O modelo vê pupila centrada e declara o coração preservado. É um
   cheque em branco, e viola a regra do próprio prompt: *"Ausência de carga NÃO é evidência
   de saúde. O que nunca entra é a zona onde você simplesmente não viu nada."*
2. **A carga é vaga onde não houve calibração** — sem zona precisa, sem critério de
   exclusão. Comparar com o fígado é a diferença entre um alvo e uma direção.

Somado à cota do prompt ("4-12 preservados, mire ≥4 genuínos"), o modelo preenche com os
campos cujo critério de preservação é fácil. **Eles não são escolhidos por observação; são
escolhidos por serem fáceis.**

⛔ O objetivo NÃO é fazer aparecer carga nesses campos (founder: *"também não é pra ir para
outro extremo"*). É fazer o Stage 1 EXAMINAR o campo e reportar o que viu — dos dois lados,
com critério.

## Lastro da proposta

**Iridologia psicoemocional — Marcos V. Dias** (`lastro/_dumpA.txt` ~2515, `_dumpB.txt` ~3765),
**Área da VONTADE**: lado TEMPORAL, sobre o sistema brônquio-pulmonar e o coração.

- **Lacuna** na área → *"indecisão e incapacidade de ligar-se de maneira estável com o
  parceiro, medo de comunicar, medo de não encontrar/receber o amor desejado... dificuldade
  de manter uma ligação com os outros"* → família **Vínculo e afeto**.
- **Pigmento** na área → *"o amor condicionado ao sacrifício pessoal — quanto mais me
  sacrifico, mais amor me deverá ser doado"*.
- **Pigmento no setor SUPERIOR do lado temporal** → *"forte desilusão sentimental"*.

⭐ A leitura é EMOCIONAL, não clínica: carga aqui vira "dificuldade de vínculo", nunca
"problema cardíaco". O guardrail não-médico fica intacto.

## Entradas propostas (para o founder revisar palavra por palavra)

### coracao

    zona: 'Área da VONTADE — setor TEMPORAL (~9h OD, ~3h OE), sobre brônquio-pulmonar
           e coração. Setor SUPERIOR temporal = desilusão sentimental (Marcos V. Dias).'
    sinal_carga: 'LACUNA de contorno definido no setor temporal, OU pigmento
           CONCENTRADO na mesma faixa. Pigmento DIFUSO pela íris inteira NÃO qualifica
           (é constitucional). Micro-irregularidade de trama, sem lacuna nem pigmento
           delimitado, NÃO qualifica.'
    sinal_preservacao: 'Setor temporal examinado por varredura DIRETA: fibras contínuas
           e regulares, tom uniforme, SEM lacuna definida e SEM pigmento concentrado.
           ⛔ "pupila centrada" NÃO é critério — é sinal global, não do campo.'

### pulmoes

    zona: 'Temporal superior (~3h OE, ~9h OD) — mesma Área da VONTADE, porção
           brônquio-pulmonar.'
    sinal_carga: 'Lacuna definida OU opacidade delimitada na faixa temporal superior.
           Opacidade difusa periférica NÃO qualifica (é linfática/constitucional).'
    sinal_preservacao: 'Faixa temporal superior varrida diretamente: fibra contínua,
           sem lacuna e sem opacidade localizada.'

### sistema_musculoesqueletico

    sinal_preservacao: 'Estroma com fibra compacta e alinhada VERIFICADA em pelo menos
           dois setores distintos. ⛔ trama fechada de constituição NÃO é preservação
           observada — é o tipo de íris da pessoa.'

### sistema_linfatico

    sinal_preservacao: 'Coroa periférica varrida: sem rosário, sem opacidade difusa,
           tom uniforme em toda a volta.'

## Como validar antes de aplicar

1. Aplicar **só o coracao** primeiro.
2. Rodar contra as mesmas 40 leituras (o exame é reproduzível — mesmas fotos, mesmo prompt).
3. Medir: quantas passam a ter carga no coração. Esperado: ALGUMAS, não todas.
   - se ~0 → a calibração não pegou; refazer
   - se >50% → foi pro outro extremo; endurecer critério
4. Só então os outros três.

⚠️ Custo: reprocessar 40 leituras é ~40 × US$ 0,168 ≈ **US$ 6,70** por rodada de validação.
