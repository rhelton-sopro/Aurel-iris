# Mapa CANÔNICO — emoção → FAMÍLIA EMOCIONAL

**Data:** 2026-07-23 (rev. 2 — refinamentos do founder).

**O que é:** a tabela canônica que agrupa TODAS as emoções do lastro (`tabela-lastro-CANONICA.md`) em **famílias que são EMOÇÕES** — temas emocionais claros (raiva, medo, tristeza…), na linha da psicologia das emoções. **NÃO são elementos** (decisão do founder: proibido Fogo/Água/Terra/Ar como família). O elemento Bardon continua no lastro para o cálculo interno; esta camada é a **leitura psicológica** por cima, para o motor agrupar, contar e narrar sem repetir a mesma emoção ubíqua (anti-Forer).

**Fonte:** extração pelo parser `motor-calc.mjs` (`parseLastro()`) — **232 emoções de carga (🔴)** + **146 de recurso (🟢)**, únicas, dos 38 campos-órgão. Marcadores/moduladores (`pigmento_amber`, `lacuna_estrutural`, `cripta`, `anel_interno`, `padrao_pupilar`) são localizadores "por área" e ficam fora deste mapa (a emoção deles herda da área onde caem).

**Princípio psicossomático (founder):** **todo sintoma físico ou estado cognitivo tem uma emoção-base — e os DOIS ficam, conectados.** Nada é descartado nem substituído: o achado permanece e ao lado vem a emoção a que ele está ligado, pela seta `→`. `tensão muscular → medo de sobreviver` · `fadiga crônica → desânimo/desistência` · `dificuldade de concentração → ansiedade que não deixa a mente assentar` · `neuroticismo → instabilidade emocional de base`. **A ligação é o valor:** o relatório pode mostrar tanto o que a pessoa sente no corpo QUANTO a emoção por trás (o gancho terapêutico mora nesse "→"). **0 itens ficam sem família.**

**Recursos SEMPRE entram (founder):** "a gente só trouxe os achados; os preservados a gente SEMPRE vai mencionar". Por isso cada uma das 146 emoções de recurso 🟢 tem família — é o **polo saudável** da mesma família da ferida (serenidade→Raiva, segurança→Medo, alegria→Alegria e prazer, firmeza que não se esgota→Esgotamento e vitalidade+). A força não é enfeite: é metade do relatório.

**Regra de classificação (cada linha defensável):**
1. Família = o **tema emocional nuclear**, não o mecanismo. "raiva engolida" → a emoção é raiva, mas o traço definidor é engolir a voz → **Expressão contida** (alt: Raiva).
2. Recurso 🟢 = **polo saudável** da família correspondente.
3. Ambíguo genuíno → **principal** + `(alt: X)`.
4. Sintoma físico/cognitivo → **mantém o achado E a emoção-base, ligados por `→`** (ex.: `tensão muscular → medo de sobreviver`); a família é a da emoção-base. Nunca substituir, nunca descartar.

---

## Famílias (13)

Ancoradas nas **emoções básicas de Ekman** (raiva, medo, tristeza, nojo, alegria), nas **autoconscientes/sociais** (culpa, vergonha — Tangney & Lewis), e em **estados afetivos** reconhecidos (ansiedade ≠ medo agudo — Barlow; apego/controle; vitalidade↔esgotamento; vínculo — Bowlby; sentido — Frankl). Nomes em pt-BR, 8ª série.

| # | Família | Definição (1 linha) | Âncora |
|---|---|---|---|
| 1 | **Raiva** | O calor que sobe: irritação, frustração, ira, impaciência, impulso reativo. | Ekman (básica). |
| 2 | **Medo** | Sentir-se sem chão diante de uma ameaça: insegurança, pavor, pânico, alerta, congelamento — inclui o corpo em modo de sobrevivência. | Ekman (básica). |
| 3 | **Ansiedade e preocupação** | O medo difuso do que ainda não veio: ruminar, mente que não desliga/não assenta, nervosismo. | Barlow (ansiedade ≠ medo agudo). |
| 4 | **Tristeza e perda** | A dor do que se foi ou nunca veio: luto, desânimo, desesperança, desistir. | Ekman (básica). |
| 5 | **Mágoa e ressentimento** | A ferida guardada contra alguém: rancor, amargura, inveja, vitimização. | Emoção social de agravo. |
| 6 | **Culpa e vergonha** | A dor virada contra si: sentir-se pouco/indigno, autocrítica, baixa autoestima. | Autoconscientes (Tangney, Lewis). |
| 7 | **Controle e rigidez** | Segurar apertado: controle, perfeccionismo, autoexigência, rigidez, teimosia, não soltar. | Estado de "segurar" (controle/rigidez/retenção; o apego afetivo fica em Vínculo e afeto). |
| 8 | **Vínculo e afeto** | O laço com o outro e suas feridas: amor, abandono, traição, solidão, ciúme. | Teoria do apego (Bowlby). |
| 9 | **Expressão contida** | A voz e a criação presas: engolir o que sente, "nunca é minha vez", não dizer não. | Repressão da expressão. |
| 10 | **Esgotamento e vitalidade** | O tanque: exaustão, "não posso parar", carregar tudo, astenia — e no polo bom, energia com descanso. | Eixo vitalidade↔burnout. |
| 11 | **Propósito e sentido** | O rumo: perda de sentido, busca de missão, procrastinar o que importa — e no polo bom, entusiasmo pela missão. | Logoterapia (Frankl). |
| 12 | **Alegria e prazer** | A vida que dá gosto: alegria, entusiasmo, prazer, curiosidade, sociabilidade. | Ekman (básica). |
| 13 | **Nojo e aversão** | O que o corpo empurra pra longe: desgosto, intolerância, aversão/pavor do novo, "não digerir", rejeição — e no polo bom, discernir e digerir a vida com gosto. | Ekman (básica). |

**Ciúme/inveja:** por decisão do founder, **NÃO** vira família própria — fica espalhado em Mágoa (inveja), Vínculo (ciúme no vínculo, possessividade) e Controle (posse como retenção).

---

## Mapa emoção → família

Legenda: **🔴** = carga (a ferida/achado) · **🟢** = recurso (o polo saudável/preservado) · `(alt: X)` = alternativa quando ambíguo · `sintoma → emoção-base` = o achado físico/cognitivo FICA, ligado à emoção por trás (a seta é o valor — o motor mostra os dois: o que a pessoa sente no corpo E a emoção que o move).

### 1. Raiva
**🔴 Carga (13):** raiva contida · frustração · irritação/irritabilidade · ira · impaciência/pressa *(alt: Esgotamento e vitalidade)* · irritação que "sobe" do visceral ao mental · irritabilidade de fundo · irritação cristalizada nas articulações *(alt: Mágoa e ressentimento)* · impulso / ímpeto de ação descontrolado *(alt: Esgotamento e vitalidade)* · prontidão para luta / reatividade *(alt: Medo)* · "reajo antes de pensar" · "estar irritado/pissed off" retido *(alt: Expressão contida)* · raiva não-dissolvida *(alt: Mágoa e ressentimento)*
**🟢 Recurso (10):** assertividade saudável, coragem de "cortar o que não serve" · decisão e iniciativa *(alt: Propósito e sentido)* · ímpeto/motivação de ação *(alt: Esgotamento e vitalidade)* · força de vontade, calor no agir *(alt: Esgotamento e vitalidade)* · iniciativa quando há de fato o que enfrentar *(alt: Esgotamento e vitalidade)* · energia que, canalizada, vira foco e ação *(alt: Esgotamento e vitalidade)* · ímpeto de agir e criar *(alt: Alegria e prazer)* · iniciativa expansiva e presença, "energia que puxa o grupo" *(alt: Vínculo e afeto)* · assertividade/combatividade bem regulada · impulso a serviço da ação escolhida *(alt: Esgotamento e vitalidade)*

### 2. Medo
**🔴 Carga (45):** medo estrutural de base · insegurança da infância · pavor · terror/horror · falta de reserva/apoio · falta de identidade/insegurança criativa *(alt: Propósito e sentido)* · base frágil sentida como medo · insegurança · retração defensiva *(alt: Controle e rigidez)* · síndrome do pânico *(alt: Ansiedade e preocupação)* · alerta sustentado → medo (resposta de ameaça) *(alt: Ansiedade e preocupação)* · hipervigilância → medo (varredura de ameaça) · prontidão reativa crônica → medo em prontidão *(alt: Esgotamento e vitalidade)* · sobressalto → medo (susto reflexo) · ansiedade corporal / sobressalto *(alt: Ansiedade e preocupação)* · hipervigilância / incapacidade de relaxar → medo que não baixa a guarda *(alt: Ansiedade e preocupação)* · alerta crônico → medo de fundo *(alt: Ansiedade e preocupação)* · tensão muscular de fundo → medo de sobreviver · congelamento → medo que paralisa (freeze) · hipervigilância sensorial → medo (sentidos em alerta) *(alt: Ansiedade e preocupação)* · desconexão do corpo → medo (dissociação de ameaça) *(alt: Ansiedade e preocupação)* · reatividade sensorial → medo (sobressalto sensorial) *(alt: Ansiedade e preocupação)* · tensão intestino-cérebro → medo/estresse retido na víscera *(alt: Raiva)* · tensão visceral acumulada → medo/estresse retido no corpo *(alt: Raiva)* · medo/fobia inscrita na coluna · medo de falta de apoio · medo/ansiedade somatizada na lombar → medo que desce pro corpo · insegurança material/financeira · insegurança estrutural / de fundamento · base frágil / não ter chão · medo de seguir em frente / de decisões grandes · insegurança de base / sobrevivência · medo de finalizações / de pertencer *(alt: Vínculo e afeto)* · sexualidade e medos inatos — o instinto travado *(alt: Culpa e vergonha)* · hipervigilância defensiva → medo (defesa em alerta) · prontidão defensiva crônica → medo sempre pronto a se proteger · fronteira/limite frágil com o mundo *(alt: Vínculo e afeto)* · sensibilidade/ameaça ao externo · sentir-se exposto/sem casca *(alt: Culpa e vergonha)* · temperamento manifesto reativo — o "eu" que oscila tímido↔dominante → insegurança de identidade *(alt: Vínculo e afeto)* · tensão de fronteira eu↔mundo quando espessada/irregular → medo do limite invadido *(alt: Vínculo e afeto)* · medo de pertencer / de vincular-se *(alt: Vínculo e afeto)* · medo de finalizações / gravidez não-planejada *(alt: Ansiedade e preocupação)* · medo/ansiedade *(alt: Ansiedade e preocupação)* · fobias somatizadas → medo que vira sintoma no corpo
**🟢 Recurso (15):** coragem tranquila / segurança de base · confiar e descansar na própria base · calma receptiva *(alt: Ansiedade e preocupação)* · senso de reserva e apoio real *(alt: Vínculo e afeto)* · constância, ter recursos guardados *(alt: Controle e rigidez)* · sensação de segurança que permite baixar o alerta *(alt: Ansiedade e preocupação)* · segurança interna *(alt: Culpa e vergonha)* · confiança de que há apoio e recursos *(alt: Vínculo e afeto)* · sentir-se sustentado *(alt: Vínculo e afeto)* · senso de sustentação e base material segura · construir base passo a passo *(alt: Controle e rigidez)* · segurança de base sentida · base instintiva assentada, corpo como chão seguro · fronteira sentida sem se sentir invadido *(alt: Vínculo e afeto)* · calma que não precisa travar de medo *(alt: Ansiedade e preocupação)*

### 3. Ansiedade e preocupação
**🔴 Carga (32):** preocupação · ruminação · ansiedade · nervosismo · ansiedade de fundo · sobrecarga mental *(alt: Esgotamento e vitalidade)* · "mente que não desliga" na hora de dormir · ruminação mental · desregulação sono-vigília → ansiedade que não deixa a mente assentar à noite · "tagarelice mental rotativa" — mente que não desliga · inquietação · ansiedade mental de fundo · neuroticismo → instabilidade emocional de base · tensão nervosa sustentada → ansiedade tensionada no corpo *(alt: Medo)* · ruminação/mente-que-julga *(alt: Controle e rigidez)* · ansiedade de performance *(alt: Controle e rigidez)* · dispersão/ausência → ansiedade que não deixa a mente assentar · confusão / "cabeça no mundo da lua" → ansiedade que embaralha a mente · credulidade / dificuldade de discernir → ansiedade que não deixa a mente filtrar · intuição não-ancorada → mente dispersa pela ansiedade *(alt: Propósito e sentido)* · sobrecarga sensorial → ansiedade de sistema saturado · dispersão mental → ansiedade que não deixa a mente assentar · dificuldade de concentração → ansiedade que não deixa a mente assentar · sobrecarga difusa · preocupação crônica somatizada → preocupação que vira sintoma no corpo · nervosismo somatizado na pele → nervosismo que aflora na pele · natureza conceitual/futuro-orientada, indecisão → ansiedade da mente que antecipa *(alt: Propósito e sentido)* · dispersão entre ideias → ansiedade que não deixa a mente assentar *(alt: Propósito e sentido)* · medo do futuro econômico *(alt: Medo)* · medo do futuro *(alt: Medo)* · medo do fracasso que trava a ação *(alt: Medo)* · medo de errar/de falhar *(alt: Medo)*
**🟢 Recurso (16):** praticidade, resolver no próprio tempo *(alt: Controle e rigidez)* · calma receptiva diante do incerto · confiança de que dá conta *(alt: Medo)* · mente clara que organiza e descansa · ritmo sono-vigília regulado, corpo que descansa no horário *(alt: Esgotamento e vitalidade)* · agilidade mental e curiosidade *(alt: Alegria e prazer)* · capacidade de voltar à calma quando há segurança *(alt: Medo)* · sensação de que pode baixar a guarda *(alt: Medo)* · prontidão que responde e depois relaxa — mobilização bem regulada *(alt: Esgotamento e vitalidade)* · capacidade de assentar o corpo, tônus de base calmo *(alt: Medo)* · clareza mental *(alt: Controle e rigidez)* · sensibilidade que se ancora no corpo, receptividade calma *(alt: Medo)* · prontidão sensorial que serve à ação, sem sobressalto *(alt: Medo)* · clareza mental quando a tensão visceral se alivia · aterrar a tensão no corpo antes que suba *(alt: Medo)* · capacidade de baixar a guarda em segurança — não precisar reagir sempre *(alt: Medo)*

### 4. Tristeza e perda
**🔴 Carga (11):** tristeza · luto/pesar · desânimo · fechamento ao novo depois da perda *(alt: Medo)* · tristeza/luto "pelo que poderia ter sido" · derrotismo / "deixar de cuidar de si" *(alt: Esgotamento e vitalidade)* · resignação *(alt: Expressão contida)* · desistência *(alt: Expressão contida)* · desilusão/trauma localizado *(alt: Mágoa e ressentimento)* · desespero *(alt: Ansiedade e preocupação)* · falta de alegria/prazer, rejeição da vida (anedonia) *(alt: Nojo e aversão)*
**🟢 Recurso (3):** leveza depois de elaborar a perda, "respirar aliviado" · sentir fundo e soltar a dor *(alt: Mágoa e ressentimento)* · otimismo e leveza depois do luto *(alt: Alegria e prazer)*

### 5. Mágoa e ressentimento
**🔴 Carga (9):** ressentimento *(alt: Raiva)* · amargura *(alt: Tristeza e perda)* · inveja *(alt: Raiva)* · mágoa velha presa *(alt: Controle e rigidez)* · mágoa acumulada nas costas · ressentimento de quem sempre sustenta *(alt: Esgotamento e vitalidade)* · crítica cristalizada *(alt: Raiva)* · ressentimento endurecido · amargura / vitimização *(alt: Tristeza e perda)*
**🟢 Recurso (4):** sentir fundo e soltar / perdoar · compaixão que substitui o rancor *(alt: Vínculo e afeto)* · calma receptiva depois de dizer o que doeu *(alt: Ansiedade e preocupação)* · soltar a mágoa velha com leveza *(alt: Controle e rigidez)*

### 6. Culpa e vergonha
**🔴 Carga (18):** auto-rejeição *(alt: Tristeza e perda)* · fôlego curto / sufocamento — "não digno de respirar a vida plena" → sensação de indignidade · falta de amor-próprio/auto-rejeição · auto-humilhação · culpa · irritação voltada contra si na auto-humilhação *(alt: Raiva)* · desvalorização *(alt: Expressão contida)* · autocensura moral/social — super-ego mental *(alt: Controle e rigidez)* · culpa por "não dar conta" · vergonha de não corresponder ao próprio padrão · senso de inferioridade *(alt: Vínculo e afeto)* · culpa/vergonha que trava o impulso · "fora de equilíbrio consigo mesmo" → desconforto de não estar em paz consigo · baixa autoestima · "baixa estima → baixa imunidade" → baixa autoestima (a imunidade é só o veículo) · culpa antiga enterrada · humilhação/vergonha do campo sexual · culpa ou pressão em torno do sexual
**🟢 Recurso (6):** compaixão consigo *(alt: Tristeza e perda)* · doçura da vida recuperada, amor-próprio *(alt: Alegria e prazer)* · senso de valor que não depende da entrega *(alt: Esgotamento e vitalidade)* · gentileza consigo quando não dá conta · autoestima que sustenta a defesa sem exaustão · valor sentido por dentro

### 7. Controle e rigidez
**🔴 Carga (34):** possessividade *(alt: Vínculo e afeto)* · marca de primeira infância/retenção · constrição/contração interna *(alt: Medo)* · dificuldade de soltar · apego ao passado · retenção · obstinação *(alt: Raiva)* · medo de soltar *(alt: Medo)* · necessidade de controle · dever rígido, "tenho de" internalizado *(alt: Esgotamento e vitalidade)* · autoexigência de performance *(alt: Ansiedade e preocupação)* · julgamento do outro e de si *(alt: Culpa e vergonha)* · frieza/racionalização como defesa *(alt: Vínculo e afeto)* · autoexigência / autocrítica *(alt: Culpa e vergonha)* · hipercontrole / necessidade de controle · dever/idealismo excessivo · perfeccionismo · rigidez moral · dificuldade de delegar/confiar no outro · inflexibilidade / rigidez · teimosia *(alt: Raiva)* · "recusa em ver os dois lados" *(alt: Nojo e aversão)* · rigidez teimosa com calor *(alt: Raiva)* · proibições/imposições internalizadas *(alt: Culpa e vergonha)* · peso de regras antigas *(alt: Culpa e vergonha)* · rigidez / resistência · resistência a "mudar de direção" · fixação no passado — "como as coisas eram antes" · resistência à mudança · nostalgia dura / apego ao que passou *(alt: Tristeza e perda)* · rigidez afetiva / "endurecer para aguentar" *(alt: Vínculo e afeto)* · endurecimento de atitudes · retenção — "segurar o que deveria fluir" · apego a ideias velhas / medo de soltar *(alt: Medo)*
**🟢 Recurso (17):** maleabilidade, soltar aos poucos · paciência *(alt: Raiva)* · firmeza que tem posição sem endurecer — ter jeito próprio sem fechar a porta *(alt: Expressão contida)* · capacidade de soltar/deixar fluir — eliminar o que não serve · desapego leve, confiança de que o novo chega · constância sem apego · discernimento e capacidade de organizar/decidir bem — a face útil do rigor · autoconfiança que permite delegar e confiar — força de vontade que não precisa controlar tudo · rigor que vira método sustentável, constância sem rigidez · flexibilidade — capacidade de considerar outros pontos de vista *(alt: Nojo e aversão)* · presença firme e serena *(alt: Medo)* · flexibilidade ativa para mudar de direção quando preciso · firmeza / base vital — força que sustenta sem endurecer *(alt: Medo)* · constância/resistência *(alt: Medo)* · abertura que se mantém firme sem endurecer *(alt: Vínculo e afeto)* · capacidade de deixar fluir o que já não serve · descarga saudável, abrir espaço *(alt: Raiva)*

### 8. Vínculo e afeto
**🔴 Carga (18):** dificuldade de vínculo / de ligar-se · idealismo afetivo — "coração aventureiro que não sustenta o vínculo" · paixão possessiva / drama afetivo *(alt: Controle e rigidez)* · intensidade que consome, "queimar-se" no outro · ciúme ardente no vínculo · medo de não ser amado / amor não recebido *(alt: Medo)* · abandono · perda *(alt: Tristeza e perda)* · traição *(alt: Mágoa e ressentimento)* · solidão de fundo — "sozinha apesar de rodeada", medo da solidão *(alt: Medo)* · amor retido / medo de dar afeto *(alt: Medo)* · sentir-se não-amado *(alt: Culpa e vergonha)* · ausência de limite entre si e o mundo *(alt: Esgotamento e vitalidade)* · fusão com o outro *(alt: Esgotamento e vitalidade)* · afeto que "desliga para se proteger" *(alt: Controle e rigidez)* · dificuldade de ligar-se · passividade sexual ↔ dominação no vínculo *(alt: Controle e rigidez)* · ciúme/desvalorização no vínculo *(alt: Culpa e vergonha)*
**🟢 Recurso (22):** acolhimento/nutrição de si e dos outros *(alt: Culpa e vergonha)* · capacidade de receber tanto quanto dá *(alt: Esgotamento e vitalidade)* · entusiasmo afetivo, coração aberto/aventureiro *(alt: Alegria e prazer)* · calor no vínculo / afeto que aquece · vitalidade e presença na conexão *(alt: Esgotamento e vitalidade)* · desejo saudável de aproximar-se, ardor afetivo vivo · segurança amorosa · sentir fundo e se deixar amar · sentir-se amado e conectado · afeto que se deixa demonstrar · capacidade de pedir e receber apoio *(alt: Medo)* · senso de pertencer e de valor igual ao dos outros *(alt: Culpa e vergonha)* · sentir-se amado e sustentado por dentro · empatia que nutre em vez de esgotar *(alt: Esgotamento e vitalidade)* · sentir o outro sem se afogar *(alt: Esgotamento e vitalidade)* · leveza no vínculo, circular afeto sem carga *(alt: Alegria e prazer)* · abertura afetiva sem medo de se machucar *(alt: Medo)* · calor afetivo que se permite sentir · sensibilidade que protege e conecta na medida *(alt: Medo)* · vínculo prazeroso e nutridor, intimidade viva *(alt: Alegria e prazer)* · vincular-se com prazer e segurança · intimidade viva e leve, vínculo que circula *(alt: Alegria e prazer)*

### 9. Expressão contida
**🔴 Carga (15):** humilhação engolida *(alt: Culpa e vergonha)* · voz sufocada / "nunca é minha vez" · ressentimento de nunca ter vez *(alt: Mágoa e ressentimento)* · servilismo / incapacidade de dizer não · raiva engolida *(alt: Raiva)* · contenção da voz / engolir o que quer dizer · expressão engolida · expressão reprimida · engolir emoções · "não consigo dizer o que sinto" · voz sufocada · criatividade bloqueada *(alt: Propósito e sentido)* · medo de se expor ao falar *(alt: Medo)* · raiva engolida / não falar por si *(alt: Raiva)* · expressão contida/retida
**🟢 Recurso (12):** voz que sente e se deixa ouvir sem medo · confiança de que a própria voz importa · capacidade de pôr limites e sustentar a própria posição *(alt: Controle e rigidez)* · assertividade — reivindicar a própria vez com calor *(alt: Raiva)* · dizer o que sente com jeito, deixar a voz passar · firmeza para sustentar a própria posição *(alt: Controle e rigidez)* · dizer o que sente, voz própria · deixar a emoção passar em palavra · criatividade e expressão liberadas *(alt: Propósito e sentido)* · comunicação leve e viva *(alt: Alegria e prazer)* · assertividade — falar por si com firmeza *(alt: Raiva)* · sustentar a própria fala com calma

### 10. Esgotamento e vitalidade
**🔴 Carga (25):** cuidar demais dos outros / doar sem receber *(alt: Vínculo e afeto)* · exaustão/esgotamento adrenal · "não posso parar" *(alt: Controle e rigidez)* · fadiga crônica/astenia matutina → desânimo/desistência · falta de vitalidade → desânimo · inércia do esgotamento → desistência/desânimo · urgência constante *(alt: Ansiedade e preocupação)* · "tenho de fazer mais / não posso parar" *(alt: Controle e rigidez)* · hiper-realização *(alt: Controle e rigidez)* · incapacidade de parar *(alt: Controle e rigidez)* · sobrecarga de responsabilidade que "trava o pescoço" *(alt: Controle e rigidez)* · peso afetivo / "carregar nas costas" *(alt: Tristeza e perda)* · carregar os outros / falta de apoio emocional *(alt: Vínculo e afeto)* · sobrecarga de dever *(alt: Controle e rigidez)* · "segurar tudo sozinho" *(alt: Vínculo e afeto)* · peso estrutural / "vida adulta pesada" *(alt: Tristeza e perda)* · sobrecarga empática / assumir os fardos dos outros *(alt: Vínculo e afeto)* · acúmulo emocional não drenado *(alt: Mágoa e ressentimento)* · sobrecarga silenciosa de quem sustenta a todos · exaustão de cuidador · "estrutura mais esgotada" → exaustão · dificuldade de dizer não ao cuidado do outro *(alt: Expressão contida)* · autoproteção exaurida *(alt: Medo)* · defesa esgotada / depleção de base → exaustão · carga inflamatória crônica de fundo → estresse/exaustão crônica *(alt: Medo)*
**🟢 Recurso (15):** fôlego/vitalidade · nutrição de si, presença cuidadora equilibrada *(alt: Culpa e vergonha)* · calma receptiva, confiar que pode descansar *(alt: Medo)* · energia mobilizada a serviço da ação escolhida — vigor que responde e depois recua *(alt: Raiva)* · capacidade de recuperar vitalidade após o descanso — voltar à base · constância que sustenta sem se esgotar *(alt: Controle e rigidez)* · capacidade de escolher a prioridade real e agir com foco *(alt: Controle e rigidez)* · vigor direcionado *(alt: Raiva)* · capacidade de desacelerar e sustentar o ritmo · capacidade de dividir o peso, apoiar-se sem carregar tudo *(alt: Vínculo e afeto)* · vitalidade / "fogo criador" — a base instintiva viva *(alt: Alegria e prazer)* · limites saudáveis — cuidar sem se dissolver *(alt: Vínculo e afeto)* · firmeza que sustenta o próprio contorno *(alt: Vínculo e afeto)* · capacidade de se recuperar e se fortalecer, base que se refaz *(alt: Medo)* · vitalidade e ímpeto generativo *(alt: Alegria e prazer)*

### 11. Propósito e sentido
**🔴 Carga (5):** desconexão de propósito · perda de sentido/missão · confusão sobre o rumo *(alt: Ansiedade e preocupação)* · procrastinação / "não começo minha missão" *(alt: Medo)* · busca ansiosa de propósito/missão *(alt: Ansiedade e preocupação)*
**🟢 Recurso (8):** pneuma / conexão espiritual — o sopro que liga a algo maior · reconexão com propósito/sentido, entusiasmo pela missão · reconexão com o sentido sentido, calma interior *(alt: Ansiedade e preocupação)* · intuição e imaginação quando ancoradas — o dom do sonhador *(alt: Alegria e prazer)* · capacidade de dar o primeiro passo concreto, aterrar a missão *(alt: Controle e rigidez)* · entusiasmo pela missão / sentido de propósito vivo · orientação ao futuro com esperança, visão conceitual que inspira *(alt: Alegria e prazer)* · coragem de se arriscar na própria missão *(alt: Raiva)*

### 12. Alegria e prazer
**🔴 Carga (0):** — *(nenhum carga puro; a "falta de alegria/prazer, rejeição da vida" (anedonia) migrou para Tristeza e perda. Que a alegria só apareça no polo recurso é esperado: é a família da força.)*
**🟢 Recurso (14):** capacidade de inspirar/receber a vida, abertura ao novo *(alt: Nojo e aversão)* · sentir o gostinho bom das coisas · ímpeto de ir atrás do próprio prazer/doçura *(alt: Raiva)* · alegria/júbilo · sociabilidade, prazer no encontro *(alt: Vínculo e afeto)* · alegria & amor *(alt: Vínculo e afeto)* · espírito livre / não-conformismo criativo — energia inquieta que inova *(alt: Propósito e sentido)* · sensibilidade que percebe beleza e detalhe · recentrar no essencial: amor e alegria *(alt: Vínculo e afeto)* · otimismo *(alt: Propósito e sentido)* · sociabilidade, carisma, calor no contato *(alt: Vínculo e afeto)* · leveza no vínculo social *(alt: Vínculo e afeto)* · criatividade / "fogo criador" — o instinto criativo, não só o reprodutivo *(alt: Propósito e sentido)* · desejo vivo *(alt: Vínculo e afeto)*

### 13. Nojo e aversão
**🔴 Carga (7):** nojo/desgosto · "não digerir/não assimilar o novo" · pavor do novo / medo de ideias novas *(alt: Medo)* · não-assimilar · rigidez/intolerância *(alt: Controle e rigidez)* · intolerância que endurece *(alt: Raiva)* · intolerância *(alt: Controle e rigidez)*
**🟢 Recurso (4):** curiosidade e apetite pelo novo, "digerir a vida com gosto" *(alt: Alegria e prazer)* · capacidade de assimilar/aproveitar o que serve — separar o puro do impuro *(alt: Controle e rigidez)* · abrir-se devagar ao diferente *(alt: Medo)* · confiança de que o novo pode ser bom *(alt: Controle e rigidez)*

---

## Sintomas físicos e cognitivos → emoção-base conectada (rastreio do princípio psicossomático)

Nenhum foi descartado nem substituído: **o achado FICA e a emoção-base fica ao lado, ligados pelo "→".** A coluna do meio é o valor — o relatório pode dizer as duas coisas ("essa tensão que você sente no corpo é o medo de sobreviver"). A família é a da emoção-base.

| Sintoma / achado (fica) | Emoção-base conectada (o "→") | Família |
|---|---|---|
| tensão muscular de fundo | medo de sobreviver | **Medo** |
| tensão intestino-cérebro · tensão visceral acumulada | medo/estresse retido na víscera | **Medo** *(alt Raiva)* |
| congelamento (freeze) | medo que paralisa | **Medo** |
| sobressalto · hipervigilância (sensorial/defensiva) · alerta sustentado/crônico · reatividade sensorial · desconexão do corpo · prontidão reativa/defensiva | medo em estado de alerta / varredura de ameaça | **Medo** |
| medo/ansiedade somatizada na lombar · fobias somatizadas | medo que vira sintoma no corpo | **Medo** |
| fadiga crônica/astenia matutina · falta de vitalidade · inércia do esgotamento · "estrutura mais esgotada" · defesa esgotada | desânimo / desistência / exaustão | **Esgotamento e vitalidade** |
| carga inflamatória crônica de fundo | estresse/exaustão crônica | **Esgotamento e vitalidade** *(alt Medo)* |
| desregulação sono-vigília | ansiedade que não deixa a mente assentar à noite | **Ansiedade e preocupação** |
| neuroticismo | instabilidade emocional de base | **Ansiedade e preocupação** |
| dispersão/ausência · confusão / "mundo da lua" · dispersão mental · dificuldade de concentração · dispersão entre ideias · sobrecarga sensorial/difusa | ansiedade que não deixa a mente assentar | **Ansiedade e preocupação** |
| credulidade / dificuldade de discernir · intuição não-ancorada | ansiedade que não deixa a mente filtrar | **Ansiedade e preocupação** |
| natureza conceitual/futuro-orientada, indecisão | ansiedade da mente que antecipa | **Ansiedade e preocupação** |
| preocupação crônica somatizada · nervosismo somatizado na pele | preocupação/nervosismo que afloram no corpo | **Ansiedade e preocupação** |
| temperamento manifesto reativo (oscila tímido↔dominante) | insegurança de identidade | **Medo** *(alt Vínculo)* |
| tensão de fronteira eu↔mundo | medo do limite invadido | **Medo** *(alt Vínculo)* |
| fôlego curto/sufocamento — "não digno de respirar" | sensação de indignidade | **Culpa e vergonha** |
| "baixa estima → baixa imunidade" | baixa autoestima (a imunidade é só o veículo) | **Culpa e vergonha** |
| "fora de equilíbrio consigo mesmo" | desconforto de não estar em paz consigo | **Culpa e vergonha** |

Nota: a ligação `sintoma → emoção-base` é justamente o gancho terapêutico. O motor pode mostrar os dois lados; as tags de fonte/mecanismo internas continuam fora do doc do cliente.

---

## Contagem por família (carga + recurso)

| # | Família | 🔴 Carga | 🟢 Recurso | Total |
|---|---|---|---|---|
| 2 | Medo | 45 | 15 | **60** |
| 7 | Controle e rigidez | 34 | 17 | **51** |
| 3 | Ansiedade e preocupação | 32 | 16 | **48** |
| 8 | Vínculo e afeto | 18 | 22 | **40** |
| 10 | Esgotamento e vitalidade | 25 | 15 | **40** |
| 9 | Expressão contida | 15 | 12 | **27** |
| 6 | Culpa e vergonha | 18 | 6 | **24** |
| 1 | Raiva | 13 | 10 | **23** |
| 12 | Alegria e prazer | 0 | 14 | **14** |
| 4 | Tristeza e perda | 11 | 3 | **14** |
| 5 | Mágoa e ressentimento | 9 | 4 | **13** |
| 11 | Propósito e sentido | 5 | 8 | **13** |
| 13 | Nojo e aversão | 7 | 4 | **11** |
| | **TOTAL** | **232** | **146** | **378** |

**Verificação:** 232 carga + 146 recurso = 378. **0 itens sem família.** 13 famílias (Nojo e aversão criada). Ciúme/inveja mantido espalhado (Mágoa/Vínculo/Controle), sem família própria.

---

## Como isto foi montado (rastreio)
- Emoções extraídas por `parseLastro()` de `motor-calc.mjs` (mesmo parser do motor) — 232 carga + 146 recurso, únicas.
- Classificação pelo **tema nuclear**, não pelo elemento Bardon nem pelo órgão. Sintoma físico/cognitivo mantém o achado ligado à emoção-base por `→` (o "sintoma → emoção" é o valor); mecanismo (engolir, somatizar, cristalizar) vira alt, nunca motivo de descarte.
- Locks de coerência: MEDO agudo/ameaça (inclui corpo em sobrevivência) ≠ ANSIEDADE difusa/antecipatória (mente que não assenta); controle/rigidez/retenção juntos, apego afetivo em Vínculo (founder); expressão contida = tema próprio; vínculo ≠ alegria; nojo/aversão = 13ª família.
