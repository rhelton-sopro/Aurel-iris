# Phase 2: Auth + Dashboard básico — Research

**Pesquisado em:** 2026-05-01
**Domínio:** Supabase Auth (magic link) + Next.js 15 App Router SSR + CRUD com RLS + shadcn/ui
**Confiança geral:** HIGH (stack verificada contra registry e docs oficiais)

---

## Sumário

Esta fase instala a espinha dorsal de autenticação e navegação do produto. O stack central é `@supabase/ssr` para gerenciar sessão via cookies em Server Components, Server Actions e middleware Next.js 15. O padrão recomendado para magic link no App Router usa PKCE flow: `signInWithOtp` no browser → email com `{{ .ConfirmationURL }}` → callback em `/api/auth/callback/route.ts` que chama `exchangeCodeForSession` → redireciona para `/dashboard`.

O projeto está em Next.js **15.5.15** (não v16). Em v15 o arquivo de middleware ainda se chama `middleware.ts` e a função exportada se chama `middleware` (a renomeação para `proxy.ts` só entra em v16). Atenção: a documentação oficial do Next.js em nextjs.org já reflete v16.2.4 — qualquer padrão de `proxy.ts` ou `export function proxy()` que aparecer nos docs deve ser traduzido de volta para `middleware.ts` / `export function middleware()` para este projeto.

A criação de `profiles` em resposta ao signup é feita via SQL trigger na tabela `auth.users`, entregando como migration versionada (`0003_profiles_trigger.sql`). Isso é idempotente e independente de lógica de aplicação.

**Recomendação primária:** Dividir a fase em 4 waves: (1) Infra Supabase Auth + clients + middleware + callback, (2) Páginas auth (signup/login), (3) Layout do dashboard + rotas, (4) CRUD de clientes + smoke test.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Fluxo Auth:**
- D-01: Páginas separadas `/signup` (cadastro) e `/login` (retorno). Não é fluxo unificado.
- D-02: Signup coleta **e-mail + nome completo** (`full_name`). Dados extras opcionais, não bloqueiam cadastro.
- D-03: Registro em `profiles` criado via **Supabase trigger** em `auth.users` INSERT. Trigger lê `raw_user_meta_data->>'full_name'`, inclui `subscription_status='trial'` e `trial_ends_at = now() + interval '14 days'`. Entra como nova migration.
- D-04: Após magic link → redirect para `/dashboard`.
- D-05: Rota `/api/auth/callback/route.ts` trata o callback (troca code por sessão via `exchangeCodeForSession`), redireciona para `/dashboard`.

**SMTP e Magic Link:**
- D-06: Resend configurado como SMTP custom do Supabase Auth na Fase 2. Host: `smtp.resend.com`, porta `465`, user: `resend`, senha: `RESEND_API_KEY`.
- D-07: Template customizado do magic link — HTML simples com logo/nome Aurel Iris, texto em pt-BR, botão "Entrar no Aurel Iris".
- D-08: Remetente: `noreply@mail.soprodaorigem.com` — subdomínio dedicado na Hostinger. DNS do domínio `mail.soprodaorigem.com` verificado no Resend (SPF TXT + DKIM TXT; não interfere no site principal).

**Layout do dashboard:**
- D-09: Sidebar lateral fixa à esquerda. Mobile: Sheet drawer via shadcn/ui. Links: Dashboard / Clientes / Leituras.
- D-10: Header: nome terapeuta (`profiles.full_name`) + avatar com inicial + dropdown "Sair" + badge trial "Trial: X dias restantes".
- D-11: `/dashboard`: cards de resumo — total de clientes, leituras esta semana (= 0), status assinatura.
- D-12: `/clientes`: tabela com busca client-side por nome. Ações: ver / editar / excluir.
- D-13: `/clientes/[id]`: dados cadastrais + seção "Leituras" vazia + botão "Nova Leitura" desabilitado.
- D-14: Formulário de cliente: `full_name` (obrigatório), `birth_date`, `gender` (enum: masculino/feminino/outro/não_informado), `notes`.

### Claude's Discretion
- Tema shadcn/ui: cor base e modo light/dark → zinc/slate defaults; identidade visual real fica para Fase 9.
- Spacing, tipografia além do padrão shadcn.
- Implementação exata da busca de clientes (client-side no array carregado vs. debounce + query).
- Tratamento de erro de e-mail não encontrado no login vs. signup (UX dos estados de erro).
- Loading skeletons e estados intermediários.

### Deferred Ideas (OUT OF SCOPE)
- Tema visual / identidade Aurel Iris (cor base, modo dark, tipografia) — Fase 9.
- Edição de perfil completo do terapeuta (bio, phone, professional_id, city/state) — Fase 9.
- Redirect `?next=` após login — deferido; `/dashboard` fixo é suficiente.
- Rate limiting no envio de magic link — Fase 8/9.
- Avatar upload (foto de perfil) — Fase 9.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Descrição | Suporte da Pesquisa |
|----|-----------|----------------------|
| AUTH-01 | Terapeuta pode se cadastrar via Supabase Auth com e-mail + magic link | `supabase.auth.signInWithOtp()` com `emailRedirectTo`; trigger cria profiles |
| AUTH-02 | Sessão autenticada persiste via middleware Next.js, com redirect para login em rotas protegidas | `middleware.ts` com `createServerClient` + `getClaims()` + redirect |
| AUTH-03 | Terapeuta autenticado tem registro em `profiles` com `subscription_status='trial'` e `trial_ends_at = now() + 14 days` | SQL trigger em `auth.users` INSERT — migration `0003` |
| CLIENT-01 | CRUD completo de clientes respeitando RLS | Server Actions com `createClient()` de `lib/supabase/server.ts` |
| CLIENT-02 | Cadastro de cliente com `full_name`, `birth_date`, `gender`, `notes`; suporta `consent_signed_at` futuro | Formulário com Zod v4 + react-hook-form v7; coluna existe no schema |
| CLIENT-03 | Layout do dashboard com navegação entre `/dashboard`, `/clientes`, `/leituras` | Sidebar + route group `(dashboard)/layout.tsx` |
</phase_requirements>

---

## Mapa de Responsabilidade Arquitetural

| Capacidade | Tier Primário | Tier Secundário | Justificativa |
|------------|---------------|-----------------|---------------|
| Renderização de páginas auth (login/signup) | Frontend Server (RSC) | Browser (forms) | Formulários com `useActionState` precisam de Client Components |
| Gerenciamento de sessão (cookies) | Frontend Server (middleware) | — | Middleware Next.js executa em Node.js runtime no servidor |
| Callback do magic link | API (route handler) | — | `exchangeCodeForSession` é server-only; não expõe tokens ao browser |
| Criação de profiles no signup | Database (trigger) | — | Trigger SQL é mais confiável que webhooks; executado atomicamente |
| Leitura de dados do terapeuta (dashboard) | Frontend Server (Server Components) | — | `createClient()` do servidor usa sessão autenticada; RLS filtra por `auth.uid()` |
| CRUD de clientes | Frontend Server (Server Actions) | — | Mutações via Server Actions; `revalidatePath` para re-render |
| Busca de clientes | Browser (Client Component) | — | Busca client-side no array já carregado (Claude's Discretion: simples para MVP) |
| Envio de magic link | Supabase Auth (externo) → Resend SMTP | — | Supabase Auth chama o SMTP externo diretamente |
| Smoke test DB | API (route handler) | — | `/api/health/db` usa `createClient()` server-side autenticado |

---

## Standard Stack

### Core

| Biblioteca | Versão | Propósito | Por que é padrão |
|------------|--------|-----------|-----------------|
| `@supabase/ssr` | `0.10.2` | Clients Supabase para SSR (createBrowserClient + createServerClient) | Substituto oficial dos auth-helpers deprecados para Next.js App Router |
| `@supabase/supabase-js` | `2.105.1` | SDK base do Supabase | Dependência do @supabase/ssr; expõe signInWithOtp, exchangeCodeForSession, etc. |
| `zod` | `4.4.1` | Validação de schema / formulários | TypeScript-first; integra com react-hook-form via @hookform/resolvers |
| `react-hook-form` | `7.74.0` | Gerenciamento de estado de formulários | Performance (uncontrolled), integra com Server Actions via `useActionState` |
| `@hookform/resolvers` | `5.2.2` | Bridge entre react-hook-form e Zod v4 | Suporta Zod v4 via @standard-schema/utils; peer dep = react-hook-form ^7.55.0 |

[VERIFIED: npm registry — versões confirmadas em 2026-05-01]

### Supporting

| Biblioteca | Versão | Propósito | Quando usar |
|------------|--------|-----------|-------------|
| `date-fns` | `4.1.0` | Formatação de datas (trial_ends_at, birth_date) | Para calcular "X dias restantes" do trial e formatar birth_date na tabela |
| `lucide-react` | `1.14.0` | Ícones (já instalado) | Ícones de sidebar, ações de tabela, avatar placeholder |

[VERIFIED: npm registry]

### shadcn/ui — Componentes a instalar

O projeto usa shadcn v4.6.0 com estilo `base-nova` e `@base-ui/react` como primitivo (verificado em `components.json`). A instalação usa `pnpm dlx shadcn add <componente>`.

**CSS Variables para sidebar JÁ ESTÃO em `globals.css`** — o componente `sidebar` pode ser instalado sem conflito.

| Componente | Comando | Para que serve |
|------------|---------|----------------|
| `sidebar` | `pnpm dlx shadcn add sidebar` | Sidebar lateral fixa + mobile Sheet (já inclui Sheet) |
| `card` | `pnpm dlx shadcn add card` | Cards de resumo no `/dashboard` |
| `table` | `pnpm dlx shadcn add table` | Tabela de clientes em `/clientes` |
| `input` | `pnpm dlx shadcn add input` | Campos de formulário (signup, login, cliente) |
| `label` | `pnpm dlx shadcn add label` | Labels de formulário |
| `textarea` | `pnpm dlx shadcn add textarea` | Campo `notes` no formulário de cliente |
| `select` | `pnpm dlx shadcn add select` | Campo `gender` (enum) |
| `dialog` | `pnpm dlx shadcn add dialog` | Modal de confirmação de exclusão de cliente |
| `dropdown-menu` | `pnpm dlx shadcn add dropdown-menu` | Dropdown "Sair" no header |
| `avatar` | `pnpm dlx shadcn add avatar` | Avatar com inicial do nome do terapeuta |
| `badge` | `pnpm dlx shadcn add badge` | Badge "Trial: X dias" |
| `form` | `pnpm dlx shadcn add form` | Integração shadcn Form + react-hook-form + Zod |
| `separator` | `pnpm dlx shadcn add separator` | Separadores visuais na sidebar |
| `skeleton` | `pnpm dlx shadcn add skeleton` | Loading states (Claude's Discretion) |
| `toast` | `pnpm dlx shadcn add toast` | Feedback de sucesso/erro em mutations |

[ASSUMED — lista derivada de análise dos requisitos de UI; componentes individuais do shadcn não verificados contra registry nesta sessão, mas instalação via `pnpm dlx shadcn add` é padrão confirmado]

**Instalação em lote:**

```bash
cd apps/web
pnpm dlx shadcn add sidebar card table input label textarea select dialog dropdown-menu avatar badge form separator skeleton toast
```

### Alternativas Consideradas

| Em vez de | Poderia usar | Trade-off |
|-----------|-------------|-----------|
| Server Actions para CRUD | API Route Handlers | Server Actions são mais simples para mutações dentro do App Router; eliminam endpoint HTTP explícito. API Routes são necessárias só para webhook receivers (Fase 5, 8) |
| react-hook-form | `useActionState` nativo | useActionState funciona mas sem validação client-side antes do submit; react-hook-form + zod dá feedback em tempo real |
| date-fns | Cálculo manual de datas | date-fns já é dependência do shadcn DatePicker (futuro) |

---

## Architecture Patterns

### Diagrama de Fluxo

```
Browser                 Next.js 15 (Vercel gru1)           Supabase (sa-east-1)
  |                            |                                    |
  |-- GET /signup ------------>|                                    |
  |<-- HTML form --------------|                                    |
  |                            |                                    |
  |-- POST (Server Action) --->|                                    |
  |   { email, full_name }     |-- signInWithOtp() ---------------->|
  |                            |   emailRedirectTo=/api/auth/callback
  |                            |<-- { error: null } ----------------|
  |<-- "verifique seu email" --|                                    |
  |                            |                                    |
  |                   [Supabase Auth]                               |
  |                            |<-- trigger auth.users INSERT ------|
  |                            |    → profiles row criado           |
  |                            |                                    |
  |-- GET /api/auth/callback?code=... -->|                          |
  |                            |-- exchangeCodeForSession(code) --->|
  |                            |<-- { session: { access_token } } --|
  |                            |   Set-Cookie: sb-*-auth-token      |
  |<-- redirect /dashboard ----|                                    |
  |                            |                                    |
  |-- GET /dashboard ---------->|                                   |
  |   [middleware.ts]          |                                    |
  |                            |-- getClaims() (JWT verify) ------->|
  |                            |<-- { user } -----------------------|
  |                            |-- SELECT profiles, clients ------->|
  |<-- HTML dashboard ---------|   (RLS: auth.uid() = therapist_id) |
```

### Estrutura de Arquivos Recomendada

```
apps/web/
├── app/
│   ├── (auth)/                     # Route group — sem layout de dashboard
│   │   ├── login/
│   │   │   └── page.tsx            # LoginPage — magic link form
│   │   ├── signup/
│   │   │   └── page.tsx            # SignupPage — email + full_name form
│   │   └── layout.tsx              # Layout minimal (só fundo, sem sidebar)
│   ├── (dashboard)/                # Route group — layout com sidebar
│   │   ├── dashboard/
│   │   │   └── page.tsx            # Cards resumo
│   │   ├── clientes/
│   │   │   ├── page.tsx            # Tabela + busca
│   │   │   ├── novo/
│   │   │   │   └── page.tsx        # Formulário de criação
│   │   │   └── [id]/
│   │   │       ├── page.tsx        # Detalhe do cliente
│   │   │       └── editar/
│   │   │           └── page.tsx    # Formulário de edição
│   │   ├── leituras/
│   │   │   └── page.tsx            # Placeholder "em breve" (Fase 3)
│   │   └── layout.tsx              # DashboardLayout com Sidebar + Header
│   ├── api/
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts        # exchangeCodeForSession → /dashboard
│   │   └── health/
│   │       └── db/
│   │           └── route.ts        # Smoke test: count(*) from clients
│   └── layout.tsx                  # Root layout (já existe — Geist, pt-BR)
├── components/
│   ├── ui/                         # shadcn/ui (button já existe + novos)
│   ├── dashboard/
│   │   ├── app-sidebar.tsx         # Sidebar com nav links
│   │   ├── dashboard-header.tsx    # Header com avatar + dropdown + badge
│   │   └── summary-cards.tsx      # Cards de resumo do /dashboard
│   └── clientes/
│       ├── clients-table.tsx       # Tabela com busca client-side
│       ├── client-form.tsx         # Formulário criação/edição ('use client')
│       └── delete-client-dialog.tsx # Dialog de confirmação
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # createBrowserClient (browser)
│   │   ├── server.ts               # createServerClient (Server Components/Actions)
│   │   └── middleware.ts           # updateSession helper (chama getClaims)
│   └── utils.ts                    # cn() — já existe
├── app/
│   └── actions/
│       └── clients.ts              # Server Actions: createClient, updateClient, deleteClient
├── middleware.ts                   # Auth guard — protege (dashboard)/*
├── types/
│   └── database.ts                 # Já existe — gerado pelo Supabase
└── supabase/
    └── migrations/
        └── 0003_profiles_trigger.sql  # NOVA: trigger auth.users → profiles
```

### Pattern 1: Supabase Client — Browser

```typescript
// apps/web/lib/supabase/client.ts
// Fonte: @supabase/ssr docs + supabase.com/docs/guides/auth/server-side/creating-a-client
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
```

[CITED: supabase.com/docs/guides/auth/server-side/creating-a-client]

**Nota:** O projeto usa `NEXT_PUBLIC_SUPABASE_ANON_KEY` (chave legada, ainda válida). A documentação mais recente menciona `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (novo formato `sb_publishable_xxx`), mas a `ANON_KEY` existente no Vercel desde a Fase 1 funciona normalmente com `@supabase/ssr`. Não é necessário migrar para o novo formato agora. [VERIFIED: supabase.com/docs/guides/api/api-keys — "You can still find legacy keys in the Legacy anon, service_role API keys tab"]

### Pattern 2: Supabase Client — Server (Server Components + Server Actions)

```typescript
// apps/web/lib/supabase/server.ts
// Fonte: supabase.com/docs/guides/auth/server-side/creating-a-client
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export const createClient = async () => {
  const cookieStore = await cookies()

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
            // Chamado de Server Component — cookies não podem ser escritos aqui.
            // O middleware já fez o refresh; este catch silencia o erro esperado.
          }
        },
      },
    }
  )
}
```

[CITED: supabase.com/docs/guides/auth/server-side/creating-a-client]

**Armadilha:** `cookies()` em Next.js 15 é `async` (retorna Promise). Chamar sem `await` causa erro silencioso. Sempre `await cookies()`.

### Pattern 3: Middleware — updateSession + Auth Guard

```typescript
// apps/web/lib/supabase/middleware.ts
// Responsabilidade: refresh de token via getClaims(); retorna { supabase, response }
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

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

  // NUNCA usar getSession() no servidor — não valida assinatura JWT.
  // getClaims() valida o JWT localmente contra as chaves públicas do projeto.
  const { data: { user } } = await supabase.auth.getUser()

  return { supabase, supabaseResponse, user }
}
```

```typescript
// apps/web/middleware.ts
// Protege (dashboard)/*, passa adiante (auth)/* e rotas públicas
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

  // Usuário logado tentando acessar /login ou /signup → /dashboard
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

[CITED: supabase.com/docs/guides/auth/server-side/nextjs, nextjs.org/docs/app/api-reference/file-conventions/proxy]

**ATENÇÃO — Next.js versão:** O arquivo se chama `middleware.ts` (com `export function middleware`) em Next.js 15.x. A renomeação para `proxy.ts` (`export function proxy`) só ocorreu em **v16.0.0**. Este projeto está em **15.5.15** — usar `middleware.ts`. [VERIFIED: npm dist-tags — `latest: 16.2.4`, `backport: 15.5.15`; version history da doc confirma `v16.0.0: Middleware renamed to Proxy`]

### Pattern 4: Auth Callback Route

```typescript
// apps/web/app/api/auth/callback/route.ts
// Troca o code do magic link por sessão (PKCE flow)
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

  // Falha na troca → retorna para login com indicação de erro
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
```

[CITED: supabase.com/docs/guides/auth/server-side/email-based-auth-with-pkce-flow-for-ssr]

**Configuração necessária no Supabase Dashboard:** Em Authentication → URL Configuration → Redirect URLs, adicionar `https://aurel-iris-web.vercel.app/api/auth/callback` (produção) e `http://localhost:3000/api/auth/callback` (local). O Supabase bloqueia redirects para URLs não cadastradas.

### Pattern 5: signInWithOtp — Signup com metadata

```typescript
// Em Server Action ou Client Component (apps/web/app/(auth)/signup/page.tsx)
// Fonte: supabase.com/docs/reference/javascript/auth-signinwithotp
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: `${siteUrl}/api/auth/callback`,
    data: {
      full_name,   // lido pelo trigger: raw_user_meta_data->>'full_name'
    },
    shouldCreateUser: true,  // cria user se não existir (signup)
  },
})
```

**Para login (usuário existente):**

```typescript
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: `${siteUrl}/api/auth/callback`,
    shouldCreateUser: false, // não cria novo usuário
  },
})
```

[CITED: supabase.com/docs/reference/javascript/auth-signinwithotp]

**`siteUrl`:** Usar `process.env.NEXT_PUBLIC_SITE_URL` (adicionar ao .env.example) ou `headers().get('origin')` em Server Actions. Em produção: `https://aurel-iris-web.vercel.app`.

### Pattern 6: SQL Trigger — Criação automática de profiles

```sql
-- supabase/migrations/0003_profiles_trigger.sql
-- Trigger que cria row em profiles automaticamente no signup.
-- Idempotente: ON CONFLICT DO NOTHING protege contra re-disparo.
-- Lê full_name de raw_user_meta_data (passado via signInWithOtp options.data).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, subscription_status, trial_ends_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'trial',
    now() + interval '14 days'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Drop trigger se já existir (idempotência na migration)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

[CITED: supabase.com/docs/guides/auth/managing-user-data — padrão oficial de trigger para profiles]

**Pontos críticos:**
- `security definer set search_path = ''` previne SQL injection via search_path
- `coalesce(..., '')` evita violação de NOT NULL se `full_name` estiver ausente
- `on conflict (id) do nothing` protege contra re-disparo (ex: bug no Supabase Auth que dispara duas vezes em caso de erro seguido de retry)
- A função deve ser `public.handle_new_user()` (schema explícito) pois roda em contexto `security definer`

### Pattern 7: Server Action para CRUD de clientes

```typescript
// apps/web/app/actions/clients.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const clientSchema = z.object({
  full_name: z.string().min(1, 'Nome é obrigatório'),
  birth_date: z.string().optional().nullable(),
  gender: z.enum(['masculino', 'feminino', 'outro', 'não_informado']).optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function createClientAction(formData: FormData) {
  const supabase = await createClient()
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

export async function deleteClientAction(clientId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // RLS garante que só o dono pode deletar
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', clientId)

  if (error) return { error: error.message }

  revalidatePath('/clientes')
}
```

[CITED: nextjs.org/docs/app/guides/forms — Server Actions pattern; supabase.com/docs/reference/javascript/delete]

**IMPORTANTE:** Sempre chamar `supabase.auth.getUser()` dentro do Server Action para verificar autenticação. Não confiar apenas no middleware — conforme documentado pelo Next.js: "Always verify authentication and authorization inside each Server Action, even if the form is only rendered on an authenticated page."

### Pattern 8: Smoke Test Route `/api/health/db`

```typescript
// apps/web/app/api/health/db/route.ts
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

### Anti-Patterns a Evitar

- **`getSession()` no servidor:** Não valida assinatura JWT — use `getUser()`. [CITED: @supabase/ssr README — "Never trust `supabase.auth.getSession()` inside server code"]
- **`cookies()` sem await:** Em Next.js 15, `cookies()` retorna Promise. Esquecer `await` causa silently stale cookies.
- **Criar Supabase client em singleton global:** Cada request deve criar uma nova instância do server client para acessar os cookies corretos da request.
- **`middleware.ts` em Next.js 15:** Não renomear para `proxy.ts` — isso é Next.js 16+.
- **Edge Runtime no middleware:** `@supabase/ssr` requer Node.js runtime (não edge). Em Next.js 15.5 o Node.js runtime para middleware é estável desde v15.5.0.
- **Sem `shouldCreateUser: false` no login:** Por padrão, `signInWithOtp` cria o usuário se não existir. A página `/login` deve passar `shouldCreateUser: false` para não criar contas acidentalmente.

---

## Don't Hand-Roll

| Problema | Não construir | Usar em vez | Por quê |
|----------|---------------|-------------|---------|
| Gerenciamento de cookies de sessão | Cookie handler manual | `@supabase/ssr` createServerClient | Token refresh, serialização, edge cases de concorrência de tokens já resolvidos |
| Validação de formulário | Validação manual com `if` statements | Zod v4 + react-hook-form | Erros de tipo, mensagens localizadas, validação síncrona/assíncrona |
| Sidebar mobile responsive | CSS drawer custom | shadcn `Sidebar` (já inclui Sheet para mobile) | Acessibilidade, foco trapping, animações já testadas |
| Hash/verify de senha | Qualquer coisa manual | Supabase Auth (magic link — sem senha) | Magic link elimina o problema de senha por design |
| CSRF em Server Actions | Token manual | Next.js Server Actions (built-in CSRF protection) | Next.js 15 inclui proteção CSRF automática via Same-Origin check |

---

## Configuração Resend SMTP

### Passos no Resend Dashboard

1. Em `resend.com/domains`, clicar "Add Domain" e inserir `mail.soprodaorigem.com`
2. O Resend fornece 2 registros DNS (SPF TXT + DKIM TXT) para adicionar no Hostinger para o subdomínio `mail.soprodaorigem.com`
   - **SPF:** `TXT @ "v=spf1 include:amazonses.com ~all"` (formato exato varia — copiar do Resend Dashboard)
   - **DKIM:** `TXT resend._domainkey "p=..."` (chave pública RSA gerada pelo Resend)
3. Aguardar propagação DNS (5–30 min) e clicar "Verify" no Resend
4. Criar API Key em `resend.com/api-keys` com permissão de envio para `mail.soprodaorigem.com` (ou "Full Access" se preferir)

### Passos no Supabase Dashboard

Em `supabase.com/dashboard/project/owgbrllpznsngrkvodyw` → Authentication → Email → SMTP Settings:

```
Enable custom SMTP: ON
Host:     smtp.resend.com
Port:     465
Username: resend
Password: [RESEND_API_KEY value]
Sender name:  Aurel Iris
Sender email: noreply@mail.soprodaorigem.com
```

[VERIFIED: resend.com/docs/send-with-supabase-smtp — host smtp.resend.com, porta 465, user resend, password = API key]

### Template de Magic Link (pt-BR)

No Supabase Dashboard → Authentication → Email Templates → Magic Link:

**Subject:** `Seu acesso ao Aurel Iris`

**Body HTML:**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">Aurel Iris</h1>
    <p style="color: #6b7280; font-size: 14px; margin-bottom: 32px;">
      Ferramenta de apoio à anamnese terapêutica integrativa.
    </p>
    <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">
      Clique no botão abaixo para entrar no Aurel Iris.
      Este link é válido por 24 horas.
    </p>
    <a href="{{ .ConfirmationURL }}"
       style="display: inline-block; background: #111827; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 15px; font-weight: 600;">
      Entrar no Aurel Iris
    </a>
    <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
      Se você não solicitou este acesso, ignore este e-mail.<br>
      Não substitui avaliação médica. Ferramenta de apoio à anamnese.
    </p>
  </div>
</body>
</html>
```

[CITED: supabase.com/docs/guides/auth/auth-email-templates — variável `{{ .ConfirmationURL }}`]

**Variável `{{ .ConfirmationURL }}`** inclui o `?code=...` do PKCE e o `redirect_to` configurado. Para direcionar para `/api/auth/callback`, o `emailRedirectTo` no `signInWithOtp` deve ser passado explicitamente.

### Allowed Redirect URLs

No Supabase Dashboard → Authentication → URL Configuration:

- Site URL: `https://aurel-iris-web.vercel.app`
- Redirect URLs (adicionar ambos):
  - `https://aurel-iris-web.vercel.app/api/auth/callback`
  - `http://localhost:3000/api/auth/callback`

---

## SQL da Migration 0003

```sql
-- supabase/migrations/0003_profiles_trigger.sql
-- Cria profiles automaticamente no signup de auth.users.
-- Design choices:
--   - security definer: executa com privilégios do owner, não do caller
--   - set search_path = '': previne substituição de funções via search_path
--   - ON CONFLICT DO NOTHING: idempotente; protege contra double-fire
--   - coalesce para full_name: profiles.full_name é NOT NULL

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

Aplicar com: `supabase db push --linked` (do root do repo).

**Verificação após aplicar:**

```sql
-- Checar se o trigger existe
select trigger_name, event_object_table, action_timing
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name = 'on_auth_user_created';
```

---

## Common Pitfalls

### Pitfall 1: `cookies()` sem await em Next.js 15

**O que dá errado:** `const cookieStore = cookies()` (sem await) silenciosamente retorna uma Promise em vez do cookie store, causando `undefined` ao chamar `.getAll()`.

**Por que acontece:** Em Next.js 15, as funções de `next/headers` (`cookies()`, `headers()`) são assíncronas para suporte a streaming.

**Como evitar:** Sempre `const cookieStore = await cookies()` em qualquer função assíncrona.

**Warning sign:** Erro `cookieStore.getAll is not a function` em Server Components ou Server Actions.

### Pitfall 2: `getSession()` em vez de `getUser()` no servidor

**O que dá errado:** `getSession()` lê o token do cookie sem validar a assinatura JWT — qualquer cookie forjado passa. `getUser()` bate no servidor Supabase Auth e valida.

**Por que acontece:** `getSession()` é mais rápido e é o que a maioria dos tutoriais antigos mostra.

**Como evitar:** Usar `getUser()` sempre em Server Components, Server Actions e Route Handlers para decisões de autorização. `getSession()` é aceitável apenas em Client Components para UI.

**Warning sign:** A documentação do `@supabase/ssr` documenta explicitamente: "Never trust `supabase.auth.getSession()` inside server code."

### Pitfall 3: Esquecer `shouldCreateUser: false` no login

**O que dá errado:** `signInWithOtp` com as configurações default cria um novo usuário se o e-mail não existir. Na página `/login`, um terapeuta que erra o e-mail acidentalmente cria uma nova conta.

**Como evitar:** Passar `options: { shouldCreateUser: false }` em `/login`. Em `/signup`, o padrão `shouldCreateUser: true` (default) é correto.

**Warning sign:** Usuários duplicados com e-mails semelhantes.

### Pitfall 4: Redirect URLs não cadastradas no Supabase

**O que dá errado:** O callback recebe `error=access_denied` e o PKCE flow falha silenciosamente. O magic link abre mas não loga.

**Por que acontece:** Supabase Auth valida o `redirect_to` contra a allowlist. Em desenvolvimento, `localhost:3000` precisa estar explicitamente cadastrado.

**Como evitar:** Adicionar `http://localhost:3000/api/auth/callback` e `https://aurel-iris-web.vercel.app/api/auth/callback` no Dashboard antes de testar.

### Pitfall 5: Route group `(dashboard)` sem layout compartilhado

**O que dá errado:** Se `(dashboard)/layout.tsx` não existir, cada rota do dashboard não recebe sidebar/header. O middleware ainda protege, mas o layout quebra.

**Como evitar:** Criar `app/(dashboard)/layout.tsx` como primeiro task do Wave 3 antes de criar as páginas individuais.

### Pitfall 6: Zod v4 — mudança na API de erros

**O que dá errado:** Código migrado do Zod v3 que usa `message:` em vez de `error:` e usa `invalid_type_error:` / `required_error:` como campos top-level não compila.

**Como evitar:**
```typescript
// Zod v3 (NÃO usar)
z.string({ required_error: "Obrigatório", invalid_type_error: "Inválido" })
// Zod v4 (usar)
z.string({ error: (issue) => issue.input === undefined ? "Obrigatório" : "Inválido" })
// Ou mais simples para MVP:
z.string().min(1, 'Nome é obrigatório')
```

[CITED: zod.dev/v4 — migration guide]

### Pitfall 7: `middleware.ts` não intercepta route groups

**O que dá errado:** Colocar `matcher: ['/(dashboard)/*']` (com parênteses) no middleware não corresponde a nenhuma rota — o nome do route group não aparece na URL.

**Como evitar:** O matcher deve ser `['/dashboard/:path*', '/clientes/:path*', ...]` (sem parênteses). O route group `(dashboard)` é transparente para a URL.

---

## Recomendação de Waves

### Wave 1 — Fundação Supabase Auth (bloqueante)
Tudo que deve existir antes de qualquer UI de auth.

1. Instalar `@supabase/supabase-js` + `@supabase/ssr`
2. Criar `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`
3. Criar `middleware.ts` (auth guard)
4. Criar `app/api/auth/callback/route.ts`
5. Criar migration `0003_profiles_trigger.sql` + `supabase db push --linked`
6. Configurar Resend SMTP no Supabase Dashboard + verificar domínio `mail.soprodaorigem.com`
7. Adicionar `NEXT_PUBLIC_SITE_URL` no `.env.example` + Vercel

### Wave 2 — Páginas de Auth (depende de Wave 1)
8. Criar `app/(auth)/layout.tsx` (layout minimal)
9. Criar `app/(auth)/signup/page.tsx` + Server Action
10. Criar `app/(auth)/login/page.tsx` + Server Action
11. Instalar shadcn components: `input label form card toast`
12. Teste E2E: novo usuário recebe magic link, clica, aterra em `/dashboard`, profiles criado com trial

### Wave 3 — Layout do Dashboard (depende de Wave 1)
13. Instalar shadcn components: `sidebar avatar badge dropdown-menu separator`
14. Criar `app/(dashboard)/layout.tsx` com `AppSidebar` + `DashboardHeader`
15. Criar `components/dashboard/app-sidebar.tsx`
16. Criar `components/dashboard/dashboard-header.tsx`
17. Criar `app/(dashboard)/dashboard/page.tsx` (cards resumo)
18. Criar `app/(dashboard)/leituras/page.tsx` (placeholder)

### Wave 4 — CRUD de Clientes + Smoke Test (depende de Wave 3)
19. Instalar shadcn components: `table dialog select textarea skeleton`
20. Criar `app/actions/clients.ts` (Server Actions: create, update, delete)
21. Criar `app/(dashboard)/clientes/page.tsx` + `components/clientes/clients-table.tsx`
22. Criar `app/(dashboard)/clientes/novo/page.tsx` + `client-form.tsx`
23. Criar `app/(dashboard)/clientes/[id]/page.tsx`
24. Criar `app/(dashboard)/clientes/[id]/editar/page.tsx`
25. Criar `components/clientes/delete-client-dialog.tsx`
26. Criar `app/api/health/db/route.ts`
27. Instalar `zod` + `react-hook-form` + `@hookform/resolvers` + `date-fns`
28. Verificar RLS com segunda conta: cliente não aparece para terapeuta B

---

## Ambiente — Disponibilidade

| Dependência | Requerida por | Disponível | Versão | Fallback |
|-------------|---------------|-----------|--------|----------|
| Node.js | Next.js | ✓ | ~20.x (LTS) | — |
| pnpm | Package manager | ✓ | (existente na Fase 1) | — |
| Supabase CLI | Migration push | ✓ | (existente na Fase 1) | — |
| `@supabase/ssr` | Auth SSR | ✗ | — | Instalar Wave 1 |
| `@supabase/supabase-js` | Base SDK | ✗ | — | Instalar Wave 1 |
| `zod` | Validação | ✗ | — | Instalar Wave 4 |
| `react-hook-form` | Formulários | ✗ | — | Instalar Wave 4 |
| `@hookform/resolvers` | zod + rhf bridge | ✗ | — | Instalar Wave 4 |
| `date-fns` | Datas | ✗ | — | Instalar Wave 4 |
| Resend domain verificado | SMTP para magic link | ✗ | — | Sem fallback — é pré-requisito para AUTH-01 funcionar em produção |
| DNS `mail.soprodaorigem.com` | Remetente SMTP | ✗ | — | Em desenvolvimento usar SMTP padrão do Supabase (limitado a 4/h) |

**Dependências bloqueantes sem fallback para produção:**
- Verificação do domínio `mail.soprodaorigem.com` no Resend (não pode ser automatizada — requer acesso manual ao painel Hostinger para adicionar DNS)

**Em desenvolvimento local:** O Supabase tem SMTP built-in (limitado a 4 e-mails/hora para projetos free). O magic link pode ser testado via Supabase Dashboard → Authentication → Users → "Send magic link" sem precisar do Resend configurado. Isso permite desenvolvimento em Wave 1/2 antes da verificação DNS estar pronta.

---

## Arquitetura de Validação

### Test Framework

| Propriedade | Valor |
|-------------|-------|
| Framework | Nenhum instalado (Wave 0 gap) |
| Config file | — (Wave 0 gap) |
| Quick run command | `pnpm test` (após Wave 0) |
| Full suite command | `pnpm test:e2e` (após Wave 0) |

**Nota:** O projeto não tem teste automatizado ainda. A Fase 2 deve incluir verificação manual dos 6 critérios de sucesso. Testes automatizados de integração são recomendados mas não mandatórios para o MVP — conforme padrão do projeto (solo dev, Fase 9 polish).

### Mapeamento de Requisitos → Verificações

| Req ID | Comportamento | Tipo | Verificação Manual |
|--------|---------------|------|-------------------|
| AUTH-01 | Terapeuta novo recebe magic link e completa login | E2E manual | 1. POST /signup com email real → 2. Clicar link no email → 3. Verificar aterragem em /dashboard |
| AUTH-02 | Sessão persiste em refresh; /dashboard sem sessão → /login | E2E manual | 1. Refresh da página logado → sessão mantida; 2. Limpar cookies → GET /dashboard → redirect /login |
| AUTH-03 | profiles criado com trial + trial_ends_at 14 dias | SQL query | `SELECT subscription_status, trial_ends_at FROM profiles WHERE id = '[uid]'` — trial_ends_at deve ser ~14 dias à frente |
| CLIENT-01 | CRUD completo com RLS | E2E manual | Criar, editar, ver, deletar cliente; verificar com segunda conta que cliente não aparece |
| CLIENT-02 | Formulário captura full_name, birth_date, gender, notes | UI manual | Preencher todos os campos, checar INSERT em Supabase Dashboard |
| CLIENT-03 | Navegação entre /dashboard, /clientes, /leituras | UI manual | Clicar nos links da sidebar, verificar que cada rota carrega |

### Critérios de Sucesso do Roadmap

| # | Critério | Verificação |
|---|---------|------------|
| SC-1 | Magic link recebido e login completo | Email recebido + aterragem em /dashboard |
| SC-2 | Sessão persiste; /dashboard sem sessão → /login | Teste de cookies + acesso não-autenticado |
| SC-3 | CRUD de clientes com RLS cross-terapeuta | `INSERT` + verificação com conta B |
| SC-4 | Editar + ver detalhe + deletar cascadeado | UI + `SELECT` no Supabase confirmando 0 rows |
| SC-5 | profiles com trial + trial_ends_at | SQL query direto |
| SC-6 | `/api/health/db` retorna 200 com count | `curl -H "Cookie: [session]" /api/health/db` |

### Wave 0 Gaps

- [ ] Nenhum framework de teste instalado — Fase 2 opera sem testes automatizados (MVP, solo dev)
- [ ] `NEXT_PUBLIC_SITE_URL` não existe em `.env.example` — adicionar em Wave 1

---

## Constraint LGPD — Vocabulário Proibido

**Non-negotiable.** Nenhum texto em UI desta fase pode conter "diagnóstico", "tratamento", "cura".

**Copy obrigatória em pelo menos um lugar visível nesta fase:** "Ferramenta de apoio à anamnese terapêutica integrativa, não substitui avaliação médica."

**Onde aplicar na Fase 2:**
- `app/(auth)/layout.tsx` ou páginas de signup/login: rodapé ou subtítulo com a copy obrigatória
- `app/(dashboard)/layout.tsx`: footer discreto com a copy
- Componente `DashboardHeader` — tooltip do badge de trial sem vocabulário proibido

**Já correto:** `app/layout.tsx` tem `description: "Ferramenta de apoio à anamnese terapêutica integrativa."` (verificado no código existente).

[CITED: .planning/intel/constraints.md — NFR LGPD; REQUIREMENTS.md LGPD-06]

---

## Estado da Arte

| Abordagem Antiga | Abordagem Atual | Quando Mudou | Impacto |
|-----------------|-----------------|-------------|---------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2023 (auth-helpers deprecado) | API completamente diferente; não misturar os dois |
| `getSession()` para verificação server-side | `getUser()` | 2024 (documentação atualizada) | Segurança: getUser() valida JWT, getSession() não |
| `middleware.ts` → `export function middleware()` | Next.js 15: mesma coisa | Next.js 16: renomeia para `proxy.ts` | Projeto está em 15.x — manter `middleware.ts` |
| `cookies()` síncrono | `cookies()` assíncrono (Promise) | Next.js 15 | Sempre `await cookies()` |
| `z.string({ message: "..." })` | `z.string({ error: "..." })` / `.min(1, "...")` | Zod v4 (2025) | Migration necessária em qualquer código Zod v3 |

**Deprecado/obsoleto:**
- `@supabase/auth-helpers-nextjs`: Não instalar. Usar apenas `@supabase/ssr`.
- `supabase.auth.getSession()` em contexto servidor: Não usar para autorização.

---

## Log de Assumidos

| # | Afirmação | Seção | Risco se Errado |
|---|-----------|-------|-----------------|
| A1 | Lista de shadcn components necessários (sidebar, card, table, etc.) | Standard Stack — shadcn | Componentes adicionais podem ser necessários (ex: popover para Select); baixo risco — `pnpm dlx shadcn add` é incremental |
| A2 | Busca client-side no array carregado é suficiente para MVP (Claude's Discretion) | Architecture Patterns | Para centenas de clientes, busca client-side degrada — mas MVP terapeutas têm dezenas de clientes |
| A3 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` já cadastrado na Vercel desde Fase 1 | Standard Stack | Se não estiver, Wave 1 falha — verificar via Vercel Dashboard antes de executar |
| A4 | DNS da Hostinger para subdomínio `mail.soprodaorigem.com` é editável pelo fundador | Ambiente | Se Hostinger não der acesso ao subdomínio, remetente precisa ser ajustado |

**Se a tabela não tiver nenhum item:** todas as afirmações foram verificadas ou citadas — sem confirmação do usuário necessária.

---

## Open Questions

1. **`NEXT_PUBLIC_SITE_URL` vs URL dinâmica no signInWithOtp**
   - O que sabemos: `emailRedirectTo` deve ser a URL absoluta do callback
   - O que está incerto: Em preview deploys da Vercel o URL muda por branch. Usar `VERCEL_URL` env ou `process.env.NEXT_PUBLIC_SITE_URL` fixo?
   - Recomendação: Criar `NEXT_PUBLIC_SITE_URL` no `.env.example` com valor de produção. Para previews, o Supabase bloqueia redirects para URLs não-cadastradas na allowlist — adicionar padrão wildcard como `https://*.vercel.app/api/auth/callback` no Supabase se previews forem necessários.

2. **Password da database (STATE.md menciona rotação necessária)**
   - STATE.md nota: `AurelIris123` apareceu em chat; `SUPABASE_SERVICE_ROLE_KEY` pode ter rotacionado se o fundador já rotacionou a senha do banco
   - Recomendação: Verificar que `SUPABASE_SERVICE_ROLE_KEY` no Vercel está atualizado antes de executar Wave 1

---

## Fontes

### Primárias (HIGH confidence)
- `supabase.com/docs/guides/auth/server-side/creating-a-client` — padrões createBrowserClient, createServerClient
- `supabase.com/docs/guides/auth/server-side/email-based-auth-with-pkce-flow-for-ssr` — PKCE flow, exchangeCodeForSession
- `supabase.com/docs/reference/javascript/auth-signinwithotp` — signInWithOtp, shouldCreateUser, options.data
- `supabase.com/docs/guides/auth/auth-email-templates` — variáveis de template {{ .ConfirmationURL }}
- `resend.com/docs/send-with-supabase-smtp` — SMTP settings (host, port, user)
- `nextjs.org/docs/app/api-reference/file-conventions/proxy` — middleware pattern, matcher config (Next.js 16 docs com nota de que v15 usa `middleware.ts`)
- `nextjs.org/docs/app/guides/forms` — Server Actions, useActionState, revalidatePath
- `nextjs.org/docs/app/api-reference/file-conventions/route-groups` — route groups (auth), (dashboard)
- `zod.dev/v4` — breaking changes Zod v4 para erros de validação
- npm registry — versões verificadas: @supabase/ssr 0.10.2, @supabase/supabase-js 2.105.1, zod 4.4.1, react-hook-form 7.74.0, @hookform/resolvers 5.2.2, date-fns 4.1.0
- Codebase: `apps/web/components.json`, `apps/web/app/globals.css`, `apps/web/package.json`, `supabase/migrations/`

### Secundárias (MEDIUM confidence)
- `supabase.com/docs/guides/api/api-keys` — distinção anon key vs publishable key; backward compat confirmada
- `supabase.com/docs/guides/auth/managing-user-data` — padrão de trigger handle_new_user

### Terciárias (LOW confidence)
- Lista de shadcn components necessários (A1 — derivada de análise dos requisitos, não de registry)

---

## Metadata

**Breakdown de confiança:**
- Stack + versões: HIGH — verificado via npm registry em 2026-05-01
- Padrões de código (@supabase/ssr, middleware, callback): HIGH — verificado via docs oficiais
- SQL trigger: HIGH — padrão canônico Supabase com security definer
- Resend SMTP steps: HIGH — verificado via resend.com/docs
- Lista shadcn components: MEDIUM/LOW — derivada de análise de requisitos

**Data da pesquisa:** 2026-05-01
**Válida até:** ~2026-05-31 (stack estável; o único ponto de atenção é eventual upgrade do Next.js para v16 que renomeia middleware.ts)
