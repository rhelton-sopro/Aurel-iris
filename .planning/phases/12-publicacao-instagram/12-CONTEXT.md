# Phase 12: publicacao-instagram - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

O conteúdo **aprovado e agendado** no painel `/admin/painel` é publicado **automaticamente** no Instagram do founder (carrossel + reel), de ponta a ponta, via Meta Content Publishing API — idempotente, com falhas visíveis e re-tentáveis. Inclui também um disparo **manual ("publicar agora")** no painel para forçar publicação imediata. Mídias lidas das URLs públicas (iriscodex.com/...).

**Fora de escopo (outras fases):** cockpit/timeline polido do painel (Fase 13); métricas/insights e loop de dados (Fase 14).

</domain>

<decisions>
## Implementation Decisions

### Cadência & disparo (IGPUB-02)
- **D-01:** Cron no Vercel roda **de hora em hora**. Varre posts `agendado` com `scheduled_at` vencido e publica na passada seguinte (atraso de até ~1h é aceitável).
- **D-02:** Publicação **idempotente** — rodar o cron duas vezes NÃO republica um post já `publicado` (lock/checagem de estado antes de disparar).

### Falha & re-tentativa (IGPUB-06)
- **D-03:** Em falha, **re-tenta automaticamente nas próximas 2 passadas** do cron (≈ até 2h). Persistindo após as re-tentativas, o post **NÃO entra em `publicado`**, fica marcado com erro e o **motivo** é gravado.
- **D-04:** Erros ficam **visíveis na central de notificações do `/admin`** (reaproveitar a infra de notificações existente — `getAdminNotifications`), de onde o founder **reenfileira** manualmente.
- **D-05 (discrição):** Sucesso é **silencioso** — sem notificação; apenas marca `publicado` + grava permalink/ID do post (IGPUB-06). Só falha alerta.

### Token / conexão Meta (IGPUB-01)
- **D-06:** Token de longa duração (~60 dias) com **refresh AUTOMÁTICO** antes de expirar + **health-check** periódico da conexão (token válido + IG Business Account ID em env Vercel).
- **D-07:** **Alerta no `/admin` apenas em falha** de health-check/refresh. Objetivo: o founder quase nunca precisa intervir no token.

### "Publicar agora" (escopo desta fase)
- **D-08:** Incluir um **botão "publicar agora"** no painel já na Fase 12 — força a publicação imediata de um post aprovado/agendado, **reaproveitando o mesmo caminho de publicação do cron**. Serve como validação end-to-end sem esperar a passada horária. (A UI mais rica de status fica pra Fase 13.)

### Claude's Discretion
- Estrutura do endpoint do cron, layout das env vars (IG Business Account ID, token, app secret), poll de status do container do reel, schema do registro de erro/permalink no `social_posts`, mecânica do lock de idempotência — research/planner decidem.
- Sucesso silencioso (D-05).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requisitos
- `.planning/ROADMAP.md` (seção "Fase 12: Publicacao Instagram") — goal + 6 critérios de sucesso + dependências.
- `.planning/REQUIREMENTS.md` — requisitos IGPUB-01..06 (texto canônico).

### Infra existente a reaproveitar
- `supabase/migrations/0045_social_posts.sql` — tabela `social_posts`: máquina de estados `pendente→aprovado→agendado→publicado→reprovado`, `scheduled_at`, `media` (carrossel/reel/post).
- `apps/web/lib/admin/social-posts.ts` — lib de acesso à fila.
- `apps/web/app/admin/painel/actions.ts` — server actions do painel (inclui `scheduleAction`).
- `apps/web/lib/admin/notifications-summary.ts` — central de notificações do `/admin` (`getAdminNotifications`) — superfície onde o erro de publicação deve aparecer (D-04).
- `apps/web/lib/supabase/service.ts` — `createServiceClient()` (RLS-bypass) para o job server-side do cron.

### API externa (a pesquisa funda acontece no plan-phase)
- Meta **Instagram Content Publishing API** — fluxo container→media_publish; carrossel (containers por slide → container do carrossel → publish); reel (container de vídeo 9:16 H.264 → poll de status → publish); long-lived token + refresh; permissão `instagram_business_content_publish`. A Fase 12 (research) deve fixar a variante de login correta (IG Login vs FB Login) e os passos exatos de app/token para o homework do founder.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`social_posts` (migration 0045):** estados + `scheduled_at` + `media` já existem — o motor só adiciona a transição `agendado→publicado/erro` + campos de permalink/erro.
- **Central de notificações `/admin`** (`getAdminNotifications` + cards em `app/admin/page.tsx`): reusar pra expor falhas de publicação (D-04).
- **`createServiceClient()`** (`lib/supabase/service.ts`): o cron roda server-side e precisa bypassar RLS.

### Established Patterns
- **Cron no Vercel** (config em `vercel.json`/`vercel.ts`) → rota server-side `runtime = 'nodejs'`.
- **Env no Vercel = todas Sensitive** (`env pull` é cego — `echo` pra `env add`).
- **Deploy = `git push` na main** (Vercel auto-deploy).

### Integration Points
- Mídias servidas das **URLs públicas** (`apps/web/public/...` → `iriscodex.com/...`) — a Meta API lê os assets por URL pública.
- A dupla-aprovação (Nefertiti + founder) já governa o que chega em `agendado`; o motor publica só o que está `agendado` e vencido.

</code_context>

<specifics>
## Specific Ideas

- **Uma conta só** — o Instagram do founder, em **dev mode** (SEM App Review). App Review só seria necessário pra publicar em contas de terceiros.
- **Gargalo externo (homework do founder):** converter o IG para **Professional/Business** + criar/vincular uma **Página do Facebook**, depois criar o app Meta + gerar o token de longa duração. A pesquisa da Fase 12 deve devolver os passos exatos. Sem isso a publicação não roda (mas plano/pesquisa rodam sem).

</specifics>

<deferred>
## Deferred Ideas

- **Cockpit do painel** (timeline da fila, status de publicação por post, UI rica de reenfileiramento, agendar na régua de composição) → **Fase 13** (COCKPIT-01..03).
- **Loop de dados / Insights API** (saves/alcance/não-seguidor/watch-time → pauta) → **Fase 14** (DATA-01..03; exige `instagram_manage_insights`).
- **Multi-conta / publicar em contas de terceiros** (exigiria App Review) — fora do milestone v1.1.

</deferred>

---

*Phase: 12-publicacao-instagram*
*Context gathered: 2026-06-21*
