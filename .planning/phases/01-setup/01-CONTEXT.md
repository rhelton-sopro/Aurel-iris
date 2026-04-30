# Phase 1: Setup - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Ambiente operacional pronto para que as fases subsequentes (Auth, Captura, Vision, RAG, LLM, Billing, LGPD, Polish) possam ser implementadas sem retrabalho de infraestrutura. Concretamente:

- Repositório git inicializado com estrutura de monorepo (`apps/web/` Next.js + `vision-service/` Python).
- Projeto Next.js 15 (App Router, TypeScript, Tailwind, shadcn/ui) instalado, rodando local (`pnpm dev`) e deployado em preview na Vercel (região `gru1`).
- Projeto Supabase provisionado em `sa-east-1` (São Paulo), com `pgvector` habilitado, schema completo do SPEC §3 aplicado via Supabase CLI (migrations versionadas em `supabase/migrations/`), índice HNSW em `knowledge_chunks(embedding) vector_cosine_ops`, e RLS habilitada nas tabelas sensíveis com policies-base do SPEC §3.
- Variáveis de ambiente para Vercel, Supabase, Anthropic, Voyage, Modal, Stripe e Resend cadastradas em `.env.local` e em "Vercel → Environment Variables" (mesmo que vazias para serviços que entram só em fases posteriores).
- Teste E2E mínimo demonstrando: (a) `pnpm dev` levanta o app; (b) cliente Supabase autenticado consegue `select 0 from clients`; (c) tentativa cross-terapeuta com dois `auth.uid()` distintos é bloqueada por RLS; (d) insert dummy de `vector(1024)` em `knowledge_chunks` aceito.

**Fora do escopo desta fase:**
- Qualquer página de UI além das default geradas pelo `create-next-app`.
- Lógica de auth do usuário final (Fase 2).
- Captura, upload, vision pipeline, RAG, LLM, billing, LGPD ToS — tudo Fase 2+.
- Setup de domínio custom, e-mail SMTP, monitoramento (deferido até haver tráfego real).

</domain>

<decisions>
## Implementation Decisions

### Estrutura de repositório
- **D-01:** Monorepo único. Estrutura: `apps/web/` (Next.js) e `vision-service/` (Python/Modal) como subdirs do mesmo repo git. SPEC §2 menciona "repositório separado (Modal)" — esta decisão sobrepõe deliberadamente: solo dev no MVP, overhead de 2 repos não compensa. Vercel ignora `vision-service/` via `.vercelignore`/`ignoreCommand`; Modal só observa seu próprio subdir.
- **D-02:** Root do repo contém configuração compartilhada (git, README, `.env.example`, eventual `pnpm-workspace.yaml` se virar workspace). `apps/web/` tem seu próprio `package.json` com escopo Next.js; `vision-service/` tem seu próprio `requirements.txt`.

### Gestor de pacotes
- **D-03:** `pnpm` para o lado TypeScript/Next.js. Lockfile `pnpm-lock.yaml` versionado. Vercel detecta e usa `pnpm install` automaticamente.
- **D-04:** Versão do Node travada via `.nvmrc` ou `engines` em `package.json` — versão LTS atual (Node 20+). Decisão final do exec: planner pode escolher entre `.nvmrc` e `engines` baseado em convenção pnpm.

### Hospedagem e regiões
- **D-05:** Projeto Supabase em **`sa-east-1` (São Paulo)**. Justificativas: (a) latência de upload de fotos pelo terapeuta brasileiro; (b) dados biométricos sensíveis residem em território nacional, reforçando postura LGPD do PROJECT.md "Restrições não-negociáveis"; (c) chamadas server-to-server pra Modal/Anthropic/Voyage estão fora do caminho crítico do usuário (são background async no pipeline de visão e LLM).
- **D-06:** Vercel functions em **`gru1` (São Paulo)** para casar com Supabase sa-east-1. Connections Postgres ficam intra-região (~5ms vs ~120ms cruzando continente). Configurado em `vercel.json` `regions: ["gru1"]` ou nas configurações do projeto. Edge runtime **não** usado em rotas que acessam o DB (Postgres pooler em edge é frágil).

### Schema e migrations
- **D-07:** Supabase CLI com migrations versionadas em `supabase/migrations/` (timestamped SQL files). Aplicação local via `supabase db reset` / `supabase db push` para o projeto remoto. Cada alteração futura de schema entra como nova migration; nenhum SQL ad-hoc no dashboard exceto debugging temporário.
- **D-08:** Migration inicial cobre tudo do SPEC §3 num único arquivo `0001_initial_schema.sql` (ou splittado em ordem dependente — planner decide entre monolito vs `0001_extensions.sql` / `0002_tables.sql` / `0003_indexes.sql` / `0004_rls.sql`). Ambas formas são aceitáveis; restrição é apenas que tudo do SPEC §3 esteja aplicado e versionado.
- **D-09:** Tipos do banco gerados via `supabase gen types typescript` para `apps/web/types/database.ts` (SPEC §2 já lista esse arquivo como `gerado pelo Supabase`). Esse passo entra como script `pnpm gen:types` para repetibilidade.

### Variáveis de ambiente
- **D-10:** `.env.example` no root commitado com todas as chaves listadas (sem valores). Cada terapeuta/dev preenche `.env.local` baseado nele. Chaves de produção/preview entram diretamente em "Vercel → Environment Variables" no dashboard, não em arquivos.
- **D-11:** Categorias mínimas de envs (mesmo que vazias para serviços ainda não usados): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`, `MODAL_WEBHOOK_SECRET` (HMAC SPEC §7 Fase 4), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`. Detalhamento completo em `.planning/intel/constraints.md`.

### RLS e teste cross-terapeuta
- **D-12:** Migration aplica policies do SPEC §3 verbatim para `clients`, `readings`, `reading_images`, `subscriptions` (`auth.uid() = therapist_id`) e a policy de leitura autenticada para `knowledge_chunks`. Cobertura inclui também `profiles` (cada usuário só vê o próprio profile).
- **D-13:** Critério de aceite da fase inclui um teste — pode ser script SQL versionado em `supabase/tests/` ou um teste em `apps/web/` rodando contra Supabase local — que: (a) cria 2 perfis de terapeuta dummy; (b) cria 1 cliente para cada; (c) tenta `select` cross-terapeuta usando `set local role` ou JWT impersonation; (d) confirma 0 rows retornadas. Sem esse teste, RLS pode estar configurada mas não verificada.

### Claude's Discretion
- Convenção de nome de branches git, formato de mensagens de commit, configuração ESLint/Prettier além do default `create-next-app`, escolha entre `.nvmrc` vs `engines`, escolha entre migration monolítica vs splittada, formato exato do teste cross-terapeuta (SQL vs TS), e se Husky/lint-staged entram nesta fase. Planner decide.
- Setup de Sentry/PostHog/observabilidade — não pedido no SPEC para Fase 0, deferido.
- Comandos `pnpm` "scripts top-level" (`pnpm dev`, `pnpm build`, `pnpm gen:types`, `pnpm test`) — convenção padrão do create-next-app + 1-2 customizações; planner detalha.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Especificação fonte
- `SPEC.md` §1 — Stack tecnológico (justificativas das escolhas Next.js/Supabase/Modal/Sonnet/Voyage/Stripe/Resend)
- `SPEC.md` §2 — Estrutura de pastas (referência para layout `apps/web/` + `vision-service/`)
- `SPEC.md` §3 — Schema do banco (SQL canônico para migration inicial: extensão pgvector, 6 tabelas, índices, policies RLS)
- `SPEC.md` §7 Fase 0 — Roadmap de Setup original (1-2 dias)

### Contexto do projeto
- `.planning/PROJECT.md` — Restrições LGPD não-negociáveis (residência de dados biométricos), métrica de sucesso dogfooding-first
- `.planning/REQUIREMENTS.md` — SETUP-01..04 (requisitos da fase)
- `.planning/ROADMAP.md` Fase 1 — Goal, Depends on (nada), Success Criteria
- `.planning/intel/constraints.md` — 21 constraints sintetizadas (api-contracts, schema, protocols, NFRs); especialmente seções de schema, env vars e protocols

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Nenhum — repositório novo. SPEC.md é o único artefato pré-existente.

### Established Patterns
- Convenção pnpm + Next.js 15 App Router (sem patterns customizados ainda).
- Convenção Supabase CLI (`supabase/migrations/` timestamped, gerador de types).

### Integration Points
- Esta fase **não integra** com nada externo ainda (Modal, Anthropic, Voyage, Stripe, Resend ficam apenas como envs vazias). Apenas Vercel ↔ Supabase é exercitado E2E.

</code_context>

<specifics>
## Specific Ideas

- Layout de pastas conforme SPEC §2 deve ser respeitado quando aplicável (pastas tipo `app/(dashboard)/`, `lib/supabase/`, `prompts/`, `types/`, etc.) — mesmo que muitas fiquem vazias na Fase 1, as fases seguintes preenchem.
- Naming convention das tabelas e colunas: **verbatim do SPEC §3** (`profiles`, `clients`, `readings`, `reading_images`, `knowledge_chunks`, `subscriptions`). Não inventar variantes.
- Disclaimer estrutural do produto não aparece em UI nesta fase (sem UI), mas mantenha a postura: nenhuma string commitada nesta fase pode usar "diagnóstico", "tratamento", "cura". Restrição cultural/jurídica vale desde já.

</specifics>

<deferred>
## Deferred Ideas

- **Tema shadcn/ui (base color, modo light/dark, tipografia da identidade Aurel)** — UI não aparece na Fase 1; tema entra na Fase 2 (`UI hint: yes` no ROADMAP) ou via `/gsd-ui-phase 2`. Para Fase 1, instalar shadcn/ui com defaults é suficiente.
- **Configuração de Resend como SMTP custom no Supabase Auth** — magic link em produção precisa SMTP custom. Decisão entra na Fase 2 (Auth) ou Fase 8 (e-mail transacional Resend), não aqui.
- **Setup de CI/GitHub Actions além do que Vercel/Modal fazem por default** — não pedido pela Fase 1 e adicionar agora é overhead. Reavaliar quando houver test suite real (Fase 2+).
- **Configuração de domínio custom + DNS** — pré-PMF, deferido até depois do gate de Estágio 1 do dogfooding.
- **Workspaces pnpm (`pnpm-workspace.yaml` formal com `apps/*` + `packages/*`)** — só faz sentido se aparecer pacote compartilhado. Por enquanto, dois subdirs independentes (`apps/web/` e `vision-service/`) sem `pnpm-workspace.yaml`. Promover a workspace na fase em que surgir o primeiro `packages/shared/`.
- **Sentry / PostHog / observabilidade** — sem usuários reais ainda; reavaliar perto do gate de Estágio 1 do dogfooding.

</deferred>

---

*Phase: 01-setup*
*Context gathered: 2026-04-30*
