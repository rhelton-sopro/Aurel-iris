'use client'

/**
 * "Versão do cliente" do MAPA DO SER (2026-07-30).
 *
 * Blocos 1 a 6 sempre; o **bloco 7 — "Perguntas para a sua sessão"** é o guia de
 * condução DO TERAPEUTA e só vai junto se ele marcar a caixinha. Decisão do founder:
 * entregar o roteiro da devolutiva antes da devolutiva queima a sessão, mas há casos
 * (cliente à distância, acompanhamento) em que ele quer mandar tudo.
 *
 * A escolha é por ENTREGA, não uma configuração global — por isso mora aqui, ao lado
 * do botão, e não no /admin.
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { Download, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function VersaoClienteButton({ readingId }: { readingId: string }) {
  const [pending, setPending] = useState(false)
  const [comGuia, setComGuia] = useState(false)

  async function baixar() {
    setPending(true)
    try {
      const url = `/api/readings/${readingId}/emocional/pdf?variant=client${comGuia ? '&guia=1' : ''}`
      const res = await fetch(url, { method: 'GET' })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        toast.error(`Falha ao gerar PDF: ${detail.slice(0, 200) || `HTTP ${res.status}`}`)
        return
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition')
      const m = cd?.match(/filename\*?=(?:UTF-8''|")?([^";]+)/)
      const filename = m
        ? decodeURIComponent(m[1]!.replace(/^"|"$/g, ''))
        : `mapa-do-ser-cliente-${readingId}.pdf`
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(objUrl), 500)
      toast.success('PDF baixado.')
    } catch (err) {
      toast.error(
        `Falha ao baixar PDF: ${err instanceof Error ? err.message : 'desconhecido'}`,
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={baixar}
        disabled={pending}
        className="gap-2"
        data-testid="reading-mode-versao-cliente"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Download className="h-4 w-4" aria-hidden />
        )}
        {pending ? 'Gerando PDF…' : 'Versão do cliente'}
      </Button>
      <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={comGuia}
          onChange={(e) => setComGuia(e.target.checked)}
          className="h-3.5 w-3.5 accent-teal-dark"
          data-testid="incluir-guia-sessao"
        />
        incluir “Perguntas para a sua sessão”
      </label>
    </span>
  )
}
