'use client'

/**
 * "Antigo relatório" — o DOSSIÊ (o Stage 2 que era o relatório de produção até
 * 2026-07-30, quando o Mapa do Ser assumiu como principal).
 *
 * Dois estados:
 *   - já existe  → abre em `/leituras/[id]/dossie` (o principal continua na página
 *                  da leitura; o antigo abre à parte, como o founder pediu)
 *   - não existe → gera sob demanda via `POST /analyze?doc=dossie`
 *
 * A geração reaproveita o Stage 1 que a leitura JÁ tem, então não repaga a observação
 * das fotos. Mas **consome 1 crédito** (decisão do founder, 2026-07-30): é um segundo
 * documento, opcional, pedido depois que o principal já foi entregue.
 *
 * Por isso o clique passa por confirmação: cobrar um crédito sem avisar é o tipo de
 * surpresa que o terapeuta descobre na fatura.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { FileText, Loader2 } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function AntigoRelatorioButton({
  readingId,
  jaExiste,
  disabled,
}: {
  readingId: string
  jaExiste: boolean
  disabled?: boolean
}) {
  const router = useRouter()
  const [gerando, setGerando] = useState(false)

  if (jaExiste) {
    return (
      <Link
        href={`/leituras/${readingId}/dossie`}
        className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
        data-testid="ver-dossie"
      >
        <FileText className="h-4 w-4" aria-hidden />
        Antigo relatório
      </Link>
    )
  }

  async function gerar() {
    const ok = window.confirm(
      'Gerar o antigo relatório (Dossiê) consome 1 crédito, separado do relatório principal desta leitura.\n\nDeseja continuar?',
    )
    if (!ok) return
    setGerando(true)
    toast.info('Gerando o antigo relatório — costuma levar 2-3 minutos.')
    try {
      const res = await fetch(`/api/readings/${readingId}/analyze?doc=dossie`, {
        method: 'POST',
      })
      if (!res.ok) {
        if (res.status === 402) {
          toast.error('Sem créditos para gerar este relatório.')
          return
        }
        let msg: string | null = null
        try {
          const j = (await res.clone().json()) as { error?: string; message?: string }
          msg = j.message ?? j.error ?? null
        } catch {
          // corpo não-JSON (5xx da plataforma) — tratado abaixo
        }
        // Geração longa: a plataforma corta a conexão em ~300s e devolve 5xx mesmo
        // com o handler seguindo em Fluid Compute. Não é falha — reconcilia no refresh.
        if (res.status >= 500) {
          toast.info('A geração continua no servidor — atualize a página em alguns minutos.')
          router.refresh()
          return
        }
        toast.error(`Falha ao gerar: ${msg ?? `HTTP ${res.status}`}`)
        return
      }
      // Consome o stream até o fim para saber que terminou (o texto em si não é usado
      // aqui — quem exibe é a página do dossiê).
      const reader = res.body?.getReader()
      if (reader) {
        for (;;) {
          const { done } = await reader.read()
          if (done) break
        }
      }
      toast.success('Antigo relatório gerado.')
      router.refresh()
    } catch {
      // stream caiu (aba em background, rede) — o servidor continua
      toast.info('A conexão caiu, mas a geração continua no servidor. Atualizando…')
      router.refresh()
    } finally {
      setGerando(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={gerar}
      disabled={disabled || gerando}
      className="gap-2"
      data-testid="gerar-dossie"
      title="Gera o relatório técnico antigo a partir desta mesma leitura. Consome 1 crédito."
    >
      {gerando ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <FileText className="h-4 w-4" aria-hidden />
      )}
      {gerando ? 'Gerando… (~3 min)' : 'Gerar antigo relatório (1 crédito)'}
    </Button>
  )
}
