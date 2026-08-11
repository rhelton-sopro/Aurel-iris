/**
 * Stage 1 Glossary — dados PUROS (sem `server-only` guard).
 *
 * Por que arquivo separado: este módulo é importado tanto pelo
 * runtime server (via stage1-schema.ts, que adiciona server-only) quanto
 * pelo script standalone scripts/generate-schema-artifacts.ts (que roda
 * fora do contexto Next.js e não consegue resolver 'server-only').
 *
 * Conteúdo: apenas tipos discriminados + GLOSSARY[] (42 termos canônicos)
 * + KNOWN_CAMPOS Set. Nenhuma dependência de runtime — só dados.
 *
 * NÃO importar nada que use 'server-only' aqui. NÃO adicionar zod, NÃO
 * adicionar Anthropic SDK, NÃO adicionar fs/path. Pure data only.
 *
 * Validação bibliográfica em 2026-05-23 contra Jensen (big+Simplified),
 * Jackson, Manual ES Moraga, Lo Rito Profondo, Lindemann Manual PT.
 * Detalhe em memory/project_caminho_1_sonnet_2x_architecture.md.
 *
 * v2.3.0 Caminho 1
 */

type SistemaOrgaoEntry = {
  group: 'sistema_orgao'
  campo: string
  zona: string
  sinal_carga: string
  sinal_preservacao: string
  bibliografia?: string
}

type SubZonaCerebralEntry = {
  group: 'sub_zona_cerebral'
  campo: string
  zona: string
  funcao_clinica: string
  sinal_carga: string
  bibliografia?: string
}

type EixoTopograficoEntry = {
  group: 'eixo_topografico'
  campo: string
  zona: string
  psicossomatica: string
  bibliografia?: string
}

type EstruturaIridologicaEntry = {
  group: 'estrutura_iridologica'
  campo: string
  zona: string
  sinal_carga: string
  sinal_preservacao: string
  bibliografia?: string
}

type ConstitucionalEntry = {
  group: 'constitucional'
  campo: string
  categorias: string
  observacao: string
}

type PerifericoEntry = {
  group: 'periferico'
  campo: string
  zona: string
  sinal_carga: string
}

export type GlossaryEntry =
  | SistemaOrgaoEntry
  | SubZonaCerebralEntry
  | EixoTopograficoEntry
  | EstruturaIridologicaEntry
  | ConstitucionalEntry
  | PerifericoEntry

export const GLOSSARY: readonly GlossaryEntry[] = [
  // === Sistemas e órgãos (19) ===
  {
    // v2.9.0 (2026-05-27): sinal_carga reescrito pra subir piso clínico.
    // Audit das últimas 10 leituras mostrou figado_vesicula em 90%/100% das
    // leituras — viés sistemático. Causa: "pigmento âmbar, manchas escuras,
    // lacunas" era amplo demais — pigmento âmbar DIFUSO em íris castanha é
    // constitutional, não achado clínico. Novo piso exige sinal CONCENTRADO
    // em zona 5-7h específica (não difuso periférico) + densidade evidente.
    // 2026-07-26 — CORRIGIDO contra o gráfico oficial (Jensen/Ellen Jensen 2004,
    // livros/551115800-iridology-chart.pdf) + texto do livro grande.
    // ERRO ANTERIOR: 'Temporal inferior OE+OD (5-7h)'. A 5-7h o gráfico mostra
    // quadril/coxa/joelho/pé, virilha, peritônio, parede abdominal, pelve,
    // testículo/ovário, adrenal e apêndice — NENHUM fígado.
    // O complexo hepatobiliar está a ~7:30-8:15h e SÓ na íris DIREITA: o gráfico
    // espelha LIVER+GALLBL+PAN HEAD (OD ~8h) com SPLEEN+PAN TAIL (OE ~4h), cada
    // órgão na íris do seu lado. Livro: "just preceding 8 o'clock in the right iris".
    // Detalhes em docs/TOPOGRAFIA-JENSEN-2004.md.
    group: 'sistema_orgao', campo: 'figado_vesicula',
    zona: 'Anel MUSCULATURA (4º de 7), ~7:30-8:15h, íris DIREITA (OD) apenas — órgão lateralizado. Vesícula (GALLBL) e cabeça do pâncreas adjacentes na borda do colarete. Rótulo externo do setor: U. ABDOMEN.',
    sinal_carga: 'Pigmento âmbar DENSO e CONCENTRADO na faixa ~7:30-8:15h da íris DIREITA, no anel de musculatura (NÃO pericentral, NÃO difuso periférico), lacuna hepatobiliar com contorno definido, OU mancha escura bem delimitada. Pigmento âmbar PERICENTRAL (em volta do colarete) NÃO é hepático — ali é estômago/intestino. Pigmento difuso na íris inteira NÃO qualifica (é constitucional).',
    sinal_preservacao: 'Faixa ~7:30-8:15h da íris direita limpa, sem pigmento concentrado e sem lacuna definida no anel de musculatura.',
  },
  {
    // 2026-07-26 — CAMPO NOVO. Ausente do glossário apesar de ter banda própria
    // no gráfico oficial e de constar na lista de zonas do Jensen ("6. Spleen,
    // thyroid, liver"). É o espelho anatômico do fígado.
    group: 'sistema_orgao', campo: 'baco',
    zona: 'Anel MUSCULATURA (4º de 7), ~3:45-4:15h, íris ESQUERDA (OE) apenas — órgão lateralizado, espelho do fígado. Cauda do pâncreas (PAN TAIL) adjacente na borda do colarete.',
    sinal_carga: 'Pigmento concentrado, opacidade ou lacuna definida na faixa ~3:45-4:15h da íris ESQUERDA, anel de musculatura.',
    sinal_preservacao: 'Faixa ~3:45-4:15h da íris esquerda íntegra, fibras regulares, sem pigmento concentrado.',
  },
  {
    // 2026-07-26 — CAMPO NOVO. Oval SOL PLX no gráfico oficial + lista de zonas
    // do Jensen ("3. Adrenal glands, heart and aorta, solar plexus...").
    group: 'sistema_orgao', campo: 'plexo_solar',
    zona: 'Oval junto à borda do colarete, ~3h na íris ESQUERDA (OE). Marcado como SOL PLX no gráfico.',
    sinal_carga: 'Marca, opacidade ou irregularidade concentrada no oval peri-colarete de ~3h em OE.',
    sinal_preservacao: 'Região peri-colarete de ~3h em OE sem marca, contorno regular.',
  },
  {
    group: 'sistema_orgao', campo: 'rim',
    zona: 'Inferior (6h) ambos',
    sinal_carga: 'Lacunas profundas, manchas escuras, opacidade',
    sinal_preservacao: 'Zona íntegra, fibras compactas',
  },
  {
    group: 'sistema_orgao', campo: 'adrenal',
    zona: 'Sobre o rim (5:30-6h) — mapeamento anatômico',
    sinal_carga: 'Opacidade difusa, sombreamento no setor adrenal',
    sinal_preservacao: 'Zona clara, sem sombreamento',
    bibliografia: 'Jackson p.36',
  },
  {
    // v2.9.0 (2026-05-27): sinal_carga reescrito pra subir piso clínico.
    // Audit das últimas 10 leituras mostrou eixo_pituitario_adrenal em 100%
    // das leituras — viés sistemático. Causa: "entradas do collarete" e
    // "surcos radiais" são MICRO-irregularidades de collarete adulto
    // presentes em quase qualquer adulto > 30 — qualquer textura qualifica.
    // Novo piso exige ≥2 estruturas pareadas (não apenas micro-textura) E
    // localização específica na zona 12:30h (não collarete em geral).
    group: 'sistema_orgao', campo: 'eixo_pituitario_adrenal',
    zona: 'Collarete a 12:30h, ambos os iris',
    sinal_carga: 'Achado MÚLTIPLO/DOMINANTE na zona 12:30h: ≥2 estruturas pareadas (lacuna DEFINIDA + cripta, OU lacuna + surcos radiais em ≥2 direções, OU descontinuidade marcada de collarete + pigmento concentrado). Micro-irregularidade isolada de collarete (presente em qualquer adulto > 30) NÃO qualifica.',
    sinal_preservacao: 'Collarete em 12:30h regular, sem lacuna definida pareada com outra estrutura — micro-textura própria de collarete adulto é normal, não preservação especial.',
    bibliografia: 'Manual ES Moraga p.62',
  },
  {
    // 2026-08-11 — critério revisto. ⏳ FALTA a coordenada RADIAL (o anel), que só o
    // founder pode dar: sem ela o endereço fica incompleto e o campo segue difícil de
    // localizar. Medido: 0 achados em 60 leituras, 40 preservados.
    // O "pupila centrada" saiu: é sinal GLOBAL (quase toda íris tem), então servia de
    // cheque em branco pra declarar o coração preservado sem olhar o coração — e
    // contradizia a regra do próprio prompt ("ausência de carga NÃO é evidência de saúde").
    group: 'sistema_orgao', campo: 'coracao',
    zona: 'Anel BLOOD & LYMPH (3º de 7, humoral zone — logo FORA do colarete), ~2-3h na íris ESQUERDA (OE). Livro grande: "the left iris at 3 [h] in Zone 3, usually ON the autonomic nerve wreath line" — o gráfico Jensen/Ellen Jensen 2004 o põe colado ao colarete, não na periferia. Também é a Área da VONTADE (Marcos V. Dias): lacuna aqui lê-se como dificuldade de VÍNCULO, NUNCA como sinal cardíaco.',
    sinal_carga: 'LACUNA de contorno definido no setor, OU pigmento CONCENTRADO na mesma faixa. Pigmento DIFUSO pela íris inteira NÃO qualifica (é constitucional). Micro-irregularidade de trama, sem lacuna nem pigmento delimitado, NÃO qualifica.',
    sinal_preservacao: 'Setor varrido DIRETAMENTE: fibras contínuas e regulares, tom uniforme, sem lacuna definida e sem pigmento concentrado. ⛔ "pupila centrada" NÃO é critério — é sinal global, não deste campo.',
  },
  {
    // 2026-08-11 — critério revisto. ⏳ FALTA a coordenada RADIAL.
    // Medido: 0 achados em 60 leituras, 46 preservados.
    group: 'sistema_orgao', campo: 'pulmoes',
    zona: 'Anel SUPERFICIAL LYMPH & BLOOD (6º de 7 — faixa EXTERNA, azul-clara no gráfico), ~3h OE e ~9h OD. Bloco grande do gráfico Jensen/Ellen Jensen 2004 que reúne LUNG (upper/mid/lower lobe), BRONCHIOLES, PLEURA, THORAX e RIBS — fica FORA do cinza de BONY STRUCTURE (onde está SHOULDER). Corrobora Jackson (1992): "the outer zone of the iris contains the main detoxification and elimination channels — the skin, lungs, liver". Também é a porção brônquio-pulmonar da Área da VONTADE (Marcos V. Dias).',
    sinal_carga: 'LACUNA definida OU opacidade DELIMITADA na faixa temporal superior. Opacidade difusa periférica NÃO qualifica (é linfática/constitucional).',
    sinal_preservacao: 'Faixa temporal superior varrida DIRETAMENTE: fibra contínua, tom uniforme, sem lacuna e sem opacidade localizada.',
  },
  {
    // 2026-07-26 — enriquecido (estava correto, faltava a coordenada radial).
    group: 'sistema_orgao', campo: 'estomago',
    zona: 'Anel STOMACH (1º de 7, nutritive zone), imediatamente ao redor da pupila e DENTRO do colarete. Circunferencial — não tem hora própria. Jensen: "the central area surrounding the pupil corresponds to the stomach".',
    sinal_carga: 'Irregularidade/ondulação no anel interno',
    sinal_preservacao: 'Anel interno regular, bem definido',
  },
  {
    // 2026-07-26 — CORRIGIDO: 'Estroma intermediário' era vago demais e permitia
    // confusão com a zona de órgãos. Livro grande: "The small intestine takes up
    // the area in Zone 2 from seven o'clock to eleven o'clock in the left iris".
    group: 'sistema_orgao', campo: 'intestino_delgado',
    zona: 'Anel INTESTINES (2º de 7), logo FORA do colarete — mesmo anel do cólon, mais próximo do colarete. Placas de Peyer (PEY PT, área pontilhada) no mesmo anel a ~2-3h OD / ~9-10h OE.',
    sinal_carga: 'Lacunas, manchas, irregularidades',
    sinal_preservacao: 'Zona intermediária íntegra',
  },
  {
    // 2026-07-26 — CORRIGIDO: estava 'Periferia/borda externa'. O cólon é o
    // 2º anel (INTESTINES — nutritive zone), logo FORA do colarete, não a
    // periferia. Jensen Simplified p.10: "On the inside of the wreath is found
    // the stomach, small and large intestines". Só reto e ânus avançam para a
    // borda. Confirmado em 4 fontes.
    group: 'sistema_orgao', campo: 'intestino_grosso',
    zona: 'Anel INTESTINES (2º de 7), imediatamente FORA do colarete — NÃO a periferia. Percorre a circunferência: cólon ascendente, transverso (~11h-1h), descendente e sigmoide. Apenas RETO e ÂNUS avançam radialmente para a borda externa.',
    sinal_carga: 'Lacunas radiais, manchas escuras ou irregularidade no 2º anel, logo fora do colarete',
    sinal_preservacao: 'Anel intestinal de contorno regular e tom uniforme ao redor do colarete',
  },
  {
    group: 'sistema_orgao', campo: 'sistema_linfatico',
    zona: 'Coroa periférica (zona 6 Jensen)',
    sinal_carga: 'Rosário linfático visível, opacidade periférica difusa',
    sinal_preservacao: 'Periferia clara, sem rosário, drenagem aparente',
    bibliografia: 'Manual ES Moraga p.66 (zona 6)',
  },
  {
    group: 'sistema_orgao', campo: 'sistema_imune',
    zona: 'Sistêmico (espalhado)',
    sinal_carga: 'Manchas psóricas dispersas, pigmentação difusa, perda de brilho global',
    sinal_preservacao: 'Ausência de manchas dispersas, brilho saudável',
  },
  {
    group: 'sistema_orgao', campo: 'sistema_nervoso_autonomico',
    zona: 'Anel nervoso (concêntrico no estroma médio)',
    sinal_carga: 'Anel nervoso visível, espessamento',
    sinal_preservacao: 'Ausência de anel nervoso',
  },
  {
    // 2026-07-26 — CORRIGIDO: lateralidade estava INVERTIDA. Gráfico oficial
    // (banda THYROID ampliada nas duas íris) + livro grande: "between 2 and 3
    // o'clock in the RIGHT iris and 9 and 10 in the LEFT iris".
    group: 'sistema_orgao', campo: 'tireoide',
    zona: 'Anel MUSCULATURA (4º de 7), ~2:40-3:20h na íris DIREITA (OD) e ~9-9:40h na íris ESQUERDA (OE). Paratireoide (PT) e timo (THY) como ovais menores junto ao colarete, no mesmo setor. Rótulo externo: THROAT.',
    sinal_carga: 'Pigmentação acinzentada-escura ou opacidade densa na banda de ~3h (OD) / ~9h (OE), anel de musculatura',
    sinal_preservacao: 'Banda cervical-tireoidiana limpa em ambas as íris',
  },
  {
    // 2026-07-26 — CORRIGIDO: 'Lateralidade OE preferencial (~7-8h OE)' não
    // corresponde a nenhuma das três posições do gráfico oficial, que divide o
    // órgão em cabeça / corpo / cauda, cada uma no seu lado anatômico.
    group: 'sistema_orgao', campo: 'pancreas',
    zona: 'Órgão TRIPARTIDO no gráfico oficial, ovais junto à borda do colarete: PAN HEAD ~8h na íris DIREITA (junto ao fígado e ao duodeno) · PAN TAIL ~4h na íris ESQUERDA (junto ao baço) · PAN BODY no setor dorsal de ambas. Nomear a parte observada.',
    // v2.5.3 (2026-05-24): "Pigmento âmbar" adicionado literal — Cristiane
    // regen=4 mostrou Sonnet classificando pigmento âmbar nasal-inferior
    // OE como pigmento_amber órfão em vez de pancreas. Causa: o sinal_carga
    // anterior ("Lacunas, pigmentação...") não tinha match cromático
    // óbvio com "pigmento âmbar". Glossário entry de figado_vesicula tem
    // "Pigmento âmbar" literal → Sonnet caía em fígado por afinidade
    // textual. Espelhamento corrige o gap.
    sinal_carga: 'Pigmento âmbar, lacunas, pigmentação na zona pancreática',
    sinal_preservacao: 'Zona íntegra',
    bibliografia: 'Lo Rito: eixo Bazo-Pâncreas-Rim',
  },
  {
    group: 'sistema_orgao', campo: 'sistema_reprodutor',
    zona: 'Inferior medial (~6h)',
    sinal_carga: 'Lacunas/manchas, irregularidades',
    sinal_preservacao: 'Zona limpa',
  },
  {
    group: 'sistema_orgao', campo: 'sistema_urinario',
    zona: 'Inferior (rim → ureter → bexiga)',
    sinal_carga: 'Lacunas conectadas em sequência',
    sinal_preservacao: 'Setor urinário limpo',
  },
  {
    group: 'sistema_orgao', campo: 'sistema_circulatorio',
    zona: 'Coroa periférica + anel periférico',
    sinal_carga: 'Anel sódico, arco senil',
    sinal_preservacao: 'Coroa simpática regular, ausência de anel sódico',
  },
  {
    // 2026-08-11 — critério revisto. ⏳ FALTA a coordenada RADIAL.
    // Medido: 0 achados em 60 leituras, 50 preservados — o campo mais declarado
    // preservado de todos. O critério antigo ("fibras compactas, densas") descreve
    // uma íris de TRAMA FECHADA, que é constituição da pessoa, não integridade
    // observada naquela zona: qualquer íris densa satisfazia sem exame nenhum.
    group: 'sistema_orgao', campo: 'sistema_musculoesqueletico',
    zona: 'Anéis MUSCULATURE (4º de 7, rosa-claro) e BONY STRUCTURE (5º, cinza) — os dois, porque o campo cobre músculo E esqueleto. Gráfico Jensen 2004: SHOULDER cai no cinza; as faixas rosa-claro imediatamente internas são musculatura. Jackson (1992): "the muscle tissue lies next to the blood zone... não é fácil distinguir a zona muscular da esquelética, pois ficam lado a lado". ⛔ NÃO é a periferia (6-7) nem a nutritiva (1-2).',
    sinal_carga: 'Trama visivelmente AFROUXADA em relação ao restante do estroma DESTA íris, com separação de fibras nomeável em setor identificável. ⛔ trama aberta de constituição (a íris inteira é assim) NÃO qualifica — é o tipo da pessoa, não um achado.',
    sinal_preservacao: 'Fibra compacta e alinhada VERIFICADA em pelo menos dois setores distintos, com o setor nomeado. ⛔ trama fechada de constituição NÃO é preservação observada.',
  },
  {
    group: 'sistema_orgao', campo: 'pele_tegumentar',
    zona: 'Anel periférico extremo (zona 7 Jensen)',
    sinal_carga: 'Escurecimento ou irregularidade no anel periférico (NÃO confundir com rosário linfático da zona 6)',
    sinal_preservacao: 'Borda íntegra, sem marcas',
    bibliografia: 'Jensen big p.368 + Manual ES Moraga p.66 (zona 7)',
  },

  // === Sub-zonas cerebrais (3) ===
  {
    group: 'sub_zona_cerebral', campo: 'cerebrum_motor',
    zona: '12-1h OD, 11-12h OE',
    funcao_clinica: 'Função executiva, autocensura, ruminação mental',
    sinal_carga: 'Lacunas, opacidade nessa zona',
    bibliografia: 'Jensen Simplified p.2 "Cerebrum Motor/Psychological Brain"',
  },
  {
    group: 'sub_zona_cerebral', campo: 'cerebellum_sensory',
    zona: '11-12h OD, 12-1h OE',
    funcao_clinica: 'Função sensorial, hipervigilância somática',
    sinal_carga: 'Lacunas, opacidade nessa zona',
    bibliografia: 'Jensen Simplified p.2 "Cerebellum Sensory/Physiological Brain"',
  },
  {
    group: 'sub_zona_cerebral', campo: 'pineal_hipotalamica',
    zona: 'Centro ~12h ambos os iris',
    funcao_clinica: 'Eixo neuroendócrino, ritmo circadiano, sono-vigília, dimensão espiritual',
    sinal_carga: 'Carga/marca no topo central',
    bibliografia: 'Jensen big p.288 (pineal 11-12h OE / 12-1h OD; pituitary 12h ambos consolidada) + Lo Rito cap. "Hipotálamo y estrés"',
  },

  // === Eixos topográficos (5) ===
  {
    group: 'eixo_topografico', campo: 'coluna_cervical',
    zona: '10-11h (homolateral único)',
    psicossomatica: 'Expressão, voz, contenção verbal',
    bibliografia: 'Jackson p.36',
  },
  {
    group: 'eixo_topografico', campo: 'coluna_toracica',
    zona: '3-5h (homolateral único)',
    psicossomatica: 'Peso afetivo, "carregar nas costas"',
    bibliografia: 'Jackson p.36',
  },
  {
    group: 'eixo_topografico', campo: 'coluna_lombar',
    zona: '4-5h (homolateral único)',
    psicossomatica: 'Sustentação, fundamento estrutural',
    bibliografia: 'Jackson p.36',
  },
  {
    group: 'eixo_topografico', campo: 'sacro_coccyx',
    zona: '5-6h (homolateral único)',
    psicossomatica: 'Base, sexualidade, sobrevivência',
    bibliografia: 'Jackson p.36',
  },
  {
    // ⏳ 2026-08-11 — NÃO alterado, e o motivo importa: o tipo `EixoTopograficoEntry`
    // não admite sinal_carga/sinal_preservacao. Este campo (e coluna_cervical,
    // coluna_toracica, coluna_lombar, sacro_coccyx) PODE ser emitido pelo modelo —
    // está no CAMPO_ENUM — mas nunca recebeu critério do que procurar. Medido: 0
    // achados, 2 preservados em 60 leituras; coluna_toracica e sacro_coccyx são mudos.
    // Dar critério a eles exige ESTENDER O TIPO: decisão de arquitetura, do founder.
    group: 'eixo_topografico', campo: 'boca_garganta',
    zona: 'Orofaríngea ~1-2h OE, ~10-11h OD (mais externa que tireoide)',
    psicossomatica: 'Expressão, eixo verbal',
  },

  // === Estruturas iridológicas (10) ===
  {
    // v2.9.0 (2026-05-27): sinal_carga reescrito pra subir piso clínico.
    // Audit das últimas 10 leituras mostrou anel_interno em 90% das
    // leituras — viés sistemático. Causa: "irregular, ondulado, espessado"
    // qualifica qualquer collarete adulto (collarete geometricamente
    // perfeito é raríssimo após 30). Novo piso exige ondulação DOMINANTE
    // que se destaca do padrão de fundo, OU fragmentação em ≥2 setores
    // distintos. Ondulação suave bilateral simétrica é base, não carga.
    group: 'estrutura_iridologica', campo: 'anel_interno',
    zona: 'Anel periférico à pupila (collarete)',
    sinal_carga: 'Ondulação DOMINANTE que se destaca do padrão de fundo (não micro-irregularidade), OU fragmentação real em ≥2 setores distintos, OU espessamento setorial não-simétrico. Ondulação suave bilateral simétrica é base constitucional, não achado clínico.',
    sinal_preservacao: 'Collarete com contorno proporcional, sem fragmentação setorial — micro-ondulação fisiológica é base, não preservação especial.',
  },
  {
    group: 'estrutura_iridologica', campo: 'anel_nervoso',
    zona: 'Anel concêntrico no estroma médio',
    sinal_carga: 'Visível (tensão nervosa sustentada)',
    sinal_preservacao: 'Ausente',
  },
  {
    group: 'estrutura_iridologica', campo: 'anel_sodico',
    zona: 'Periferia da íris',
    sinal_carga: 'Anel branco/azulado visível',
    sinal_preservacao: 'Ausente',
  },
  {
    group: 'estrutura_iridologica', campo: 'coroa_simpatica',
    zona: 'Fronteira zona ciliar/zona periférica',
    sinal_carga: 'Espessada, irregular',
    sinal_preservacao: 'Coroa regular, fina, ordenada',
  },
  {
    group: 'estrutura_iridologica', campo: 'rosario_linfatico',
    zona: 'Periferia (anel de manchinhas brancas/cinza)',
    sinal_carga: 'Visível',
    sinal_preservacao: 'Ausente',
  },
  {
    group: 'estrutura_iridologica', campo: 'radii_solaris',
    zona: 'Linhas radiais escuras saindo da pupila',
    sinal_carga: 'Visíveis (irritação intestinal → cérebro)',
    sinal_preservacao: 'Ausência',
  },
  {
    group: 'estrutura_iridologica', campo: 'manchas_psoricas',
    zona: 'Dispersas no estroma',
    sinal_carga: 'Presentes (carga inflamatória crônica)',
    sinal_preservacao: 'Ausência',
  },
  {
    group: 'estrutura_iridologica', campo: 'pigmento_amber',
    zona: 'Concentrado em zona específica',
    sinal_carga: 'Presente (depósito metabólico/hereditário/tóxico)',
    sinal_preservacao: 'Ausência',
  },
  {
    // v2.7.0 (2026-05-25): padrao_pupilar como achado SECUNDÁRIO com cap.
    // Stage 1 PODE emitir quando a pupila for clinicamente significativa
    // (midríase sustentada >70%, miose marcada <30%, assimetria >15%,
    // irregularidade de borda), MAS com 2 hard constraints:
    //   1. Intensidade MÁXIMA 3 (jamais 4 ou 5).
    //   2. JAMAIS ser o achado de maior intensidade da leitura — se
    //      nenhum outro achado tem intensidade ≥3, NÃO emite (pupila
    //      vai pra constituicao_base.pupila apenas, como pré-v2.6.0).
    // Razão empírica: N=2 (Cristiane regen=8 + Evanilce regen=1 em v2.6.0)
    // mostrou pupila como primária dominando narrativa de todo relatório.
    // Decisão founder 2026-05-25: mantém campo (não silencia midríase
    // real) mas demove de primário. Os 3 eixos pericentrais obscurecidos
    // seguem como achados ricos em §2 Categoria A.5 (motivo=
    // 'obscurecimento_estrutural') — protagonista é o eixo obscurecido,
    // não a pupila que obscurece.
    group: 'estrutura_iridologica', campo: 'padrao_pupilar',
    zona: 'Centro pericentral (avaliação nas 6 fotos, sob flash e sem flash)',
    sinal_carga: 'Midríase sustentada >70% do diâmetro iridiano, midríase moderada 50-70%, miose marcada <30%, assimetria pupilar >15% OE vs OD, ou irregularidade de bordas pupilares',
    sinal_preservacao: 'Pupila centrada com diâmetro proporcional (~30-45% do diâmetro iridiano), bordas regulares, simétrica bilateral, responde adequadamente ao flash',
    bibliografia: 'Deck / Angerer — escola alemã: midríase sustentada = ativação simpática crônica',
  },
  {
    group: 'estrutura_iridologica', campo: 'lacuna_estrutural',
    zona: 'Zona específica',
    sinal_carga: 'Cavitação escura, formato folha/ova, abertura ("open or closed")',
    sinal_preservacao: 'Ausência',
    bibliografia: 'Jensen p.131 + Jackson p.53',
  },
  {
    group: 'estrutura_iridologica', campo: 'cripta',
    zona: 'Zona específica',
    sinal_carga: 'Formato losango/fenda, topo-estável, perfuração mais PROFUNDA e antiga que lacuna',
    sinal_preservacao: 'Ausência',
    bibliografia: 'Jensen p.131 + Lindemann p.54',
  },

  // === Constitucionais (4) ===
  {
    group: 'constitucional', campo: 'cor_predominante',
    categorias: 'castanho_escuro / castanho_claro / verde_acinzentado / azul / azul_acinzentado / misto',
    observacao: 'Contexto, não achado. Vai pra constituicao_base do JSON.',
  },
  {
    group: 'constitucional', campo: 'trama_fibras',
    categorias: 'compacta_densa / media / aberta / irregular',
    observacao: 'Compacta+densa = vitalidade constitucional.',
  },
  {
    group: 'constitucional', campo: 'pupila',
    categorias: 'centrada_regular / descentrada / deformada / miose / midriase',
    observacao: 'Centrada = eixo neuroendócrino organizado.',
  },
  {
    group: 'constitucional', campo: 'bordas_pupilares',
    categorias: 'regulares / achatamentos / descentralizacoes / irregulares',
    observacao: 'Achatamentos sinalizam padrões psicossomáticos específicos.',
  },

  // === Periféricos ===
  // v2.10.0 (2026-06-09): campo `vascularizacao_escleral` REMOVIDO.
  // Audit das últimas 5 leituras mostrou escleral em 5/5 (até protagonista
  // no Bernardo), apesar do piso subido em v2.9.0 — o Sonnet contornava
  // descrevendo tudo como "extensa/tortuosa". Causa raiz: esclera (branco
  // do olho) é extra-iridológica E o sinal é o menos específico que existe
  // (qualquer adulto cansado/sol/álcool/tela), violando a quality bar.
  // Empiricamente o achado NUNCA saía sozinho — sempre pareado com
  // anel_sodico/sistema_circulatorio. Decisão founder (A2): remover o campo
  // standalone E tirar "vascularização escleral marcante" do sinal_carga de
  // sistema_circulatorio (acima) — carga circulatória passa a ser lida só
  // por sinais INTRA-íris (anel sódico, arco senil). Icterícia escleral
  // (cor amarelada = sinal hepático medicalizado) PERMANECE, roteada por
  // termos de cor no Stage 2 (gatilho 🔬). Não-retroativo.
]

/**
 * Set de termos canônicos pra validação O(1). Construído a partir do
 * GLOSSARY. NÃO incluir aqui os campos constitucionais — eles vão pra
 * constituicao_base, não pra achados_de_atencao/sistemas_preservados.
 */
export const KNOWN_CAMPOS: ReadonlySet<string> = new Set(
  GLOSSARY
    .filter(e => e.group !== 'constitucional')
    .map(e => e.campo),
)

/**
 * Lista ordenada dos mesmos termos. v2.5.1 (Fix 2): zod enum +
 * Anthropic tool input_schema enum requerem array, não Set. Mantemos
 * o Set também (acessos O(1) em validador + logger).
 */
export const KNOWN_CAMPOS_LIST: readonly string[] = GLOSSARY
  .filter(e => e.group !== 'constitucional')
  .map(e => e.campo)

/**
 * Map campo → zona canônica do glossário. v2.5.1 (Fix 3): validação
 * de coerência campo↔zona compara horas mencionadas em
 * descricao_visual com a zona declarada aqui. Construído uma vez
 * (size pequeno; 40 entries).
 */
export const CAMPO_ZONA_MAP: ReadonlyMap<string, string> = new Map(
  GLOSSARY
    .filter(e => e.group !== 'constitucional' && 'zona' in e)
    .map(e => [e.campo, (e as { zona: string }).zona]),
)
