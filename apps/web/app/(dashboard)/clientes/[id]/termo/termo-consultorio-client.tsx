'use client'

import { useState } from 'react'
import Link from 'next/link'

import { TermoBiometricoStep } from '@/components/billing/TermoBiometricoStep'

/**
 * Wrapper client do passo de termo no consultório. Monta o TermoBiometricoStep
 * já existente (canal office_handoff, SEM readingId — consentimento a nível de
 * cliente) e, ao assinar, mostra confirmação + CTA pra iniciar a leitura.
 */
export function TermoConsultorioClient({
  clientId,
  clienteNome,
}: {
  clientId: string
  clienteNome: string
}) {
  const [signed, setSigned] = useState(false)

  if (signed) {
    return (
      <div className="space-y-3 rounded-md border border-teal-dark/40 bg-teal-dark/5 px-4 py-5">
        <p className="text-sm font-semibold text-teal-dark">
          Termo assinado com sucesso. ✓
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Uma <strong>cópia do termo assinado foi enviada ao e-mail do cliente</strong>.
          O consentimento está registrado — você já pode iniciar a leitura.
        </p>
        <Link
          href="/leituras/nova"
          className="inline-block rounded-md bg-teal-dark px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Iniciar leitura
        </Link>
      </div>
    )
  }

  return (
    <TermoBiometricoStep
      clientId={clientId}
      clienteNome={clienteNome}
      consentChannel="office_handoff"
      onSigned={() => setSigned(true)}
    />
  )
}
