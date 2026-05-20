import { redirect } from 'next/navigation'

import { validateToken } from '@/lib/invite/tokens'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveClientGate } from '@/lib/gates/client-gates'
import { InviteCaptureWrapper } from './InviteCaptureWrapper'

export const dynamic = 'force-dynamic'

/**
 * Entry RSC do fluxo público de captura. Validações:
 *  - Token válido (not_found/expired/already_used → redirect /convite/[token]
 *    pra mostrar erro humano);
 *  - client_id obrigatório: ou via ?client=<id> (cliente novo, vem do form),
 *    ou já presente no token (cliente existente).
 *  - Cria a reading com therapist_id derivado do token (service-role bypassa RLS).
 *  - Renderiza InviteCaptureWrapper que delega pro CaptureClient existente
 *    com prop inviteToken (modo público).
 *
 * NÃO marca token used_at — isso vive no /api/convite/[token]/finalize
 * chamado quando a captura completa (single-use queimado UMA vez na vida
 * do convite).
 */
export default async function ConviteCapturarPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ client?: string }>
}) {
  const { token } = await params
  const sp = await searchParams

  const validation = await validateToken(token)
  if (validation.status !== 'ok') {
    redirect(`/convite/${token}`)
  }

  // client_id resolver: prop URL (cliente novo) ou já vinculado ao token (existente).
  const clientId = sp.client ?? validation.token.client_id
  if (!clientId || !/^[0-9a-f-]{36}$/i.test(clientId)) {
    redirect(`/convite/${token}`)
  }

  const service = createServiceClient()

  // Confirma que client_id pertence ao mesmo therapist do token (defesa em
  // profundidade contra manipulação do query param).
  const { data: client } = await service
    .from('clients')
    .select('id, full_name, therapist_id, birth_date, biological_sex, email, phone')
    .eq('id', clientId)
    .maybeSingle()
  if (!client || client.therapist_id !== validation.token.therapist_id) {
    redirect(`/convite/${token}`)
  }

  // Gate de completude — mesma regra do path authed. Cliente existente com
  // dados incompletos não pode fazer captura via convite (terapeuta precisa
  // completar primeiro). Cliente novo via convite sempre passa (form
  // valida campos obrigatórios via Zod).
  const gate = resolveClientGate(client)
  if (gate.status === 'incomplete' || gate.status === 'blocked_underage') {
    redirect(`/convite/${token}`)
  }

  // Cria reading com therapist_id do token, capture_method='mobile_camera'
  // (path público é sempre mobile — cliente abre no celular). Service-role
  // bypassa RLS — não há sessão authed do cliente.
  const { data: reading, error: readingErr } = await service
    .from('readings')
    .insert({
      client_id: client.id,
      therapist_id: validation.token.therapist_id,
      status: 'pending',
      capture_method: 'mobile_camera',
    })
    .select('id')
    .single()
  if (readingErr || !reading) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 space-y-2">
        <h2 className="text-xl font-semibold">Não conseguimos iniciar sua leitura</h2>
        <p className="text-sm text-muted-foreground">
          Tente recarregar a página. Se persistir, peça um novo link ao seu
          terapeuta.
        </p>
      </div>
    )
  }

  return (
    <InviteCaptureWrapper
      readingId={reading.id}
      clientId={client.id}
      clientName={client.full_name}
      therapistId={validation.token.therapist_id}
      inviteToken={token}
    />
  )
}
