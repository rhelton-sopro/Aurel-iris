'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

/**
 * Link "← Voltar para admin" no header das sub-páginas do /admin.
 * Some no índice (/admin) pra evitar redundância (founder UAT 2026-05-22:
 * "todas essas páginas que saem do admin, dentro delas têm a opção de
 * voltar para o admin").
 */
export function AdminBackLink() {
  const pathname = usePathname()
  // /admin (índice) ou /admin/ — sem back link
  if (!pathname || pathname === '/admin' || pathname === '/admin/') return null

  return (
    <Link
      href="/admin"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ChevronLeft className="h-4 w-4" />
      Voltar para admin
    </Link>
  )
}
