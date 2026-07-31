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
 * O que sai da VERSÃO DO CLIENTE (decisão founder, 2026-07-30).
 *
 * Todos os blocos vão pro cliente MENOS **"Perguntas para a sua sessão"** — o guia
 * de condução do terapeuta, que só acompanha se ele marcar a caixinha na hora de
 * baixar. Entregar o roteiro da devolutiva antes da devolutiva queima a sessão.
 *
 * ⚠️ É um padrão de TÍTULO, não um número de bloco. O documento canônico tem 7 blocos,
 * mas um filtro posicional falharia exatamente no documento defeituoso — entregando o
 * guia de sessão ao cliente. Ver a nota no render-novo.mjs.
 */
export const OMITIR_NA_VERSAO_CLIENTE = ['^perguntas para a sua sess']

export function renderEmocional(
  markdown: string,
  exame: unknown,
  nome: string,
  opts?: { omitirTitulos?: string[] },
) {
  return renderHTML(markdown, exame, nome, opts)
}
