# Tabela-lastro — SUGESTÕES INTEGRATIVAS (bloco 8 do Mapa do Ser)

**Data:** 2026-08-03. **Status:** v1 — lastro do bloco novo, ainda NÃO ligado ao render.
**Origem:** §11 do dossiê (`prompts/system.md`), reorganizado para saída **determinística**.

## O que muda em relação ao dossiê

No dossiê o Sonnet escreve as 6 categorias a cada leitura. Aqui **o motor monta** a partir
deste lastro, como no bloco 7. Mesma razão: não há como fabricar, leituras já geradas ganham
o bloco sem regerar, e não gasta API.
**O dossiê já ajudou muito**: ele organiza a nutrição por **EIXO** (não por órgão solto) e as
práticas contemplativas por **FAMÍLIA DE PADRÃO** — as duas coisas são deriváveis do motor.

## ⛔ Guardrails

1. **QUEM LÊ O QUÊ** (decisão do founder, 2026-08-03):
   | categoria | cliente | terapeuta |
   |---|---|---|
   | Nutrição · Práticas corporais · Práticas contemplativas · Florais | ✅ | ✅ |
   | **Fitoterapia · Adaptógenos** | ⛔ | ✅ só no guia |
   **Razão:** erva tem interação farmacológica real (ashwagandha × medicação de tireoide é o
   caso clássico). É categoria diferente de "magnésio" — o próprio dossiê, lido por terapeuta,
   já carrega hedge de profissional habilitado ali.
2. **Sem marca comercial. Sem dose, quantidade, frequência ou duração. Sem nome de exame.**
3. **Floral pelo EFEITO funcional**, nunca pelo nome comercial ("floral de centramento", não
   marca). Isso também é o que o torna seguro para o cliente.
4. ⛔ **Nada aparece sem achado que sustente** — vale o mesmo *skip-rather-than-fabricate* do
   bloco 7. Categoria sem lastro nesta leitura simplesmente não sai.
5. ⭐ **TESTE DE FORER (do próprio dossiê, mantido):** *"trocando a íris desta pessoa por
   outra qualquer, esta lista ainda funcionaria?"* Se sim, está errada. Por isso **nada aqui
   é default de categoria** — tudo pendura num eixo ou num padrão.
6. ⛔ Proibidos como default genérico: "beber mais água", "reduzir açúcar", "comer mais
   vegetais", "meditação 10 min", "atenção plena", "body scan solto". Herdado do anti-template
   v2 do dossiê, que existe justamente porque essas frases servem pra qualquer um.

---

## 1. EIXO de cada campo — a chave que liga achado → sugestão

| campo | eixo |
|---|---|
| figado_vesicula | hepatobiliar |
| pancreas | hepatobiliar |
| estomago | digestivo_imune |
| intestino_delgado | digestivo_imune |
| intestino_grosso | digestivo_imune |
| sistema_imune | digestivo_imune |
| sistema_linfatico | digestivo_imune |
| radii_solaris | digestivo_imune |
| adrenal | adrenal_nervoso |
| eixo_pituitario_adrenal | adrenal_nervoso |
| sistema_nervoso_autonomico | adrenal_nervoso |
| pineal_hipotalamica | adrenal_nervoso |
| cerebrum_motor | adrenal_nervoso |
| cerebellum_sensory | adrenal_nervoso |
| coroa_simpatica | adrenal_nervoso |
| tireoide | reprodutivo_hormonal |
| sistema_reprodutor | reprodutivo_hormonal |
| coracao | cardiovascular |
| sistema_circulatorio | cardiovascular |
| rim | renal_eliminatorio |
| sistema_urinario | renal_eliminatorio |
| pele_tegumentar | renal_eliminatorio |
| pulmoes | respiratorio |
| boca_garganta | respiratorio |
| sistema_musculoesqueletico | estrutural |
| coluna_cervical | estrutural |
| coluna_toracica | estrutural |
| coluna_lombar | estrutural |
| sacro_coccyx | estrutural |

---

## 2. NUTRIÇÃO por eixo — vai ao CLIENTE

| eixo | sugestão | detalhe |
|---|---|---|
| hepatobiliar | Amargos antes das refeições | rúcula, almeirão, dente-de-leão — o amargo é o sabor que prepara a digestão de gordura |
| hepatobiliar | Menos gordura saturada por algumas semanas | dá folga ao fígado o suficiente pra você sentir diferença |
| hepatobiliar | Fibra solúvel no café da manhã | aveia, linhaça, banana verde — segura o ritmo do dia inteiro |
| adrenal_nervoso | Folhas verdes todo dia | são a fonte alimentar mais direta do magnésio que acalma |
| adrenal_nervoso | Castanhas e sementes | magnésio e gordura boa juntos, no mesmo punhado |
| adrenal_nervoso | Menos café e álcool enquanto reorganiza | os dois cobram do mesmo eixo que já está pedindo descanso |
| digestivo_imune | Fermentados de verdade | kefir, chucrute fresco — repõem quem trabalha a seu favor lá dentro |
| digestivo_imune | Fibra que alimenta a flora | inulina, chicória, alho-poró — não é fibra pra "soltar", é comida pra bactéria boa |
| digestivo_imune | Caldo de ossos no frio | colágeno e minerais na forma que o intestino aproveita melhor |
| reprodutivo_hormonal | Linhaça moída na hora | moída, porque inteira passa direto |
| reprodutivo_hormonal | Ômega-3 do alimento | peixe de água fria, chia, nozes |
| reprodutivo_hormonal | Comer em horário mais regular | esse eixo responde a ritmo mais do que a quantidade |
| cardiovascular | Ômega-3 como prioridade | é o que a parede dos vasos mais usa |
| cardiovascular | Alho e cebola crus, em pouca quantidade | o princípio ativo se perde no calor |
| cardiovascular | Temperos que aquecem | gengibre e cúrcuma, no lugar de sal |
| renal_eliminatorio | Água distribuída no dia | um litro de uma vez o corpo não aproveita; ele aproveita o hábito |
| renal_eliminatorio | Menos sal de produto pronto | o sal industrial é o que sobrecarrega, não o do saleiro |
| renal_eliminatorio | Frutas com muita água na estação | melancia, pepino, melão |
| respiratorio | Alimentos que não formam catarro | reduzir leite e açúcar por um período e observar a diferença |
| respiratorio | Vitamina C do alimento | acerola, goiaba, frutas cítricas |
| estrutural | Proteína em todas as refeições | músculo e osso se refazem com matéria-prima, não com repouso |
| estrutural | Sol na pele, cedo | é a via mais eficiente de vitamina D — e é grátis |

---

## 3. PRÁTICAS CORPORAIS por eixo — vai ao CLIENTE

| eixo | sugestão | detalhe |
|---|---|---|
| hepatobiliar | Torções suaves de tronco | mobilizam a região do fígado sem esforço |
| adrenal_nervoso | Caminhada lenta, sem meta | ritmo baixo é o que tira o corpo do modo alerta — correr reforça |
| adrenal_nervoso | Abraço longo, de 20 segundos | tempo suficiente pro sistema nervoso registrar segurança |
| adrenal_nervoso | Contato com a natureza sem tela | o corpo baixa a guarda no ambiente que ele reconhece |
| digestivo_imune | Automassagem no sentido horário | acompanha o caminho natural do intestino |
| cardiovascular | Movimento contínuo e moderado | o coração responde melhor a constância que a intensidade |
| renal_eliminatorio | Pernas para cima na parede | ajuda o retorno de líquido sem esforço nenhum |
| respiratorio | Respiração com expiração longa | soltar o ar devagar é o que abre o peito, não puxar mais |
| estrutural | Alongamento curto, todo dia | pouco e diário vale mais que muito e raro |
| estrutural | Nadar ou flutuar | tira o peso das articulações e devolve amplitude |

---

## 4. PRÁTICAS CONTEMPLATIVAS por FAMÍLIA — vai ao CLIENTE

⭐ **A família é escolhida pelo PADRÃO, não pelo achado** — e o motor consegue decidir sozinho.
⛔ Nunca emitir as três: **uma predominante**.

**Regra de seleção (determinística):**
- **LIBERAR** — quando há retenção/supressão da expressão: achado em `tireoide`,
  `boca_garganta` ou `pulmoes`, ou carga de *raiva contida · voz sufocada · dificuldade de
  soltar · ressentimento*.
- **CALMAR** — quando há hipervigilância: achado em `adrenal`, `eixo_pituitario_adrenal`,
  `sistema_nervoso_autonomico`, `pineal_hipotalamica`, ou carga de *alerta · ansiedade ·
  mente que não desliga · preocupação · urgência*.
- **ATIVAR** — quando há dispersão ou queda: carga de *dispersão · melancolia · desânimo ·
  fadiga · autoproteção exaurida*.
- **Empate → CALMAR.** É a família mais segura: baixar ativação não machuca ninguém, enquanto
  ATIVAR em quem está exausto piora.

| família | sugestão | detalhe |
|---|---|---|
| CALMAR | Respiração 4-7-8 | inspira em 4, segura em 7, solta em 8 — a expiração longa é o que desliga o alerta |
| CALMAR | Varredura do corpo deitada | religa a percepção fina sem exigir concentração |
| CALMAR | Yoga restaurativa, posições paradas | a fáscia solta no tempo, não na força |
| ATIVAR | Caminhada consciente em ritmo crescente | religa o pulso vital começando devagar |
| ATIVAR | Dança livre, 5 a 10 minutos | movimento sem performance destrava mais que exercício |
| ATIVAR | Leitura lenta em voz alta | foco suave, pra quem não consegue quietude |
| LIBERAR | Escrita catártica que não se envia | solta o que ficou preso na garganta sem consequência |
| LIBERAR | Cantar ou emitir som livre | destrava a expressão pelo corpo, não pela conversa |
| LIBERAR | Chorar quando vier, sem segurar | represar é o que cansa, não o choro |

---

## 5. FLORAIS por EMOÇÃO — vai ao CLIENTE

⭐ Florais casam com **estado emocional**, não com órgão — então esta tabela cruza com o mapa
emocional que o relatório já calcula, e não com o campo.
⛔ **Pelo efeito funcional, nunca pela marca.**

| emoção (carga) | floral | detalhe |
|---|---|---|
| raiva contida | floral de expressão sem culpa | pra quem engole pra manter a paz |
| irritação que sobe | floral de paciência | pra quem se acende antes de pensar |
| ressentimento | floral de perdão e liberação | pra soltar o que já não muda |
| preocupação | floral de confiança no processo | pra quem vive um passo à frente da vida |
| ansiedade | floral de presença no agora | pra trazer de volta ao que já está acontecendo |
| medo | floral de coragem e chão | pra quem trava antes de tentar |
| dificuldade de soltar | floral de desapego | pra quem guarda o que já cumpriu o papel |
| melancolia | floral de reencontro com o gosto pela vida | pra quando o brilho baixou sem motivo claro |
| baixa autoestima | floral de valor próprio | pra quem se cobra o que não cobraria de ninguém |
| dispersão | floral de foco e reunião | pra quem começa muito e termina pouco |
| rigidez | floral de flexibilidade | pra quem só enxerga um jeito certo |
| voz sufocada | floral de expressão da própria voz | pra quem se cala pra não incomodar |
| autoproteção exaurida | floral de descanso da vigilância | pra quem não consegue baixar a guarda |
| luto | floral de travessia | pra atravessar sem apressar |

---

## 6. FITOTERAPIA por eixo — ⛔ SÓ NO GUIA DO TERAPEUTA

| eixo | planta | detalhe |
|---|---|---|
| hepatobiliar | cardo-mariano | hepatoprotetor clássico |
| hepatobiliar | alcachofra | estímulo de fluxo biliar |
| adrenal_nervoso | passiflora | nervina suave, sem sedação de dia |
| adrenal_nervoso | melissa | tensão que se instala no digestivo |
| adrenal_nervoso | mulungu | quando o alerta atrapalha o sono |
| digestivo_imune | espinheira-santa | mucosa gástrica |
| digestivo_imune | camomila | espasmo e irritação de mucosa — ⚠️ só quando o eixo sustenta, é o default mais batido da categoria |
| respiratorio | guaco | via respiratória com secreção |
| respiratorio | tanchagem | irritação de mucosa alta |
| renal_eliminatorio | cavalinha | diurético suave |
| renal_eliminatorio | quebra-pedra | via urinária |
| cardiovascular | crataegus (espinheiro-branco) | tônico cardiovascular tradicional |
| reprodutivo_hormonal | vitex agnus-castus | eixo hormonal feminino |
| estrutural | garra-do-diabo | desconforto articular |

## 7. ADAPTÓGENOS por padrão — ⛔ SÓ NO GUIA DO TERAPEUTA

⚠️ **Hedge obrigatório em toda saída desta categoria:** *considere acompanhamento de
profissional habilitado antes de iniciar adaptógenos.* Herdado do dossiê.

| padrão | adaptógeno | detalhe |
|---|---|---|
| CALMAR (hipervigilância / exaustão adrenal) | ashwagandha | ⚠️ interage com medicação de tireoide — motivo pelo qual esta categoria não vai ao cliente |
| ATIVAR (fadiga sustentada com queda funcional) | rhodiola | fadiga com sobrecarga mental |
| LIBERAR (tensão imune com retenção emocional) | reishi | tensão imune sustentada |

---

## Ordenação e teto (a definir com o founder antes de ligar no render)

Proposta, espelhando o bloco 7: ordenar cada categoria pela **intensidade do achado** que a
sustenta e **limitar a 3 por categoria** (é o que o dossiê já faz). Categoria sem lastro
nesta leitura **não aparece** — nem com título.
