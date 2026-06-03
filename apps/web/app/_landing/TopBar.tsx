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
      <nav className="mx-auto flex h-[68px] max-w-[1280px] items-center justify-between px-6 sm:h-[80px] md:px-10">
        <Link href="#top" aria-label="Iris Codex — início" className="flex items-center">
          <Image src="/logo/iris_codex_horizontal.png" alt="Iris Codex" width={976} height={488} priority className="h-[43px] w-auto sm:h-[61px]" />
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
