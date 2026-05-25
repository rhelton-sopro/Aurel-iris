/**
 * Glossário emocional de padrões estruturais — v2.6.0 (2026-05-25).
 *
 * Mapeia estados de `padrao_pupilar` (e outros padrões estruturais
 * obscurecedores) para leitura clínica integrativa: achado clínico
 * principal + manifestações comportamentais com variações lexicais +
 * eixos obscurecidos + convite reflexivo.
 *
 * Stage 2 (system block VOICE_OVERRIDE ou ANCHORING) importa este
 * glossário e usa para compor §2 Categoria A.5 ("Sinais que pedem
 * reflexão") + propagar leitura integrativa em §5, §7, §8, §10, §11,
 * §13 com honestidade técnica preservada.
 *
 * Variações lexicais: cada categoria de manifestação tem 3 redações
 * alternativas. Sonnet escolhe UMA por categoria por leitura.
 * Reduz repetibilidade percebida entre clientes diferentes que tenham
 * o mesmo padrão estrutural (memory anti-fórmula universal §11).
 *
 * Princípio: NÃO é Forer (descrição clínica ancorada em achado real
 * mensurável). Cliente com pupila normal não recebe esta seção;
 * cliente com midríase sustentada recebe — mas pode receber outras
 * variações que cliente B com mesmo achado recebeu.
 *
 * Manutenção: quando observação empírica em UAT mostrar repetição alta
 * em alguma categoria de manifestação (ex: 3 leituras com
 * "hipervigilância sustentada" literal), adicione 2-3 variações novas
 * àquela categoria. Versão semver patch.
 */

// Estrutura por padrão estrutural — type-safe via `as const`.
export const GLOSSARIO_EMOCIONAL_ESTRUTURAIS = {
  // Midríase sustentada (>70% do diâmetro iridiano em todas as fotos,
  // mesmo sob flash). Achado iridológico clássico de ativação simpática
  // crônica (escola alemã Deck/Angerer).
  midriase_sustentada: {
    achado_clinico: 'ativação simpática sustentada',
    nome_leitura_emocional: 'modo sentinela',
    convite_reflexivo_padrao:
      'em quais momentos do dia o sistema baixa de verdade — não no sono, mas acordada',
    eixos_obscurecidos: [
      'eixo_pituitario_adrenal',
      'pineal_hipotalamica',
      'sistema_nervoso_autonomico',
      'anel_interno',
    ],
    manifestacoes: [
      // Categoria 1: hipervigilância
      [
        'hipervigilância sustentada — radar permanentemente ligado para o entorno',
        'atenção que não desliga — sistema sempre captando o que vai acontecer antes que aconteça',
        'modo de leitura constante do ambiente, com o corpo já preparando resposta antes da consciência registrar',
      ],
      // Categoria 2: dificuldade de relaxar
      [
        'dificuldade de relaxamento profundo mesmo em momentos de pausa real',
        'corpo que não chega ao descanso de verdade, mesmo quando a agenda permite',
        'pausa que parece pausa para os outros mas não é pausa para dentro — sistema permanece em vigília',
      ],
      // Categoria 3: sono não-restaurador
      [
        'sono que adormece mas não restaura completamente',
        'manhãs em que se acorda já cansada, como se não tivesse dormido o suficiente',
        'noites de sono que terminam sem a sensação de ter descansado',
      ],
      // Categoria 4: estar sempre "ligada"
      [
        'sensação de estar "ligada" mesmo sem ameaça concreta no presente',
        'corpo em prontidão funcional como temperatura de base, não como reação a evento',
        'estado de alerta de fundo que virou o tom padrão do cotidiano, invisível por familiar',
      ],
      // Categoria 5: cansaço somatizado
      [
        'cansaço que aparece nos sintomas físicos antes de chegar à consciência',
        'esgotamento que se mostra no corpo antes de ser nomeado como cansaço',
        'fadiga somatizada — o corpo avisa em sintomas concretos antes do reconhecimento mental',
      ],
      // Categoria 6: dificuldade de baixar a guarda
      [
        'resistência a baixar a guarda mesmo em contextos seguros',
        'dificuldade de confiar que o perigo passou, mesmo quando passou',
        'sistema que aprendeu cedo que estar pronta era mais seguro que estar relaxada, e não sabe desaprender',
      ],
    ],
  },

  // Midríase moderada (50-70%). Versão menos expressiva da sustentada;
  // pode indicar ativação simpática em fase menos consolidada.
  midriase_moderada: {
    achado_clinico: 'ativação simpática moderada',
    nome_leitura_emocional: 'tom de alerta de base',
    convite_reflexivo_padrao:
      'quando a vigilância do sistema serve de fato, e quando ela está apenas em modo automático',
    eixos_obscurecidos: ['eixo_pituitario_adrenal', 'anel_interno'],
    manifestacoes: [
      [
        'tom de alerta moderado mas constante no cotidiano',
        'antecipação habitual do que pode vir, mais leve que hipervigilância plena',
        'sistema com um pé fora do relaxamento mesmo nos momentos calmos',
      ],
      [
        'sono que costuma restaurar mas tem fases em que não fecha o ciclo',
        'noites em que adormece bem mas acorda já em modo de preparação',
        'sono restaurador a maior parte do tempo, com janelas de fadiga acumulada',
      ],
      [
        'capacidade de relaxar em momentos específicos, mas custo de chegar ao parassimpático profundo',
        'relaxamento possível mas requer mais esforço do que deveria',
        'pausa real acontece, porém é mais raro do que poderia ser',
      ],
    ],
  },

  // Miose marcada (<30%). Pupila contraída. Padrão menos comum;
  // pode indicar ativação parassimpática paradoxal ou exaustão do
  // simpático após fase prolongada.
  miose_sustentada: {
    achado_clinico: 'tônus parassimpático elevado ou exaustão simpática pós-fase',
    nome_leitura_emocional: 'recolhimento sustentado',
    convite_reflexivo_padrao:
      'quando o recolhimento é descanso genuíno, e quando é retirada do mundo',
    eixos_obscurecidos: ['eixo_pituitario_adrenal', 'anel_interno'],
    manifestacoes: [
      [
        'tendência ao recolhimento e à introspecção como modo de base',
        'recuo natural diante de estímulos intensos, mais que avanço',
        'sistema que prefere a quietude ao estímulo, mesmo em contexto neutro',
      ],
      [
        'fadiga de fundo que pede mais descanso do que o cotidiano permite',
        'cansaço que vem antes do esforço — sinal de reserva diminuída',
        'energia disponível menor do que o ritmo habitual demanda',
      ],
      [
        'sensação de já ter dado muito e precisar receber pra continuar',
        'reservas internas baixas, com necessidade real de pausa restauradora',
        'organismo pedindo aporte — sono, alimento, ritmo desacelerado',
      ],
    ],
  },

  // Assimetria pupilar (>15% OE vs OD). Padrão neurológico de
  // assimetria autonômica.
  assimetria_pupilar: {
    achado_clinico: 'assimetria do sistema autonômico bilateral',
    nome_leitura_emocional: 'desequilíbrio entre lados',
    convite_reflexivo_padrao:
      'em que situações a pessoa percebe um lado do corpo respondendo diferente do outro',
    eixos_obscurecidos: ['anel_interno', 'sistema_nervoso_autonomico'],
    manifestacoes: [
      [
        'sensação de desequilíbrio entre os dois lados do corpo em momentos de estresse',
        'um lado do corpo que carrega mais tensão do que o outro de forma habitual',
        'lateralidade marcada do tônus muscular ou da percepção sensorial',
      ],
      [
        'resposta autonômica que varia entre os hemicampos visuais',
        'olho que reage à luz de forma diferente do outro em condições similares',
        'assimetria que aparece em sintomas relacionados a um lado específico do corpo',
      ],
    ],
  },

  // Irregularidade de bordas pupilares — sinal estrutural de
  // desorganização do anel pupilar interno.
  irregularidade_borda: {
    achado_clinico: 'desorganização estrutural do eixo neuroendócrino central',
    nome_leitura_emocional: 'limite interno sob tensão',
    convite_reflexivo_padrao:
      'como a pessoa percebe seu próprio limite — quando dizer sim, quando dizer não',
    eixos_obscurecidos: ['anel_interno', 'eixo_pituitario_adrenal'],
    manifestacoes: [
      [
        'sensação de borda interna pouco definida — dificuldade de saber o próprio limite',
        'limite pessoal que se molda demais ao limite alheio',
        'dificuldade de reconhecer o ponto em que o próprio sistema diz "não"',
      ],
      [
        'eixo neuroendócrino central com sinal de desorganização estrutural',
        'regulação hormonal e neurovegetativa com expressão menos estável',
        'integração corpo-emoção com pontos de fragilidade visíveis',
      ],
    ],
  },
} as const

export type GlossarioEmocionalKey = keyof typeof GLOSSARIO_EMOCIONAL_ESTRUTURAIS

/**
 * Helper: detecta qual chave do glossário se aplica a um achado
 * padrao_pupilar baseado na descricao_visual. Retorna null se nenhum
 * padrão reconhecido.
 *
 * Heurística simples por palavras-chave. Stage 2 usa pra compor A.5 +
 * propagar leitura emocional em §5, §7, §8, §10, §11, §13.
 */
export function detectarPadraoPupilarEmocional(
  descricaoVisual: string,
): GlossarioEmocionalKey | null {
  const desc = descricaoVisual.toLowerCase()

  // Ordem importa — assimetria/irregularidade têm precedência sobre
  // diâmetro porque podem coexistir.
  if (/assimetria|assim[ée]trica|diferen[çc]a\s+entre/.test(desc)) {
    return 'assimetria_pupilar'
  }
  if (/borda.+irregular|irregularidade.+borda|borda.+desorganiz/.test(desc)) {
    return 'irregularidade_borda'
  }
  if (/midr[íi]ase\s+(?:sustentada|severa|acentuada|marcada|bilateral)|>?\s*70[%\s]|pupila\s+dilatada.+(?:flash|sustentada)/.test(desc)) {
    return 'midriase_sustentada'
  }
  if (/midr[íi]ase\s+moderada|50[-\s]+70[%\s]|dilatada\s+moderadamente/.test(desc)) {
    return 'midriase_moderada'
  }
  if (/miose\s+(?:sustentada|severa|marcada|acentuada)|pupila\s+contra[ií]da|<?\s*30[%\s]/.test(desc)) {
    return 'miose_sustentada'
  }
  return null
}
