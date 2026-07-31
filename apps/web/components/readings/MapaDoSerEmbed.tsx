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
 * A altura acompanha o conteúdo (sem scroll interno): o documento é longo e ler um
 * relatório dentro de uma janelinha rolante seria pior que a página separada.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export function MapaDoSerEmbed({ html, title }: { html: string; title: string }) {
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
  }, [medir, html])

  return (
    <iframe
      ref={ref}
      title={title}
      srcDoc={html}
      onLoad={medir}
      className="w-full border-0 bg-white"
      style={{ height: altura }}
      // sandbox sem allow-scripts: o documento é estático por natureza e não há
      // razão para dar script a um HTML que veio de saída de modelo.
      sandbox="allow-same-origin"
      data-testid="mapa-do-ser-embed"
    />
  )
}
