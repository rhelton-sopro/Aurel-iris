# Phase 1: Setup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 01-setup
**Areas discussed:** Estrutura de repositório, Gestor de pacotes, Região Supabase + Vercel, Migrations do schema

---

## Estrutura de repositório

| Option | Description | Selected |
|--------|-------------|----------|
| Pasta no mesmo repo (monorepo) | Recomendado pra MVP solo. `vision-service/` como subdir do repositório Next.js. Um único git history, deploys independentes (Vercel ignora `vision-service/`, Modal ignora o resto). Menos overhead de credenciais e PRs cross-repo. | ✓ |
| Repo Git separado | Como descrito no SPEC §2 ("repositório separado (Modal)"). Isolamento completo, melhor se vários devs ou se vision-service virar produto independente. Custa: 2 repos pra clonar, 2 sets de credenciais Modal/Anthropic, sync de tipos manual. | |
| Você decide | Claude escolhe baseado nas restrições do projeto. | |

**User's choice:** Pasta no mesmo repo (monorepo)
**Notes:** Sobreposição deliberada ao SPEC §2 — solo dev no MVP, overhead de 2 repos não compensa. `apps/web/` + `vision-service/` como subdirs.

---

## Gestor de pacotes

| Option | Description | Selected |
|--------|-------------|----------|
| pnpm (Recomendado) | Rápido, lockfile determinístico, content-addressable store (economiza disco). Suporte nativo a workspaces se quiser separar `apps/web` e `packages/shared` no futuro. Vercel detecta automaticamente. | ✓ |
| npm | Default do Next.js, zero configuração, já vem com Node. Mais lento e lockfile maior, mas zero surpresas. | |
| bun | Mais rápido que pnpm em install. Runtime alternativo. Vercel suporta. Risco: mais novo, alguns pacotes podem ter quirks. | |
| Você decide | Claude escolhe. | |

**User's choice:** pnpm
**Notes:** —

---

## Região Supabase + Vercel

### Sub-questão 1: Região Supabase

| Option | Description | Selected |
|--------|-------------|----------|
| sa-east-1 (São Paulo) — Recomendado | Latência menor pra usuário brasileiro (captura mobile + upload). Dados biométricos residem em território nacional, reforça postura LGPD. Penalidade: latency extra ao chamar Modal (default us-east) e Anthropic — mas são chamadas server-to-server, não no caminho crítico do usuário. | ✓ |
| us-east-1 (N. Virginia) | Mesma região que Vercel default, Modal default, Anthropic. Ligações server-to-server mais rápidas. Custa: latência maior em upload de foto pelo terapeuta brasileiro, e dado biométrico cruza fronteira (LGPD permite mas exige cláusulas específicas no termo). | |
| Você decide | Claude recomenda baseado nas restrições. | |

**User's choice:** sa-east-1 (São Paulo)

### Sub-questão 2: Região Vercel

| Option | Description | Selected |
|--------|-------------|----------|
| gru1 (São Paulo) — Recomendado | Casa com Supabase sa-east-1: API routes do Next falam com o DB sem cruzar continente. Disponibilizada também em Vercel Pro. | ✓ |
| iad1 (default global) | Default da Vercel. Funciona, mas cada chamada API → Supabase atravessa ~120-150ms vs ~5ms na mesma região. | |
| Edge runtime (multi-região) | Routes rodam próximo do usuário. Bom pra rotas estáticas/públicas, ruim quando precisa falar com Supabase — conexões Postgres não funcionam bem em edge sem connection pooler. | |

**User's choice:** gru1 (São Paulo)
**Notes:** Decisão integrada — Supabase sa-east-1 + Vercel gru1 minimiza latência intra-região e mantém dados em território nacional.

---

## Migrations do schema

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase CLI com migrations versionadas — Recomendado | `supabase init` cria `supabase/migrations/` versionadas em git. Cada alteração é um arquivo SQL timestamped. Aplica em prod via `supabase db push`. Custa ~30min de setup mas trava tudo: rollback possível, deltas auditados, `db.types.ts` gerado automaticamente. | ✓ |
| SQL ad-hoc no dashboard Supabase | Cola o SQL do SPEC §3 no SQL Editor e roda. Rápido (5min). Custa: nenhuma rastreabilidade, qualquer mudança futura tem que ser re-executada manualmente em cada ambiente, sem rollback estruturado. | |
| Drizzle ORM + Drizzle Kit | TypeScript-first, schema em código TS, gera migrations. Bom DX se você já conhece. Custa: ferramenta a mais, e ORM dispensa pgvector helpers — você ainda precisa de SQL raw pro índice HNSW e políticas RLS. | |

**User's choice:** Supabase CLI com migrations versionadas
**Notes:** —

---

## Claude's Discretion

- Convenção de nome de branches git, formato de mensagens de commit.
- Configuração ESLint/Prettier além do default `create-next-app`.
- Escolha entre `.nvmrc` vs `engines` no `package.json`.
- Migration inicial monolítica vs splittada por tópico.
- Formato exato do teste cross-terapeuta (SQL vs TS).
- Se Husky/lint-staged entram na Fase 1 ou ficam pra fase posterior.
- Comandos `pnpm` exatos (scripts top-level no `package.json`).

## Deferred Ideas

- **Tema shadcn/ui (base color, modo light/dark, tipografia)** — UI não aparece na Fase 1; tema entra na Fase 2 ou via `/gsd-ui-phase 2`.
- **Configuração de Resend como SMTP custom no Supabase Auth** — entra na Fase 2 (Auth) ou Fase 8 (e-mail transacional).
- **Setup de CI/GitHub Actions além do default Vercel/Modal** — overhead sem test suite real ainda; reavaliar Fase 2+.
- **Domínio custom + DNS** — pré-PMF, deferido até depois do gate de Estágio 1.
- **`pnpm-workspace.yaml` formal** — promover a workspace só quando surgir primeiro `packages/shared/`.
- **Sentry / PostHog / observabilidade** — sem usuários reais; reavaliar perto do gate de Estágio 1.
