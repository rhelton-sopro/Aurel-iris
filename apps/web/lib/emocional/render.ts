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
import { renderHTML as _renderHTML } from '../../_motor-lab/render-novo.mjs'

const renderHTML = _renderHTML as (
  md: string,
  exame: unknown,
  nome: string,
) => { html: string; AG: { mente: number; coracao: number; corpo: number } }

export function renderEmocional(markdown: string, exame: unknown, nome: string) {
  return renderHTML(markdown, exame, nome)
}
