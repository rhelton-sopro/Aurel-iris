'use client'

// Formulário de composição (escrever / responder / encaminhar) — modal sobre a
// inbox. Envia via sendEmailAction (SMTP) de suporte@iriscodex.com.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { sendEmailAction } from './actions'

export interface ComposeInitial {
  title: string // "Escrever" | "Responder" | "Encaminhar"
  to: string
  subject: string
  text: string
  inReplyTo?: string | null
  references?: string | null
}

export function ComposeForm({
  initial,
  onClose,
}: {
  initial: ComposeInitial
  onClose: () => void
}) {
  const router = useRouter()
  const [to, setTo] = useState(initial.to)
  const [subject, setSubject] = useState(initial.subject)
  const [text, setText] = useState(initial.text)
  const [isPending, start] = useTransition()

  function send() {
    start(async () => {
      const r = await sendEmailAction({
        to,
        subject,
        text,
        inReplyTo: initial.inReplyTo,
        references: initial.references,
      })
      if (r.ok) {
        toast.success('Email enviado.')
        onClose()
        router.refresh()
      } else {
        toast.error(r.error ?? 'Falha ao enviar.')
      }
    })
  }

  const inputCls =
    'w-full rounded-[2px] border border-border bg-card px-2 py-1.5 text-sm focus:border-teal-dark focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-lg space-y-3 rounded-[2px] border border-border bg-background p-5">
        <h3 className="text-lg font-semibold text-ink">{initial.title}</h3>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Para</label>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={isPending}
            placeholder="destinatario@email.com"
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Assunto</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Mensagem</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isPending}
            rows={10}
            className={`${inputCls} resize-y font-sans`}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Enviado de suporte@iriscodex.com · cópia salva em Enviados.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={send}
            disabled={isPending}
            aria-busy={isPending}
            className="bg-teal-dark text-white hover:bg-teal-dark/90"
          >
            {isPending ? 'Enviando…' : 'Enviar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
