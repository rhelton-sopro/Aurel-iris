# Score Emocional — especificação de cálculo (vira o prompt do Stage 2)

Como transformar o output do **Stage 1** (achados) no **mapa emocional** do cliente (barras + nível). Determinístico, não-aleatório, único por pessoa. Display qualitativo (alta/média/baixa/livre) — o número existe por baixo, mas NÃO é impresso (evita falsa precisão / Forer).

## ⭐ REGRAS OBRIGATÓRIAS DO PROMPT (não podem ficar de fora — decisão founder)
1. **FORÇA das DUAS fontes, sempre:** `sistemas_preservados` **E** `constituicao_base` (pupila centrada = centramento · trama compacta = vitalidade · bordas regulares = estabilidade). NUNCA mostrar só os preservados — a força ficaria subrepresentada. Varrer as duas em toda leitura.
2. **Só os PRINCIPAIS** (top ~6 cargas + ~4-5 recursos), NUNCA os 60 pêndulos inteiros.
3. **Display qualitativo** (alta/média/baixa/livre/vital) — número por baixo, nunca impresso.
4. **ZERO iridologia** no texto do cliente; voz 2ª pessoa, 8ª série, envolvente.
5. **NÃO inventar força** além do que a íris mostra (preservado + constituição) = falso conforto/Forer-positivo proibido.

## TEMPERAMENTO (Bardon, bloco 3) — cálculo do % (soma 100)
⚠️ HONESTIDADE: o 40/30/20/10 do Helton foi ESTIMADO à mão no mockup; a DIREÇÃO (colérico dom + melancólico sec) é real. Fórmula definitiva pro prompt:
1. Cada achado → emoção → BALDE de elemento: raiva/irritação/impulso→**Colérico(Fogo)** · tristeza/medo/ressentimento/contenção→**Melancólico(Água)** · alegria/vínculo/expansão→**Sanguíneo(Ar)** · apego/calma/estabilidade/ruminação-lenta→**Fleumático(Terra)**.
2. Peso = `intensidade` (1-5) de cada achado.
3. Soma por balde → **normaliza pra 100%** (≠ dos 3 centros, que são independentes). Dominante + secundário = os 2 maiores.
**⭐ EXIBIÇÃO DO % (founder pegou "40/30/20/10 redondo demais = parece template/Forer"): mostrar INTEIROS CALCULADOS que somam 100 e VARIAM por pessoa (ex. Helton 42/37/16/5), NUNCA dezenas redondas (40/30) NEM decimais (42,7% = falsa precisão). Isto SUPERA a decisão antiga "múltiplos de 5" (que veio do estudo de formato, mas parece fake).** Número redondo = dedo-duro de chute; número quebrado único = parece e É real.
Ex. Helton: Colérico(fígado4+radii4=8) · Melancólico(nervoso3+rim2+contenção≈7) · Fleumático(intestino3) · Sanguíneo(coração livre≈1) → ~Col 40 / Mel 35 / Fleu 15 / San 5.
**⚠️ 2 DECISÕES ABERTAS (founder decide antes do prompt):** (a) TABELA DE-PARA definitiva achado→elemento — resolver os ambíguos (anel_interno, sist_nervoso_autonomico podem ir p/ Melancólico OU Fleumático); (b) o **Sanguíneo** conta o coração PRESERVADO/vital (pessoa É calorosa/alegre → sobe sanguíneo) ou só a CARGA (hoje só carga → sanguíneo baixo)? Mesma dúvida do coração médio no bloco 2.

## Entradas (do Stage 1, sem tocar nele)
- `achados_de_atencao[]`: `{ campo, intensidade (1-5), natureza_da_carga, lateralidade }`
- `sistemas_preservados[]`: `{ campo, polaridade_funcional (vital_ativo | neutro) }`
- `correlacoes_observadas[]`: `{ campos[2], natureza }`

## Passo 1 — campo → emoção(ões)
Usar a **tabela-lastro** (`tabela-lastro-MASTER.md` + `iridologia-psicoemocional-extracao.md`). Cada `campo` abre um LEQUE de emoções (fígado → raiva/ressentimento/frustração…). O Sonnet escolhe a(s) que encaixam com o contexto da pessoa (anamnese/history) — não todas.

## Passo 2 — CARGA (vem dos achados)
Nível a partir da `intensidade`:
| intensidade | nível | barra (%) |
|---|---|---|
| 5 | muito alta | 92-95 |
| 4 | alta | 82-90 |
| 3 | média | 55-68 |
| 2 | baixa | 30-40 |
| 1 | leve/sutil | 18-25 |

Modular por `natureza_da_carga`:
- `cronica_sustentada` → mantém (entranhada)
- `aguda_recente` → mantém, tom "recente/ainda móvel"
- `em_reorganizacao_ativa` → **desce 1 nível** (já caminha pro livre)
- `herdada_constitucional` → base
- `indeterminada` → **NÃO gera emoção** (pula)

## Passo 3 — LIVRE (recursos)
Duas fontes (usar as DUAS — não só os preservados, senão a força fica subrepresentada):
**(a) `sistemas_preservados`:**
- `vital_ativo` → **vital** (barra 88-92) — recurso forte
- `neutro` → **livre** (barra 78-84)
Cada preservado → emoção-recurso (polo positivo): coração→alegria/amor · pulmões→fôlego/vitalidade · musculoesquelético→firmeza/base vital · linfático→limites saudáveis (não carrega o mundo dos outros) · sistema_reprodutor→vínculo/criatividade · etc.
**(b) `constituicao_base` (recursos constitucionais):**
- `pupila: centrada_regular` → **centramento / eixo organizado** ("um chão por dentro") — livre 82-86
- `trama_fibras: compacta_densa` → **vitalidade constitucional** (resiliência de base) — vital
- `bordas_pupilares: regulares` → estabilidade
⚠️ NÃO inventar força além do que a íris mostra (preservado + constituição organizada) = seria falso conforto / Forer-positivo. Se a íris tem pouca força real, dizer menos — a força PRINCIPAL da pessoa também aparece no TEMPERAMENTO (os dons) e nas HERANÇAS (resiliência herdada), então o relatório inteiro não fica pesado mesmo que este bloco tenha mais carga.

## Passo 4 — não mencionado = neutro
Emoção cujo campo não apareceu nem como achado nem como preservado → **não entra no mapa** (nem carga nem livre). Sem inventar.

## Passo 5 — COMPOSTAS (correlações)
`correlacoes_observadas` → emoção composta reforçada (ex.: fígado + marca da infância = "contenção aprendida"; nervoso + collarete = "alerta que não desliga"). Nudge pequeno (+, não conta gigante). Também vira NARRATIVA no texto de fecho.

## Passo 6 — SELEÇÃO (principais, NÃO os 60)
- CARGA: achados ordenados por `intensidade` DESC → top **5-6** emoções.
- LIVRE: preservados → **3-4** emoções-recurso.
- Total ~8-10 no mapa. A biblioteca dos 60 pêndulos fica interna (motor/lastro), nunca impressa inteira.

## Passo 7 — DISPLAY
- Barra GROSSA (~19px), comprimento = o % do nível. Carga = âmbar; livre = teal/verde.
- Rótulo: **alta / média / baixa / leve** (carga) · **vital / livre** (recurso).
- Fecho: 1-2 frases ligando a maior carga ao maior recurso ("sua carga mora em X; sua força está livre em Y").
- Voz do cliente (2ª pessoa, 8ª série, envolvente). ZERO iridologia no texto.

## Exemplo — Helton (self)
Achados: fígado I4 crônica · radii I4 · anel_interno I4 · intestino_grosso I3 · nervoso I3 · rim I2. Preservados: coração(neutro) · pulmões(neutro) · musculo(vital_ativo) · linfático(neutro).
→ CARGA: raiva contida (alta) · contenção aprendida [fígado+timeline] (alta) · irritação que sobe (alta) · alerta que não desliga [nervoso+collarete] (média) · apego (média) · medo de base (baixa).
→ LIVRE: firmeza (vital) · alegria & amor (livre) · fôlego (livre).

---

# MAPA DE 10 SEGUNDOS (bloco de ABERTURA, vai em CIMA) — cálculo

## 3 centros (Mente / Coração / Instinto) — lastro: Eneagrama (3 centros de inteligência) + Rayid + Método Vetorial
⚠️ **REVISADO (founder pegou 2x):** os 3 centros = **MODO de PROCESSAR (personalidade)**, definido pelos SINAIS EMOCIONAIS/COMPORTAMENTAIS que dominam, NÃO pela zona do órgão carregado. Chave = qual TRÍADE do Eneagrama:
- **Instinto (gut/sobrevivência/reação):** o corpo reagindo ANTES do pensamento — DOIS motores (⚠️ founder pegou: NÃO é só raiva): **(a) RAIVA/luta** = figado_vesicula, radii_solaris (irritação que sobe), coroa_simpatica → "ferve, ataca"; **(b) MEDO/fuga/sobrevivência** = rim (medo), adrenal/eixo_pituitario_adrenal (luta-ou-fuga), sacro_coccyx (sobrevivência), sistema_nervoso_autonomico (hipervigilância corporal) → "se protege, fica em alerta, sente o perigo antes". Instinto alto = reage por impulso. **O TEXTO muda com o SABOR:** cliente raiva-dominante → "ferve rápido"; cliente medo-dominante → "reage se protegendo/em alerta". Helton = instinto alto MOVIDO A RAIVA (fígado). NÃO é "corpo carrega carga" (isso é o mapa emocional).
- **Mente (análise/ruminação):** sinais MENTAIS — anel_nervoso (alerta/hipervigilância), cerebrum_motor, ruminação, pigmento concentrado (Jóia). Mente alta = analisa, antecipa, rumina.
- **Coração (afeto/vínculo):** sinais AFETIVOS — coracao, pulmoes, boca_garganta, aberturas/lacunas (Flor). Coração alto = sente forte, se vincula.
**ESCALAS INDEPENDENTES** (0-100 CADA, NÃO somam 100 — founder: "pode ser mente E coração grandes juntos"). Diferente do temperamento Bardon (que soma 100).
**CADA nível DIZ o que significa** (o gráfico tem que comunicar): instinto alto=reage rápido/ferve · mente alta=pensa/rumina · coração médio=sente mas afeto flui leve.
**ORIGEM na íris VISÍVEL** (founder exigiu): cada centro mostra o sinal que o gerou (◦ da íris: …) — no doc do cliente a linha some (lastro interno), mas o SCORE é análise real de dado da íris.
Ex. Helton: Instinto ALTO (fígado I4 + radii I4 = ferve rápido) · Mente ALTA (anel nervoso + rumina) · Coração MÉDIO (afeto livre). = "gasolina que pensa: instinto dispara, cabeça segura".

## Pares de tensão (os eixos)
- **Interior ⟷ Exterior** (introv/extrov) — LASTREADO: distância collarete↔pupila (Método Vetorial). Derivar da constituição.
- **Mente ⟷ Instinto** — eixo vertical superior↔inferior (Método Vetorial): peso dos achados de cérebro/nervo vs vísceras.
- **Analisar ⟷ Sentir** — razão carga-Mente vs carga-Coração.
- **Acelerar ⟷ Parar** — achados de alerta/hipervigilância (nervoso, anel de stress) → puxa p/ Acelerar.
- **Controlar ⟷ Confiar** — colérico% + achados de controle → puxa p/ Controlar.
Cada par = agulha (0-100) derivada dos dados. NÃO repetir eixos que já estão no mapa emocional (ex.: segurar↔soltar = já é apego↔soltar lá).
Display: voz do cliente, "collarete-pupila" NÃO aparece impresso (é só lastro). Promptável e único por pessoa.

---

# BLOCO 7 (FECHO) — "Perguntas para sua sessão" — cálculo/craft
Nome escolhido pelo founder (era "roteiro de anamnese"; "anamnese" = jargão, fere 8ª série). Fecha o relatório (fecho ATIVO: manda a pessoa adiante com as perguntas, em vez de mensagem genérica). Lastro = §12 REAL de produção (`system.md`) + relatório do Miguel (`Leitura-Miguel-Reis-2026-07-19.pdf`).

## Fonte das perguntas (promptável)
Cada pergunta ANCORA numa emoção CARREGADA do mapa de pêndulos (bloco 6) — NÃO no órgão/idade (o Miguel de produção ancora em "fígado/vesícula/pâncreas" = JARGÃO, proibido no doc novo; e usa "pontas de fio" = "fio" BANIDO). Aqui a âncora é a emoção. Seleção: top ~4-5 cargas do mapa + **1 pergunta ancorada numa FORÇA/recurso** (equilibra o bloco; move do Miguel Q8: "vira a mesma determinação pra dentro") + 1 pergunta-fecho personificada.

## Estrutura de CADA pergunta (3 tempos — do §12 real, confirmado no Miguel)
1. **Âncora hedge da leitura** ("A leitura mostra/aponta/sugere…") em cima da emoção.
2. **Pergunta biográfica — o "puxão"** (aberta, leva à memória/vida real; NÃO direciona a resposta; UMA pergunta principal por item). ← ⚠️ o tempo que meu 1º mockup tinha comprimido; é o que faz doer bonito.
3. **Corpo-agora** ("o que você sente no corpo agora, lendo isto — se é que sente algo") + micro-movimento ("nomeie", "fique uns segundos", "note onde travou"). Aberto, sem místico.

## Adotado do Miguel
- **Linha de permissão** (após o intro): "Se algo vier forte ao corpo enquanto você lê, não precisa ter resposta — basta notar onde chegou."
- **Pergunta-fecho personificada** (à prova de Forer): "o que, dentro de você, ainda está esperando que você pergunte como está? Se isso tivesse um corpo, onde estaria — e o que estaria pedindo?"

## Regras (canônicas)
8ª série · ZERO iridologia (emoção, nunca órgão) · sem gíria (proibidos: "fio", "rolar", metáfora "gasolina") · anti-Forer (discrimina) · aberta, não direciona · tom clínico-integrativo, sem místico · voz 2ª pessoa. O "nasce de:" é lastro interno — some no doc do cliente.

## Exemplo — Helton (v1 lista, `out/b7-perguntas-sessao.html`)
6 perguntas: 1 raiva contida · 2 alerta que não desliga (+ medo de base) · 3 contenção aprendida (não pedir ajuda) · 4 apego/soltar · **5 FORÇA virada pra dentro** (firmeza) · 6 fecho personificado. + envio caloroso.

## ⭐ EVOLUÇÃO (DECISÃO founder 2026-07-21): "PERGUNTAS DO SOPRO DA ORIGEM" — MÉTODO SOMÁTICO
Cada pergunta deixa de ser um convite de 1 linha e vira um **PROCESSO SOMÁTICO de 5 tempos** que a pessoa caminha sozinha. **NOMES FINAIS:** título do bloco = **"Perguntas para a sua sessão"** (seção "7"), subtítulo = **"Método somático · Sopro da Origem"** (marca PRÓPRIA do founder — permitido, ≠ citar autor/escola externa; os autores-fonte ficam ESCONDIDOS no prompt, nunca no doc). Cada item = **"Caminho N"** (nomeado pela SAÍDA carga→alívio, ex. "Caminho 1 · Raiva contida → Serenidade"; NÃO "Pêndulo" nem "Emoção carregada" — nomear pela ferida foi rejeitado). **1 pergunta por pêndulo** (6 no Helton). Bloco completo: `out/b7-perguntas-sopro.html` (+ `relatorio-novo/`); protótipo de 1: `b7-processo-proto.html`. Founder: "esse é o nosso processo, gostei" — aceitou que cada pergunta ocupe mais espaço.
**DECISÃO (tentativa, revisitar): as perguntas-processo vão SÓ pro TERAPEUTA** (não o doc do cliente). "isso a gente vê depois."
**Os 5 TEMPOS** (lastro completo + stems/frases = `motor-perguntas-processo.md`): **1 Chegar** (voz permissiva Erickson + controle/segurança Satir) · **2 Tocar a carga no corpo** (felt sense Gendlin + submodalidades PNL + TITRAÇÃO na frase: "um cantinho já basta / se nada vier, tudo bem") · **3 Deixar falar** (Clean Language — sensação em ABERTO, nunca afirmar = anti-Forer; "tem mais alguma coisa?") · **4 Trazer o outro lado** (RÓTULO exibido = "Trazer o outro lado"; "Pendular" é jargão, cortado. Técnica = pendulação Levine = o nosso pêndulo âmbar⟷verde; ancorar no recurso REAL da íris; "tocou E voltou = já é força" Satir) · **5 Micro-passo** (precisão Metamodelo PNL + passa o bastão: PDF ABRE, sessão PROCESSA).
**REGRAS DO MÉTODO:** ⚠️ calor pode ser universal (voz), mas ÂNCORA + CONTEÚDO saem da íris (senão o acolhimento vira Forer). Titração obrigatória em carga 4-5. Mandar pra sessão em: trauma precoce, luto, carga crônica alta, convite que não fecha em ~30s. Uso PNL/Erickson só AUTO-GUIADO e transparente (nunca sugestão oculta). Frases-modelo do motor = gabarito de ESTRUTURA/TOM → prompt DEVE reescrever no vocabulário da leitura (senão vazam literal = Forer; audit de prod já pegou).

⚠️ ABERTO (founder decide antes do prompt): (a) nº de perguntas — com o formato-processo, cada uma pesa muito → recomendação: **poucas e fundas (4-5)**, não 10; (b) bloco roda 3-mov compacto OU cobre os 5 tempos ao longo do bloco.

---

# PROMPT (Stage 2 novo) — FONTE DA VERDADE (diretiva founder 2026-07-21)
O novo prompt Stage 2 é ancorado no **MOCKUP** (os 7 blocos em `relatorio-novo/`, a VOZ, a premissa **8ª série — uma pessoa da 8ª série entende tudo**) + este SPEC. Do **prompt de produção atual** (`apps/web/prompts/system.md`) pegar **SÓ o que presta e serve**: anti-Forer, "sai da íris não do achismo", guardrails não-médicos/LGPD, como ele LÊ/aterra o achado. **NÃO** herdar a estrutura nem a voz clínica/jargão do prompt de produção — é justamente o que estamos substituindo (o founder: "o prompt atual não tem essas coisas"). Arquitetura = **HÍBRIDO ENXUTO**: código calcula os números (ver `motor-numeros-metodologia.md`), LLM escreve a prosa + os 6 Caminhos.

---

⚠️ Regra viva: calibrar Sonnet no Stage 2 = ASK ao founder antes. Este SPEC é o lastro pra montar o prompt, não muda o Stage 1.
