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
    group: 'sistema_orgao', campo: 'figado_vesicula',
    zona: 'Temporal inferior OE+OD (5-7h)',
    sinal_carga: 'Pigmento âmbar, manchas escuras, lacunas hepatobiliares',
    sinal_preservacao: 'Zona limpa, sem pigmento, fibras regulares',
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
    group: 'sistema_orgao', campo: 'eixo_pituitario_adrenal',
    zona: 'Collarete a 12:30h, ambos os iris',
    sinal_carga: 'Lacunas, criptas, entradas do collarete, surcos radiais na zona específica',
    sinal_preservacao: 'Collarete íntegro nessa região',
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
    sinal_carga: 'Lacunas, pigmentação na zona pancreática',
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
    group: 'estrutura_iridologica', campo: 'anel_interno',
    zona: 'Anel periférico à pupila (colarete)',
    sinal_carga: 'Irregular, ondulado, espessado, fragmentado',
    sinal_preservacao: 'Bem definido, regular',
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
    group: 'periferico', campo: 'vascularizacao_escleral',
    zona: 'Branco do olho (esclera, fora da íris)',
    sinal_carga: 'Vasos dilatados, vascularização periférica acentuada (sinal hepático/circulatório)',
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
