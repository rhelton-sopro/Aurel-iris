# Aurel Iris

SaaS de leitura iridológica assistida por IA para terapeutas integrativos.

> Ferramenta de apoio à anamnese terapêutica integrativa, não substitui avaliação médica.

## Estrutura do monorepo

- `apps/web/` — Next.js 15 (App Router, TypeScript, Tailwind, shadcn/ui).
- `vision-service/` — Pipeline de visão computacional Python (Modal serverless GPU).
- `supabase/` — Migrations versionadas e tests SQL do schema Postgres + pgvector.

## Setup local

Pré-requisitos: Node 20+ (ver `.nvmrc`), `pnpm@10+`, `supabase` CLI.

```bash
pnpm install
pnpm dev
```

Detalhes em cada subdiretório.

## Stack

Ver `.planning/PROJECT.md` (Restrições — Stack) e `SPEC.md` §1.
