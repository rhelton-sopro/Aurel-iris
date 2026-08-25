'use client'

/**
 * "Dossiê IRIS" — o Stage 2 que era o relatório de produção até 2026-07-30, quando o
 * Mapa do Ser assumiu como principal.
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
 *
 * ── 2026-08-25 ──────────────────────────────────────────────────────────────
 * · Rótulo: "(antigo relatório)" saiu. Colado no nome do documento, lia-se como
 *   "versão desatualizada DESTE texto" — o terapeuta novo não sabia que era
 *   outro documento, e o que ele é de fato é o relatório TÉCNICO.
 * · A confirmação deixou de ser `window.confirm`. Era a única do sistema com a
 *   cara do navegador em vez da cara do produto — e logo esta, que é a que tira
 *   dinheiro dele. Excluir cliente e concluir leitura já usavam a caixa da marca.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { FileText, Loader2 } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  const [confirmar, setConfirmar] = useState(false)

  if (jaExiste) {
    return (
      <Link
        href={`/leituras/${readingId}/dossie`}
        className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
        data-testid="ver-dossie"
      >
        <FileText className="h-4 w-4" aria-hidden />
        Dossiê IRIS · relatório técnico
      </Link>
    )
  }

  async function gerar() {
    setConfirmar(false)
    setGerando(true)
    toast.info('Gerando o Dossiê IRIS — costuma levar 2-3 minutos.')
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
      toast.success('Dossiê IRIS gerado.')
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
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setConfirmar(true)}
        disabled={disabled || gerando}
        className="gap-2"
        data-testid="gerar-dossie"
        title="Gera o Dossiê IRIS — o relatório técnico — a partir desta mesma leitura. Consome 1 crédito."
      >
        {gerando ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <FileText className="h-4 w-4" aria-hidden />
        )}
        {gerando ? 'Gerando… (~3 min)' : 'Gerar Dossiê IRIS (1 crédito)'}
      </Button>

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Gerar o Dossiê IRIS?</DialogTitle>
            <DialogDescription>
              O Dossiê é o relatório técnico — um documento à parte do que esta
              leitura já entregou. Ele reaproveita a mesma observação das fotos,
              então não refaz o exame, mas é uma segunda geração.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-[2px] border border-border bg-muted/30 px-3 py-2.5 text-sm">
            Consome <strong>1 crédito</strong>, separado do relatório principal
            desta leitura.
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmar(false)}>
              Cancelar
            </Button>
            <Button onClick={gerar} data-testid="confirmar-dossie">
              Gerar (1 crédito)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
