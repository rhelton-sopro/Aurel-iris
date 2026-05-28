import { redirect } from 'next/navigation'

import { validateToken } from '@/lib/invite/tokens'
import { createServiceClient } from '@/lib/supabase/service'
import { resolveClientGate } from '@/lib/gates/client-gates'
import { reserveCreditForReading } from '@/lib/billing/credits'
import { logAuditEvent } from '@/lib/audit/log'
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

  // 2026-05-22 fix (founder UAT — Evanilce gerou 5 readings sujas):
  // se token já tem used_by_reading_id apontando pra reading em pending,
  // retoma. Senão cria nova + pré-vincula no token pra próxima reentrada.
  // Zero migration — coluna client_invite_tokens.used_by_reading_id já
  // existe (0025), antes só era preenchida no finalize.
  let readingId: string | null = null
  let capturedSlots: { eye: string; angle: string }[] = []

  if (validation.token.used_by_reading_id) {
    const { data: existing } = await service
      .from('readings')
      .select('id, status, reading_images(eye, angle)')
      .eq('id', validation.token.used_by_reading_id)
      .maybeSingle()
    if (existing && existing.status === 'pending') {
      readingId = existing.id
      capturedSlots = (existing.reading_images ?? []).map(
        (img: { eye: string; angle: string }) => ({
          eye: img.eye,
          angle: img.angle,
        }),
      )
    }
    // se status != 'pending' (já promovida) ou reading foi deletada (FK
    // on-delete-set-null já zerou used_by_reading_id), cai pro path de
    // criação abaixo.
  }

  if (!readingId) {
    const { data: created, error: createErr } = await service
      .from('readings')
      .insert({
        client_id: client.id,
        therapist_id: validation.token.therapist_id,
        status: 'pending',
        capture_method: 'mobile_camera',
      })
      .select('id')
      .single()
    if (createErr || !created) {
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
    readingId = created.id

    // Fase 8 D-10 #2 / D-11: reserva 1 crédito do TERAPEUTA (dono do crédito,
    // não o cliente que está aqui sem sessão) ANTES de iniciar a captura.
    // Decisão de arquitetura (08-07): o convite NÃO cria reading em
    // createInviteTokenAction — a reading nasce aqui, lazy, quando o cliente
    // abre o link. Como reserveCreditForReading exige reading_id, este é o
    // único ponto onde a reserva pode ser atrelada. Cobre tanto D-10 #1
    // (saldo antes de usar link remoto) quanto D-10 #2 (antes de capturar):
    // sem saldo do terapeuta, a captura é bloqueada com mensagem humana.
    // Só reserva na criação NOVA — retomar reading pending (acima) já tem
    // reservation; re-reservar duplicaria o débito.
    const reserve = await reserveCreditForReading(
      validation.token.therapist_id,
      readingId,
    )
    if (!reserve.ok) {
      // Rollback: remove a reading recém-criada pra não poluir a base.
      await service.from('readings').delete().eq('id', readingId)
      readingId = null
      if (reserve.reason === 'no_balance') {
        return (
          <div className="mx-auto max-w-md px-4 py-12 space-y-2">
            <h2 className="text-xl font-semibold">
              Seu terapeuta precisa liberar esta leitura
            </h2>
            <p className="text-sm text-muted-foreground">
              No momento não há créditos disponíveis para iniciar sua leitura.
              Avise o terapeuta que enviou este convite — ele poderá liberar e
              reenviar o link.
            </p>
          </div>
        )
      }
      return (
        <div className="mx-auto max-w-md px-4 py-12 space-y-2">
          <h2 className="text-xl font-semibold">
            Não conseguimos iniciar sua leitura
          </h2>
          <p className="text-sm text-muted-foreground">
            Tente recarregar a página. Se persistir, peça um novo link ao seu
            terapeuta.
          </p>
        </div>
      )
    }

    // D-09 audit: uso de internal_use (founder/admin) via convite — simétrico
    // a createReadingAction (08-07 task 2). Sem isso, criações via link do
    // founder ficariam invisíveis pra exclusão de métricas de faturamento.
    if (reserve.source === 'internal') {
      await logAuditEvent({
        event_type: 'admin.internal_use_used',
        actor_user_id: validation.token.therapist_id,
        target_type: 'reading',
        target_id: readingId,
        metadata: { entry_point: 'invite_capture', client_id: client.id },
      })
    }

    // Pre-vincula no token pra próxima reentrada do mesmo link reusar esta.
    // Cast 'as never' espelha markTokenUsed em lib/invite/tokens.ts (types
    // não geraram client_invite_tokens ainda — founder regen depois).
    await service
      .from('client_invite_tokens' as never)
      .update({ used_by_reading_id: readingId } as never)
      .eq('id', validation.token.id)
  }

  return (
    <InviteCaptureWrapper
      readingId={readingId}
      clientId={client.id}
      clientName={client.full_name}
      therapistId={validation.token.therapist_id}
      inviteToken={token}
      capturedSlots={capturedSlots}
      resumeMode={capturedSlots.length > 0}
    />
  )
}
