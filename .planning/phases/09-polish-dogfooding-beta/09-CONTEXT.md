# Fase 9 — Polish + dogfooding + beta

**Criada:** 2026-05-26 (via `/gsd-discuss-phase 9` pós-Fase 11 re-sync)
**Tipo:** Fase v1 do roadmap original — finalmente entrando em discuss-phase após produto estar em prod há ~12 dias
**Goal:** Entregar o mínimo de polish + dogfooding pra primeira terapeuta convidada (Fase 11 11-04) ter experiência profissional, e ter um gate empírico de quando v1 está fechada.

## Domínio

Originalmente "Polish + dogfooding + beta" (5 ONBOARD-XX requirements). Founder escopou pra **3 itens essenciais** dado launch v1 = B2B convite:

- **ONBOARD-01** — Onboarding 3-step pra terapeuta nova
- **ONBOARD-02-completar** — E-mail "leitura pronta" (magic-link auth já entregue via Fase 11 11-01)
- **ONBOARD-04-redefinir** — Dogfooding gate strict 3 semanas

Deferred pra V1.1+:
- **ONBOARD-03** — Landing page pública LGPD-compliant
- **ONBOARD-05** — Beta com 5 internos + 10-20 externos (depende de Fase 8 Stripe + landing)

Fase 8 (Stripe + LGPD-01..06) **NÃO é pré-requisito** apesar do ROADMAP dizer "Depends on Fase 8" — founder desacoplou 2026-05-18 (memory `project_b2c_registration_future_phase`): launch v1 = B2B convite, cobrança fora do produto.

## Decisões locked nesta discussão

### D1 — Escopo: 3 essenciais pra B2B convite
Implementar **ONBOARD-01 + ONBOARD-02-completar + ONBOARD-04-redefinir**. Pular ONBOARD-03 (landing) e ONBOARD-05 (beta 10-20) — viram V1.1.

**Implicação:**
- Próxima leva de terapeutas (após 11-04 piloto) chega via SEU convite manual em `/admin/terapeutas`, não signup público
- Sem landing, root URL `/` continua redirecionando pra `/login` ou `/dashboard` (a verificar)
- Beta com volume vira pre-req da landing — escala juntos

### D2 — Onboarding UX: Wizard inline na dashboard, skipable
Após magic-link, terapeuta cai na `/dashboard`. Banner/card grande topo "Vamos começar (1 de 3)" guia os 3 passos. Botão "Pular" disponível mas barra fica visível até completar OU dismiss explícito.

**Implicação:**
- NÃO criar rota dedicada `/onboarding`
- Banner desaparece quando os 3 passos completam OR quando terapeuta clica "Pular" (persistir dismiss em `profiles.onboarding_dismissed_at`)
- Cada passo é link/CTA pra rota existente (perfil → `/configuracoes`, cliente → `/clientes/novo`, leitura → `/leituras/nova`)
- Estado de cada passo = derivado de DB (perfil completo? cliente.count > 0? leitura.count > 0?)
- Pure server-side derivado, não state client persistido

### D3 — Onboarding 3 steps: Perfil → 1º cliente → 1ª leitura
Match exato do Success Criteria 1 do ROADMAP. Foca em chegar ao primeiro relatório visto em ≤30min.

**Implicação:**
- **Step 1 "Perfil"** — completar campos faltantes (`profiles.full_name`, `phone`, `specialties` se vazio). CTA → `/configuracoes` (verificar se rota existe).
- **Step 2 "1º cliente"** — cadastrar 1 cliente. Conta tanto cliente real quanto autoexame (`is_self=true`). CTA → `/clientes/novo`.
- **Step 3 "1ª leitura"** — iniciar leitura. Conta qualquer reading criada (status `pending` ou além). CTA → `/leituras/nova`.
- Onboarding NÃO é mandatory — terapeuta pode usar o produto sem completar wizard (mas barra de progresso fica visível, suave UX nudge).

### D4 — E-mail "leitura pronta": automático na primeira vez que status='ready'
Trigger no Server Action que finaliza geração de relatório. Quando `report_generated` vira non-null pela 1ª vez (regen NÃO duplica), enviar e-mail via Resend pra terapeuta com link assinado pra `/leituras/[id]`.

**Implicação:**
- Adicionar nova coluna `readings.notification_sent_at` (timestamptz nullable) — flag idempotente
- Disparar e-mail server-side pós-stream, antes de revalidatePath. Não bloquear se falhar (log + segue)
- Template novo no Resend ou Supabase (não confundir com magic-link)
- Sender = `noreply@iriscodex.com` (já configurado em 11-01)
- Sem signed URL ainda (Fase 7 entrega `/leituras/[id]` autenticado por sessão) — link inclui só path, terapeuta loga se necessário

### D5 — Dogfooding gate: 3 semanas consecutivas, 3+ leituras/semana, clientes reais, sem notas paralelas
Manter strict do ROADMAP original. Founder declara passa/não-passa via memory (não admin UI).

**Implicação:**
- Founder começou uso real 2026-05-15 (Sonnet 2x v2.3.0 LIVE)
- Hoje (2026-05-26) = ~11 dias = ~1.5 semanas
- Gate fecha em ~2026-06-05 se continuar o ritmo
- Memory `project_dogfooding_gate_status` (NEW) rastreará progress
- "Sem notas paralelas" é compromisso founder, não medível por código
- Pode incluir mini-relatório semanal em `/admin/relatorios` mostrando count `is_self=false` readings/semana — mas isso é instrumentação, não gate em si

## Plans esqueleto (a refinar via `/gsd-plan-phase 9`)

### 09-01 — Migration + schema pra notification + onboarding state
- Migration 0032: `ALTER TABLE readings ADD COLUMN notification_sent_at timestamptz NULL` + `ALTER TABLE profiles ADD COLUMN onboarding_dismissed_at timestamptz NULL`
- Regenerar `types/database.ts`
- Atomic, blocking pra 09-02 e 09-03

### 09-02 — Onboarding 3-step wizard (ONBOARD-01)
- Componente `OnboardingWizard` em `components/dashboard/`
- Server Action `dismissOnboardingAction` (UPDATE profiles.onboarding_dismissed_at)
- Logic: render wizard se `profiles.onboarding_dismissed_at IS NULL` AND NOT (perfil completo + clientes.count > 0 + readings.count > 0)
- Visual: card hero topo dashboard com 3 steps + checkmarks de completos
- Mobile-first responsive (sm: stack vertical, md+: row)
- Wave 1

### 09-03 — E-mail "leitura pronta" (ONBOARD-02 completar)
- Resend client em `lib/email/resend-client.ts` (já existe? verificar — pode estar implicit via Supabase Auth)
- Template "Leitura pronta" — markdown/HTML, branded com `noreply@iriscodex.com`
- Hook em `app/api/readings/[id]/analyze/route.ts` pós-stream: se `notification_sent_at IS NULL`, dispara e-mail + UPDATE notification_sent_at
- Wave 2 (depende de 09-01 migration)

### 09-04 — Dogfooding instrumentation + gate tracking (ONBOARD-04)
- Memory file `project_dogfooding_gate_status.md` (NEW) com:
  - Data início: 2026-05-15
  - Status atual: leituras/semana count, clientes reais únicos
  - Gate close target: 2026-06-05 (se ritmo mantém)
- Opcional: bloco "Dogfooding gate" em `/admin/relatorios` com contagem semanal
- Wave 2

### 09-05 — Verification + close
- Smoke: terapeuta-teste (founder alt email) faz signup → vê wizard → completa 3 steps → recebe e-mail de leitura pronta
- Founder declara gate dogfooding via memory update
- Roadmap status: Fase 9 done

## Cross-cutting constraints

- **Backward-compat**: onboarding wizard NÃO aparece pra terapeutas existentes que já têm dados (founder, Cristiane-pop). Logic: se já tem ≥1 leitura ou perfil completo + cliente, considera onboarding "implicitamente completo" mesmo sem dismiss explícito.
- **LGPD vocabulary audit**: templates de e-mail passam pelo audit:vocabulary (sem "diagnóstico"/"tratamento"/"cura")
- **Sem cliente lock-in**: onboarding NÃO bloqueia uso. Terapeuta pode dismissar e usar produto livremente.
- **Performance**: e-mail send NÃO bloqueia revalidatePath (best-effort, log + continua)
- **Memory triggers**: dogfooding gate fechado por declaração founder, não auto-detectado

## Não-objetivos explícitos (deferred V1.1+)

- ❌ Landing page pública (ONBOARD-03) — sem signup público, sem necessidade até V1.1
- ❌ Beta 10-20 terapeutas (ONBOARD-05) — depende de Fase 8 Stripe + landing
- ❌ Onboarding mandatory/forced — sempre skipable
- ❌ Signed URLs pra leitura no e-mail — fluxo session-based atual basta
- ❌ Feedback estruturado dos 5 terapeutas internos — adia pra V1.1 com beta real
- ❌ Métricas formais (tempo até primeira leitura) — implícito no contador de readings/semana

## Canonical refs

- `.planning/ROADMAP.md` — Fase 9 detail (Success Criteria 1-5 original)
- `.planning/REQUIREMENTS.md` — ONBOARD-01..05 specs
- `.planning/PROJECT.md` — Métrica de sucesso Estágio 1 (dogfooding) e Estágio 2 (beta)
- `.planning/phases/11-launch-readiness-b2b/11-CONTEXT.md` — Fase 11 decisões que afetam 9 (B2B convite, hand-held, sender autenticado)
- Memory `project_b2c_registration_future_phase` — confirma launch v1 = B2B
- Memory `project_consent_term_legal_review_debt` — trigger ativo
- Memory `project_resend_domain_unverified_launch_gate` (RESOLVED) — config Resend válida
- `apps/web/app/(dashboard)/` — root pra wizard banner
- `apps/web/lib/gates/profile-completeness.ts` — gate pra detectar perfil completo
- `apps/web/app/actions/readings.ts` — hook pra disparar e-mail "leitura pronta"
- `apps/web/components/dashboard/summary-cards.tsx` — patterns de card UI já existentes

## Code context

- **Auth flow atual** (`app/(auth)/signup/page.tsx`, `app/(auth)/login/page.tsx`): magic-link → `/dashboard`. Sem onboarding intercept ainda.
- **Dashboard layout** (`app/(dashboard)/layout.tsx`, `app/(dashboard)/dashboard/page.tsx`): home da terapeuta logada. É onde o wizard banner vai morar.
- **summary-cards.tsx**: já mostra `BETA_READING_CAP` + count usadas — design pattern de "card-com-info" pra reusar no wizard
- **profile-completeness gate**: `evaluateProfileCompleteness(profile)` retorna `{status: 'ok' | 'incomplete' | 'blocked_underage'}` — usar pra check step 1
- **Resend integration**: provavelmente só implícita via Supabase Auth atualmente. 09-03 vai precisar Resend SDK direto OR template Supabase customizado.
- **Migrations**: pasta `supabase/migrations/`, próximo número = 0032

## Próximo passo

`/gsd-plan-phase 9` quando founder estiver pronto. Recomenda começar por 09-01 (migration blocking) → 09-02 (wizard, paralelo possível) → 09-03 (e-mail) → 09-04 (instrumentation) → 09-05 (verify + declare gate).

Founder pode atacar 11-04 (smoke terapeuta real) DEPOIS de 09-02 entregar wizard — assim a primeira terapeuta já vê o onboarding polido. Ordem sugerida:
1. Hoje: `/gsd-plan-phase 9` + começar 09-01..02
2. Próximas horas: terminar 09-03..04
3. Founder dispara 11-04 (smoke terapeuta) com wizard + notification em prod
4. Founder continua dogfooding até gate fechar ~2026-06-05
5. Marcar Fase 9 done + Fase 11 done + iniciar V1.1
