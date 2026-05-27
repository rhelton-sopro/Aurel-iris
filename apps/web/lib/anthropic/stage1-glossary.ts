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
    group: 'sistema_orgao', campo: 'figado_vesicula',
    zona: 'Temporal inferior OE+OD (5-7h)',
    sinal_carga: 'Pigmento âmbar DENSO e CONCENTRADO na zona 5-7h (não difuso periférico), lacuna hepatobiliar com contorno definido, OU mancha escura bem delimitada. Pigmento âmbar difuso disperso na íris inteira NÃO qualifica (é constitutional em íris castanha).',
    sinal_preservacao: 'Zona 5-7h limpa, sem pigmento concentrado, sem lacuna definida; pigmento difuso global é base constitucional, não carga hepática.',
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
    group: 'sistema_orgao', campo: 'coracao',
    zona: 'Superior esquerda OE (~2-3h)',
    sinal_carga: 'Lacunas, manchas, anel circular',
    sinal_preservacao: 'Zona limpa, pupila centrada',
  },
  {
    group: 'sistema_orgao', campo: 'pulmoes',
    zona: 'Temporal superior (~3h OE, ~9h OD)',
    sinal_carga: 'Lacunas, manchas pulmonares, opacidade',
    sinal_preservacao: 'Zona clara, fibras regulares',
  },
  {
    group: 'sistema_orgao', campo: 'estomago',
    zona: 'Pericentral, anel interno',
    sinal_carga: 'Irregularidade/ondulação no anel interno',
    sinal_preservacao: 'Anel interno regular, bem definido',
  },
  {
    group: 'sistema_orgao', campo: 'intestino_delgado',
    zona: 'Estroma intermediário',
    sinal_carga: 'Lacunas, manchas, irregularidades',
    sinal_preservacao: 'Zona intermediária íntegra',
  },
  {
    group: 'sistema_orgao', campo: 'intestino_grosso',
    zona: 'Periferia/borda externa',
    sinal_carga: 'Lacunas radiais, manchas escuras periféricas',
    sinal_preservacao: 'Periferia clara',
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
    group: 'sistema_orgao', campo: 'tireoide',
    zona: 'Cervical (~2-3h OE, ~9-10h OD)',
    sinal_carga: 'Pigmentação acinzentada-escura, opacidade densa',
    sinal_preservacao: 'Zona cervical limpa',
  },
  {
    group: 'sistema_orgao', campo: 'pancreas',
    zona: 'Lateralidade OE preferencial (~7-8h OE, mais sutil em OD)',
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
    sinal_carga: 'Anel sódico, arco senil, vascularização escleral marcante',
    sinal_preservacao: 'Coroa simpática regular, ausência de anel sódico',
  },
  {
    group: 'sistema_orgao', campo: 'sistema_musculoesqueletico',
    zona: 'Estroma intermediário-periférico',
    sinal_carga: 'Trama afrouxada, fibras irregulares',
    sinal_preservacao: 'Fibras compactas, densas, estroma firme',
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

  // === Periféricos (1) ===
  {
    // v2.9.0 (2026-05-27): sinal_carga reescrito pra subir piso clínico.
    // Audit das últimas 10 leituras mostrou vascularizacao_escleral em
    // 90%-100% das leituras — viés sistemático. Causa: "vasos dilatados"
    // qualifica qualquer adulto cansado/sol/álcool/tela — esclera com
    // alguns vasos visíveis é normal. Novo piso exige extensão (≥3
    // quadrantes da esclera) OU tortuosidade marcada OU injeção bilateral
    // densa. Vasos finos isolados em 1-2 pontos é base, não carga.
    group: 'periferico', campo: 'vascularizacao_escleral',
    zona: 'Branco do olho (esclera, fora da íris)',
    sinal_carga: 'Vascularização EXTENSA (≥3 quadrantes da esclera), OU vasos TORTUOSOS bem definidos, OU injeção bilateral densa visível nas 6 fotografias. Vasos finos isolados em 1-2 quadrantes são normais (cansaço/sol/álcool/tela), NÃO qualificam como achado hepático/circulatório.',
  },
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
