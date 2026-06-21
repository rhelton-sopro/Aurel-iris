'use client'

// Formulário de composição (escrever / responder / encaminhar) — modal sobre a
// inbox. Editor com formatação básica (negrito/itálico/sublinhado/link) via
// contenteditable; envia html + text (fallback) por sendEmailAction (SMTP).

import { useRef, useState, useTransition } from 'react'
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
function textToHtml(s: string): string {
  return escapeHtml(s).replace(/\n/g, '<br>')
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
  const editorRef = useRef<HTMLDivElement>(null)
  const [isPending, start] = useTransition()

  function exec(cmd: string, value?: string) {
    document.execCommand(cmd, false, value)
    editorRef.current?.focus()
  }
  function addLink() {
    const url = window.prompt('URL do link:')
    if (url) exec('createLink', url)
  }

  function send() {
    const html = editorRef.current?.innerHTML ?? ''
    const text = editorRef.current?.innerText ?? ''
    start(async () => {
      const r = await sendEmailAction({
        to,
        subject,
        text,
        html,
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
  const toolBtn =
    'rounded-[2px] border border-border px-2 py-0.5 text-xs hover:bg-muted/40'

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
          <div className="flex gap-1">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')} className={`${toolBtn} font-bold`}>B</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')} className={`${toolBtn} italic`}>I</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')} className={`${toolBtn} underline`}>U</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={addLink} className={toolBtn}>🔗 link</button>
          </div>
          <div
            ref={editorRef}
            contentEditable={!isPending}
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: textToHtml(initial.text) }}
            className="min-h-40 max-h-80 overflow-y-auto rounded-[2px] border border-border bg-card px-2 py-1.5 text-sm focus:border-teal-dark focus:outline-none [&_a]:text-teal-dark [&_a]:underline"
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
