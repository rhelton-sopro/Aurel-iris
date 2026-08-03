'use client'

/**
 * "Versão do cliente" do MAPA DO SER.
 *
 * O TERAPEUTA ESCOLHE O QUE VAI (founder, 2026-08-03). Cada um dos blocos do documento
 * tem a sua caixinha; ele marca e baixa. Antes era uma caixinha só, para o guia de
 * sessão — o resto ia sempre, decidido por nós.
 *
 * A escolha é por ENTREGA, não uma configuração global: mora aqui, ao lado do botão, e
 * viaja na query do PDF. Duas leituras do mesmo cliente podem sair diferentes, que é o
 * caso real (acompanhamento à distância recebe o guia; devolutiva presencial, não).
 *
 * Padrão ao abrir: tudo menos "Perguntas para a sua sessão" — o guia de condução DO
 * terapeuta. Entregar o roteiro da devolutiva antes da devolutiva queima a sessão, mas
 * agora é uma sugestão de partida, não uma regra.
 *
 * ⚠️ Os títulos vêm do MOTOR por prop (`lib/emocional/render` é server-only). Reescrever
 * a lista aqui seria a deriva que o "UM MOTOR SÓ" existe para impedir — e um rótulo fora
 * de ordem faria o terapeuta desmarcar um bloco achando que era outro.
 */
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Check, ChevronDown, Download, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export function VersaoClienteButton({
  readingId,
  titulos,
}: {
  readingId: string
  /** Títulos dos blocos na ordem de EXIBIÇÃO — `TITULOS_BLOCOS` do motor. */
  titulos: string[]
}) {
  const [pending, setPending] = useState(false)
  const [aberto, setAberto] = useState(false)

  // Padrão: tudo menos o guia de sessão. Reconhecido pelo TÍTULO e não por um índice
  // fixo — bloco novo no meio do documento (aconteceu duas vezes em agosto) deslocaria
  // o número e o padrão passaria a tirar o bloco errado.
  const padrao = useMemo(
    () => titulos.map((_t, i) => i).filter((i) => !/^perguntas/i.test(titulos[i]!)),
    [titulos],
  )
  const [incluidos, setIncluidos] = useState<number[]>(padrao)

  const nada = incluidos.length === 0

  function alternar(i: number) {
    setIncluidos((atual) =>
      atual.includes(i) ? atual.filter((x) => x !== i) : [...atual, i].sort((a, b) => a - b),
    )
  }

  async function baixar() {
    setPending(true)
    try {
      const url = `/api/readings/${readingId}/emocional/pdf?variant=client&blocos=${incluidos.join(',')}`
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
    <span className="inline-flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        onClick={baixar}
        disabled={pending || nada}
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

      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
              data-testid="escolher-blocos"
            >
              {incluidos.length} de {titulos.length} blocos
              <ChevronDown className="h-3 w-3" aria-hidden />
            </button>
          }
        />
        <PopoverContent align="start" className="w-80 p-3">
          <p className="mb-2 text-xs font-medium text-foreground">
            O que vai no PDF do cliente
          </p>
          <ul className="space-y-1">
            {titulos.map((t, i) => (
              <li key={t}>
                <label className="flex cursor-pointer items-start gap-2 py-0.5 text-sm leading-snug">
                  <input
                    type="checkbox"
                    checked={incluidos.includes(i)}
                    onChange={() => alternar(i)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-teal-dark"
                    data-testid={`bloco-${i}`}
                  />
                  <span>
                    <span className="text-muted-foreground">{i + 1}.</span> {t}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
            {nada
              ? 'Marque ao menos um bloco.'
              : '“Perguntas para a sua sessão” é o seu guia de condução — sai por padrão.'}
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="mt-1 h-7 gap-1.5 px-2 text-xs"
            onClick={() => setIncluidos(padrao)}
            data-testid="blocos-padrao"
          >
            <Check className="h-3 w-3" aria-hidden />
            Voltar ao padrão
          </Button>
        </PopoverContent>
      </Popover>
    </span>
  )
}
