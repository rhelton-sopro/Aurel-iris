'use client'
/**
 * Botão "Gerar relatório emocional" — o 2º relatório (Mapa do Ser).
 *
 * ⛔ FOUNDER-ONLY (decisão founder 2026-07-28: "somente no meu usuário por enquanto").
 * O componente só é montado quando `isFounder`, mas o gate que VALE é o da rota e o do
 * server component da página — este aqui é conveniência de UI, não segurança.
 *
 * Só aparece em reading mode, ou seja, quando o relatório de produção JÁ existe — que é
 * a condição pedida: o emocional se apoia no Stage 1 daquela leitura.
 *
 * Se já foi gerado, o botão vira "Ver relatório emocional" e o rótulo de gerar passa a
 * "Gerar de novo" — o founder decide, mas paga API de novo (~$0,40 e ~3-4 min).
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { Sparkles, HeartPulse } from 'lucide-react'
import { cn } from '@/lib/utils'

export function GerarEmocionalButton({
  readingId,
  jaGerado,
  disabled,
}: {
  readingId: string
  jaGerado: boolean
  disabled?: boolean
}) {
  const router = useRouter()
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function gerar() {
    setErro(null)
    setGerando(true)
    try {
      const res = await fetch(`/api/readings/${readingId}/emocional`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || `falhou (${res.status})`)
      // recarrega os dados do server component pra o botão virar "Ver"
      startTransition(() => router.refresh())
      router.push(`/leituras/${readingId}/emocional`)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'erro desconhecido')
    } finally {
      setGerando(false)
    }
  }

  return (
    <>
      {jaGerado && (
        <Link
          href={`/leituras/${readingId}/emocional`}
          className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
          data-testid="ver-emocional"
        >
          <HeartPulse className="h-4 w-4" aria-hidden />
          Ver relatório emocional
        </Link>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={gerar}
        disabled={disabled || gerando}
        className="gap-2"
        data-testid="gerar-emocional"
        title={gerando ? 'Leva ~3 minutos' : undefined}
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        {gerando
          ? 'Gerando… (~3 min)'
          : jaGerado
            ? 'Gerar de novo'
            : 'Gerar relatório emocional'}
      </Button>
      {erro && (
        <span className="text-xs text-destructive" role="alert">
          {erro}
        </span>
      )}
    </>
  )
}
