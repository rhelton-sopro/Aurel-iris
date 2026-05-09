import { isFounderEmail } from '@/lib/auth/founder'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

// Defense-in-depth founder gate at the server-component layer.
// Middleware (apps/web/middleware.ts) is the primary gate and rewrites
// non-founder requests to /404 before they reach this layout. This check
// triggers only if middleware is misconfigured (e.g., env unset, matcher gap).
//
// Returns 404 (not 403) to avoid leaking existence of /admin/* routes.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isFounderEmail(user.email)) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-sm font-medium text-muted-foreground">
            ADMIN · Aurel Iris
          </h1>
          <span className="text-xs text-muted-foreground">{user.email}</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}
