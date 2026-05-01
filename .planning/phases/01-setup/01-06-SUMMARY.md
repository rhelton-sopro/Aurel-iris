---
phase: 01-setup
plan: 06
status: COMPLETE
subsystem: infra-deploy

tags: [vercel, env-vars, lgpd, deploy, gru1, monorepo]

requires:
  - phase: 01-setup/04
    provides: "Schema Supabase aplicado no remoto + types gerados"
provides:
  - ".env.example no root com 11 chaves D-11 (todas vazias)"
  - "apps/web/.env.local.example mirror para Next.js dev"
  - "vercel.json com regions=gru1 + framework=nextjs"
  - "Projeto Vercel 'aurel-iris-web' criado e linkado a github.com/rhelton-sopro/Aurel-iris"
  - "3 envs Supabase reais cadastradas em Production/Preview/Development no Vercel dashboard"
  - "Deploy production em https://aurel-iris-web.vercel.app/ — HTTP 200, página 'Aurel Iris' renderizada com disclaimer LGPD-compliant"
affects: [02-auth-dashboard, todas-fases-com-deploy-publico]

tech-stack:
  added:
    - "Vercel project (org sopro-da-origem) com Root Directory auto-detected = apps/web"
    - "Domain padrão Vercel: aurel-iris-web.vercel.app (Production)"
  patterns:
    - "Monorepo Vercel: Root Directory = apps/web/, mas installCommand 'pnpm install --frozen-lockfile' walks up automaticamente para o workspace root via pnpm"
    - "buildCommand 'pnpm --filter web build' explicita pra Vercel construir apenas o package web"
    - "outputDirectory '.next' (relativo ao Root Directory apps/web) — auto-detect falhou porque dashboard cached o valor inicial 'apps/web/.next' que duplicava o path"

key-files:
  created:
    - .env.example
    - apps/web/.env.local.example
    - vercel.json
    - .env.local (gitignored — para dev local com envs Supabase reais)
    - apps/web/.env.local (gitignored — mirror)
  modified:
    - apps/web/.gitignore (whitelist .env*.example)

key-decisions:
  - id: "Root Directory = apps/web (auto-detected pela Vercel)"
    decision: "Vercel UI auto-detectou apps/web como Root Directory na importação inicial. Aceito — funciona com pnpm walking up para workspace root para install."
    why: "Reverter para Root Directory='.' exigiria editar config no dashboard. Aceitar o auto-detect simplifica o setup; a única consequência é que outputDirectory precisa ser '.next' (relativo ao apps/web) em vez de 'apps/web/.next'."
  - id: "Sem ignoreCommand (deferido)"
    decision: "Removido ignoreCommand do vercel.json. Quebrava no primeiro deploy por shallow clone (HEAD^ não existe)."
    why: "Otimização (skip build quando só vision-service mudou) não é crítica em Fase 1 com volume baixo de commits. Reintroduzir em fase futura via 'git.deploymentEnabled' do vercel.json (suportado nativamente pela Vercel) ou ignoreCommand com fallback para HEAD^ ausente."

verification:
  - check: ".env.example contém exatamente 11 chaves D-11 (regex ^[A-Z][A-Z0-9_]+= match)"
    result: PASS
  - check: ".env.example não tem nenhum valor preenchido"
    result: PASS
  - check: "vercel.json é JSON válido + contém 'gru1' + 'nextjs'"
    result: PASS
  - check: "Vocabulário proibido (diagnóstico|tratamento|cura) ausente em .env.example, vercel.json"
    result: PASS
  - check: "Vercel deploy production retorna HTTP 200 em /"
    result: PASS
  - check: "Página renderiza 'Aurel Iris' (h1) + 'Ferramenta de apoio à anamnese terapêutica integrativa' + 'Não substitui avaliação médica'"
    result: PASS
  - check: "lang='pt-BR' no <html>"
    result: PASS

commit-hashes:
  - bfc1bde (Task 1 inicial: .env.example + vercel.json + apps/web/.env.local.example)
  - d986214 (fix: remove ignoreCommand)
  - 7e46240 (chore: trigger fresh deploy)
  - 1d9a57b (fix: remove outputDirectory tentativa de auto-detect)
  - 4544968 (fix: outputDirectory '.next' relativo ao apps/web)

requirements-covered:
  - SETUP-02 (envs estruturadas + projeto Vercel + deploy preview/production funcionando)

duration-minutes: ~25 (incluindo 3 iterações de fix do vercel.json até o deploy passar)
---

# Plan 01-06 — Vercel deploy + envs

## What was built

Estrutura completa de variáveis de ambiente (D-10/D-11) versionada via templates `.env.example` (root) e `apps/web/.env.local.example` (mirror para Next.js dev). Todos os 11 envs do D-11 listados, todos vazios — cada bloco anota em qual fase a env é consumida (Phase 1 já consome as 3 do Supabase; demais permanecem vazias até a fase respectiva).

Configuração `vercel.json` com `regions: ["gru1"]` (D-06 — São Paulo, casa com Supabase sa-east-1), `framework: nextjs`, `buildCommand: pnpm --filter web build`, `outputDirectory: .next`.

Deploy production funcionando em **https://aurel-iris-web.vercel.app/** — HTTP 200, página "Aurel Iris" renderizada com disclaimer LGPD-compliant.

## Devíos executados (3 iterações)

Build da Vercel falhou em sequência com 3 problemas distintos, todos resolvidos:

1. **`ignoreCommand` quebrava no primeiro deploy:** `git diff --quiet HEAD^ HEAD ./apps/web ...` falhou com `fatal: ambiguous argument` porque Vercel faz shallow clone (depth=1) — HEAD^ não existe. Fix: removido `ignoreCommand` (commit `d986214`).

2. **Vercel cacheava commit antigo:** Após push do fix, dashboard continuava builando 887c831 (com ignoreCommand). Fix: empty commit `chore: trigger fresh deploy` (`7e46240`) forçou webhook fresco.

3. **`outputDirectory` duplicava path:** Vercel auto-detectou Root Directory = `apps/web` na importação UI. Com `outputDirectory: "apps/web/.next"`, resolução virou `apps/web/apps/web/.next` (path duplicado). Tentei remover (`1d9a57b`) mas dashboard cacheava `apps/web/.next` como override. Fix: setar explicitamente `outputDirectory: ".next"` no vercel.json (commit `4544968`) — sobrescreve cache do dashboard.

## Como reproduzir o deploy

```bash
# 1. Login Vercel (uma vez)
vercel login

# 2. Push para main dispara redeploy automático via GitHub integration

# 3. Validar deploy
curl -I https://aurel-iris-web.vercel.app/
# Esperado: HTTP/1.1 200 OK

curl -s https://aurel-iris-web.vercel.app/ | grep -E "Aurel Iris|apoio à anamnese"
# Esperado: matches em <title>, <h1>, e meta description
```

## Connection string e segurança

A senha do Supabase (`AurelIris123`) foi colada no chat durante o execute-phase para rodar o teste RLS local (plan 01-05). **Recomendação:** rotacionar antes de qualquer dogfooding real (Estágio 1 do PROJECT.md métrica de sucesso). Steps:

1. Supabase Dashboard → Settings → Database → Reset Database Password
2. Atualizar `.env.local` (root e apps/web) com a nova senha
3. Vercel Dashboard → Settings → Environment Variables — atualizar `SUPABASE_SERVICE_ROLE_KEY` se rotacionado também

## Próximo passo

Fase 2 — Auth + Dashboard básico. Cliente Supabase precisa ser instalado em apps/web e wired pra magic link (`@supabase/supabase-js` + `@supabase/ssr`). O critério deferido pra Fase 2 (`/api/health/db` retorna 200 com `count(*) from clients` da sessão autenticada) será exercido lá.
