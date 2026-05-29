'use client'

import { useState } from 'react'

import { CaptureClient } from '@/app/(capture)/leituras/nova/capturar/capture-client'
import { InviteTermoStep } from './InviteTermoStep'

/**
 * Thin wrapper que delega pro CaptureClient existente em modo convite
 * (prop inviteToken ativa o branch token-auth: uploads via API service-role,
 * validate-image inclui token, finalize via API que marca used_at do token).
 *
 * Pq esse wrapper existe (em vez de renderizar CaptureClient direto na
 * page.tsx): CaptureClient é 'use client' e a page RSC tem que rodar
 * server-only logic (validateToken, createReading). Wrapper serve só pra
 * cruzar essa fronteira em arquivo nomeado.
 *
 * BILLING-03 + LGPD-01 (D-19) — Decisão A+ (founder 2026-05-28): se o termo
 * biométrico do cliente ainda não foi assinado (`termoSigned=false`), renderiza
 * o passo BLOQUEANTE InviteTermoStep ANTES de qualquer captura/upload. Só após
 * a assinatura (consent_channel='remote_link') o CaptureClient é montado. Isso
 * fecha o gate de consentimento no PONTO de captura do fluxo remote_link, que é
 * onde o cliente (sem sessão) efetivamente consente.
 *
 * Não regride o resume flow: quando o cliente reentra com fotos já capturadas
 * (resumeMode), o termo já estava assinado (a 1ª captura só ocorreu depois do
 * aceite), então `termoSigned` chega true e o passo é pulado.
 */
export function InviteCaptureWrapper({
  readingId,
  clientId,
  clientName,
  therapistId,
  inviteToken,
  capturedSlots,
  resumeMode,
  termoSigned,
}: {
  readingId: string
  clientId: string
  clientName: string
  therapistId: string
  inviteToken: string
  capturedSlots: { eye: string; angle: string }[]
  resumeMode: boolean
  termoSigned: boolean
}) {
  const [signed, setSigned] = useState(termoSigned)

  if (!signed) {
    return (
      <div className="relative flex-1 min-h-dvh flex flex-col">
        <InviteTermoStep
          token={inviteToken}
          clientId={clientId}
          readingId={readingId}
          clienteNome={clientName}
          onSigned={() => setSigned(true)}
        />
      </div>
    )
  }

  return (
    <div className="relative flex-1 min-h-dvh flex flex-col">
      <CaptureClient
        readingId={readingId}
        clientId={clientId}
        clientName={clientName}
        therapistId={therapistId}
        capturedSlots={capturedSlots}
        resumeMode={resumeMode}
        inviteToken={inviteToken}
        finalizeRedirect={`/convite/${inviteToken}/obrigada`}
      />
    </div>
  )
}
