# Phase 2: Auth + Dashboard básico — Pattern Map

**Mapped:** 2026-05-01
**Files analyzed:** 23 new files + 1 migration
**Analogs found:** 4 / 23 (partial matches only — codebase is early-stage; most patterns come from RESEARCH.md)

---

## Codebase State

The project is at the end of Phase 1 (scaffolding only). The only source files that exist under `apps/web/` are:

| File | Lines | Description |
|------|-------|-------------|
| `apps/web/app/layout.tsx` | 35 | Root layout — Geist font, `lang="pt-BR"`, metadata |
| `apps/web/app/page.tsx` | 15 | Home placeholder — Tailwind centering, LGPD copy |
| `apps/web/components/ui/button.tsx` | 58 | shadcn Button with `@base-ui/react` primitive + CVA |
| `apps/web/lib/utils.ts` | 6 | `cn()` helper — `tailwind-merge` + `clsx` |
| `apps/web/types/database.ts` | 422 | Supabase-generated types for all tables |

No controllers, services, middleware, route handlers, or feature components exist yet. Pattern assignments below combine **codebase excerpts** (for conventions) with **RESEARCH.md code examples** (for net-new patterns).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/web/lib/supabase/client.ts` | utility | request-response | `apps/web/lib/utils.ts` | structural-only |
| `apps/web/lib/supabase/server.ts` | utility | request-response | `apps/web/lib/utils.ts` | structural-only |
| `apps/web/lib/supabase/middleware.ts` | utility | request-response | `apps/web/lib/utils.ts` | structural-only |
| `apps/web/middleware.ts` | middleware | request-response | none | no analog |
| `apps/web/app/api/auth/callback/route.ts` | route handler | request-response | none | no analog |
| `apps/web/app/api/health/db/route.ts` | route handler | request-response | none | no analog |
| `apps/web/app/(auth)/layout.tsx` | layout | request-response | `apps/web/app/layout.tsx` | role-match |
| `apps/web/app/(auth)/login/page.tsx` | page (RSC+client) | request-response | `apps/web/app/page.tsx` | structural-only |
| `apps/web/app/(auth)/signup/page.tsx` | page (RSC+client) | request-response | `apps/web/app/page.tsx` | structural-only |
| `apps/web/app/(dashboard)/layout.tsx` | layout | request-response | `apps/web/app/layout.tsx` | role-match |
| `apps/web/app/(dashboard)/dashboard/page.tsx` | page (RSC) | CRUD | `apps/web/app/page.tsx` | structural-only |
| `apps/web/app/(dashboard)/clientes/page.tsx` | page (RSC) | CRUD | `apps/web/app/page.tsx` | structural-only |
| `apps/web/app/(dashboard)/clientes/novo/page.tsx` | page (RSC) | CRUD | `apps/web/app/page.tsx` | structural-only |
| `apps/web/app/(dashboard)/clientes/[id]/page.tsx` | page (RSC) | CRUD | `apps/web/app/page.tsx` | structural-only |
| `apps/web/app/(dashboard)/clientes/[id]/editar/page.tsx` | page (RSC) | CRUD | `apps/web/app/page.tsx` | structural-only |
| `apps/web/app/(dashboard)/leituras/page.tsx` | page (RSC) | request-response | `apps/web/app/page.tsx` | structural-only |
| `apps/web/app/actions/clients.ts` | server action | CRUD | none | no analog |
| `apps/web/components/dashboard/app-sidebar.tsx` | component | request-response | `apps/web/components/ui/button.tsx` | structural-only |
| `apps/web/components/dashboard/dashboard-header.tsx` | component | request-response | `apps/web/components/ui/button.tsx` | structural-only |
| `apps/web/components/dashboard/summary-cards.tsx` | component | CRUD | `apps/web/components/ui/button.tsx` | structural-only |
| `apps/web/components/clientes/clients-table.tsx` | component | CRUD | `apps/web/components/ui/button.tsx` | structural-only |
| `apps/web/components/clientes/client-form.tsx` | component | CRUD | `apps/web/components/ui/button.tsx` | structural-only |
| `apps/web/components/clientes/delete-client-dialog.tsx` | component | CRUD | `apps/web/components/ui/button.tsx` | structural-only |
| `supabase/migrations/0003_profiles_trigger.sql` | migration | — | `supabase/migrations/0002_grant_authenticated_role.sql` | role-match |

---

## Shared Patterns (extracted from existing codebase)

### Import Path Convention
**Source:** Every existing file in `apps/web/`
**Apply to:** All new files in `apps/web/`

The project uses the `@/` alias for imports rooted at `apps/web/` (configured via `tsconfig.json`). `components.json` confirms:
```
"aliases": {
  "components": "@/components",
  "utils":      "@/lib/utils",
  "ui":         "@/components/ui",
  "lib":        "@/lib",
  "hooks":      "@/hooks"
}
```
All internal imports must use `@/` — never relative paths like `../../`.

---

### cn() Utility
**Source:** `apps/web/lib/utils.ts` (lines 1–6)
**Apply to:** All components that compose Tailwind class strings

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```
Import as: `import { cn } from "@/lib/utils"`

---

### shadcn/ui Component Convention
**Source:** `apps/web/components/ui/button.tsx` (lines 1–58)
**Apply to:** All new `components/ui/` files added via `pnpm dlx shadcn add`

The project uses **shadcn v4.6.0 with style `base-nova`** and **`@base-ui/react` as the primitive layer** (not Radix). Key conventions extracted:

```typescript
// Imports pattern (lines 1–4):
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Component export pattern (lines 43–58):
function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
export { Button, buttonVariants }
```

Note: `pnpm dlx shadcn add <component>` will automatically generate files in this style. Do **not** hand-write shadcn components — always use the CLI.

---

### Root Layout Pattern
**Source:** `apps/web/app/layout.tsx` (lines 1–35)
**Apply to:** `app/(auth)/layout.tsx`, `app/(dashboard)/layout.tsx`

```typescript
// Metadata export pattern (lines 15–19):
export const metadata: Metadata = {
  title: "Aurel Iris",
  description: "Ferramenta de apoio à anamnese terapêutica integrativa.",
}

// Layout shell pattern (lines 21–35):
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

Route group layouts do NOT re-render `<html>` or `<body>` — they wrap only inner content. The `lang="pt-BR"` is set once in the root layout and inherited.

---

### LGPD Copy Constraint
**Source:** `apps/web/app/page.tsx` (lines 9–13), `apps/web/app/layout.tsx` (line 18)
**Apply to:** `app/(auth)/layout.tsx`, `app/(dashboard)/layout.tsx`, `app/(auth)/signup/page.tsx`

The copy "Ferramenta de apoio à anamnese terapêutica integrativa. Não substitui avaliação médica." must appear in at least one visible place per auth/dashboard surface:

```tsx
// From apps/web/app/page.tsx lines 9-13:
<p className="text-lg text-muted-foreground">
  Ferramenta de apoio à anamnese terapêutica integrativa.
</p>
<p className="text-sm text-muted-foreground">
  Não substitui avaliação médica.
</p>
```

Prohibited words anywhere in UI copy: "diagnóstico", "tratamento", "cura".

---

### Database Type Usage
**Source:** `apps/web/types/database.ts`
**Apply to:** All files that interact with Supabase (lib/supabase/*.ts, actions/clients.ts, all pages and components)

The generated type is `Database` exported from `@/types/database`. Use the helper types for typed table access:

```typescript
import type { Database } from "@/types/database"
import type { Tables, TablesInsert, TablesUpdate } from "@/types/database"

// Usage examples:
type Client = Tables<"clients">
type ClientInsert = TablesInsert<"clients">
type Profile = Tables<"profiles">
```

Relevant columns confirmed in `types/database.ts`:
- `clients.Row`: `id`, `therapist_id`, `full_name`, `birth_date`, `gender`, `notes`, `consent_signed_at`, `consent_document_url`, `created_at`
- `profiles.Row`: `id`, `full_name`, `subscription_status`, `trial_ends_at`, `bio`, `phone`, `professional_id`, `city`, `state`, `stripe_customer_id`, `created_at`

---

### Migration File Convention
**Source:** `supabase/migrations/0002_grant_authenticated_role.sql` (lines 1–30)
**Apply to:** `supabase/migrations/0003_profiles_trigger.sql`

```sql
-- Header comment pattern (lines 1-16):
-- 0002_grant_authenticated_role.sql
--
-- NOTA: Esta migration NÃO está no SPEC §3 verbatim. É necessária pra que...
-- [reason for existence and design choices]
-- Padrão Supabase: [relevant reference]
-- Detectado durante [phase/plan that motivated it]

-- Body: pure SQL, no transactions needed for DDL in Supabase migrations
grant usage on schema public to anon, authenticated, service_role;
```

Migrations are applied with `supabase db push --linked` from the repo root.

---

## Pattern Assignments

### `apps/web/lib/supabase/client.ts` (utility, browser, request-response)

**Analog:** `apps/web/lib/utils.ts` (structural — same "named export from lib/" pattern)
**Pattern source:** RESEARCH.md Pattern 1

**Complete file content to implement:**
```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
```

**Key conventions:**
- Named export `createClient` (lowercase, no `default` export) — consistent with `lib/utils.ts` pattern of named exports
- Uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` (not `PUBLISHABLE_KEY`) — legacy key confirmed in Vercel from Phase 1
- Generic typed with `Database` from `@/types/database`

---

### `apps/web/lib/supabase/server.ts` (utility, server, request-response)

**Analog:** `apps/web/lib/utils.ts` (structural only)
**Pattern source:** RESEARCH.md Pattern 2

**Complete file content to implement:**
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export const createClient = async () => {
  const cookieStore = await cookies()   // MUST await — Next.js 15 cookies() is async

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — cookies cannot be written.
            // Middleware already refreshed; this catch silences the expected error.
          }
        },
      },
    }
  )
}
```

**Critical pitfall:** `await cookies()` is mandatory in Next.js 15 — omitting it silently returns a Promise instead of the cookie store (RESEARCH.md Pitfall 1).

---

### `apps/web/lib/supabase/middleware.ts` (utility, middleware-helper, request-response)

**Analog:** none
**Pattern source:** RESEARCH.md Pattern 3 (first block)

**Complete file content to implement:**
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // NEVER use getSession() on server — does not validate JWT signature.
  // getUser() validates against Supabase Auth server.
  const { data: { user } } = await supabase.auth.getUser()

  return { supabase, supabaseResponse, user }
}
```

---

### `apps/web/middleware.ts` (middleware, auth guard, request-response)

**Analog:** none — first middleware in project
**Pattern source:** RESEARCH.md Pattern 3 (second block)

**Complete file content to implement:**
```typescript
import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/dashboard', '/clientes', '/leituras', '/assinatura']

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const pathname = request.nextUrl.pathname

  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Logged-in user trying to access /login or /signup → redirect to /dashboard
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Critical conventions:**
- File name is `middleware.ts` (NOT `proxy.ts`) — Next.js 15.5.15; `proxy.ts` is Next.js 16+
- Export name is `middleware` (NOT `proxy`)
- Matcher uses URL paths without route group parentheses: `/dashboard` not `/(dashboard)` (RESEARCH.md Pitfall 7)
- Runtime is Node.js (not edge) — `@supabase/ssr` requires Node.js runtime

---

### `apps/web/app/api/auth/callback/route.ts` (route handler, auth, request-response)

**Analog:** none
**Pattern source:** RESEARCH.md Pattern 4

**Complete file content to implement:**
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // Exchange failed → return to login with error signal
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
```

**Pre-requisite (manual step):** Add both callback URLs to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs before testing:
- `https://aurel-iris-web.vercel.app/api/auth/callback`
- `http://localhost:3000/api/auth/callback`

---

### `apps/web/app/api/health/db/route.ts` (route handler, smoke test, request-response)

**Analog:** none
**Pattern source:** RESEARCH.md Pattern 8

**Complete file content to implement:**
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const { count, error } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, clients_count: count })
}
```

---

### `apps/web/app/(auth)/layout.tsx` (layout, auth, request-response)

**Analog:** `apps/web/app/layout.tsx` (role-match — same layout file pattern)
**Pattern source:** `apps/web/app/layout.tsx` lines 21–35 + LGPD copy from `apps/web/app/page.tsx`

```typescript
// Route group layout — no <html>/<body> wrapping
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Aurel Iris — Acesso",
  description: "Ferramenta de apoio à anamnese terapêutica integrativa.",
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      {children}
      {/* LGPD required copy — must be visible on auth pages */}
      <footer className="mt-8 text-xs text-muted-foreground text-center max-w-sm">
        Ferramenta de apoio à anamnese terapêutica integrativa.
        Não substitui avaliação médica.
      </footer>
    </div>
  )
}
```

---

### `apps/web/app/(auth)/signup/page.tsx` and `apps/web/app/(auth)/login/page.tsx` (page, auth form, request-response)

**Analog:** `apps/web/app/page.tsx` (structural — Server Component page export pattern)
**Pattern source:** RESEARCH.md Patterns 5 + existing page.tsx lines 1–15

**Page shell pattern** (from `apps/web/app/page.tsx` lines 1–15):
```typescript
// Server Component (no 'use client' directive at page level)
export default function SignupPage() {
  return (
    <main className="...">
      {/* Client Component form rendered here */}
    </main>
  )
}
```

**signInWithOtp pattern for signup** (RESEARCH.md Pattern 5):
```typescript
// In a Server Action or 'use client' form component:
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`,
    data: { full_name },   // read by trigger: raw_user_meta_data->>'full_name'
    shouldCreateUser: true,
  },
})
```

**signInWithOtp pattern for login** (must differ from signup):
```typescript
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`,
    shouldCreateUser: false,  // CRITICAL: prevents creating accounts on login page
  },
})
```

**Zod v4 schema pattern** (RESEARCH.md Pitfall 6 — project uses Zod 4.4.1):
```typescript
// Zod v4 syntax (NOT v3):
import { z } from 'zod'

const signupSchema = z.object({
  email: z.string().min(1, 'E-mail é obrigatório').email('E-mail inválido'),
  full_name: z.string().min(1, 'Nome é obrigatório'),
})

// z.string({ error: ... }) syntax is v4; z.string({ required_error: ... }) is v3 — do NOT use v3 syntax
```

---

### `apps/web/app/(dashboard)/layout.tsx` (layout, dashboard shell, request-response)

**Analog:** `apps/web/app/layout.tsx` (role-match — layout file pattern)
**Pattern source:** `apps/web/app/layout.tsx` lines 21–35

The dashboard layout wraps all `(dashboard)` routes with `AppSidebar` + `DashboardHeader`. It reads the authenticated user's profile (Server Component — uses `createClient` from `lib/supabase/server.ts`):

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Belt-and-suspenders auth check (middleware is primary)
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, subscription_status, trial_ends_at')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex flex-col flex-1">
        <DashboardHeader profile={profile} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
```

---

### `apps/web/app/(dashboard)/dashboard/page.tsx` (page, RSC, CRUD)

**Analog:** `apps/web/app/page.tsx` (structural — Server Component with async data fetch)
**Pattern source:** `apps/web/app/page.tsx` lines 1–15 + RESEARCH.md

```typescript
// Server Component — async data fetch pattern
import { createClient } from '@/lib/supabase/server'
import { SummaryCards } from '@/components/dashboard/summary-cards'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ count: clientCount }, { data: profile }] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('subscription_status, trial_ends_at').eq('id', user!.id).single(),
  ])

  return <SummaryCards clientCount={clientCount ?? 0} profile={profile} />
}
```

---

### `apps/web/app/(dashboard)/clientes/page.tsx` (page, RSC, CRUD)

**Analog:** `apps/web/app/page.tsx` (structural)
**Pattern source:** `apps/web/app/page.tsx` lines 1–15

```typescript
import { createClient } from '@/lib/supabase/server'
import { ClientsTable } from '@/components/clientes/clients-table'

export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, full_name, birth_date, created_at')
    .order('full_name')

  return <ClientsTable clients={clients ?? []} />
}
```

---

### `apps/web/app/(dashboard)/clientes/novo/page.tsx` and `apps/web/app/(dashboard)/clientes/[id]/editar/page.tsx` (page, RSC, CRUD)

**Analog:** `apps/web/app/page.tsx` (structural)

Pages are thin wrappers — they pass server-fetched data to a shared `ClientForm` Client Component:

```typescript
// novo/page.tsx — no pre-fill needed
import { ClientForm } from '@/components/clientes/client-form'

export default function NovoClientePage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Novo Cliente</h1>
      <ClientForm />
    </div>
  )
}

// [id]/editar/page.tsx — pre-fills form with existing data
import { createClient } from '@/lib/supabase/server'
import { ClientForm } from '@/components/clientes/client-form'
import { notFound } from 'next/navigation'

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params   // Next.js 15: params is a Promise
  const supabase = await createClient()
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (!client) notFound()

  return <ClientForm client={client} />
}
```

Note: In Next.js 15, `params` in page components is a `Promise` — always `await params`.

---

### `apps/web/app/(dashboard)/clientes/[id]/page.tsx` (page, RSC, CRUD)

**Analog:** `apps/web/app/page.tsx` (structural)

```typescript
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (!client) notFound()

  // Renders client data + empty readings section + disabled "Nova Leitura" button
  // ...
}
```

---

### `apps/web/app/(dashboard)/leituras/page.tsx` (page, placeholder)

**Analog:** `apps/web/app/page.tsx` (structural — plain Server Component)
**Pattern source:** `apps/web/app/page.tsx` lines 1–15

Minimal placeholder consistent with the existing page pattern:
```typescript
export default function LeiturasPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-2">
      <h1 className="text-2xl font-semibold">Leituras</h1>
      <p className="text-muted-foreground">
        Disponível na Fase 3.
      </p>
    </div>
  )
}
```

---

### `apps/web/app/actions/clients.ts` (server action, CRUD)

**Analog:** none — first Server Action in project
**Pattern source:** RESEARCH.md Pattern 7

**Core pattern:**
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

// Zod v4 schema (not v3):
const clientSchema = z.object({
  full_name: z.string().min(1, 'Nome é obrigatório'),
  birth_date: z.string().optional().nullable(),
  gender: z.enum(['masculino', 'feminino', 'outro', 'não_informado']).optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function createClientAction(formData: FormData) {
  const supabase = await createClient()
  // ALWAYS verify auth inside the action — do not trust middleware alone:
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) redirect('/login')

  const parsed = clientSchema.safeParse({
    full_name: formData.get('full_name'),
    birth_date: formData.get('birth_date') || null,
    gender: formData.get('gender') || null,
    notes: formData.get('notes') || null,
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { error } = await supabase
    .from('clients')
    .insert({ ...parsed.data, therapist_id: user.id })

  if (error) return { error: { _form: [error.message] } }

  revalidatePath('/clientes')
  redirect('/clientes')
}
```

**updateClientAction and deleteClientAction** follow the same pattern: `getUser()` check, RLS-enforced operation, `revalidatePath`, optional `redirect`.

---

### `apps/web/components/dashboard/app-sidebar.tsx` (component, sidebar nav)

**Analog:** `apps/web/components/ui/button.tsx` (structural — named function export with `cn()`)
**Pattern source:** `apps/web/components/ui/button.tsx` lines 1–58 (import/export conventions)

**Import/export pattern** (from button.tsx):
```typescript
// 'use client' required for sidebar (handles Sheet/drawer state on mobile)
'use client'

import { cn } from "@/lib/utils"
// shadcn components (after pnpm dlx shadcn add sidebar):
import { Sidebar, SidebarContent, SidebarHeader, /* etc */ } from "@/components/ui/sidebar"

// Named function export (not default):
export function AppSidebar({ ... }) { ... }
```

Nav links: `/dashboard` (Dashboard), `/clientes` (Clientes), `/leituras` (Leituras) — per D-09.

---

### `apps/web/components/dashboard/dashboard-header.tsx` (component, header with avatar/dropdown/badge)

**Analog:** `apps/web/components/ui/button.tsx` (structural)

```typescript
'use client'  // DropdownMenu requires client interaction

import { cn } from "@/lib/utils"
import type { Tables } from "@/types/database"

type Profile = Pick<Tables<"profiles">, "full_name" | "subscription_status" | "trial_ends_at">

export function DashboardHeader({ profile }: { profile: Profile | null }) {
  // Avatar shows first letter of full_name
  // Badge shows trial days remaining — calculate with date-fns differenceInDays()
  // Dropdown has "Sair" → calls supabase.auth.signOut() then router.push('/login')
  // ...
}
```

Trial badge copy: "Trial: X dias restantes" — no prohibited vocabulary.

---

### `apps/web/components/dashboard/summary-cards.tsx` (component, dashboard cards)

**Analog:** `apps/web/components/ui/button.tsx` (structural)

```typescript
// Server Component (no interactivity needed)
import type { Tables } from "@/types/database"
// Uses shadcn Card components after: pnpm dlx shadcn add card

type Profile = Pick<Tables<"profiles">, "subscription_status" | "trial_ends_at">

export function SummaryCards({
  clientCount,
  profile,
}: {
  clientCount: number
  profile: Profile | null
}) { ... }
```

Cards per D-11: total de clientes, leituras esta semana (= 0), status da assinatura.

---

### `apps/web/components/clientes/clients-table.tsx` (component, client, CRUD)

**Analog:** `apps/web/components/ui/button.tsx` (structural)

```typescript
'use client'  // client-side search requires useState

import { useState } from "react"
import { cn } from "@/lib/utils"
import type { Tables } from "@/types/database"
// Uses shadcn Table after: pnpm dlx shadcn add table

type ClientRow = Pick<Tables<"clients">, "id" | "full_name" | "birth_date" | "created_at">

export function ClientsTable({ clients }: { clients: ClientRow[] }) {
  const [search, setSearch] = useState('')

  // Client-side filter (Claude's Discretion — simple for MVP):
  const filtered = clients.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase())
  )

  // Renders: search input + table with columns: nome, data nascimento, última leitura, ações
  // Actions: Link to /clientes/[id] (ver), Link to /clientes/[id]/editar (editar), DeleteClientDialog (excluir)
}
```

---

### `apps/web/components/clientes/client-form.tsx` (component, client form, CRUD)

**Analog:** `apps/web/components/ui/button.tsx` (structural)
**Pattern source:** RESEARCH.md Pattern 7 (form + Server Action integration)

```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Tables } from "@/types/database"
// Uses shadcn Form after: pnpm dlx shadcn add form input label textarea select

const clientSchema = z.object({
  full_name: z.string().min(1, 'Nome é obrigatório'),
  birth_date: z.string().optional(),
  gender: z.enum(['masculino', 'feminino', 'outro', 'não_informado']).optional(),
  notes: z.string().optional(),
})

type ClientFormValues = z.infer<typeof clientSchema>
type Client = Tables<"clients">

export function ClientForm({ client }: { client?: Client }) {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: client ? {
      full_name: client.full_name,
      birth_date: client.birth_date ?? undefined,
      gender: (client.gender as ClientFormValues['gender']) ?? undefined,
      notes: client.notes ?? undefined,
    } : undefined,
  })

  // onSubmit calls createClientAction or updateClientAction via startTransition
}
```

Fields per D-14: `full_name` (required), `birth_date`, `gender` (enum select), `notes` (textarea).

---

### `apps/web/components/clientes/delete-client-dialog.tsx` (component, confirmation dialog, CRUD)

**Analog:** `apps/web/components/ui/button.tsx` (structural)

```typescript
'use client'

// Uses shadcn Dialog after: pnpm dlx shadcn add dialog
import { deleteClientAction } from '@/app/actions/clients'

export function DeleteClientDialog({ clientId, clientName }: {
  clientId: string
  clientName: string
}) {
  // Dialog with destructive confirmation before calling deleteClientAction(clientId)
  // Uses Button variant="destructive" from @/components/ui/button
}
```

---

### `supabase/migrations/0003_profiles_trigger.sql` (migration, DDL)

**Analog:** `supabase/migrations/0002_grant_authenticated_role.sql` (same file format)
**Pattern source:** RESEARCH.md Pattern 6 + SQL Migration Convention above

**Header comment pattern** (from 0002, lines 1–16):
```sql
-- 0003_profiles_trigger.sql
--
-- NOTA: Esta migration cria o trigger que popula profiles automaticamente
-- no signup. Design choices documentados inline.
-- Padrão Supabase: security definer + set search_path = '' (canônico)
-- Ref: supabase.com/docs/guides/auth/managing-user-data
```

**Complete SQL** (from RESEARCH.md SQL section):
```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, subscription_status, trial_ends_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Terapeuta'),
    'trial',
    now() + interval '14 days'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

Key points: `security definer set search_path = ''` prevents search_path injection; `ON CONFLICT DO NOTHING` is idempotent; `coalesce(..., 'Terapeuta')` handles missing `full_name` without violating `NOT NULL` on `profiles.full_name`.

---

## No Analog Found

Files with no close match in the existing codebase (all patterns from RESEARCH.md):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/middleware.ts` | middleware | request-response | No middleware exists yet in project |
| `apps/web/app/api/auth/callback/route.ts` | route handler | request-response | No route handlers exist yet |
| `apps/web/app/api/health/db/route.ts` | route handler | request-response | No route handlers exist yet |
| `apps/web/app/actions/clients.ts` | server action | CRUD | No server actions exist yet |

---

## Key Conventions Summary (for planner reference)

| Convention | Value | Source |
|------------|-------|--------|
| Import alias | `@/` maps to `apps/web/` | `components.json` aliases |
| shadcn style | `base-nova` with `@base-ui/react` primitives | `components.json` |
| shadcn base color | `neutral` | `components.json` |
| Tailwind version | v4 (CSS-first, no `tailwind.config.js`) | `globals.css` — `@import "tailwindcss"` |
| CSS vars for sidebar | Already in `globals.css` | `globals.css` lines 13–20 |
| Package manager | pnpm | `package.json` + Phase 1 decisions |
| Supabase auth key var | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Existing in Vercel from Phase 1 |
| Next.js version | 15.5.15 (NOT 16) | `package.json` |
| Middleware file name | `middleware.ts` (NOT `proxy.ts`) | Next.js 15.x convention |
| `cookies()` | Must `await` — async in Next.js 15 | RESEARCH.md Pitfall 1 |
| Auth validation | Always `getUser()`, never `getSession()` | RESEARCH.md Anti-patterns |
| Zod version | v4.4.1 — use `.min(1, 'msg')` not `required_error:` | RESEARCH.md Pitfall 6 |
| Migration runner | `supabase db push --linked` from repo root | RESEARCH.md + Phase 1 |
| `params` in pages | `Promise<{...}>` — always `await params` | Next.js 15 breaking change |

---

## Metadata

**Analog search scope:** `apps/web/` (all `.ts`, `.tsx` files), `supabase/migrations/`
**Files scanned:** 12 source files (5 under `apps/web/`, 2 migrations, 2 test files, `package.json`, `components.json`, `globals.css`)
**Pattern extraction date:** 2026-05-01
