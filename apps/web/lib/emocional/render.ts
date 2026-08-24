/**
 * Renderiza o HTML do relatório emocional a partir do markdown guardado.
 *
 * O render é o MESMO módulo que o lab usa (`_motor-lab/render-novo.mjs`), agora exposto
 * como função. Verificado byte a byte contra o HTML que o script gerava antes do
 * refactor, nos 3 exames — o desenho não mudou.
 *
 * Como o markdown fica no banco e o HTML é derivado aqui, mudar o desenho NÃO exige
 * gerar de novo: re-renderiza e os relatórios existentes acompanham. Foi essa escolha
 * que permitiu mudar índice, régua, mapa e bloco 7 num dia só sem repagar API.
 */
import 'server-only'
// .mjs sem tipos, compartilhado com o lab de propósito (evita deriva)
import {
  renderHTML as _renderHTML,
  TITULOS_BLOCOS as _TITULOS,
  OMITIR_RX_POR_BLOCO as _OMITIR_POR_BLOCO,
} from '../../_motor-lab/render-novo.mjs'

/**
 * Títulos dos 7 blocos, vindos do MOTOR (não de uma cópia).
 *
 * ⚠️ Este módulo é `server-only` — para usar no cliente (barra de progresso da
 * geração), passe por prop a partir de um server component. Reescrever a lista num
 * arquivo client-safe seria a deriva que o "UM MOTOR SÓ" existe para impedir.
 */
export const TITULOS_BLOCOS = _TITULOS as string[]

const renderHTML = _renderHTML as (
  md: string,
  exame: unknown,
  nome: string,
  opts?: { omitirTitulos?: string[] },
) => { html: string; AG: { mente: number; coracao: number; corpo: number } }

/**
 * O que sai da VERSÃO DO CLIENTE **por padrão**.
 *
 * 2026-07-30 → 2026-08-24: era `['^perguntas para a sua sess']`. Naquela data o bloco 7
 * era o **Método Somático**, um roteiro de CONDUÇÃO — entregá-lo antes da devolutiva
 * queimava a sessão, e por isso ele saía por padrão.
 *
 * O bloco 7 mudou (founder, 24/08): agora são as **perguntas ancoradas**, que nasceram no
 * Dossiê escritas para quem lê **sem terapeuta na sala** — a linha-ponte do prompt existe
 * exatamente para isso. Não há mais roteiro de condução a proteger, e a decisão do founder
 * foi explícita: *"o que eu quero que o terapeuta e o cliente vejam? As perguntas."*
 *
 * Vazio ≠ sem filtro: um array vazio ainda sinaliza ao motor que este é o documento do
 * CLIENTE, e é isso que segura a fitoterapia fora dele (ver `versaoCliente` no render).
 *
 * ⚠️ Continua sendo padrão de TÍTULO, nunca número de bloco — a caixinha por bloco segue
 * valendo, então o terapeuta ainda pode tirar as perguntas de uma entrega específica.
 */
export const OMITIR_NA_VERSAO_CLIENTE: string[] = []

/**
 * Padrão de título de CADA bloco, na ordem de exibição (0..8) — vindo do motor.
 *
 * `TITULOS_BLOCOS[i]` é o que o terapeuta lê na caixinha; `OMITIR_RX_POR_BLOCO[i]` é
 * como aquele bloco é reconhecido no documento. Os dois andam juntos pelo índice.
 */
export const OMITIR_RX_POR_BLOCO = _OMITIR_POR_BLOCO as string[]

/**
 * Seleção do terapeuta (2026-08-03) → filtro do render.
 *
 * Recebe os índices de exibição que ele MARCOU e devolve os padrões dos que sobraram de
 * fora. A escolha é por ENTREGA, não configuração global: chega na query da rota do PDF
 * e nada é persistido.
 *
 * Devolver `[]` (marcou tudo) não é o mesmo que não filtrar: array vazio ainda sinaliza
 * ao motor que este é o documento do CLIENTE, e é isso que segura a fitoterapia — que é
 * do terapeuta e nunca dependeu de caixinha.
 */
export function omitirDaSelecao(incluidos: readonly number[]): string[] {
  return OMITIR_RX_POR_BLOCO.filter((_rx, i) => !incluidos.includes(i))
}

export function renderEmocional(
  markdown: string,
  exame: unknown,
  nome: string,
  opts?: { omitirTitulos?: string[] },
) {
  return renderHTML(markdown, exame, nome, opts)
}
