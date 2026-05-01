# Phase 2: Auth + Dashboard básico - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Terapeuta consegue criar conta, fazer login com magic link, navegar pelo dashboard e gerenciar a própria carteira de clientes.

Concretamente:
- Páginas `/signup` e `/login` com Supabase Auth (e-mail + magic link).
- Middleware Next.js protege rotas do dashboard; sem sessão redireciona para `/login`.
- Registro em `profiles` criado automaticamente via trigger Supabase no signup, com `subscription_status='trial'` e `trial_ends_at = now() + 14 days`.
- Layout de dashboard com sidebar + navegação `/dashboard`, `/clientes`, `/leituras`.
- CRUD completo de clientes (criar, listar, editar, ver detalhe, excluir) respeitando RLS.
- Resend configurado como SMTP custom do Supabase Auth, com template customizado do magic link.

**Fora do escopo desta fase:**
- Captura de imagens, upload, pipeline de visão, RAG, LLM.
- Billing/Stripe (trial começa aqui, cobrança entra na Fase 8).
- LGPD: termo de consentimento por cliente (Fase 8); o campo `consent_signed_at` existe no schema mas não é exigido ainda.
- E-mail transacional além do magic link (recibos, notificações — Fase 8/9).
- Onboarding guiado em 3 passos (Fase 9).
- Tema visual / identidade Aurel Iris (deferido para Fase 9).

</domain>

<decisions>
## Implementation Decisions

### Fluxo Auth
- **D-01:** Páginas separadas: `/signup` (cadastro) e `/login` (retorno). Não é fluxo unificado.
- **D-02:** Signup coleta **e-mail + nome completo** (`full_name`). Dados extras de `profiles` (bio, phone, professional_id, city, state) são opcionais e não bloqueiam o cadastro — ficam para edição futura de perfil.
- **D-03:** Registro em `profiles` criado via **Supabase trigger** em `auth.users` INSERT. Trigger lê `raw_user_meta_data->>'full_name'` passado no `supabase.auth.signUp({ options: { data: { full_name } } })`. Inclui `subscription_status='trial'` e `trial_ends_at = now() + interval '14 days'`. Trigger entra como nova migration Supabase.
- **D-04:** Após clicar no magic link e autenticar → redirect sempre para `/dashboard`.
- **D-05:** Rota `/api/auth/callback/route.ts` trata o callback do magic link (troca code por sessão via `supabase.auth.exchangeCodeForSession`), depois redireciona para `/dashboard`.

### SMTP e Magic Link
- **D-06:** **Resend configurado como SMTP custom do Supabase Auth na Fase 2** (não deferido). Configuração via Supabase Dashboard → Auth → SMTP Settings. Host: `smtp.resend.com`, porta 465, user: `resend`, senha: `RESEND_API_KEY`.
- **D-07:** **Template customizado** do e-mail do magic link — HTML simples com logo/nome Aurel Iris, texto em pt-BR, botão "Entrar no Aurel Iris".
- **D-08:** Remetente: `noreply@mail.soprodaorigem.com` — subdomínio dedicado na Hostinger. DNS verification do domínio no Resend (MX/TXT no subdomínio `mail.soprodaorigem.com`, não interfere no site atual que aponta para Lovable).

### Layout do dashboard
- **D-09:** Navegação por **sidebar lateral** fixa à esquerda. Links: Dashboard / Clientes / Leituras. Em mobile: sidebar colapsa, hamburger no header abre **drawer** via shadcn/ui `Sheet`.
- **D-10:** Header do dashboard: nome do terapeuta (`profiles.full_name`) + avatar com inicial da letra + dropdown com "Sair" (logout). Badge de status do trial ("Trial: X dias restantes") visível no header.
- **D-11:** `/dashboard` principal: **cards de resumo** — total de clientes, leituras esta semana (= 0 na Fase 2, mas componente já existe), status da assinatura.
- **D-12:** `/clientes`: **tabela simples com busca por nome**. Colunas: nome, data de nascimento, última leitura (vazia na Fase 2), ações (ver / editar / excluir). Input de busca client-side no topo.
- **D-13:** `/clientes/[id]`: cabeçalho com dados cadastrais (nome, data nascimento, gênero, notas) + seção "Leituras" (lista vazia com mensagem "Nenhuma leitura ainda" + botão "Nova Leitura" desabilitado/linked para Fase 3).
- **D-14:** Formulário de cadastro/edição de cliente captura: `full_name` (obrigatório), `birth_date`, `gender` (enum: masculino/feminino/outro/não_informado), `notes` (textarea).

### Claude's Discretion
- Tema shadcn/ui: cor base e modo light/dark → usar zinc/slate defaults; identidade visual real fica para Fase 9.
- Spacing, tipografia além do padrão shadcn.
- Implementação exata da busca de clientes (client-side no array já carregado vs. debounce + query).
- Tratamento de erro de e-mail não encontrado no login vs. signup (UX dos estados de erro).
- Loading skeletons e estados intermediários.

</decisions>

<specifics>
## Specific Ideas

- Remetente do magic link: `noreply@mail.soprodaorigem.com` — subdomínio Hostinger separado do site principal.
- Trigger de `profiles` deve ser idempotente (`INSERT ... ON CONFLICT DO NOTHING`) para proteger contra re-disparo acidental.
- `/dashboard` deve mostrar o status do trial de forma visível mas não intrusiva (badge, não modal).
- Botão "Nova Leitura" em `/clientes/[id]` já presente na Fase 2 mas linka para Fase 3 — pode ser disabled com tooltip "em breve" ou simplesmente apontar para `/leituras/nova` (rota que existe mas não está implementada ainda).

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth e schema
- `SPEC.md` §1 — Stack tecnológico (Supabase Auth, magic link, Next.js 15)
- `SPEC.md` §2 — Estrutura de pastas (route groups `(auth)/`, `(dashboard)/`, `lib/supabase/`, `app/api/`)
- `SPEC.md` §3 — Schema do banco (tabela `profiles`, campos de trial, tabela `clients`, RLS policies)
- `SPEC.md` §7 Fase 1 — Roadmap original de Auth + Dashboard (2–3 dias)
- `.planning/REQUIREMENTS.md` — AUTH-01, AUTH-02, AUTH-03, CLIENT-01, CLIENT-02, CLIENT-03

### Projeto e restrições
- `.planning/PROJECT.md` — Restrições LGPD não-negociáveis, vocabulário proibido, copy obrigatória
- `.planning/ROADMAP.md` Fase 2 — Goal, Success Criteria (6 itens)
- `.planning/intel/constraints.md` — 21 constraints sintetizadas; seções de auth, schema e env vars

### Fase anterior
- `.planning/phases/01-setup/01-CONTEXT.md` — Decisões de estrutura de repo, pnpm, região Vercel/Supabase, migrations, env vars (D-01 a D-13)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/components/ui/button.tsx` — shadcn/ui Button (única peça pronta; mais componentes precisam ser adicionados via `pnpm dlx shadcn add`)
- `apps/web/lib/utils.ts` — `cn()` helper (tailwind-merge + clsx)
- `apps/web/types/database.ts` — tipos gerados do Supabase (inclui `profiles`, `clients`, `readings`, etc.)
- `apps/web/app/layout.tsx` — root layout com Geist font, lang="pt-BR"

### Established Patterns
- pnpm como package manager; `apps/web/` como root do Next.js (Vercel Root Directory = `apps/web`)
- Supabase migrations versionadas em `supabase/migrations/`; `supabase gen types typescript` para `types/database.ts`
- Vercel region `gru1`, Supabase `sa-east-1` — server functions e DB co-locados

### Integration Points
- `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (Server Components/Actions), `lib/supabase/middleware.ts` — a serem criados nesta fase
- `middleware.ts` no root de `apps/web/` — protege `/(dashboard)/` e redireciona não-autenticados para `/login`
- `app/api/auth/callback/route.ts` — trata o code exchange do magic link

</code_context>

<deferred>
## Deferred Ideas

- **Tema visual / identidade Aurel Iris** (cor base, modo dark, tipografia) — Fase 9 (Polish). shadcn defaults suficientes para Fases 2–8.
- **Edição de perfil do terapeuta** (bio, phone, professional_id, city/state) — campos existem no schema mas formulário de perfil completo é polish; deferido para Fase 9 ou sprint dedicado.
- **Redirect `?next=` após login** — salvar URL alvo antes de redirecionar para login e devolver o usuário ao destino. Deferido; `/dashboard` fixo é suficiente para o MVP.
- **Rate limiting no envio de magic link** — proteção contra abuse no endpoint de login. Deferido para Fase 8/9 (antes do rollout externo).
- **Avatar upload** (foto de perfil do terapeuta) — deferido para Fase 9.

</deferred>

---

*Phase: 02-auth-dashboard-basico*
*Context gathered: 2026-05-01*
