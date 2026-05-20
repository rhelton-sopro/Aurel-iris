import { Check } from 'lucide-react'

import { validateToken } from '@/lib/invite/tokens'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

/**
 * Página final do fluxo público. O token já foi marcado used_at pelo
 * /api/convite/[token]/finalize chamado quando a 6ª foto subiu.
 *
 * Pega o nome do terapeuta (do token) pra personalizar a mensagem.
 * NÃO mostra o relatório — Q2 founder lock 2026-05-20: cliente NÃO vê,
 * só terapeuta recebe.
 */
export default async function ConviteObrigadaPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // validateToken aqui vai retornar 'already_used' (foi marcado no
  // finalize) — isso é esperado. Buscamos o token bypassando essa
  // checagem (service-role + filtro direto) só pra ler therapist_id.
  const service = createServiceClient()
  const { data: tokenRow } = await service
    .from('client_invite_tokens' as never)
    .select('therapist_id')
    .eq('token', token)
    .maybeSingle<{ therapist_id: string }>()

  let therapistName = 'seu terapeuta'
  if (tokenRow?.therapist_id) {
    const { data: profile } = await service
      .from('profiles')
      .select('full_name')
      .eq('id', tokenRow.therapist_id)
      .maybeSingle()
    if (profile?.full_name) {
      therapistName = profile.full_name
    }
  }

  // validateToken silencia o lint do import não-usado caso a checagem
  // acima precise voltar futuramente.
  void validateToken

  return (
    <div className="mx-auto max-w-md px-4 py-12 flex flex-col items-center text-center gap-6">
      <div className="rounded-full bg-emerald-500/15 p-4">
        <Check className="h-10 w-10 text-emerald-700" strokeWidth={2.5} />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Leitura recebida</h2>
        <p className="text-sm text-muted-foreground">
          Obrigada! Suas fotos foram enviadas com sucesso. <strong>{therapistName}</strong>{' '}
          receberá o resultado e entrará em contato.
        </p>
        <p className="text-xs text-muted-foreground/80 pt-2">
          Pode fechar esta página com segurança.
        </p>
      </div>
    </div>
  )
}
