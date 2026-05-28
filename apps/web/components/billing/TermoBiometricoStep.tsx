'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { signTermAction } from '@/app/actions/consent'

interface Props {
  clientId: string
  readingId: string
  clienteNome: string
  clienteCpf?: string | null
  consentChannel:
    | 'office_handoff'
    | 'office_qr'
    | 'remote_link'
    | 'therapist_created'
  onSigned: (pdfUrl: string | null) => void
}

/**
 * Passo de aceite do termo de consentimento biométrico (LGPD-01, D-19).
 * Bloqueia o avanço até o checkbox ser marcado. Ao aceitar, dispara
 * signTermAction (gera PDF + registra consent) e chama onSigned com a URL
 * do PDF assinado.
 *
 * Reusável em /convite/[token]/capturar (remote_link) e /leituras/nova
 * (office_handoff) — integração nos planos seguintes (08-09).
 */
export function TermoBiometricoStep({
  clientId,
  readingId,
  clienteNome,
  clienteCpf,
  consentChannel,
  onSigned,
}: Props) {
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    if (!accepted) {
      setError('É necessário aceitar o termo antes de prosseguir.')
      return
    }
    startTransition(async () => {
      setError(null)
      const r = await signTermAction({
        client_id: clientId,
        reading_id: readingId,
        consent_channel: consentChannel,
        cliente_nome: clienteNome,
        cliente_cpf: clienteCpf ?? undefined,
      })
      if (!r.ok) {
        setError(r.error)
        toast.error(r.error)
        return
      }
      toast.success('Termo assinado com sucesso.')
      onSigned(r.pdf_url)
    })
  }

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold">
        Termo de consentimento — dados biométricos
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Para prosseguir com a captura das fotos de íris, leia e aceite o termo
        abaixo. Suas fotografias serão tratadas conforme a LGPD (Lei
        13.709/2018) como dado pessoal sensível.
      </p>

      <div className="space-y-2 rounded-md border border-border bg-muted/20 px-3 py-2.5">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => {
              setAccepted(e.target.checked)
              if (error) setError(null)
            }}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-teal-dark"
            data-testid="termo-biometrico-accept"
            disabled={isPending}
          />
          <span className="font-medium leading-snug">
            Li e aceito o Termo de Consentimento para tratamento de dados
            biométricos
          </span>
        </label>
        <p className="pl-[1.625rem] text-xs leading-relaxed text-muted-foreground">
          Ao aceitar, registramos seu IP, data/hora e versão do termo. Você
          pode solicitar a exclusão a qualquer momento via{' '}
          <a href="/privacidade#deletar-dados" className="underline">
            esta página
          </a>
          .
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!accepted || isPending}
        className="w-full rounded-md bg-teal-dark px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Assinando…' : 'Aceitar e prosseguir'}
      </button>
    </div>
  )
}
