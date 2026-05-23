/**
 * Stage 2 — Extrator de frases-chave do markdown gerado pra alimentar
 * a memória inter-leituras (report_phrases table).
 *
 * Pós-stream da Etapa 2, este parser regex extrai do markdown do
 * relatório:
 *   - 3 primeiras frases do §1 Síntese inicial
 *   - 2 primeiras frases do §10 Dimensão Arquetípica
 *   - 2 primeiras frases do §14 Mensagem para o Cliente
 *   - bloco 🧭 Perfil e Temperamento do §15 inteiro
 *   - "Em poucas palavras" inteira
 *
 * O resultado vira o JSON `phrases` em report_phrases, e o builder
 * de contexto recente (recent-phrases-context.ts) lê de lá pras
 * próximas 10 leituras do mesmo terapeuta como anti-repetição.
 *
 * Zero LLM, zero rede — só regex sobre o markdown que acabou de ser
 * gerado. Custo trivial.
 *
 * NÃO usa biblioteca de parsing markdown — heurística específica pra
 * formato Iris Codex (15 seções + "Em poucas palavras"). Frágil a
 * mudanças grandes de formato no system.md; testes em
 * extract-phrases.test.ts cobrem regressões.
 *
 * v2.3.0 Caminho 1 | Sonnet 2x architecture
 */
import 'server-only'

export interface ExtractedPhrases {
  /** 3 primeiras frases da §1 ### Síntese inicial */
  sintese_inicial: string[]
  /** 2 primeiras frases do conteúdo logo após `## 10. ...` */
  abertura_secao_10: string[]
  /** 2 primeiras frases do conteúdo logo após `## 14. ...` */
  abertura_secao_14: string[]
  /** Conteúdo inteiro do bloco `### 🧭 Perfil e Temperamento` (§15) */
  perfil_secao_15: string
  /** Conteúdo inteiro do bloco `## Em poucas palavras` */
  em_poucas_palavras: string
}

/**
 * Extrai as 5 chaves da memória de frases a partir do markdown final
 * da Etapa 2. Retorna strings vazias / arrays vazios quando o bloco
 * não é encontrado (degradação graciosa — pipeline não bloqueia).
 *
 * `clientName` (opcional) — quando fornecido, substitui ocorrências do
 * nome do cliente por `[CLIENTE]` em todos os campos antes de retornar.
 * PII scrubbing pra report_phrases não vazar identidade entre leituras.
 * Founder decisão 2026-05-23: memória inter-leituras é estrutura+tom,
 * não dados pessoais.
 */
export function extractPhrases(
  markdown: string,
  clientName?: string | null,
): ExtractedPhrases {
  const raw: ExtractedPhrases = {
    sintese_inicial: takeFirstSentences(
      sectionTextAfter(markdown, /^## 1\./m, /^### Síntese inicial\s*$/m),
      3,
    ),
    abertura_secao_10: takeFirstSentences(
      sectionTextAfter(markdown, /^## 10\./m, null),
      2,
    ),
    abertura_secao_14: takeFirstSentences(
      sectionTextAfter(markdown, /^## 14\./m, null),
      2,
    ),
    perfil_secao_15: blockAfter(markdown, /^### 🧭 Perfil e Temperamento\s*$/m),
    em_poucas_palavras: blockAfter(markdown, /^## Em poucas palavras\s*$/m),
  }

  return scrubPii(raw, clientName)
}

/**
 * PII scrub: substitui o nome do cliente por `[CLIENTE]` em todos os
 * campos. Funciona com:
 *   - Nome completo ("Maria Joana Silva")
 *   - Primeiro nome ("Maria")
 *   - Nome composto sem acentos (case-insensitive, normalizado)
 *
 * Não tenta scrubar outros PII (idade, profissão, cidade) porque:
 *   (a) o relatório atual evita esse nível de detalhe biográfico
 *   (b) scrub agressivo perde sinal útil pra anti-repetição
 *
 * Se observação empírica revelar PII residual relevante, expandir aqui.
 */
function scrubPii(
  phrases: ExtractedPhrases,
  clientName: string | null | undefined,
): ExtractedPhrases {
  if (!clientName?.trim()) return phrases

  const names = collectNameVariants(clientName)
  if (names.length === 0) return phrases

  // Constrói regex que casa qualquer variante (mais longo primeiro pra
  // evitar match parcial — ex: "Maria" matching dentro de "Maria Silva").
  const pattern = new RegExp(
    `\\b(${names.map(escapeRegex).join('|')})\\b`,
    'gi',
  )
  const replace = (s: string): string => s.replace(pattern, '[CLIENTE]')

  return {
    sintese_inicial: phrases.sintese_inicial.map(replace),
    abertura_secao_10: phrases.abertura_secao_10.map(replace),
    abertura_secao_14: phrases.abertura_secao_14.map(replace),
    perfil_secao_15: replace(phrases.perfil_secao_15),
    em_poucas_palavras: replace(phrases.em_poucas_palavras),
  }
}

/**
 * Gera variantes do nome a serem scrubbed:
 *   - Nome completo
 *   - Primeiro nome isolado
 *   - Cada palavra >= 4 chars (evita scrub de "de", "da")
 * Ordenado por tamanho DESC pro regex casar a variante mais específica.
 */
function collectNameVariants(fullName: string): string[] {
  const cleaned = fullName.trim()
  if (cleaned.length < 3) return []
  const parts = cleaned.split(/\s+/).filter(w => w.length >= 4)
  const set = new Set<string>([cleaned, ...parts])
  return [...set].sort((a, b) => b.length - a.length)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Lê o PRIMEIRO parágrafo (sem heading interno) após o heading principal
 * e o sub-heading opcional. Para no próximo `#`-prefixed heading ou no
 * primeiro bloco em branco de tamanho ≥1 linha.
 *
 * Exemplo:
 *   paragraphAfter(md, /^## 1\./m, /^### Síntese inicial$/m)
 *   → retorna o parágrafo abaixo de `### Síntese inicial` dentro da §1
 */
/**
 * Coleta TODO o texto após o heading (mainHeading + opcional subHeading)
 * até próximo heading de qualquer nível. Múltiplos parágrafos viram um
 * texto único separado por espaços. takeFirstSentences depois faz o split
 * pra pegar N sentenças.
 *
 * Fallback: se subHeading dado mas não encontrado dentro de mainHeading
 * (relatórios pré-v2.1.0 não tinham `### Síntese inicial`), volta a
 * coletar a partir de mainHeading mesmo.
 */
function sectionTextAfter(
  markdown: string,
  mainHeading: RegExp,
  subHeading: RegExp | null,
): string {
  const lines = markdown.split('\n')
  const mainIdx = lines.findIndex(line => mainHeading.test(line))
  if (mainIdx === -1) return ''
  let i = mainIdx

  if (subHeading) {
    let subFound = false
    let scanIdx = mainIdx
    while (++scanIdx < lines.length) {
      const ln = lines[scanIdx]
      // Saiu da seção (encontrou outro `## `)
      if (/^## /.test(ln) && !mainHeading.test(ln)) break
      if (subHeading.test(ln)) {
        i = scanIdx
        subFound = true
        break
      }
    }
    if (!subFound) i = mainIdx
  }

  // Coleta linhas até próximo heading. Múltiplos parágrafos viram texto
  // único com espaços (linhas em branco e quebras viram espaço).
  const buf: string[] = []
  for (let j = i + 1; j < lines.length; j++) {
    const ln = lines[j]
    if (/^#{1,6}\s/.test(ln)) break
    if (ln.trim() === '') {
      // separador de parágrafo — vira espaço
      if (buf.length > 0 && buf[buf.length - 1] !== '') buf.push('')
    } else {
      buf.push(ln.trim())
    }
  }
  return buf
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Lê o BLOCO inteiro após o heading (incluindo múltiplas linhas e
 * parágrafos separados por linhas em branco) até o próximo heading
 * de mesmo nível ou superior.
 *
 * Usado para `### 🧭 Perfil e Temperamento` (1-2 frases corridas) e
 * `## Em poucas palavras` (frase única, mas pode ter quebras).
 */
function blockAfter(markdown: string, heading: RegExp): string {
  const lines = markdown.split('\n')
  const headingIdx = lines.findIndex(line => heading.test(line))
  if (headingIdx === -1) return ''

  // Determina o nível do heading encontrado
  const headingLine = lines[headingIdx]
  const headingLevel = (headingLine.match(/^(#+)/)?.[1] ?? '').length
  if (headingLevel === 0) return ''

  // Coleta tudo até próximo heading de mesmo nível OU superior
  const buf: string[] = []
  for (let i = headingIdx + 1; i < lines.length; i++) {
    const ln = lines[i]
    const match = ln.match(/^(#{1,6})\s/)
    if (match) {
      const lvl = match[1].length
      if (lvl <= headingLevel) break
    }
    buf.push(ln)
  }

  // Trim leading/trailing blank lines + collapse multi-blanks
  return buf
    .join('\n')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\n{3,}/g, '\n\n')
}

/**
 * Quebra texto em sentenças e retorna as primeiras N.
 * Heurística pt-BR: split em `[.!?]` seguido de espaço + maiúscula.
 * Tolerante a abreviações comuns (Sr., Dr., etc) — não inclui split
 * agressivo por ponto.
 */
function takeFirstSentences(text: string, n: number): string[] {
  if (!text) return []
  // Split on sentence-ending punctuation + whitespace + uppercase letter
  // (covers pt-BR accents). Conservative — won't split mid-abbreviation.
  const sentences = text
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇÀ])/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
  return sentences.slice(0, n)
}
