# Tabela-lastro — ACHADO (campo Stage 1) → HIPÓTESE DE SUPORTE NUTRICIONAL + LEITURA MTC/AYURVEDA

**Data:** 2026-08-03. **Status:** v1 — lastro para o bloco novo "Repertório de suporte"
(decisão do founder 2026-08-02, ver `docs/DECISOES.md`).

## O que é

Para cada campo do Stage 1, a **hipótese de suporte** que o achado pode sustentar, com a
**justificativa fisiológica** (por que aquele nutriente tem relação com aquele
órgão/sistema) e a **camada de leitura** MTC/Ayurveda — que explica o PADRÃO, não prescreve.

## ⛔ Guardrails — não-negociáveis

1. **NUNCA nomear a FORMA do nutriente.** Escreve-se "magnésio", nunca "magnésio glicinato";
   "vitamina B6", nunca "B6 P5P". **Razão (decisão do founder, 2026-08-02):** este bloco vai
   no documento do CLIENTE, e nome de forma específica funciona como instrução de compra. O
   dossiê do terapeuta pode nomear a forma; o Mapa do Ser não.
   ⚠️ Esta é a única divergência deliberada em relação ao §7 do dossiê.
2. **Zero dose, zero frequência, zero duração, zero nome de exame laboratorial.** Herdado
   integralmente da régua regulatória do §7 do dossiê (`prompts/system.md`), que já passou
   por revisão. Qual exame pedir é do médico.
3. **Uma carência só aparece se um achado ESPECÍFICO a sustenta.** ⛔ Proibido cobrir todos
   os campos. Falta de cobertura é TETO da leitura, não convite para preencher —
   ver `feedback_forced_completeness_breeds_fabrication`: quando eu exigi cobertura
   obrigatória, o modelo inventou "banda tireoidiana já registrada".
4. **É hipótese a investigar, nunca conclusão.** A moldura é sempre "vale olhar isso com quem
   te acompanha", não "você tem falta de X".
5. **MTC e Ayurveda são camada de LEITURA**, não segunda lista de suplementos. Elas explicam
   o padrão (por que esse conjunto de achados anda junto). ⛔ Não gerar erva, fórmula ou
   prática a partir delas — isso transformaria o bloco em catálogo e reabriria o alarme Forer.
6. **Nada de tag de fonte no documento.** As tags abaixo são rastreio interno.

## Legenda de fontes

| tag | fonte |
|---|---|
| **F** | Fisiologia estabelecida — o nutriente tem papel documentado naquele órgão/sistema |
| **I** | Tradição iridológica — a associação vem do repertório da escola (Jensen/Bernard) |
| **MTC** | Medicina Tradicional Chinesa — órgão/elemento/padrão |
| **AY** | Ayurveda — dosha/agni/dhatu |
| **E** | Ponte com o mapa emocional deste relatório (a emoção do campo, não o nutriente) |

---

## DIGESTÃO E ASSIMILAÇÃO

### `estomago` — anel interno pericentral
| | |
|---|---|
| **Suporte** | zinco · vitaminas do complexo B · cloreto (sal integral) |
| **Por quê** | **F** zinco é cofator da anidrase carbônica e da produção de ácido gástrico; B12 depende de fator intrínseco produzido no estômago — estômago tenso por muito tempo compromete a própria absorção de B12. |
| **MTC** | Estômago/Baço = elemento **Terra**. Padrão típico: *deficiência de Qi do Baço* — a pessoa "não digere" nem a comida nem os acontecimentos. Preocupação ruminante é a emoção da Terra. |
| **AY** | **Agni** (fogo digestivo) irregular — *vishamagni*, típico de Vata. Come bem às vezes, mal outras. |
| **E** | preocupação · ansiedade que "dá no estômago" |

### `intestino_delgado` — estroma intermediário
| | |
|---|---|
| **Suporte** | glutamina (aminoácido) · zinco · vitamina A · vitamina D |
| **Por quê** | **F** são os nutrientes da integridade da mucosa e das junções firmes do epitélio intestinal — onde a assimilação de fato acontece. Absorção comprometida aqui rebaixa TODO o resto, o que faz deste campo um multiplicador. |
| **MTC** | Intestino Delgado é o par Yang do **Coração** (Fogo) — a função de "separar o puro do impuro", inclusive no plano do discernimento. |
| **AY** | Sede do **Pitta** (pachaka). Excesso de Pitta = irritabilidade + inflamação de mucosa no mesmo eixo. |
| **E** | rigidez/intolerância · dificuldade de aceitar o diferente |

### `intestino_grosso` — periferia/borda externa
| | |
|---|---|
| **Suporte** | magnésio · fibras · água · vitamina D |
| **Por quê** | **F** magnésio atua na motilidade da musculatura lisa e na retenção de água no lúmen; a vitamina D tem receptor no epitélio colônico. **I** é o campo clássico da retenção na tradição iridológica. |
| **MTC** | Intestino Grosso é o par Yang do **Pulmão** (Metal) — o eixo do "soltar". Não largar o que já cumpriu o papel aparece nos dois. |
| **AY** | **Apana Vata** desregulado — o vento descendente que governa eliminação. |
| **E** | dificuldade de soltar · apego · controle |

### `figado_vesicula` — temporal inferior (5-7h)
| | |
|---|---|
| **Suporte** | vitaminas do complexo B · magnésio · enxofre alimentar (crucíferas, alho) · colina |
| **Por quê** | **F** as duas fases da detoxificação hepática são dependentes de B, magnésio e doadores de metila/enxofre; colina é central no metabolismo de gordura hepática. |
| **MTC** | Fígado/Vesícula = **Madeira**. Padrão: *estagnação do Qi do Fígado* — a raiva que não sai fica presa e vira tensão, e é o padrão mais associado a irritabilidade. |
| **AY** | **Pitta** — calor. Ranjaka Pitta governa fígado e sangue. |
| **E** | raiva contida · irritação que sobe · ressentimento |
| ⚠️ | Campo com histórico de **falso positivo topográfico** — ver `docs/DECISOES.md`. Só entra com achado bem sustentado. |

### `pancreas` — 7-8h OE
| | |
|---|---|
| **Suporte** | cromo · magnésio · vitaminas do complexo B |
| **Por quê** | **F** cromo participa da sinalização de insulina; magnésio é cofator de mais de 300 enzimas, várias no metabolismo de glicose. |
| **MTC** | Baço/Pâncreas = **Terra**, o eixo da doçura — inclusive da doçura que falta na vida e se busca no açúcar. |
| **AY** | **Kledaka Kapha** + agni. Desequilíbrio = peso e sonolência após comer. |
| **E** | preocupação · necessidade de "adoçar" o que está amargo |

---

## ELIMINAÇÃO E FLUIDOS

### `rim` — inferior (6h)
| | |
|---|---|
| **Suporte** | água · magnésio · potássio · vitaminas do complexo B |
| **Por quê** | **F** a função de filtração depende de volume e do equilíbrio de eletrólitos; o rim é o órgão que converte a vitamina D em sua forma ativa. |
| **MTC** | Rim = **Água**, a raiz do Jing (essência) e do medo. É o órgão da reserva vital — cansaço de fundo mora aqui. |
| **AY** | **Vata** — o medo e a secura são do mesmo eixo. |
| **E** | medo estrutural de base · insegurança |

### `sistema_urinario` — inferior (rim → ureter → bexiga)
| | |
|---|---|
| **Suporte** | água · magnésio · vitamina C |
| **Por quê** | **F** hidratação e pH urinário são os dois fatores modificáveis mais diretos deste eixo. |
| **MTC** | Bexiga é o par Yang do Rim (**Água**) — o eixo do que se segura e do que se libera. |
| **E** | medo · não conseguir "soltar" |

### `sistema_linfatico` / `rosario_linfatico` — coroa periférica
| | |
|---|---|
| **Suporte** | água · vitamina C · movimento (não é nutriente — é o fator não-nutricional mais relevante aqui) |
| **Por quê** | **F** a linfa não tem bomba própria: depende de contração muscular e respiração. **I** o rosário linfático é um dos achados mais reconhecidos da tradição. |
| **MTC** | Umidade/*Tan* (mucosidade) — o padrão de acúmulo e peso. |
| **AY** | **Kapha** — estagnação, peso, lentidão. |
| **E** | peso · sensação de acúmulo |

### `pele_tegumentar` — anel periférico extremo
| | |
|---|---|
| **Suporte** | ômega-3 · zinco · vitamina A · vitamina E |
| **Por quê** | **F** são os nutrientes da barreira cutânea e da resolução de inflamação. A pele é a via de eliminação que assume quando as outras estão sobrecarregadas. |
| **MTC** | Pele é regida pelo **Pulmão** (Metal) — a fronteira entre eu e mundo. |
| **E** | fronteira · exposição · o que "aflora" |

---

## RESPIRAÇÃO E FRONTEIRA

### `pulmoes` — temporal superior (3h OE / 9h OD)
| | |
|---|---|
| **Suporte** | vitamina C · vitamina D · ômega-3 · magnésio |
| **Por quê** | **F** vitamina D modula a imunidade respiratória; magnésio relaxa a musculatura brônquica; ômega-3 participa da resolução da inflamação. |
| **MTC** | Pulmão = **Metal**, o eixo da tristeza e do luto. Governa o Qi e a fronteira (Wei Qi). |
| **AY** | **Kapha** no tórax (avalambaka). |
| **E** | tristeza · luto · dificuldade de receber o novo |

### `boca_garganta` — orofaríngea
| | |
|---|---|
| **Suporte** | zinco · vitaminas do complexo B · ferro |
| **Por quê** | **F** as mucosas de renovação rápida são as primeiras a sinalizar carência destes três. |
| **MTC** | Garganta = passagem do Qi; nó de garganta é *Qi estagnado* do Fígado subindo. |
| **E** | voz sufocada · o que não foi dito |

---

## EIXO NEUROENDÓCRINO

### `adrenal` — sobre o rim (5:30-6h)
| | |
|---|---|
| **Suporte** | vitamina C · vitaminas do complexo B · magnésio · sódio (sal integral) |
| **Por quê** | **F** a suprarrenal tem uma das maiores concentrações de vitamina C do corpo e a consome na esteroidogênese; magnésio e B são cofatores diretos do eixo do estresse. |
| **MTC** | Reserva do **Rim** (Água) — esgotamento aqui é consumo de Jing. |
| **AY** | **Ojas** rebaixado — a reserva vital que se gasta com vigilância contínua. |
| **E** | autoproteção exaurida · alerta constante · urgência |

### `eixo_pituitario_adrenal` — collarete a 12:30h
| | |
|---|---|
| **Suporte** | vitaminas do complexo B · magnésio · vitamina D |
| **Por quê** | **F** é o mesmo pacote de cofatores da adrenal, com o acréscimo da vitamina D, que tem receptor em tecido hipofisário. |
| **MTC** | Eixo Rim-Coração — a comunicação entre a raiz e o alto. |
| **E** | não conseguir desligar · viver em prontidão |

### `tireoide` — cervical
| | |
|---|---|
| **Suporte** | iodo · selênio · zinco · ferro · tirosina (aminoácido) |
| **Por quê** | **F** iodo e tirosina são a matéria-prima do hormônio tireoidiano; selênio é indispensável na conversão de T4 em T3; ferro é cofator da peroxidase tireoidiana. É o campo com o encadeamento nutricional mais bem estabelecido de toda a tabela. |
| **MTC** | Garganta — expressão. Nó entre o que se sente e o que se diz. |
| **AY** | Metabolismo/agni sistêmico. |
| **E** | voz própria · ritmo próprio |
| ⚠️ | Campo sensível: sinal iridológico de tireoide é sutil e foi fonte de fabricação antes. Exige achado forte. |

### `pineal_hipotalamica` — centro ~12h
| | |
|---|---|
| **Suporte** | magnésio · vitamina B6 · triptofano (aminoácido) · vitamina D |
| **Por quê** | **F** triptofano é precursor de serotonina e melatonina; B6 e magnésio são cofatores dessa via. |
| **MTC** | Shen (espírito) do **Coração** — o sono e o assentamento. |
| **AY** | **Sadhaka Pitta** — a mente que processa. |
| **E** | mente que não desliga · sono que não repara |

---

## SISTEMA NERVOSO

### `sistema_nervoso_autonomico` / `anel_nervoso`
| | |
|---|---|
| **Suporte** | magnésio · vitaminas do complexo B · ômega-3 |
| **Por quê** | **F** magnésio é antagonista natural do cálcio na excitabilidade neuronal; ômega-3 é constituinte estrutural da membrana neuronal; B são cofatores da síntese de neurotransmissores. **I** o anel nervoso é o achado clássico de tensão sustentada. |
| **MTC** | Desarmonia Coração-Rim — o Fogo em cima sem a Água embaixo para assentá-lo. |
| **AY** | **Vata** em excesso — irregularidade, movimento, secura. |
| **E** | alerta · inquietação · sobressalto |

### `cerebrum_motor` (12-1h) e `cerebellum_sensory` (11-12h)
| | |
|---|---|
| **Suporte** | ômega-3 · vitaminas do complexo B · colina · ferro |
| **Por quê** | **F** são os substratos de mielina, membrana e neurotransmissão. Ferro baixo aparece como névoa cognitiva antes de aparecer como anemia. |
| **MTC** | "Mar da medula" — governado pelo **Rim**. |
| **E** | dispersão · ruminação · cabeça que não para |

### `radii_solaris` — linhas radiais saindo da pupila
| | |
|---|---|
| **Suporte** | magnésio · vitaminas do complexo B · fibras · água |
| **Por quê** | **I** na tradição, os raios solares associam eixo intestino-cérebro; o suporte reflete os dois lados desse eixo. **F** a produção de neurotransmissores depende do ambiente intestinal. |
| **MTC** | Umidade turva subindo e obscurecendo os orifícios superiores. |
| **E** | pensamento que gira · dificuldade de clarear |

---

## ESTRUTURA E MOVIMENTO

### `sistema_musculoesqueletico` — estroma intermediário-periférico
| | |
|---|---|
| **Suporte** | magnésio · cálcio · vitamina D · vitamina K · proteína |
| **Por quê** | **F** o quarteto mineral-vitamínico da matriz óssea e da contração muscular; sem vitamina D e K, cálcio não chega ao osso. |
| **MTC** | Tendões são do **Fígado**; ossos são do **Rim**. |
| **AY** | **Vata** nas articulações — secura e estalos. |
| **E** | rigidez · flexibilidade · sustentar-se |

### `coluna_cervical` · `coluna_toracica` · `coluna_lombar` · `sacro_coccyx`
| | |
|---|---|
| **Suporte** | magnésio · vitamina D · vitaminas do complexo B |
| **Por quê** | **F** magnésio para a musculatura paravertebral, D para o osso, B para a condução nervosa dos segmentos correspondentes. |
| **MTC** | Coluna = eixo do **Rim** — a sustentação e o medo de não dar conta. |
| **E** | carregar sozinho · peso nas costas (cervical: o que se segura; lombar: a base) |

---

## CIRCULAÇÃO E DEFESA

### `coracao` — superior esquerda OE (2-3h)
| | |
|---|---|
| **Suporte** | magnésio · potássio · ômega-3 · coenzima Q10 |
| **Por quê** | **F** magnésio e potássio governam o ritmo; CoQ10 é central na produção de energia no miocárdio, que é o tecido de maior densidade mitocondrial. |
| **MTC** | Coração = **Fogo**, abriga o Shen. A alegria é sua emoção equilibrada. |
| **AY** | **Sadhaka Pitta** — o coração que sente e processa. |
| **E** | alegria · abertura · desamor |

### `sistema_circulatorio` / `anel_sodico`
| | |
|---|---|
| **Suporte** | ômega-3 · magnésio · vitamina E · vitamina C |
| **Por quê** | **F** suporte de endotélio e de fluidez. **I** o anel sódico/arco lipídico é achado clássico do eixo circulatório na tradição iridológica. |
| **MTC** | Sangue governado pelo Coração, armazenado no Fígado. |
| **E** | frieza · distanciamento afetivo |

### `sistema_imune` / `manchas_psoricas`
| | |
|---|---|
| **Suporte** | vitamina D · zinco · vitamina C · selênio |
| **Por quê** | **F** o quarteto com papel mais bem documentado na competência imune. |
| **MTC** | **Wei Qi** — o Qi defensivo, governado pelo Pulmão. |
| **AY** | **Ojas** — a reserva que sustenta a imunidade. |
| **E** | fronteira · defesa · exaustão de estar em guarda |

### `coroa_simpatica` — fronteira zona ciliar/periférica
| | |
|---|---|
| **Suporte** | magnésio · vitaminas do complexo B |
| **Por quê** | **F** o mesmo eixo do sistema nervoso autônomo, na leitura da fronteira periférica. |
| **E** | tônus de alerta |

---

## REPRODUTIVO

### `sistema_reprodutor` — inferior medial (6h)
| | |
|---|---|
| **Suporte** | zinco · vitamina D · ômega-3 · vitaminas do complexo B · ferro (ciclos com perda) |
| **Por quê** | **F** zinco e D participam da esteroidogênese; ferro é a carência mais frequente onde há perda cíclica. |
| **MTC** | **Rim** — Jing, a essência e a criatividade. Útero = "Palácio do Sangue". |
| **AY** | **Shukra dhatu** — o tecido reprodutivo, o último e mais refinado. |
| **E** | criação · potência · o que se gera |

---

## CAMPOS QUE **NÃO** GERAM HIPÓTESE DE CARÊNCIA

⛔ Estes campos entram no relatório por outros blocos, mas **não sustentam** hipótese
nutricional. Listados explicitamente para que ninguém tente preencher a lacuna depois:

| campo | por que não |
|---|---|
| `pigmento_amber` | é marcador topográfico/constitucional, não funcional |
| `lacuna_estrutural`, `cripta` | dizem PROFUNDIDADE e TEMPO da carga, não natureza bioquímica |
| `anel_interno` / `collarette` | fronteira eu↔mundo — leitura relacional |
| `padrao_pupilar`, `pupila`, `bordas_pupilares` | moduladores de tônus autonômico; o suporte já vem por `sistema_nervoso_autonomico` — repetir seria inflar |
| `cor_predominante`, `trama_fibras` | constitucionais: dizem o TERRENO, não uma falta atual |

**Consequência de projeto:** uma leitura pode legitimamente sair com **poucas** hipóteses —
ou nenhuma. Isso é resultado honesto, não falha. O bloco tem que suportar sair curto.

---

## Convergência — quando dois ou mais achados apontam o mesmo suporte

O sinal mais forte da tabela **não** é um campo isolado: é o mesmo nutriente sustentado por
achados independentes. Magnésio, por exemplo, aparece em nervoso, musculoesquelético,
intestino grosso, coração e adrenal — se a leitura acende três desses, a hipótese ganha
corpo de verdade. É a mesma metodologia de corroboração já usada nas crenças (⊕).

**Regra de ordenação sugerida para o bloco:** ordenar por número de achados independentes
que sustentam o suporte, não pela ordem dos campos.

---

## MAPA MÁQUINA — parseado por `motor-calc.mjs`

⚠️ **Formato fixo.** Uma linha por campo: `campo | suporte | porquê | leitura`.
- **suporte** — nutrientes separados por ` · `. ⛔ SEM forma (magnésio, não magnésio glicinato).
- **porquê** — a razão fisiológica **na voz do cliente**, lei da 8ª série. É o que ele lê.
- **leitura** — a camada MTC/Ayurveda **traduzida**. ⛔ NUNCA nomear a escola: as 9 regras
  absolutas proíbem citar escola/autor no documento. "Deficiência de Qi do Baço" vira
  "o corpo trata o que você não digeriu — comida e acontecimento — no mesmo lugar".
  A tradição informa a frase; o nome dela fica aqui dentro.
- Campo ausente desta lista **não gera suporte**. É de propósito.

| campo | suporte | porquê | leitura |
|---|---|---|---|
| estomago | zinco · complexo B | o estômago é onde o corpo prepara o alimento pra ser aproveitado; quando ele vive tenso, a própria absorção fica prejudicada | o que você não digere — comida ou acontecimento — o corpo trata no mesmo lugar |
| intestino_delgado | glutamina · zinco · vitamina A · vitamina D | é onde o alimento de fato entra em você; se a parede dele está frágil, todo o resto chega menos | é o lugar que separa o que serve do que não serve — no corpo e na vida |
| intestino_grosso | magnésio · fibras · água | é o fim da linha: o que o corpo já usou precisa sair na hora certa | segurar o que já cumpriu o papel cansa o corpo do mesmo jeito que cansa você |
| figado_vesicula | complexo B · magnésio · enxofre alimentar | o fígado é a central de limpeza, e esse trabalho gasta um conjunto específico de nutrientes | é o órgão do impulso que precisa sair; quando não sai, vira calor guardado |
| pancreas | cromo · magnésio · complexo B | ajuda o corpo a manter o açúcar estável ao longo do dia, sem picos e quedas | a busca por doce costuma aparecer quando falta doçura em outro lugar |
| rim | água · magnésio · potássio | filtrar o dia inteiro depende de líquido suficiente e do equilíbrio dos sais | é o órgão da reserva: o cansaço que vem de fundo mora aqui |
| sistema_urinario | água · magnésio · vitamina C | hidratação é o fator que mais muda esse eixo, e é o mais simples de ajustar | o que se segura e o que se deixa ir passam pelo mesmo caminho |
| sistema_linfatico | água · vitamina C · movimento | a linfa não tem bomba própria: ela só circula quando você se move e respira fundo | acúmulo pede movimento, não mais uma coisa pra tomar |
| pele_tegumentar | ômega-3 · zinco · vitamina A | são o que sustenta a barreira da pele e ajuda a acalmar irritação | a pele assume quando as outras saídas do corpo estão sobrecarregadas |
| pulmoes | vitamina C · vitamina D · ômega-3 | sustentam a defesa das vias respiratórias e ajudam a soltar a musculatura do peito | é o lugar do fôlego: onde entra o novo e onde se despede do que passou |
| boca_garganta | zinco · complexo B · ferro | as mucosas se renovam rápido, então são as primeiras a dar sinal quando algo falta | a garganta é a passagem do que se diz — e do que ficou sem dizer |
| adrenal | vitamina C · complexo B · magnésio | é a glândula do estresse, e ela gasta vitamina C mais que quase qualquer outro tecido | viver em alerta consome uma reserva que leva tempo pra repor |
| eixo_pituitario_adrenal | complexo B · magnésio · vitamina D | é o mesmo eixo do estresse, visto de onde ele é comandado | prontidão constante é um comando que fica ligado mesmo sem perigo |
| tireoide | iodo · selênio · zinco · ferro | esses quatro entram, em sequência, na produção e na ativação do hormônio que regula o seu ritmo | é o centro do ritmo próprio — e fica na altura da garganta, onde mora a voz |
| pineal_hipotalamica | magnésio · vitamina B6 · triptofano | são a matéria-prima do que acalma e do que dá sono de verdade | dormir não é só parar: é o corpo confiar que pode baixar a guarda |
| sistema_nervoso_autonomico | magnésio · complexo B · ômega-3 | o magnésio é o que ajuda o sistema nervoso a sair do estado de alerta | alerta sustentado gasta mais que esforço — porque não tem hora de acabar |
| cerebrum_motor | ômega-3 · complexo B · ferro | são o material da própria estrutura do cérebro e da clareza de raciocínio | falta de ferro aparece como névoa na cabeça antes de aparecer em exame |
| cerebellum_sensory | ômega-3 · complexo B · ferro | são o material da própria estrutura do cérebro e da clareza de raciocínio | falta de ferro aparece como névoa na cabeça antes de aparecer em exame |
| radii_solaris | magnésio · complexo B · fibras · água | intestino e cabeça conversam: o que acalma um costuma clarear o outro | pensamento que gira raramente se resolve só no pensamento |
| sistema_musculoesqueletico | magnésio · cálcio · vitamina D · vitamina K · proteína | sem vitamina D e K o cálcio não chega ao osso — os quatro trabalham juntos ou nenhum funciona | o corpo que sustenta tudo também precisa ser sustentado |
| coluna_cervical | magnésio · vitamina D · complexo B | soltam a musculatura que fica contraída ao redor da coluna | o pescoço é onde se segura o que não se quer largar |
| coluna_toracica | magnésio · vitamina D · complexo B | soltam a musculatura que fica contraída ao redor da coluna | o meio das costas guarda o que se carrega sem falar |
| coluna_lombar | magnésio · vitamina D · complexo B | soltam a musculatura que fica contraída ao redor da coluna | a lombar é a base: ela reclama quando falta apoio |
| sacro_coccyx | magnésio · vitamina D | sustentam a base da coluna, que é onde o peso do corpo se apoia | é o ponto de assento: a sensação de ter chão |
| coracao | magnésio · potássio · ômega-3 | governam o ritmo do coração e a energia do músculo que nunca para | é o único músculo que trabalha a vida toda sem descanso |
| sistema_circulatorio | ômega-3 · magnésio · vitamina E | ajudam o sangue a circular com mais fluidez e cuidam da parede dos vasos | circulação é o quanto de você chega até as pontas |
| sistema_imune | vitamina D · zinco · vitamina C · selênio | são os quatro com papel mais bem estabelecido na defesa do corpo | defender-se o tempo todo cansa — inclusive por dentro |
| coroa_simpatica | magnésio · complexo B | mesmo eixo do sistema nervoso, visto na borda | o tônus de alerta aparece na periferia antes de aparecer no centro |
| sistema_reprodutor | zinco · vitamina D · ômega-3 · ferro | participam da produção hormonal; o ferro pesa mais onde há perda cíclica | é o eixo do que se gera — filho, obra, projeto |

## MAPA MÁQUINA — POR NUTRIENTE

⚠️ O "porquê" mostrado ao cliente é **do nutriente**, não do campo. Motivo: um mesmo campo
sustenta vários nutrientes (o fígado puxa complexo B *e* magnésio *e* enxofre), então usar o
texto do campo fazia dois itens diferentes saírem com **a mesma frase**. Voz do cliente.

| nutriente | porquê |
|---|---|
| magnésio | é o mineral que ajuda o corpo a sair do estado de alerta: solta a musculatura, acalma o sistema nervoso e regula o ritmo |
| complexo B | é o grupo que o corpo gasta para produzir energia e para o sistema nervoso funcionar — e é o primeiro a se esgotar em fase de desgaste |
| zinco | participa da renovação de tecidos e da produção do ácido que abre a digestão |
| ferro | é o que leva oxigênio a cada célula; quando falta, aparece como cansaço e névoa mental antes de aparecer em qualquer outro lugar |
| vitamina D | age como um regulador geral — osso, defesa e humor respondem a ela |
| vitamina C | é o que o corpo consome mais rápido em fase de estresse, e sustenta a defesa e a firmeza dos tecidos |
| vitamina A | cuida das superfícies que separam você do mundo: pele, mucosas, visão |
| vitamina E | protege as gorduras do corpo, inclusive as das membranas de cada célula |
| vitamina K | é quem leva o cálcio para o osso — sem ela o cálcio circula sem chegar aonde precisa |
| vitamina B6 | participa da fabricação do que acalma e do que dá bom humor |
| ômega-3 | é gordura estrutural do cérebro e o que ajuda o corpo a encerrar processos de inflamação |
| cálcio | é a matéria do osso e o que permite ao músculo contrair |
| potássio | trabalha junto com o magnésio no ritmo do coração e no equilíbrio dos líquidos |
| iodo | é a matéria-prima do hormônio que define a velocidade do seu metabolismo |
| selênio | é o que ativa esse hormônio — sem ele, o corpo produz mas não usa |
| cromo | ajuda a manter o açúcar do sangue estável ao longo do dia |
| glutamina | é o alimento das células que forram o intestino por dentro |
| colina | participa do transporte de gordura no fígado e da comunicação entre neurônios |
| triptofano | é o ponto de partida do que traz calma e do que dá sono de verdade |
| tirosina | é o ponto de partida dos hormônios que dão disposição e foco |
| proteína | é a matéria de reposição do corpo inteiro: músculo, pele, defesa, hormônio |
| fibras | dão volume e ritmo ao intestino, e alimentam as bactérias que trabalham a seu favor |
| água | é o que permite filtrar, transportar e eliminar — quase todo o resto depende dela |
| movimento | não é nutriente: a linfa não tem bomba própria e só circula quando você se mexe |
| enxofre alimentar | entra nas reações que o fígado usa para transformar e eliminar |
| sódio (sal integral) | sustenta o volume dos líquidos e o eixo que responde ao estresse |
| coenzima Q10 | participa da produção de energia dentro da célula, sobretudo onde ela nunca para |
| cloreto (sal integral) | é parte do ácido que o estômago usa para abrir a digestão |

## MAPA MÁQUINA — TRADIÇÕES (exceção do founder, 2026-08-03)

⚠️ **Exceção às 9 regras absolutas.** A regra "sem autores/escolas" continua valendo para
todo o resto do documento; o founder abriu exceção **só para Medicina Tradicional Chinesa e
Ayurveda**, neste bloco. Elas passam a ser **nomeadas** ao cliente.
⛔ Continua proibido: erva, fórmula, prática, dose. Elas explicam o PADRÃO — nada mais.
Texto na voz do cliente; campo sem entrada simplesmente não mostra a linha.

| campo | mtc | ayurveda |
|---|---|---|
| estomago | o estômago e o baço formam o centro que transforma — tanto o alimento quanto o que acontece com você | o fogo digestivo aqui é irregular: às vezes você come bem, às vezes o corpo simplesmente fecha |
| intestino_delgado | é o órgão que separa o puro do impuro — no corpo e no discernimento | é a sede do calor do corpo; quando ele sobe demais, irritação e inflamação vêm juntas |
| intestino_grosso | forma par com o pulmão: os dois tratam de soltar o que já cumpriu o papel | é o vento descendente que governa a eliminação — quando desregula, nada desce na hora certa |
| figado_vesicula | quando a energia do fígado estagna, o impulso que não saiu vira calor guardado | é território do calor: excesso aqui aparece como pavio curto |
| pancreas | pertence ao centro da terra, o eixo da doçura — inclusive da que falta e se busca no açúcar | o peso e a sonolência depois de comer são o sinal clássico deste desequilíbrio |
| rim | é a raiz da energia herdada e a morada do medo — o cansaço de fundo mora aqui | governa o movimento e a secura; medo e agitação vêm do mesmo lugar |
| sistema_linfatico | é o padrão de umidade: acúmulo, peso, coisa que não escoa | é o excesso do que estagna — pede movimento, não mais uma coisa pra tomar |
| pele_tegumentar | a pele é governada pelo pulmão: é a fronteira entre você e o mundo | é onde o calor interno encontra saída quando as outras vias estão ocupadas |
| pulmoes | o pulmão é o órgão da tristeza e do luto, e é ele que governa a fronteira que te protege | o peito é território do que se acumula e pesa |
| adrenal | é a reserva profunda do rim: viver em alerta consome a energia herdada | é a reserva vital — o que sustenta imunidade, brilho e disposição — e ela se gasta com vigilância |
| tireoide | fica na garganta, a passagem entre o que se sente e o que se diz | governa a velocidade com que o corpo transforma tudo |
| pineal_hipotalamica | o sono depende do espírito do coração se assentar — dormir é o corpo confiar que pode baixar a guarda | é a parte da mente que digere experiência; sobrecarregada, ela não desliga |
| sistema_nervoso_autonomico | é a desarmonia entre coração e rim: o fogo em cima sem a água embaixo para assentá-lo | é o excesso de movimento — irregularidade, pressa, secura |
| cerebrum_motor | o cérebro é o mar da medula, e quem o nutre é o rim | clareza depende de o que sustenta a mente estar reposto |
| radii_solaris | é a umidade turva subindo e obscurecendo os sentidos de cima | o que não é digerido embaixo sobe e embaça a cabeça |
| sistema_musculoesqueletico | os tendões pertencem ao fígado e os ossos ao rim | secura nas articulações é o sinal do excesso de movimento |
| coracao | o coração abriga o espírito, e a alegria é sua emoção equilibrada | é o coração que sente e processa, não só o que bombeia |
| sistema_imune | é a energia defensiva que circula na superfície, governada pelo pulmão | é a reserva vital que sustenta a imunidade — ela cai quando você se gasta |
| sistema_reprodutor | guarda a essência: a mesma energia da criação, de filho a obra | é o tecido mais refinado do corpo, o último a se formar e o primeiro a sofrer com desgaste |
