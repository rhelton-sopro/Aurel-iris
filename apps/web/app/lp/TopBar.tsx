'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'

/** Nav fixa que fica sólida (com blur) ao rolar — transparente sobre o hero. */
export function TopBar() {
  const [solid, setSolid] = useState(false)
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <header className={`lp-topbar ${solid ? 'solid' : ''}`}>
      <nav className="mx-auto flex h-[68px] max-w-[1280px] items-center justify-between px-6 md:px-10">
        <Link href="#top" aria-label="Iris Codex — início" className="flex items-center">
          <Image src="/logo/iris_codex_para_fundo_preto.png" alt="Iris Codex" width={1600} height={420} priority className="h-7 w-auto" />
        </Link>
        <div className="flex items-center gap-7">
          <Link href="/signup" className="eyebrow link-quiet hidden sm:inline" style={{ color: 'rgba(242,237,228,.6)' }}>
            Começar grátis
          </Link>
          <Link href="/login" className="btn btn-outline" style={{ padding: '.7rem 1.4rem', minHeight: 40 }}>
            Entrar
          </Link>
        </div>
      </nav>
    </header>
  )
}
