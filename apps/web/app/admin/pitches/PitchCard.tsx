'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { pitchToText, type Pitch } from '@/lib/admin/pitches'

// Card de um pitch. O botão copia SÓ a fala — as etiquetas de beat ficam na
// tela pra conduzir e nunca entram no clipboard (senão sujam WhatsApp/teleprompter).

export function PitchCard({ pitch }: { pitch: Pitch }) {
  const [copied, setCopied] = useState(false)
  const texto = pitchToText(pitch)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopied(true)
      toast.success(`Pitch de ${pitch.titulo} copiado — só a fala, sem os beats.`)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Não consegui copiar. Selecione o texto e use Ctrl+C.')
    }
  }

  return (
    <section className="rounded-md border bg-card">
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2
              className="text-2xl leading-none text-foreground"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 400 }}
            >
              {pitch.titulo}
            </h2>
            <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {pitch.duracao} · ~{pitch.palavras} palavras
            </span>
          </div>
          <p className="mt-2 max-w-prose text-xs text-muted-foreground">{pitch.onde}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onCopy} className="shrink-0">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          <span className="ml-2">{copied ? 'Copiado' : 'Copiar'}</span>
        </Button>
      </div>

      <div className="px-5 py-4">
        {pitch.blocos.map((b, i) => (
          <div key={i}>
            {b.beat && (
              <p className="mt-5 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[#1E6B61] first:mt-0">
                {b.beat}
              </p>
            )}
            <p className="mt-2 max-w-prose text-[0.95rem] leading-relaxed text-foreground">
              {b.texto}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
