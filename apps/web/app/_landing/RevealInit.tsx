'use client'

import { useEffect } from 'react'

/**
 * RevealInit — anima a entrada dos elementos .lp-reveal no scroll, à prova de falhas.
 * Conteúdo é VISÍVEL por padrão; só fica oculto depois que o JS adiciona `lp-anim`
 * ao <html>. Se o JS não rodar / reduced-motion / sem IntersectionObserver, tudo
 * aparece. Rede de segurança de 2,5s revela qualquer resto preso. Renderiza nada.
 */
export function RevealInit() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.lp-reveal'))
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach((e) => e.classList.add('in'))
      return
    }
    document.documentElement.classList.add('lp-anim')
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('in')
            io.unobserve(en.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach((e) => io.observe(e))
    const safety = window.setTimeout(() => els.forEach((e) => e.classList.add('in')), 2500)
    return () => {
      io.disconnect()
      window.clearTimeout(safety)
    }
  }, [])
  return null
}
