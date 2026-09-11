/**
 * Regras de geração que a TELA e a ROTA precisam aplicar IGUAL.
 *
 * Por que existe (2026-09-11): o Stage 1 automático (8005e04, 10/08) ensinou a TELA que
 * "foto apagada + exame salvo = ainda dá pra gerar" e deixou o botão à mostra — mas a
 * ROTA de geração não foi tocada e continuou relendo as fotos para o Mapa do Ser. Por um
 * mês a página prometeu uma geração que a rota não fazia: 502, "rodando no servidor" para
 * sempre, crédito preso (Julianna/Nailli e Juceni/Livia, 08/09). Eram duas cópias da
 * mesma regra em dois arquivos, e elas divergiram em silêncio. Aqui mora a ÚNICA cópia.
 *
 * Puro de propósito (sem banco, sem `server-only`): testável sem mock.
 */

export type LinhaDeExame =
  | { exame_json: Record<string, unknown> | null; validation_status?: string | null }
  | null
  | undefined

/**
 * O exame salvo serve de base para gerar um documento? Devolve o exame, ou `null`.
 *
 * Não serve: linha ausente, exame vazio (`{}` — o Stage 1 às vezes devolve isso) e exame
 * reprovado nas duas tentativas (`invalid_final`, o mesmo critério que aborta o Stage 2
 * quando o Stage 1 acabou de rodar). `invalid_retried` SERVE: passou na 2ª tentativa.
 */
export function exameReaproveitavel(linha: LinhaDeExame): Record<string, unknown> | null {
  if (!linha?.exame_json || Object.keys(linha.exame_json).length === 0) return null
  if (linha.validation_status === 'invalid_final') return null
  return linha.exame_json
}

/**
 * A reserva de crédito pode ser debitada? Só se algum documento da leitura foi CONCLUÍDO
 * DEPOIS de ela ser criada.
 *
 * A reserva não guarda qual documento a criou (Mapa ou Dossiê), mas guarda quando. Sem
 * esta regra, o Mapa entregue dias antes servia de "prova de sucesso" para cobrar a
 * reserva de um Dossiê que falhou. As `conclusoes` são os `_at` de sucesso de cada
 * documento — gravados só no caminho bom, então documento falho nunca conta.
 */
export function concluiuDepoisDaReserva(
  reservadaEm: string,
  conclusoes: ReadonlyArray<string | null | undefined>,
): boolean {
  const desde = new Date(reservadaEm).getTime()
  if (Number.isNaN(desde)) return false
  return conclusoes.some((t) => t != null && new Date(t).getTime() >= desde)
}
