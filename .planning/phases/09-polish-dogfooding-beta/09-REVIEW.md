---
phase: 09-polish-dogfooding-beta
status: clean
findings_critical: 0
findings_high: 0
findings_medium: 0
findings_low: 0
reviewer: gsd-code-reviewer (sonnet)
reviewed_at: 2026-05-26
fixed_by: gsd-code-fixer (sonnet)
fixed_at: 2026-05-26
---

# Code Review — Fase 9 (Polish + dogfooding + beta)

## Summary

8 arquivos revisados cobrindo migration SQL, server action de onboarding, componente RSC wizard, dashboard page, módulo de notificação por e-mail, hook no analyze route, módulo de dogfooding e página admin de relatórios. Nenhum CRITICAL (sem data loss, sem autentication bypass). 1 HIGH: `therapistName` interpolado sem `escapeHtml` no HTML body do e-mail (inconsistência com o `clientName` que é corretamente escapado). 2 MEDIUM: `weeksElapsed` usa `Math.ceil` em vez de `Math.floor` (exibe "2 semanas" no dia 8, não no dia 14) + coluna `full_name` ausente no SELECT do profile no dashboard (causa `therapistName` sempre null no módulo de notificação, tornando o greeting sempre "Olá" sem nome). 3 LOW: nitpicks de código.

---

## Findings

### HIGH — Fix before merge OR document risk acceptance

#### H-01: `therapistName` não é HTML-escaped no HTML body do e-mail

**File:** `apps/web/lib/notifications/notify-report-ready.ts:60,83`

**Issue:** `clientName` é corretamente protegido com `escapeHtml()` na linha 84, mas `therapistName` (linha 59–60) é interpolado diretamente como `${greeting},` no HTML body (linha 83), sem escaping. Se um terapeuta cadastrar `full_name` contendo `<script>alert(1)</script>`, o conteúdo será injetado no HTML do e-mail. Embora email clients modernos sanitizem scripts, o HTML estrutural pode ser quebrado por valores como `</p><img src=x onerror=...>`.

O dado vem de `profiles.full_name` — campo editável pelo próprio terapeuta via `/perfil/completar`. O vetor é interno (terapeuta só se faz mal a si mesmo no cenário B2B atual), mas o escapeHtml já existe no mesmo arquivo, então não escalar é uma inconsistência defensiva.

**Fix:**
```typescript
// Linha 60 — applique escapeHtml:
const greeting = therapistName ? `Olá, ${escapeHtml(therapistName)}` : 'Olá'
```

Note: `escapeHtml` é uma função privada do módulo, disponível na mesma linha de código.

---

### MEDIUM — Fix in follow-up

#### M-01: `full_name` ausente no SELECT do profile em `dashboard/page.tsx` — greeting de notificação é sempre "Olá" sem nome

**File:** `apps/web/app/(dashboard)/dashboard/page.tsx:29–31`

**Issue:** O SELECT do profile na dashboard não inclui `full_name`:

```typescript
.select(
  'subscription_status, trial_ends_at, beta_readings_used, phone, specialties, tos_accepted_at, onboarding_dismissed_at',
)
```

Isso não causa crash (é uma página separada da notificação), mas revela que `notify-report-ready.ts` depende de uma query própria em `profiles` (linha 45) para obter `full_name` do terapeuta via `svc.from('profiles').select('full_name')`. Essa query funciona independentemente do dashboard.

O problema é diferente: o SELECT do dashboard não expõe `full_name`, então se qualquer código downstream do dashboard precisar do nome do terapeuta para exibição, ele teria que re-buscar. Mais importante: o módulo `notify-report-ready.ts` faz sua própria query paralela de `full_name` — o que está correto — mas se essa query falhar silenciosamente (profile retorna null em vez de erro), `therapistName` será `''` e o greeting fica genérico `'Olá'` sem o nome. O `maybeSingle()` na linha 45 não verifica `error`, apenas `data`.

**Fix para notify-report-ready.ts — verificar o error do profile query:**
```typescript
const [{ data: reading }, { data: profile, error: profileErr }, authResult] = 
  await Promise.all([...])

if (profileErr) {
  console.warn(`[notify-report] erro ao buscar profile ${therapistId}:`, profileErr.message)
}
// profile null é ok (greeting vira 'Olá') — mas o log ajuda no debug
```

Isso não é um blocker porque greeting genérico é aceitável (terapeuta recebe o e-mail de qualquer forma), mas o erro silencioso do Supabase se passa desapercebido.

#### M-02: `weeksElapsed` usa `Math.ceil` — inflaciona em ~1 semana no início do dogfooding

**File:** `apps/web/lib/admin/dogfooding.ts:65–68`

**Issue:**

```typescript
const weeksElapsed = Math.max(
  0,
  Math.ceil((today.getTime() - startDateObj.getTime()) / (7 * 24 * 60 * 60 * 1000)),
)
```

`Math.ceil` arredonda pra cima: no dia 1 (24h após start) já mostra `weeksElapsed = 1`. Na prática, hoje (2026-05-26, 11 dias após 2026-05-15) mostra `2` semanas quando intuitivamente seria `1` semana completa e alguns dias. O UI exibe este número literalmente em "Semanas decorridas: X".

A inconsistência é entre `weeksElapsed` (arredondado pra cima, ~display only) e o bucketing real por semana ISO (que conta apenas semanas onde houve readings). Se o founder olha "Semanas decorridas: 2" mas o histórico semanal mostra apenas 1 linha qualifying, a discrepância causa confusão sobre o progresso.

`Math.floor` seria mais fiel: "quantas semanas completas se passaram".

**Fix:**
```typescript
const weeksElapsed = Math.max(
  0,
  Math.floor((today.getTime() - startDateObj.getTime()) / (7 * 24 * 60 * 60 * 1000)),
)
```

---

### LOW / Nitpick — Defer or skip

#### L-01: `console.log` (não `console.warn`) para ausência de RESEND_API_KEY

**File:** `apps/web/lib/notifications/notify-report-ready.ts:36`

**Issue:** `console.log('[notify-report] RESEND_API_KEY ausente — pulando email')` usa `log` em vez de `warn`. A ausência da key em produção é uma condição que merece visibilidade nos logs de erro — `warn` faz isso.

**Fix:** `console.warn('[notify-report] RESEND_API_KEY ausente — pulando email')`

#### L-02: Duplo import de `buttonVariants` em `onboarding-wizard.tsx`

**File:** `apps/web/components/dashboard/onboarding-wizard.tsx:3–4`

**Issue:** Linhas 3 e 4 importam do mesmo módulo em duas linhas separadas:

```typescript
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button'
```

Deveriam ser consolidados em um único import.

**Fix:**
```typescript
import { Button, buttonVariants } from '@/components/ui/button'
```

#### L-03: `gateClosedAt` aponta para `week_start` da última semana qualifying, não para a data real de encerramento do gate

**File:** `apps/web/lib/admin/dogfooding.ts:122–125`

**Issue:** Quando `streak >= CONSECUTIVE_WEEKS_REQUIRED`, `gateClosedAt` recebe `ascWeeks[ascWeeks.length - 1].week_start` (início da semana ISO mais recente), não o final dessa semana nem a data exata em que o 3º critério foi atingido. O UI exibe "FECHADO em DD/MM/AAAA" com esse valor — que seria uma segunda-feira, provavelmente anterior ao encerramento real do gate.

Isso está documentado como "proxy, não data exata" no summary do plan 09-04, então é uma decisão conhecida. Mas vale anotar que o usuário verá "FECHADO em 09/06/2026" quando na verdade o gate fecha no domingo (15/06) dessa semana, ou na data da última leitura.

**Fix (opcional):** Usar `week_start + 6 dias` (domingo da semana) como proxy mais preciso, ou simplesmente documentar a limitação no UI com "(semana de início)".

---

## Strengths

1. **Server Action hygiene impecável** (`onboarding.ts`): arquivo `'use server'` exporta exatamente 1 função async, auth gate via `getUser()` antes de qualquer mutação, `.eq('id', user.id)` como guard adicional além de RLS, `revalidatePath` apenas no happy path — todos os 4 critérios da memory rule `feedback_use_server_export_hygiene` satisfeitos.

2. **Idempotência de e-mail robusta** (hook em `analyze/route.ts:415`): guard `if (reading.notification_sent_at == null)` lido do DB no momento do request (não em memória), `UPDATE notification_sent_at` só em `sent === true`, `try/catch` defensivo que não interrompe o `finally` (atomic `analysis_completed_at`). Três camadas de proteção independentes.

3. **escapeHtml em `clientName`** (`notify-report-ready.ts:84`): a função `escapeHtml` é corretamente aplicada ao nome do cliente no HTML body, cobrindo o vetor de XSS mais provável (nome vem de input de terapeuta). O helper cobre `&`, `<`, `>`, `"`, `'` — cobertura completa.

4. **Migration 0032 estritamente additive** com `IF NOT EXISTS` em ambos os `ALTER TABLE` e `COMMENT ON COLUMN` com cross-refs às decisões D-02/D-04 — padrão canônico preservado, safe pra re-execução, sem risco de rollback.

---

## Cross-cutting observations

1. **Inconsistência de escaping no mesmo arquivo**: `clientName` é escapado mas `therapistName` (mesmo arquivo, mesma função, mesmo contexto HTML) não é — padrão de defesa-em-profundidade deveria se aplicar uniformemente a todos os campos user-controlled no HTML template. Sugere que o escaping foi adicionado reativamente (em resposta ao threat T-09-03-02) em vez de ser aplicado a todos os interpolados no momento da escrita.

2. **`maybeSingle()` sem verificação de `error`**: tanto em `notify-report-ready.ts` (linha 44–46 queries paralelas) quanto em outros patterns do codebase, o destructuring `{ data: x }` ignora o `error` retornado pelo Supabase. Para queries críticas (profile de terapeuta no envio de e-mail), isso significa degradação silenciosa. O padrão existente aceita isso como trade-off de best-effort, mas vale documentar se a visibilidade nos logs for importante.

3. **`console.log` vs `console.warn` inconsistência**: o codebase mistura ambos em caminhos de degradação (sem API key = `console.log`, HTTP error = `console.error`). Seria útil padronizar: `log` = fluxo normal, `warn` = degradação esperada, `error` = falha inesperada.

4. **Backward-compat via short-circuit no componente**: a decisão de usar `completedCount === 3` no componente (em vez de no pai) é correta do ponto de vista de encapsulamento, mas significa que um terapeuta existente com perfil incompleto (step1=false) mas clientes+leituras (steps 2+3) verá o banner "2 de 3" na primeira visita. Isso está documentado no 09-02-SUMMARY como "aceitável" e requer apenas 1 clique em "Pular" — não é um bug, é uma escolha de UX documentada.

---

_Revisado em: 2026-05-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Files reviewed: 8_
