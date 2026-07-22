# Tabela canônica DE-PARA — ACHADO (campo Stage 1) → EMOÇÕES (enriquecida + por fonte)

**O que é:** o artefato central do motor. Para CADA campo do Stage 1, o leque mais rico e defensável de emoções-hipótese, cada uma marcada por **fonte** e classificada em **NÚCLEO** (forte/central — a que o motor prioriza) ou **PALETA** (periférica/contextual — só se o exame + história pedirem). O Stage 2 consulta esta tabela.
**Escopo desta versão:** SÓ a coluna EMOÇÕES. A coluna ELEMENTO fica como placeholder — atribuição de elemento é outra pesquisa (merge posterior).
**Data:** 2026-07-22.

---

## Legenda de fontes (rastreabilidade interna — NUNCA impressa ao cliente)

| tag | fonte | peso/uso |
|---|---|---|
| **N** | Nativo — glossário psicossomático do `stage1-scan.md` | a leitura que já roda em produção |
| **Br** | Bradley — Quadro das 60 emoções (*O Código da Emoção*), órgão→emoção | catálogo visceral estruturado; **só o mapa**, nunca o método do ímã |
| **MTC** | Medicina Tradicional Chinesa — 5 elementos, emoções primárias + derivadas | validação por convergência (3 tradições independentes batem) |
| **Hay** | Louise Hay — vocabulário por região corporal | **filtrado**: entra o TEMA, nunca o framing determinista/culpa |
| **Dias** | Camada nativa da íris — livros M.V. Dias (Denny Johnson/Rayid, anéis, quadrantes psíquicos, Cronorichio, mapa vetorial) | a assinatura própria da íris; granularidade que Br/MTC/Hay não dão |

**Tag adicional — `⚡Ar`:** emoção do lado **RECURSO/expansivo** de um campo (alegria, sociabilidade, entusiasmo, leveza, vínculo prazeroso, criatividade, iniciativa). O de-para é naturalmente "carga/sombra-heavy" — sem esta marcação o registro Ar/Sanguíneo some e o temperamento Sanguíneo desaparece. Regra: `⚡Ar` só onde a fonte LEGITIMA (Stage 1 lê `sistemas_preservados` com polaridade `vital_ativo`; MTC dá a face harmônica de cada órgão; Fogo=alegria/vínculo; "fogo criador"=criatividade). **NÃO inventar Ar onde não há** — mas não deixar passar o que é real.

## Guardrails (herdados do produto)
1. **Emoção = HIPÓTESE ancorada no achado**, a explorar na devolutiva — nunca causa fixa, sentença ou culpa. Enfoque emocional/comportamental, não-médico.
2. Nome de fonte/autor **jamais** vai ao cliente. Aqui a fonte é marcada só para rastreio.
3. **Hay entra só como vocabulário** — descarta-se "você criou isso / é culpa / precisa perdoar".
4. **Não** se usa o método do ímã/teste muscular do Bradley — só o quadro emoção↔órgão.
5. **Lado RECURSO (`⚡Ar`):** todo campo tem face de carga E face preservada. O Stage 1 já emite `sistemas_preservados` (polaridade `vital_ativo`). Onde a face preservada legitima emoção expansiva/leve, ela é marcada `⚡Ar` na PALETA — para o motor não colapsar tudo em sombra e não apagar o Sanguíneo.
6. **Componente de CENTRO** (nota por campo): *Mente* (mental/analítico), *Coração* (emocional/vínculo), *Instinto* (visceral/sobrevivência). ⚠️ "análise / ruminação / ficar analisando" é **modo do centro MENTE** (outro cálculo do motor), NÃO emoção pura — mas as emoções LIGADAS (autoexigência, ansiedade de performance, medo de errar) entram normalmente na paleta. Onde um campo tem forte componente Mente/Instinto/Coração, está sinalizado.

---

# 1. Núcleo visceral (Bradley/MTC/Dias convergem forte)

### `figado_vesicula` — temporal inferior (5-7h)
- **Componente:** Coração-Instinto (afeto ferido que vira defesa/ataque). Baixo componente Mente.
- **NÚCLEO:** raiva contida (Br/MTC/Dias) · ressentimento (Br/MTC/Dias) · frustração (Br/MTC) · amargura (Br/MTC/Hay)
- **PALETA:** irritação/irritabilidade (MTC) · ira (Br/MTC) · ódio (Br) · indignação (MTC) · rancor/desejo de vingança (Dias) · hostilidade/rivalidade — "contra quem sinto hostilidade?" (Dias) · crítica crônica / faultfinding (Hay) · **ciúme** (Br/Dias — vesícula) · **inveja** (Dias) · **possessividade** (Dias) · indecisão de soltar — "o que tenho medo de perder?" (Dias) · orgulho/dureza (Hay — vesícula) · culpa (Br — nota: culpa aparece no fígado E no rim em Bradley)
- **PALETA-Ar (lado recurso/preservado):** `⚡Ar` motivação/ímpeto de ação (MTC — fígado em harmonia = motivação) · `⚡Ar` decisão e iniciativa (MTC — vesícula em harmonia = decisão/ação) · `⚡Ar` assertividade saudável, coragem de "cortar o que não serve" (MTC)
- **Elemento:** [elemento: a definir — merge]

### `rim` — inferior (6h)
- **Componente:** Instinto (medo de base, sobrevivência). 
- **NÚCLEO:** medo estrutural de base (Br/MTC/Dias) · insegurança da infância (Dias) · falta de reserva/apoio (Br — "falta de apoio") 
- **PALETA:** pavor (Br/MTC) · terror/horror (Br) · aversão (Br) · fobia (MTC) · síndrome do pânico (MTC/Dias) · culpa (Br/MTC — "rins = culpa e medo") · crítica (Hay) · decepção/desapontamento (Hay) · vergonha (Hay) · falta de identidade / insegurança criativa (Br) · conflito (Br) · (em eixo c/ quadrante depressivo) desesperança / tendência suicida (Dias — usar com MUITA parcimônia)
- **Elemento:** [elemento: a definir — merge]

### `pulmoes` — temporal superior (3h OE / 9h OD)
- **Componente:** Coração (luto, valor pessoal). 
- **NÚCLEO:** tristeza (Br/MTC/Hay) · luto/pesar (Br/MTC) · desânimo (Br) · auto-rejeição (Dias)
- **PALETA:** choro (Br) · melancolia (MTC) · depressão/desesperança (Hay/MTC) · rejeição (Br) · pesar profundo (Br) · desapego difícil / dificuldade de elaborar perdas (MTC) · baixa autoestima por auto-comparação (Dias) · pessimismo (Dias) · "não digno de viver/respirar a vida plenamente" (Hay) · desproteção (Br)
- **PALETA-Ar (lado recurso/preservado):** `⚡Ar` capacidade de inspirar/receber a vida (MTC — pulmão em harmonia = abertura ao novo) · `⚡Ar` leveza depois de elaborar a perda, "respirar aliviado" (MTC)
- **Elemento:** [elemento: a definir — merge]

### `estomago` — anel interno pericentral
- **Componente:** Mente-Instinto (ansiedade antecipatória; "não digerir"). Forte componente Mente (preocupação/ruminação — ver ⚠️ guardrail 5).
- **NÚCLEO:** ansiedade (Br/MTC) · preocupação (Br/MTC) · "não digerir / não assimilar o novo" (Hay/MTC)
- **PALETA:** nervosismo (Br) · ruminação (MTC — *modo Mente*) · desespero (Br) · nojo/desgosto (Br) · pavor do novo / medo de ideias novas (Hay) · medo do fracasso (Dias) · indecisão (Dias) · eco da vida intra-uterina — "1º círculo marcado = gestação difícil" (Dias)
- **PALETA-Ar (lado recurso/preservado):** `⚡Ar` curiosidade e apetite pelo novo, "digerir a vida com gosto" (MTC — Terra em harmonia = assimilação tranquila) · `⚡Ar` acolhimento/nutrição de si e dos outros (MTC — Terra = centro/cuidado)
- **Elemento:** [elemento: a definir — merge]

### `intestino_delgado` — estroma intermediário
- **Componente:** Instinto (retenção; primeira infância). 
- **NÚCLEO:** rigidez/intolerância (Dias/Hay) · não-assimilar (MTC) · marca de primeira infância (Dias)
- **PALETA:** constrição/contração interna (Dias) · abandono/desamparo — ⚠️ **DIVERGE**: Bradley põe abandono aqui; a íris (2º ciclo = primeira infância/retenção) diverge. **Resolução do produto: usar "primeira infância/retenção", NÃO abandono do Bradley.** Registrado, não usado como núcleo. · insegurança (Br) · alegria em excesso (Br — par Fogo; não aparece nos livros, baixa prioridade)
- **Elemento:** [elemento: a definir — merge]

### `intestino_grosso` — periferia/borda externa
- **Componente:** Instinto (soltar × segurar). 
- **NÚCLEO:** dificuldade de soltar (MTC/Hay) · apego ao passado (MTC/Hay/Dias) · retenção (Dias)
- **PALETA:** medo de soltar (Hay/MTC) · obstinação (Br) · congestionamento/acúmulo do velho (Hay) · marca de primeira infância (Dias) · constipação emocional — reter o que deveria fluir (Hay)
- **Elemento:** [elemento: a definir — merge]

### `pancreas` — 7-8h OE (lateralidade preferencial)
- **Componente:** Coração-Terra (doçura da vida, amor-próprio).
- **NÚCLEO:** falta de amor-próprio / auto-rejeição (Dias) · carência de doçura na vida (MTC/Hay) · auto-humilhação (Dias)
- **PALETA:** culpa (Dias) · cuidar demais dos outros / doar sem receber (MTC) · tristeza/luto "pelo que poderia ter sido" (Hay — diabetes) · necessidade de controle (Hay — diabetes) · amargura pela falta de doçura (Hay)
- **Elemento:** [elemento: a definir — merge]

### `coracao` — superior esquerda OE (2-3h)
- **Componente:** Coração (vínculo, amor). 
- **NÚCLEO:** medo de não ser amado / amor não recebido (Br/Dias) · abandono (Br) · dificuldade de vínculo / de ligar-se (Dias)
- **PALETA:** perda (Br) · traição (Br) · desamparo (Br) · vulnerabilidade (Br) · esforço não reconhecido (Br) · angústia (Br) · idealismo afetivo — "coração aventureiro que não sustenta o vínculo" (Dias) · coração endurecido / medo de sentir (Hay) · falta de alegria/prazer, rejeição da vida (Hay)
- **PALETA-Ar (lado recurso/preservado):** `⚡Ar` alegria/júbilo (MTC — Fogo em harmonia = alegria) · `⚡Ar` vínculo prazeroso, sentir-se amado e conectado (Br/Dias — o positivo do "amor recebido") · `⚡Ar` entusiasmo afetivo, coração aberto/aventureiro (Dias) · `⚡Ar` segurança amorosa, calor no vínculo (Br)
- **Nota (divergência):** a MTC dá "alegria" ao Fogo, mas os livros Dias NÃO usam alegria para a CARGA cardíaca → na face de carga usa-se **amor/vínculo/medo-de-não-ser-amado**, não alegria. Alegria entra SÓ como face RECURSO (`⚡Ar`), é aí que o Fogo/Sanguíneo se registra legitimamente.
- **Elemento:** [elemento: a definir — merge]

---

# 2. Endócrino / eixo do estresse

### `adrenal` — sobre o rim (5:30-6h)
- **Componente:** Instinto (luta-fuga, exaustão). Bradley/MTC NÃO cobrem — lastro é Dias + somático/polivagal.
- **NÚCLEO:** exaustão/esgotamento adrenal (Dias/Hay) · alerta sustentado (N/somático) · "não posso parar" (Dias)
- **PALETA:** fadiga crônica / astenia matutina (Dias) · síndrome do pânico (Dias) · falta de vitalidade (Dias) · solidão de fundo — "sozinha apesar de rodeada", medo da solidão (Dias) · derrotismo / "deixar de cuidar de si" (Hay) · ansiedade (Hay) · hipervigilância (somático)
- **Elemento:** [elemento: a definir — merge]

### `eixo_pituitario_adrenal` — collarete a 12:30h
- **Componente:** Instinto-Mente (urgência crônica). 
- **NÚCLEO:** alerta sustentado (Dias/N) · urgência constante (Dias) · "tenho de fazer mais / não posso parar" (Dias)
- **PALETA:** hiper-realização (Dias) · esgotamento (Dias) · autoexigência de performance (Dias — *componente Mente*) · incapacidade de relaxar (somático) · ansiedade de fundo (Dias)
- **Elemento:** [elemento: a definir — merge]

### `tireoide` — cervical (2-3h OE / 9-10h OD)
- **Componente:** Coração-expressão (voz engolida). 
- **NÚCLEO:** humilhação engolida (Hay/Dias) · voz sufocada / "nunca é minha vez" (Hay/MTC) · servilismo / incapacidade de dizer não (Hay/Dias)
- **PALETA:** ressentimento de nunca ter vez (Hay) · desistência / "desisti de fazer o que quero" (Hay) · submissão/desonra (Dias) · desvalorização (Br) · raiva engolida (MTC — garganta) · resignação (Dias)
- **Elemento:** [elemento: a definir — merge]

### `pineal_hipotalamica` — centro ~12h
- **Componente:** Mente (regulação, propósito). Lastro nativo PARCIAL.
- **NÚCLEO:** desregulação sono-vigília (N/Dias) · desconexão de propósito (Dias/Hay) · sobrecarga mental (N)
- **PALETA:** confusão sobre o propósito/rumo (Hay) · "mente que não desliga" na hora de dormir (N — *modo Mente*) · desconexão do sentido/missão (Dias — via anel de propósito)
- **Elemento:** [elemento: a definir — merge]

---

# 3. Sistema nervoso / cérebro (Bradley/MTC não cobrem — íris + somático cobrem)

### `sistema_nervoso_autonomico` / `anel_nervoso` — anel concêntrico
- **Componente:** Mente-Instinto (tensão sustentada, hipervigilância). 
- **NÚCLEO:** tensão nervosa sustentada (N/Dias) · ansiedade de fundo (Dias/somático) · hipervigilância / incapacidade de relaxar (somático)
- **PALETA:** "tagarelice mental rotativa" — mente que não desliga (Dias — *modo Mente*) · inquietação (Dias) · neuroticismo (Dias) · alerta crônico / congelamento (somático-polivagal) · tensão muscular de fundo (Dias) · não-conformismo / hiper-realização (Dias) · sobressalto (somático)
- **PALETA-Ar (lado recurso/preservado):** `⚡Ar` espírito livre / não-conformismo criativo, energia inquieta que inova (Dias — anel de liberdade no lado recurso, quando a inquietação vira movimento e não só ansiedade)
- **Elemento:** [elemento: a definir — merge]

### `cerebrum_motor` — 12-1h (super-ego / vetor mental ativo) — ⚠️ CAMPO ENRIQUECIDO
- **Componente:** Mente (o mais mental de todos — ver ⚠️ guardrail 5: aqui "controle/ruminação/julgamento" são *modos do centro Mente*; as emoções LIGADAS entram normalmente).
- **NÚCLEO:** autoexigência / autocrítica (N/Dias) · perfeccionismo (Dias — "controlador, rígido, calculista") · hipercontrole / necessidade de controle (Dias) · culpa por "não dar conta" (Dias/Hay)
- **PALETA:** autocensura moral/social — super-ego (Dias) · rigidez moral / "tem de ser do jeito certo" (Dias) · medo de errar / de falhar (Dias) · ansiedade de performance (Dias) · dificuldade de delegar / de confiar no outro (Dias) · frieza/racionalização como defesa (Dias) · julgamento do outro e de si (Dias) · obsessividade (Dias — *modo Mente*) · ruminação / "mente que não desliga" (N/Dias — *modo Mente*) · dever/idealismo excessivo (Dias) · intolerância ao próprio erro (Dias) · vergonha de não corresponder ao próprio padrão (Br — vergonha)
- **Nota:** era o campo mais POBRE (só "autocrítica, controle, ruminação, autocensura"). Enriquecido de 4→~16.
- **Elemento:** [elemento: a definir — merge]

### `cerebellum_sensory` — 11-12h (vetor mental passivo)
- **Componente:** Mente (dispersão) + somático (hipervigilância sensorial). Lastro nativo PARCIAL.
- **NÚCLEO:** hipervigilância sensorial (N/somático) · ansiedade corporal / sobressalto (N/somático) · dispersão/ausência (Dias — "sonhador, confuso, ausente")
- **PALETA:** confusão / "cabeça no mundo da lua" (Dias) · credulidade / dificuldade de discernir (Dias) · sobrecarga sensorial (somático) · desconexão do corpo (somático) · intuição não-ancorada (Dias)
- **Elemento:** [elemento: a definir — merge]

### `radii_solaris` — linhas radiais saindo da pupila
- **Componente:** Mente-Instinto (irritação que "sobe"). SEM lastro nativo específico nos livros — leitura vem do glossário/somático.
- **NÚCLEO:** irritação que "sobe" do visceral ao mental (N) · dispersão mental (N) · tensão intestino-cérebro (N)
- **PALETA:** sobrecarga difusa (N) · irritabilidade de fundo (N/MTC) · dificuldade de concentração (N — *modo Mente*)
- **Nota:** campo SEM lastro nativo nos 2 livros — palavras vêm do glossário Stage 1; usar com moderação, ancorar sempre no achado.
- **Elemento:** [elemento: a definir — merge]

---

# 4. Coluna / topografia / estrutura (íris nativa fraca; Hay enriquece o vocabulário)

### `coluna_cervical` — 10-11h
- **Componente:** Coração-expressão (voz, flexibilidade). 
- **NÚCLEO:** contenção da voz / engolir o que quer dizer (N/MTC) · inflexibilidade / rigidez (Hay) · teimosia (Hay)
- **PALETA:** "recusa em ver os dois lados" (Hay — pescoço) · expressão engolida (N) · medo/fobia inscrita na coluna (Dias — genérico) · sobrecarga de responsabilidade que "trava o pescoço" (Hay)
- **Elemento:** [elemento: a definir — merge]

### `coluna_toracica` — 3-5h — ⚠️ CAMPO ENRIQUECIDO (era fraco)
- **Componente:** Coração (peso afetivo, culpa). SEM lastro nativo específico — Hay + glossário.
- **NÚCLEO:** peso afetivo / "carregar nas costas" (N/Hay) · culpa (Hay — costas média: "sai de cima de mim") · carregar os outros / falta de apoio emocional (Hay)
- **PALETA:** sentir-se sobrecarregado por dever (Hay) · mágoa acumulada nas costas (Hay) · "segurar tudo sozinho" (Hay — costas alta: falta de apoio emocional, amor retido) · amor retido / medo de dar afeto (Hay — costas superior) · ressentimento de quem sempre sustenta (Hay)
- **Nota:** era um dos mais pobres (3 emoções). Enriquecido via Hay (mapa costas superior/média). ~3→~9.
- **Elemento:** [elemento: a definir — merge]

### `coluna_lombar` — 4-5h
- **Componente:** Instinto (sustentação, medo material). 
- **NÚCLEO:** medo de falta de apoio (Hay/N) · insegurança material/financeira (Hay — "medo por dinheiro") · insegurança estrutural / de fundamento (N)
- **PALETA:** medo do futuro econômico (Hay) · sensação de não ter chão / base frágil (N) · sobrecarga de sustentar a família/os outros (Hay) · medo/ansiedade somatizada na lombar (Dias — genérico "coluna=medo")
- **Elemento:** [elemento: a definir — merge]

### `sacro_coccyx` — 5-6h
- **Componente:** Instinto (base, sobrevivência, sexualidade). Quadrante do INSTINTO (Dias).
- **NÚCLEO:** medo de seguir em frente / de decisões grandes (Hay) · insegurança de base / sobrevivência (Dias/Hay) · sexualidade e medos inatos (Dias)
- **PALETA:** senso de inferioridade (Dias) · "fora de equilíbrio consigo mesmo" (Hay) · proibições/imposições internalizadas (Dias) · medo de finalizações / de pertencer (Dias — área 8) · culpa/vergonha ligada ao sexual (Dias)
- **Elemento:** [elemento: a definir — merge]

### `sistema_musculoesqueletico` — estroma intermediário-periférico
- **Componente:** Mente-Coração (rigidez cristalizada). 
- **NÚCLEO:** rigidez / resistência (Hay — "pensamento rígido") · crítica cristalizada (Hay — artrite) · amargura / vitimização (Hay — reumatismo)
- **PALETA:** intolerância (Dias) · preocupação crônica somatizada nas articulações (Dias) · sentir-se não-amado (Hay — articulações) · ressentimento endurecido (Hay) · resistência a "mudar de direção" (Hay — articulações = mudanças de direção) · peso estrutural / "vida adulta pesada" (Dias — 4º ciclo)
- **Elemento:** [elemento: a definir — merge]

### `boca_garganta` — orofaríngea (1-2h OE / 10-11h OD)
- **Componente:** Coração-expressão (voz por si). 
- **NÚCLEO:** raiva engolida / não falar por si (MTC/Hay) · criatividade bloqueada (Hay — amidalite) · expressão reprimida (Dias/Hay)
- **PALETA:** medo de se expor ao falar (Hay) · engolir emoções (Hay) · "não consigo dizer o que sinto" (Hay) · voz sufocada (MTC)
- **Elemento:** [elemento: a definir — merge]

---

# 5. Sistêmico / pele / linfa / circulação

### `sistema_linfatico` / `rosario_linfatico` — coroa periférica — ⚠️ CAMPO ENRIQUECIDO
- **Componente:** Coração (empatia sem limite). 
- **NÚCLEO:** sobrecarga empática / assumir os fardos dos outros (Dias) · exaustão de cuidador (Dias) · ausência de limite entre si e o mundo (Dias)
- **PALETA:** acúmulo emocional não drenado (N) · "estrutura mais esgotada" (Dias) · dificuldade de dizer não ao cuidado do outro (Dias) · perda do centro — "mente precisa se recentrar no essencial: amor e alegria" (Hay) · sobrecarga silenciosa de quem sustenta a todos (Dias)
- **Nota:** era pobre (2 emoções). ~2→~8.
- **Elemento:** [elemento: a definir — merge]

### `sistema_imune` / `manchas_psoricas` — sistêmico / disperso
- **Componente:** Coração-Instinto (autoestima, defesa). 
- **NÚCLEO:** baixa autoestima (Dias — "anel de expressão") · autoproteção exaurida (N) · hipervigilância defensiva (N/somático)
- **PALETA:** defesa esgotada / "baixa estima → baixa imunidade" (Dias) · desilusão/trauma localizado onde o pigmento aparece (Dias — leitura de pigmento, não "psórico sistêmico") · carga inflamatória crônica de fundo (N — nota: framing "psórico sistêmico" é do glossário, não nativo)
- **Elemento:** [elemento: a definir — merge]

### `sistema_circulatorio` / `anel_sodico` — coroa + anel periférico
- **Componente:** Coração-Mente (endurecer para aguentar). Anel sódico: "raro abaixo dos 40" (Dias).
- **NÚCLEO:** rigidez afetiva / "endurecer para aguentar" (Dias/N) · medo do futuro (Dias) · fixação no passado — "como as coisas eram antes" (Dias)
- **PALETA:** intolerância (Dias) · endurecimento de atitudes (Dias) · resistência à mudança (Dias) · afeto que "desliga para se proteger" (Dias) · nostalgia dura / apego ao que passou (Br — nostalgia; Dias)
- **Elemento:** [elemento: a definir — merge]

### `pele_tegumentar` — anel periférico extremo — ⚠️ CAMPO ENRIQUECIDO
- **Componente:** Instinto-Mente (fronteira com o mundo + eixo do futuro/propósito). 
- **NÚCLEO:** fronteira/limite frágil com o mundo (N/Hay) · sensibilidade/ameaça ao externo (Hay — "ameaça à individualidade") · busca de propósito/missão (Dias — anel de propósito)
- **PALETA:** ansiedade de fundo (Hay — pele = ansiedade, medo) · procrastinação / "não começo minha missão" (Dias) · medo do fracasso (Dias) · culpa antiga enterrada (Hay) · ausência de autocontrole / nervosismo somatizado na pele (Dias) · natureza conceitual/futuro-orientada, indecisão (Dias) · sentir-se exposto/sem casca (Hay)
- **PALETA-Ar (lado recurso/preservado):** `⚡Ar` entusiasmo pela missão / sentido de propósito vivo (Dias — anel de propósito no lado recurso) · `⚡Ar` orientação ao futuro com esperança, visão conceitual que inspira (Dias)
- **Nota:** era pobre (2 emoções). ~2→~10.
- **Elemento:** [elemento: a definir — merge]

### `coroa_simpatica` — fronteira zona ciliar/periférica (coroa do simpático)
- **Componente:** Instinto — é a coroa do sistema **simpático** → registro de **luta/impulso/prontidão** (fight-flight) + temperamento manifesto. Lastro: N/somático + mapa vetorial (Dias).
- **NÚCLEO:** impulso / ímpeto de ação (N/somático — coroa simpática = mobilização) · prontidão para luta / reatividade (somático) · temperamento manifesto — o "eu" que aparece: tímido↔dominante, submisso↔sedutor (Dias)
- **PALETA:** assertividade / combatividade (Dias — "eu" dominante) · tensão de fronteira eu↔mundo quando espessada/irregular (N) · transição para o futuro/velhice (Dias — periferia) · pares opositivos de "eu" prontos para eixo qualitativo — sonhador↔controlador (Dias)
- **PALETA-Ar (lado recurso/preservado):** `⚡Ar` sociabilidade, carisma, calor no contato (Dias — "eu" sedutor/simpático/carismático, vetor emocional-ativo) · `⚡Ar` iniciativa expansiva e presença, "energia que puxa o grupo" (Dias)
- **Nota:** é modulador do TOM (intensidade/mobilização) além de emoção — coroa espessada/irregular amplifica reatividade; coroa fina/ordenada = mobilização bem regulada.
- **Elemento:** [elemento: a definir — merge]

---

# 6. Reprodutor / urinário

### `sistema_reprodutor` — inferior medial (6h)
- **Componente:** Instinto (sexualidade, sobrevivência da espécie, vínculo/procriação). Quadrante do INSTINTO (Dias) — rico.
- **NÚCLEO:** sexualidade e medos inatos (Dias) · medo de pertencer / de vincular-se (Dias — área 8) · vínculo/procriação e o afeto que nutre (Dias — vetor emocional-ativo)
- **PALETA:** passividade sexual (colarete em cunha p/ baixo) ↔ dominação (p/ cima) (Dias) · sobrevivência / "fogo criador" (Dias) · humilhação/vergonha do campo sexual (Br — fila glândulas) · ciúme/desvalorização no vínculo (Br) · culpa ou pressão em torno do sexual (Hay) · medo de finalizações / gravidez não-planejada (Dias — área 8)
- **PALETA-Ar (lado recurso/preservado):** `⚡Ar` criatividade / "fogo criador" (Dias — o instinto criativo, não só o reprodutivo) · `⚡Ar` vínculo prazeroso e nutridor, intimidade viva (Dias — vetor emocional-ativo, ocitocina/prolactina) · `⚡Ar` vitalidade e ímpeto criativo/generativo (Dias)
- **Elemento:** [elemento: a definir — merge]

### `sistema_urinario` — inferior (rim → ureter → bexiga)
- **Componente:** Instinto (medo, retenção). Converge com `rim`.
- **NÚCLEO:** medo/ansiedade (Dias/MTC) · insegurança (Dias) · retenção — "segurar o que deveria fluir" (Hay — bexiga)
- **PALETA:** "estar irritado/pissed off" retido (Hay — bexiga) · apego a ideias velhas / medo de soltar (Hay — bexiga) · fobias somatizadas (Dias) · raiva não-dissolvida (Hay — "cálculos = raiva não-dissolvida")
- **Elemento:** [elemento: a definir — merge]

---

# 7. Estruturas, pigmento, marcadores temporais e constitucionais

### `pigmento_amber` — depósito concentrado em zona específica
- **Componente:** localizador de TEMA/trauma (a emoção depende da ÁREA onde cai). Nativo forte (Dias).
- **NÚCLEO (por área onde o pigmento cai):** desconsideração — "não ser considerado pelos pais/sociedade" (área do EGO, Dias) · amor condicionado ao sacrifício (área da VONTADE, Dias) · desilusão/trauma localizado (Dias)
- **PALETA:** exigência/encorajamento parental em excesso (Dias — área 1) · sensação de dívida afetiva (Dias) · mágoa cristalizada naquela função (Dias)
- **Nota:** NÃO é uma emoção fixa — o pigmento marca ONDE olhar; a emoção sai da função da área. Cruzar com o campo topográfico correspondente.
- **Elemento:** [elemento: a definir — merge]

### `lacuna_estrutural` — carga aberta/recente em zona específica
- **Componente:** localizador de CARÊNCIA/vazio (a emoção depende da ÁREA). Nativo forte (Dias).
- **NÚCLEO (por área):** carência/vazio na função da área (Dias) · "não merecer" / pouca força interior (área do EGO, Dias) · ressentimento (área do PERDÃO, Dias)
- **PALETA:** medo de não receber amor (área da VONTADE, Dias) · abandono — "não ser aceito, como se a mãe não nos tivesse aceitado" (INSTINTO/colarete, Dias) · sensação de falta/insuficiência naquela esfera (Dias)
- **Nota:** como o pigmento, é um localizador — puxa a emoção da função da área. Marcador de carga mais RECENTE/aberta (vs. cripta).
- **Elemento:** [elemento: a definir — merge]

### `cripta` — carga profunda/antiga em zona específica
- **Componente:** localizador de profundidade temporal. SEM lastro nativo específico (os livros não nomeiam "cripta"; profundidade → antiguidade é inferência do glossário; datação real vem do Cronorichio no colarete).
- **NÚCLEO:** mesma família emocional da lacuna na mesma área, porém lida como mais ANTIGA/consolidada (Dias — via Cronorichio) · carga estrutural profunda (N)
- **PALETA:** tema de origem precoce / "vem de longe" (N — inferência) · padrão cristalizado, difícil de mover (N)
- **Nota:** para a LINHA DO TEMPO usar a posição no colarete (Cronorichio), não lacuna-vs-cripta. Profundidade≈antiguidade é [inferência].
- **Elemento:** [elemento: a definir — merge]

### `anel_interno` / `collarette` — fronteira eu↔mundo
- **Componente:** fronteira + MARCADOR TEMPORAL do trauma (Cronorichio). Nativo forte (Dias) — base do gráfico de linha do tempo.
- **NÚCLEO:** tensão na regulação de limites eu↔mundo (N/Dias) · fronteira eu↔mundo mal definida (Dias) · grau de intro/extroversão (distância colarete↔pupila) (Dias)
- **PALETA:** polaridade sexual (colarete em cunha) (Dias) · ondulação = tensão de limite / dificuldade de dizer onde eu acabo e o outro começa (N/Dias)
- **Nota:** função dupla — (a) emoção de LIMITE e (b) **QUANDO** o trauma aconteceu (nascimento a 12h; cada 90° ≈ 15 anos). "A íris não diz o QUÊ, diz QUANDO." Insumo do gráfico Passado⟷Futuro.
- **Elemento:** [elemento: a definir — merge]

### `padrao_pupilar` (midríase / miose)
- **Componente:** modulador do estado autonômico (não "achado-emoção" com leque próprio).
- **NÚCLEO:** midríase sustentada = alerta / simpático dominante → ansiedade, trauma ativo (N/somático) · miose marcada = retração / exaustão / desligamento (N/somático)
- **PALETA:** assimetria pupilar = desregulação (N) · ⚠️ **DIVERGE**: os livros Dias leem a orla pupilar para ENEATIPO (caráter/compulsão), NÃO para midríase/miose. A leitura simpático/parassimpático é do somático/glossário, não nativa. Manter as duas leituras separadas.
- **Nota:** calibra a INTENSIDADE/estado do que os outros campos dizem (íris em alerta amplifica; em exaustão, aplaina).
- **Elemento:** [elemento: a definir — merge]

Estes quatro vão para `constituicao_base` (NÃO para `achados`). São **MODULADORES**: não geram leque de emoção discreta; calibram a LENTE/tom com que todos os outros campos são lidos. Listados aqui para não ficarem de fora.

### `cor_predominante` (modulador)
- **Uso:** contexto constitucional, não achado. Ancora o "chão" de base (castanho/azul/verde-acinzentado/misto). Cruza com o temperamento estrutural (Flor/Jóia/Corrente) para dar o TOM. Não vira emoção isolada.
- **Elemento:** [elemento: a definir — merge]

### `trama_fibras` (modulador)
- **Uso:** compacta+densa = **resiliência constitucional** (aguenta muito antes de sinalizar — carga pode existir sem aparecer) → `⚡Ar`/recurso quando lida como robustez/vitalidade de base; aberta/irregular = mais reativa/sensível, sinaliza cedo (tende ao perfil Flor, emocional). Calibra a INTENSIDADE do que os achados dizem.
- **Elemento:** [elemento: a definir — merge]

### `pupila` (modulador) — enum: centrada_regular / descentrada / deformada / miose / midriase
- **Uso:** centrada+regular = eixo neuroendócrino organizado (base estável); descentrada/deformada = desregulação de base. Espelha `padrao_pupilar` (ver acima) mas no plano constitucional. Modula estado, não gera emoção própria.
- **Elemento:** [elemento: a definir — merge]

### `bordas_pupilares` (modulador) — enum: regulares / achatamentos / descentralizacoes / irregulares
- **Uso:** achatamentos = **portal do eneatipo** (Dias) → caráter/compulsão-núcleo (lente de personalidade, não emoção-achado); regulares = base sem marca de compulsão. Usar para escolher o VIÉS de caráter, não como emoção impressa.
- **Elemento:** [elemento: a definir — merge]

---

## Camada estrutural nativa (lentes que atravessam TODOS os campos — não são "campo → emoção" 1:1)

Estas não entram como linha de campo, mas o motor deve conhecê-las (dão o TOM e os eixos do relatório):
- **Temperamento estrutural Rayid/Dias:** Flor (emocional/empático, tende a exaustão) · Jóia (mental/analítico/perfeccionista/cético) · Corrente (social/vinculador, se sobrecarrega). ⚠️ tipologia DIFERENTE dos 4 temperamentos de Bardon já escolhidos — decisão pendente do founder (usar um, outro, ou como lentes complementares). Ponte: os 3 tipos = 3 centros do eneagrama = 3 vetores (Mente/Coração/Instinto).
- **Anéis com emoção própria (Dias):** harmonia/linfático = sobrecarga empática · expressão/imune = baixa autoestima · determinação/sódio = rigidez + medo do futuro · liberdade/stress = ansiedade + hiper-realização · propósito/pele = busca de missão + procrastinação · desesperança/absorção = luto coletivo/desesperança inconsciente.
- **Quadrantes psíquicos (Dias):** EGO (nasal, força interior/"não merecer") · SUPER-EGO (superior, moral/dever/autocensura) · VONTADE (temporal, coragem/decisão/vínculo amoroso) · INSTINTO (inferior, medos/sexualidade/sobrevivência).
- **Cronorichio (colarete):** linha do tempo do trauma — o QUANDO, não o QUÊ.
- **5 círculos concêntricos = ciclos de vida:** eixo radial pupila(centro/passado-gestação) → periferia(borda/futuro-velhice).

---

## Resolução das divergências (o que o produto adota — reafirmado)
1. **Intestino** — usar "primeira infância + retenção/apego/medo de soltar" (íris/MTC/Hay), NÃO o "abandono" do Bradley.
2. **Coração** — usar "amor/vínculo/medo de não ser amado" (Br/Dias), NÃO "alegria" da MTC (não aparece nos livros).
3. **Ciúme** — pode ancorar no **fígado/vesícula** (Dias) além de glândulas sexuais (Br). Aceitar ambos conforme o achado.
4. **Adrenal/eixo HPA** — Br/MTC não cobrem; usar Dias (colarete=SNA, eixo de estresse) + somático.
5. **Pupila** — os livros leem a orla p/ ENEATIPO; midríase/miose autonômica é do somático. Manter as duas leituras separadas, não fundir.
6. **Framing** — voz nativa da íris (predisposição/tendência/dom-lição/"quando"); descartar a voz determinista-culpa da Hay. Hay = só vocabulário.
