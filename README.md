# Iris Codex

> A íris como mapa do ser.

Plataforma para terapeutas integrativos, clientes finais e curiosos.

> Ferramenta de apoio à anamnese terapêutica integrativa, não substitui avaliação médica.

(Substitui referências anteriores a "Aurel" / "Aurel Iris" — rebrand aplicado em Phase 7.4, decisão D-BR1.)

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
