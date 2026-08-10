import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

/**
 * O `exame_json` (Stage 1) da leitura — a fonte dos gráficos e dos blocos
 * determinísticos do Mapa do Ser (Repertório de suporte, Sugestões integrativas).
 *
 * ⚠️ SERVICE-ROLE de propósito. `report_findings` tem a policy `founder_full_access`
 * (migration 0028): pela sessão, só `rhelton@gmail.com` enxerga a tabela. As telas e o
 * PDF liam com a sessão do terapeuta e caíam no `?? {}` — o motor rodava SEM dado, e o
 * documento saía com gráfico zerado e sem o Repertório, sem erro nenhum. Era o "só sai
 * no relatório dele" que a Nailli reportou. Gerar sempre funcionou porque `/analyze` já
 * usava service-role; só a EXIBIÇÃO passava pela policy.
 *
 * ⛔ O dono TEM que ser validado antes de chamar isto: as rotas carregam a `readings`
 * com o cliente de sessão (RLS), então leitura de outro terapeuta não chega aqui. Isto
 * aqui recebe um readingId já provado. Não chame com id vindo direto do usuário sem
 * essa checagem.
 *
 * A decisão original da 0028 continua de pé — o terapeuta não acessa o exame cru pela
 * API; quem lê é o servidor, para montar o documento dele.
 *
 * `superseded_at IS NULL`: leitura regerada tem várias linhas aqui, e sem o filtro o
 * `maybeSingle()` devolve erro + null (bug que já mordeu tela, documento e PDF).
 */
export async function getExameJson(readingId: string): Promise<Record<string, unknown>> {
  const service = createServiceClient()
  const { data, error } = await service
    .from('report_findings')
    .select('exame_json')
    .eq('reading_id', readingId)
    .is('superseded_at', null)
    .maybeSingle<{ exame_json: Record<string, unknown> | null }>()

  // Ruidoso de propósito: a versão anterior deste caminho falhava em SILÊNCIO — o
  // relatório saía incompleto e ninguém ficava sabendo. Se um dia voltar a faltar
  // exame, que apareça no log antes de aparecer no documento do cliente.
  if (error) {
    console.error('[emocional] falha ao ler report_findings', { readingId, erro: error.message })
    return {}
  }
  if (!data?.exame_json || Object.keys(data.exame_json).length === 0) {
    console.warn(
      '[emocional] leitura SEM exame_json — gráficos e Repertório de suporte não vão sair',
      { readingId },
    )
    return {}
  }

  return data.exame_json
}
