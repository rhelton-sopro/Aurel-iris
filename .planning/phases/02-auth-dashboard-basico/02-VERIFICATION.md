---
phase: 02-auth-dashboard-basico
verified: 2026-05-01T00:00:00Z
status: human_needed
score: 18/18 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Fluxo completo de magic link — signup"
    expected: "Terapeuta acessa /signup, preenche e-mail + nome, clica 'Enviar link de acesso', vê confirmation state com MailCheck. Clicar no link do e-mail redireciona para /dashboard já autenticado."
    why_human: "Depende de SMTP Resend configurado + e-mail real enviado + clique no link. Não testável programaticamente."
  - test: "Trigger on_auth_user_created aplicado ao banco remoto"
    expected: "SQL `select trigger_name from information_schema.triggers where trigger_name = 'on_auth_user_created'` retorna 1 row no Supabase remoto. Novo signup cria row em public.profiles com subscription_status='trial' e trial_ends_at = now() + 14 dias."
    why_human: "Verifica estado do banco Supabase remoto. Não verificável localmente sem credenciais."
  - test: "Middleware redireciona rotas protegidas sem sessão"
    expected: "Acessar /dashboard, /clientes ou /leituras sem estar logado redireciona para /login. Logado em /login redireciona para /dashboard."
    why_human: "Comportamento de runtime do Next.js middleware + cookies de sessão Supabase. Requer browser real."
  - test: "CRUD completo de clientes com persistência"
    expected: "Criar cliente com full_name, birth_date, gender, notes → aparece em /clientes. Editar → dados atualizados. Clicar Trash2 → Dialog abre com nome do cliente → confirmar → cliente removido. /clientes/[id] mostra botão Nova Leitura disabled."
    why_human: "Fluxo completo de Server Actions + DB + navegação requer ambiente rodando."
  - test: "Dashboard exibe dados reais do perfil"
    expected: "Header mostra nome do terapeuta (profiles.full_name) + badge 'Trial: X dias'. Cards mostram contagem real de clientes. Sidebar tem links ativos para Dashboard/Clientes/Leituras."
    why_human: "Requer sessão autenticada + dados reais no banco."
  - test: "RLS cross-terapeuta — isolamento de dados"
    expected: "Clientes do Terapeuta A não aparecem para Terapeuta B. Verificar via SQL: `SELECT id, full_name, therapist_id FROM clients` com auth de dois usuários distintos."
    why_human: "Requer dois usuários cadastrados + verificação de RLS no Supabase Dashboard."
---

# Phase 2: Auth + Dashboard Básico — Relatório de Verificação

**Phase Goal:** Auth + Dashboard básico — terapeutas podem fazer signup/login via magic link, acessar o dashboard com sidebar e cards de resumo, e gerenciar clientes (criar, listar com busca, editar, excluir).
**Verificado:** 2026-05-01T00:00:00Z
**Status:** human_needed
**Re-verificação:** Não — verificação inicial

## Resultado da Meta

### Truths Observáveis

| # | Truth | Status | Evidência |
|---|-------|--------|-----------|
| 1 | Supabase client (browser + server) é instanciável sem erro de runtime | ✓ VERIFIED | `client.ts` usa `createBrowserClient`, `server.ts` usa `createServerClient` com `await cookies()` |
| 2 | middleware.ts protege /dashboard, /clientes, /leituras — redireciona para /login sem sessão | ✓ VERIFIED | `PROTECTED_PATHS = ['/dashboard', '/clientes', '/leituras', '/assinatura']` + `updateSession` importado e usado |
| 3 | GET /api/auth/callback?code=... troca o code e redireciona para /dashboard | ✓ VERIFIED | `exchangeCodeForSession(code)` presente em `app/api/auth/callback/route.ts` |
| 4 | trigger on_auth_user_created existe em auth.users e cria row em public.profiles com trial | ✓ VERIFIED | `0003_profiles_trigger.sql` contém trigger, `security definer set search_path = ''`, `on conflict (id) do nothing` |
| 5 | NEXT_PUBLIC_SITE_URL está em .env.example | ✓ VERIFIED | `apps/web/.env.example` contém `NEXT_PUBLIC_SITE_URL` |
| 6 | Terapeuta acessa /signup, preenche e-mail + nome, clica CTA e vê confirmation state | ✓ VERIFIED | `signup/page.tsx` tem `shouldCreateUser: true`, `useState(sent)`, confirmation state com MailCheck |
| 7 | Terapeuta acessa /login, preenche e-mail, clica CTA e vê confirmation state | ✓ VERIFIED | `login/page.tsx` tem `shouldCreateUser: false`, confirmation state implementado |
| 8 | Copy LGPD obrigatória aparece no layout de auth | ✓ VERIFIED | `(auth)/layout.tsx` contém "Ferramenta de apoio à anamnese terapêutica integrativa, não substitui avaliação médica." |
| 9 | Vocabulário proibido ausente em todas as páginas de auth | ✓ VERIFIED | `grep diagnóstico\|tratamento\|cura apps/web/app/(auth)/` retorna 0 resultados |
| 10 | Usuário autenticado acessa /dashboard e vê sidebar + header + 3 cards de resumo | ✓ VERIFIED | `(dashboard)/layout.tsx` monta `SidebarProvider + AppSidebar + DashboardHeader`; `dashboard/page.tsx` renderiza `SummaryCards` |
| 11 | Header exibe nome do terapeuta (profiles.full_name) + avatar com inicial + badge de trial | ✓ VERIFIED | `dashboard-header.tsx` recebe `fullName`, `trialEndsAt`, `subscriptionStatus` via props do layout Server Component; layout busca do DB com `.from('profiles').select('full_name, subscription_status, trial_ends_at')` |
| 12 | Sidebar tem links para Dashboard, Clientes e Leituras com ícones corretos | ✓ VERIFIED | `app-sidebar.tsx` exporta `AppSidebar` com `navItems` para `/dashboard`, `/clientes`, `/leituras` e ícones `LayoutDashboard`, `Users`, `Eye` |
| 13 | Copy LGPD obrigatória aparece no layout do dashboard | ✓ VERIFIED | `(dashboard)/layout.tsx` contém "Ferramenta de apoio à anamnese terapêutica integrativa, não substitui avaliação médica." |
| 14 | /leituras mostra página placeholder 'Em breve' | ✓ VERIFIED | `leituras/page.tsx` contém "Em breve" |
| 15 | Terapeuta cria cliente com full_name, birth_date, gender, notes; cliente aparece em /clientes | ✓ VERIFIED | `createClientAction` em `actions/clients.ts` com schema Zod v4 validando os 4 campos; `clientes/page.tsx` busca `.from('clients').select('*')` e passa para `ClientsTable` |
| 16 | Tabela em /clientes tem busca client-side por nome; ações ver, editar, excluir funcionam | ✓ VERIFIED | `ClientsTable` com `useState(query)` + filter `includes(query.toLowerCase())` + botões Eye/Pencil/Trash2 com links e `DeleteClientDialog` |
| 17 | Server Actions verificam getUser() antes de toda mutação (defense in depth) | ✓ VERIFIED | `getUser()` presente 3 vezes em `actions/clients.ts` — uma por action (`createClientAction`, `updateClientAction`, `deleteClientAction`) |
| 18 | /api/health/db retorna 200 com clients_count quando autenticado; 401 quando não autenticado | ✓ VERIFIED | `health/db/route.ts` chama `getUser()`, retorna `{ error: 'Unauthenticated', status: 401 }` sem sessão e `{ ok: true, clients_count: count }` com sessão |

**Score:** 18/18 truths verificadas

### Artefatos Obrigatórios

| Artefato | Descrição | Status | Detalhes |
|----------|-----------|--------|----------|
| `apps/web/lib/supabase/client.ts` | createBrowserClient browser | ✓ VERIFIED | Exporta `createClient`, usa `createBrowserClient<Database>` |
| `apps/web/lib/supabase/server.ts` | createServerClient server com await cookies() | ✓ VERIFIED | Exporta `createClient` async, usa `createServerClient<Database>` |
| `apps/web/lib/supabase/middleware.ts` | updateSession helper | ✓ VERIFIED | Exporta `updateSession`, chama `supabase.auth.getUser()` (não getSession) |
| `apps/web/middleware.ts` | Auth guard Next.js | ✓ VERIFIED | `export async function middleware` com `PROTECTED_PATHS` e `export const config` |
| `apps/web/app/api/auth/callback/route.ts` | PKCE callback server-only | ✓ VERIFIED | Exporta `GET`, contém `exchangeCodeForSession` |
| `supabase/migrations/0003_profiles_trigger.sql` | Trigger on_auth_user_created | ✓ VERIFIED | Contém `security definer set search_path = ''`, `on conflict (id) do nothing`, `coalesce` para full_name |
| `apps/web/app/(auth)/layout.tsx` | Layout minimal de auth com footer LGPD | ✓ VERIFIED | Contém copy LGPD obrigatória |
| `apps/web/app/(auth)/signup/page.tsx` | Página de cadastro com shouldCreateUser: true | ✓ VERIFIED | `'use client'`, `signInWithOtp`, `shouldCreateUser: true`, `emailRedirectTo` com `/api/auth/callback` |
| `apps/web/app/(auth)/login/page.tsx` | Página de login com shouldCreateUser: false | ✓ VERIFIED | `'use client'`, `shouldCreateUser: false` |
| `apps/web/app/(dashboard)/layout.tsx` | DashboardLayout com SidebarProvider + footer LGPD | ✓ VERIFIED | Server Component, busca perfil do DB, passa props para componentes, footer LGPD, `redirect('/login')` se sem user |
| `apps/web/components/dashboard/app-sidebar.tsx` | Sidebar com nav links | ✓ VERIFIED | Exporta `AppSidebar`, 3 links de navegação com ícones |
| `apps/web/components/dashboard/dashboard-header.tsx` | Header com trial badge + avatar + logout | ✓ VERIFIED | Exporta `DashboardHeader`, usa `supabase.auth.signOut()` |
| `apps/web/components/dashboard/summary-cards.tsx` | 3 cards de resumo | ✓ VERIFIED | Exporta `SummaryCards` com cards Clientes, Leituras, Assinatura |
| `apps/web/app/(dashboard)/dashboard/page.tsx` | Página /dashboard com SummaryCards | ✓ VERIFIED | Server Component, busca `clients` count e `profiles` trial info do DB, renderiza `SummaryCards` |
| `apps/web/app/(dashboard)/leituras/page.tsx` | Placeholder 'Em breve' | ✓ VERIFIED | Contém "Em breve" |
| `apps/web/app/actions/clients.ts` | Server Actions: create, update, delete | ✓ VERIFIED | `'use server'`, 3 actions, cada uma chama `getUser()` |
| `apps/web/components/clientes/clients-table.tsx` | Tabela com busca client-side + ações | ✓ VERIFIED | Exporta `ClientsTable`, importa `DeleteClientDialog` |
| `apps/web/components/clientes/client-form.tsx` | Formulário react-hook-form + Zod v4 | ✓ VERIFIED | Exporta `ClientForm`, action injetada via prop (pattern correto para Server Actions bound) |
| `apps/web/components/clientes/delete-client-dialog.tsx` | Dialog de confirmação de exclusão | ✓ VERIFIED | Exporta `DeleteClientDialog`, importa `deleteClientAction` diretamente |
| `apps/web/app/api/health/db/route.ts` | Smoke test DB | ✓ VERIFIED | Exporta `GET`, retorna 401 sem auth e `{ ok: true, clients_count }` com auth |

### Verificação de Links Chave

| De | Para | Via | Status | Detalhes |
|----|------|-----|--------|---------|
| `middleware.ts` | `lib/supabase/middleware.ts` | `import { updateSession }` | ✓ WIRED | Import presente, `updateSession` chamado na função middleware |
| `app/api/auth/callback/route.ts` | `lib/supabase/server.ts` | `import { createClient }` + `exchangeCodeForSession` | ✓ WIRED | Import e uso presentes |
| `0003_profiles_trigger.sql` | `public.profiles` | `INSERT ... ON CONFLICT DO NOTHING` | ✓ WIRED | Trigger dispara após INSERT em `auth.users`, insere em `public.profiles` |
| `signup/page.tsx` | `lib/supabase/client.ts` | `createClient()` para `signInWithOtp` | ✓ WIRED | Import e chamada de `signInWithOtp` presentes |
| `signup/page.tsx` | `/api/auth/callback` | `emailRedirectTo` | ✓ WIRED | `emailRedirectTo: \`${siteUrl}/api/auth/callback\`` presente |
| `(dashboard)/layout.tsx` | `lib/supabase/server.ts` | `createClient()` para buscar profiles | ✓ WIRED | Import e query `.from('profiles')` presentes |
| `dashboard-header.tsx` | `lib/supabase/client.ts` | `supabase.auth.signOut()` | ✓ WIRED | Import `createClient` e `signOut()` presentes |
| `(dashboard)/layout.tsx` | `app-sidebar.tsx` | `import AppSidebar` | ✓ WIRED | Import e renderização de `<AppSidebar />` presentes |
| `actions/clients.ts` | `lib/supabase/server.ts` | `createClient()` + `getUser()` | ✓ WIRED | Import e 3 chamadas de `getUser()` presentes |
| `client-form.tsx` | `actions/clients.ts` | `action` prop injetada por `novo/page.tsx` | ✓ WIRED | `novo/page.tsx` importa `createClientAction` e passa como prop; `editar/page.tsx` importa e faz `.bind` |
| `delete-client-dialog.tsx` | `actions/clients.ts` | `import { deleteClientAction }` | ✓ WIRED | Import direto e chamada de `deleteClientAction(client.id)` presentes |

### Data-Flow Trace (Level 4)

| Artefato | Variável de Dados | Fonte | Dados Reais | Status |
|----------|-------------------|-------|-------------|--------|
| `(dashboard)/layout.tsx` | `profile.full_name`, `trialEndsAt` | `.from('profiles').select(...).eq('id', user.id).single()` | Sim — query ao DB com filtro por user.id | ✓ FLOWING |
| `dashboard/page.tsx` → `SummaryCards` | `clientsCount` | `.from('clients').select('*', { count: 'exact', head: true })` | Sim — COUNT real do DB via RLS | ✓ FLOWING |
| `clientes/page.tsx` → `ClientsTable` | `clients[]` | `.from('clients').select('*').order('full_name')` | Sim — SELECT real do DB | ✓ FLOWING |
| `summary-cards.tsx` | `clientsCount`, `trialEndsAt`, `subscriptionStatus` | Props recebidas do `dashboard/page.tsx` | Sim — props populadas com dados reais do DB | ✓ FLOWING |

### Spot-Checks Comportamentais

Step 7b: SKIPPED para verificações que requerem runtime (magic link, middleware, DB remoto). Verificações estáticas realizadas:

| Comportamento | Verificação | Resultado | Status |
|---------------|-------------|-----------|--------|
| `getSession` banido em código servidor | `grep -rn "getSession" lib/supabase/ app/(dashboard)/` | 0 resultados | ✓ PASS |
| Vocabulário proibido ausente em auth | `grep -rn diagnóstico\|tratamento\|cura app/(auth)/` | 0 resultados | ✓ PASS |
| Vocabulário proibido ausente em dashboard | `grep -rn diagnóstico\|tratamento\|cura app/(dashboard)/ components/dashboard/` | 0 resultados | ✓ PASS |
| Vocabulário proibido ausente em clientes | `grep -rn diagnóstico\|tratamento\|cura app/(dashboard)/clientes/ components/clientes/` | 0 resultados | ✓ PASS |
| `getUser()` >= 3 vezes em actions/clients.ts | `grep -c "getUser" app/actions/clients.ts` | 3 | ✓ PASS |
| `shouldCreateUser: true` em signup | presente em `signup/page.tsx` | 1 ocorrência | ✓ PASS |
| `shouldCreateUser: false` em login | presente em `login/page.tsx` | 2 ocorrências (schema + options) | ✓ PASS |
| Botão Nova Leitura disabled em /clientes/[id] | `grep -c "disabled" app/(dashboard)/clientes/[id]/page.tsx` | 1 | ✓ PASS |

### Cobertura de Requisitos

| Requisito | Plano | Descrição | Status | Evidência |
|-----------|-------|-----------|--------|-----------|
| AUTH-01 | 02-01, 02-02 | Terapeuta pode se cadastrar via Supabase Auth com e-mail + magic link | ✓ SATISFIED | `signup/page.tsx` com `signInWithOtp` + `shouldCreateUser: true`; callback PKCE implementado |
| AUTH-02 | 02-01, 02-02, 02-03 | Sessão autenticada persiste via middleware Next.js, com redirect para login | ✓ SATISFIED | `middleware.ts` com `PROTECTED_PATHS` + `updateSession`; layout com `redirect('/login')` |
| AUTH-03 | 02-01 | Terapeuta autenticado tem registro em profiles com trial | ✓ SATISFIED (requires human) | Migration `0003_profiles_trigger.sql` com trigger que insere `subscription_status='trial'` e `trial_ends_at = now() + interval '14 days'`; aplicação ao DB remoto requer verificação humana |
| CLIENT-01 | 02-04 | Terapeuta pode criar, listar, editar e ver detalhes dos próprios clientes (CRUD), respeitando RLS | ✓ SATISFIED (requires human) | Server Actions + componentes + páginas implementados; RLS requer verificação no Supabase |
| CLIENT-02 | 02-04 | Cadastro captura full_name, birth_date, gender, notes | ✓ SATISFIED | Schema Zod e `ClientForm` com os 4 campos; `consent_document_url` e `consent_signed_at` na tabela `clients` mas não obrigatórios nesta fase |
| CLIENT-03 | 02-03 | Layout do dashboard com navegação básica entre /dashboard, /clientes e /leituras | ✓ SATISFIED | `AppSidebar` com 3 links + route groups `(dashboard)` com layout compartilhado |

### Anti-Patterns Encontrados

Nenhum anti-pattern bloqueador encontrado.

| Arquivo | Padrão | Severidade | Impacto |
|---------|--------|------------|---------|
| `summary-cards.tsx` | `"Leituras esta semana"` com valor hardcoded `0` | ℹ️ Info | Intencional no MVP — leituras não existem ainda na Fase 2; será substituído na Fase 3+ |
| `(dashboard)/clientes/[id]/page.tsx` | Botão "Nova Leitura" `disabled` | ℹ️ Info | Intencional — placeholder aguardando Fase 3 |
| `leituras/page.tsx` | Página "Em breve" sem conteúdo funcional | ℹ️ Info | Intencional — placeholder documentado no plano como aceitável para Fase 2 |

### Verificação Humana Necessária

#### 1. Fluxo completo de magic link (signup + login)

**Testar:** Acessar `/signup`, preencher e-mail + nome, clicar "Enviar link de acesso". Verificar que o confirmation state aparece (sem redirecionar). Abrir e-mail, clicar no link. Verificar que redireciona para `/dashboard` já autenticado. Repetir para `/login` com e-mail já cadastrado.

**Esperado:** Confirmation state exibido após submit. Link no e-mail leva diretamente para `/dashboard`.

**Por que humano:** Depende de SMTP Resend configurado, e-mail real enviado e clique no link.

#### 2. Trigger on_auth_user_created no banco remoto

**Testar:** No Supabase Dashboard SQL Editor: `select trigger_name, event_object_table from information_schema.triggers where trigger_name = 'on_auth_user_created'`. Após signup, verificar row em `public.profiles` com `subscription_status='trial'`.

**Esperado:** 1 row retornada; novo usuário tem perfil criado automaticamente.

**Por que humano:** Verifica estado do banco Supabase remoto — não verificável localmente sem credenciais de produção.

#### 3. Middleware de proteção de rotas (runtime)

**Testar:** Sem estar logado, acessar `/dashboard`, `/clientes` e `/leituras`. Verificar redirect para `/login`. Logado, acessar `/login` — verificar redirect para `/dashboard`.

**Esperado:** Rotas protegidas redirecionam sem sessão; /login redireciona logado para /dashboard.

**Por que humano:** Comportamento de runtime do Next.js middleware + cookies de sessão — requer browser real.

#### 4. CRUD completo de clientes com persistência

**Testar:** Logado, criar cliente com todos os campos → verificar aparece em `/clientes`. Editar → dados atualizados. Clicar Trash2 → Dialog abre com nome correto → confirmar → cliente removido. Acessar `/clientes/[id]` → verificar botão "Nova Leitura" está disabled.

**Esperado:** Todas as operações persistem no banco; busca por nome filtra a tabela; dialog de exclusão exibe nome do cliente.

**Por que humano:** Fluxo completo de Server Actions + DB + navegação requer ambiente rodando.

#### 5. Dashboard com dados reais do perfil

**Testar:** Logado, acessar `/dashboard`. Verificar: header mostra nome correto do terapeuta; badge "Trial: X dias" exibe dias corretos; card Clientes mostra contagem real.

**Esperado:** Dados do banco refletidos na UI em tempo real.

**Por que humano:** Requer sessão autenticada + dados reais no banco.

#### 6. Isolamento RLS entre terapeutas

**Testar:** Criar dois usuários (Terapeuta A e B). Criar clientes para cada um. Logado como A, verificar que clientes de B não aparecem em `/clientes`. Repetir logado como B.

**Esperado:** Cada terapeuta vê apenas seus próprios clientes.

**Por que humano:** Requer dois usuários cadastrados + verificação de RLS no Supabase Dashboard ou com duas sessões simultâneas.

### Resumo dos Gaps

Nenhum gap bloqueador identificado. Todos os 18 must-haves estão verificados no código.

Os itens marcados como `human_needed` são verificações de runtime que não podem ser realizadas estaticamente:
- Funcionamento do SMTP Resend e fluxo completo do magic link
- Trigger SQL aplicado ao banco Supabase remoto
- Comportamento do middleware no browser
- Persistência real do CRUD
- Isolamento RLS entre terapeutas

O código implementa corretamente todos os padrões necessários para que essas verificações de runtime passem.

---

_Verificado: 2026-05-01T00:00:00Z_
_Verificador: Claude (gsd-verifier)_
