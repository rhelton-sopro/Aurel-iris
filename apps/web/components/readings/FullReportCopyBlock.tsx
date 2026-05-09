'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { SECTIONS } from './EditorAccordion'

export interface FullReportCopyBlockProps {
  reportDelivered: Record<string, string>
}

function buildFullReport(delivered: Record<string, string>): string {
  const parts: string[] = []
  for (const s of SECTIONS) {
    const body = (delivered[s.key] ?? '').trim()
    if (!body) continue
    parts.push(`## ${s.number}. ${s.title}\n\n${body}`)
  }
  const enc = (delivered['encerramento_disclaimer'] ?? '').trim()
  if (enc) parts.push(enc)
  return parts.join('\n\n')
}

export function FullReportCopyBlock({ reportDelivered }: FullReportCopyBlockProps) {
  const [copied, setCopied] = useState(false)
  const text = buildFullReport(reportDelivered)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Relatório copiado para a área de transferência.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Não consegui copiar. Selecione o texto e use Ctrl+C.')
    }
  }

  return (
    <section className="space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Texto completo do relatório</h2>
          <p className="text-xs text-muted-foreground">
            Versão concatenada do que está nas seções acima — copie tudo de uma vez.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onCopy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          <span className="ml-2">{copied ? 'Copiado' : 'Copiar tudo'}</span>
        </Button>
      </div>
      <Label htmlFor="full-report-textarea" className="sr-only">
        Texto completo
      </Label>
      <Textarea
        id="full-report-textarea"
        value={text}
        readOnly
        className="min-h-[400px] font-mono text-sm"
      />
      <p className="text-xs text-muted-foreground">
        {text.length} caracteres · atualiza conforme você edita as seções acima
      </p>
    </section>
  )
}
