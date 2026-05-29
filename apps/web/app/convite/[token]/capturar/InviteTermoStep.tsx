'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { signInviteTermAction } from '@/app/actions/invite-consent'

interface Props {
  token: string
  clientId: string
  readingId: string
  clienteNome: string
  clienteCpf?: string | null
  onSigned: () => void
}

/**
 * Passo de aceite do termo biométrico no fluxo PÚBLICO de convite (remote_link),
 * BILLING-03 + LGPD-01 (D-19) — Decisão A+ (founder 2026-05-28).
 *
 * Bloqueia a captura das fotos até o CLIENTE aceitar o termo. Chama
 * signInviteTermAction (token-auth, sem sessão) que gera o PDF + registra o
 * consent + atualiza o current-pointer lido pelo termo-gate. Espelha
 * TermoBiometricoStep (08-08), mas usa a action pública de convite porque o
 * cliente não tem sessão de terapeuta.
 */
export function InviteTermoStep({
  token,
  clientId,
  readingId,
  clienteNome,
  clienteCpf,
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
      const r = await signInviteTermAction({
        token,
        client_id: clientId,
        reading_id: readingId,
        cliente_nome: clienteNome,
        cliente_cpf: clienteCpf ?? undefined,
      })
      if (!r.ok) {
        setError(r.error)
        toast.error(r.error)
        return
      }
      toast.success('Termo assinado com sucesso.')
      onSigned()
    })
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-3 px-4 py-8">
      <h3 className="text-base font-semibold">
        Termo de consentimento — dados biométricos
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Antes de tirar as fotos da sua íris, leia e aceite o termo abaixo. Suas
        fotografias são tratadas conforme a LGPD (Lei 13.709/2018) como dado
        pessoal sensível.
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
            data-testid="invite-termo-accept"
            disabled={isPending}
          />
          <span className="font-medium leading-snug">
            Li e aceito o Termo de Consentimento para tratamento de dados
            biométricos
          </span>
        </label>
        <p className="pl-[1.625rem] text-xs leading-relaxed text-muted-foreground">
          Ao aceitar, registramos seu IP, data/hora e versão do termo. Você pode
          solicitar a exclusão a qualquer momento via{' '}
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
