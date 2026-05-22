'use client'

import { CaptureClient } from '@/app/(capture)/leituras/nova/capturar/capture-client'

/**
 * Thin wrapper que delega pro CaptureClient existente em modo convite
 * (prop inviteToken ativa o branch token-auth: uploads via API service-role,
 * validate-image inclui token, finalize via API que marca used_at do token).
 *
 * Pq esse wrapper existe (em vez de renderizar CaptureClient direto na
 * page.tsx): CaptureClient é 'use client' e a page RSC tem que rodar
 * server-only logic (validateToken, createReading). Wrapper serve só pra
 * cruzar essa fronteira em arquivo nomeado.
 */
export function InviteCaptureWrapper({
  readingId,
  clientId,
  clientName,
  therapistId,
  inviteToken,
  capturedSlots,
  resumeMode,
}: {
  readingId: string
  clientId: string
  clientName: string
  therapistId: string
  inviteToken: string
  capturedSlots: { eye: string; angle: string }[]
  resumeMode: boolean
}) {
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
