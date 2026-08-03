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
