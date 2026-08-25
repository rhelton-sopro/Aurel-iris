'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

/**
 * Busca por nome do cliente na lista de leituras.
 *
 * ⚠️ A lista não tinha busca nem filtro: parava nas 50 mais recentes e pra achar
 * uma leitura de dois meses atrás só rolando — e, passadas as 50, nem rolando.
 *
 * A busca vive na URL (`?q=`) e não em estado local, por três motivos: a
 * filtragem acontece no banco (a lista é paginada, então filtrar no cliente só
 * filtraria a página atual); o resultado fica compartilhável e sobrevive ao F5;
 * e a paginação consegue carregar o termo junto ao trocar de página.
 *
 * Debounce de 350ms: sem ele cada tecla vira uma navegação e uma consulta.
 */
export function LeiturasBusca({ valorInicial }: { valorInicial: string }) {
  const router = useRouter()
  const [termo, setTermo] = useState(valorInicial)

  // Ressincroniza quando a URL muda por fora (voltar do navegador, limpar).
  useEffect(() => {
    setTermo(valorInicial)
  }, [valorInicial])

  useEffect(() => {
    if (termo === valorInicial) return
    const id = window.setTimeout(() => {
      const params = new URLSearchParams()
      if (termo.trim()) params.set('q', termo.trim())
      // Trocar o termo sempre volta pra primeira página: manter `p=3` de uma
      // busca anterior mostraria "nenhuma leitura" para um termo que tem
      // resultado, e é o tipo de vazio que a pessoa lê como "não achou".
      router.replace(params.toString() ? `/leituras?${params}` : '/leituras')
    }, 350)
    return () => window.clearTimeout(id)
  }, [termo, valorInicial, router])

  return (
    <div className="relative max-w-sm">
      <Search
        className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-mist"
        aria-hidden
      />
      <Input
        type="search"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Buscar pelo nome do cliente..."
        aria-label="Buscar leituras pelo nome do cliente"
        className="pl-6 pr-9"
      />
      {termo && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Limpar busca"
          onClick={() => setTermo('')}
          className="absolute right-0 top-1/2 size-7 -translate-y-1/2"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
