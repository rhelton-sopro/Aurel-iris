'use client'

/**
 * Exibe o Mapa do Ser DENTRO da página da leitura (2026-07-30), sem deixar o
 * documento e o dashboard se contaminarem.
 *
 * ⚠️ Por que iframe e não `dangerouslySetInnerHTML`: o render devolve um documento
 * inteiro (`<!doctype html>` + `<style>` com regras em `body`, `h2`, `p`…). Injetado
 * num div, esse CSS vaza e repinta o dashboard inteiro — e, na direção contrária, o
 * Tailwind do app mexeria no desenho do relatório, que está APROVADO. O iframe é a
 * única fronteira que preserva os dois lados exatamente como são.
 *
 * ⭐ Por que `src` e NÃO `srcDoc` (mudou em 2026-08-03): documento carregado por `srcDoc`
 * não tem URL própria — herda a base do pai. Com isso, os links do índice (`href="#b7"`)
 * resolviam para `/leituras/<id>#b7` e o iframe carregava a PÁGINA DA LEITURA dentro de si
 * ("parece recursivo", founder). Tirar os links matou a recursão mas também a navegação
 * ("clico e não vai para lugar nenhum"). Com URL real o documento tem base própria e a
 * âncora volta a ser âncora: rola dentro do quadro, sem recarregar nada.
 * ⇒ ver `app/(dashboard)/leituras/[id]/emocional/documento/route.ts`.
 *
 * A altura acompanha o conteúdo (sem scroll interno): o documento é longo e ler um
 * relatório dentro de uma janelinha rolante seria pior que a página separada.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export function MapaDoSerEmbed({ readingId, title }: { readingId: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [altura, setAltura] = useState(1200)

  const medir = useCallback(() => {
    const doc = ref.current?.contentDocument
    if (!doc?.body) return
    // scrollHeight do documentElement pega margens de colapso que o body perde
    const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight)
    if (h > 0) setAltura(h)
  }, [])

  useEffect(() => {
    // Fontes e imagens chegam depois do onLoad e mudam a altura — sem observar,
    // o rodapé do documento fica cortado no primeiro paint.
    const doc = ref.current?.contentDocument
    if (!doc?.body || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(medir)
    ro.observe(doc.body)
    return () => ro.disconnect()
  }, [medir, readingId])

  return (
    <iframe
      ref={ref}
      title={title}
      src={`/leituras/${readingId}/emocional/documento`}
      onLoad={medir}
      className="w-full border-0 bg-white"
      style={{ height: altura }}
      // ⛔ SEM sandbox: `allow-same-origin` sozinho já dá acesso ao documento, e o que
      // precisamos é justamente isso (medir a altura) + a âncora funcionar. O documento
      // não tem script nenhum — ele é gerado pelo nosso render a partir de markdown, e
      // todo texto de modelo passa por escape antes de virar HTML.
      data-testid="mapa-do-ser-embed"
    />
  )
}
