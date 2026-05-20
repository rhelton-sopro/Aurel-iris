import type { ReactNode } from 'react'

/**
 * Layout público das rotas /convite/* — sem sidebar/header de dashboard.
 * Cliente acessa do celular dele, sem login. Chrome mínimo p/ não distrair
 * do fluxo (cadastro → captura → obrigada).
 */
export default function InviteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="border-b border-border bg-white">
        <div className="mx-auto max-w-md px-4 py-3">
          <h1 className="text-sm font-light uppercase tracking-wordmark text-ink">
            Iris Codex
          </h1>
        </div>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  )
}
