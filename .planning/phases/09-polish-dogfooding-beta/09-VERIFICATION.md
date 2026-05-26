# Fase 9 — Verification

**Data:** [founder preencher quando rodar o smoke]
**Modo:** Founder manual smoke + Claude assist (verificação de artefatos via grep)

## Plans entregues

- [x] 09-01 — Migration 0032 + types regen
- [x] 09-02 — Onboarding wizard inline (ONBOARD-01)
- [x] 09-03 — E-mail "leitura pronta" (ONBOARD-02)
- [x] 09-04 — Dogfooding gate instrumentation (ONBOARD-04)
- [ ] 09-05 — Verification + close (este plan)

## Cenário 1 — Onboarding wizard (ONBOARD-01)

**Setup:**
- Founder loga via Supabase Auth Dashboard como um terapeuta novo (alt gmail account, OR usa o invite flow Fase 11 hand-held).
- Confirma que conta é nova (zero clients, zero readings).

**Steps:**
1. Receber magic-link → click → completar /perfil/completar (step 1 enforced pelo middleware existente).
2. Aterrissar em /dashboard.
3. **EXPECTED:** Banner "Vamos começar (1 de 3)" visível no topo, ACIMA de InviteReadingsSection. Step 1 com checkmark (perfil completo). Steps 2 e 3 com circle vazio + CTA "Começar".
4. Clicar CTA "Começar" do step 2 → navega pra /clientes/novo.
5. Voltar pra /dashboard → **EXPECTED:** "Vamos começar (1 de 3)" ainda. Step 2 ainda pendente (cliente não foi salvo).
6. Voltar pra /clientes/novo, preencher form, salvar.
7. Voltar pra /dashboard → **EXPECTED:** "Vamos começar (2 de 3)" — step 2 agora com checkmark.
8. Clicar CTA "Começar" do step 3 → navega pra /leituras/nova → criar reading → voltar /dashboard.
9. **EXPECTED:** Banner SUMIU (3/3 completos → componente retorna null).

**Skip path:**
10. Repetir setup com nova conta → /dashboard mostra "Vamos começar (1 de 3)".
11. Clicar botão "Pular" no header do banner.
12. **EXPECTED:** Banner some imediatamente (post server action UPDATE + revalidatePath).
13. Refresh /dashboard → **EXPECTED:** Banner não volta (onboarding_dismissed_at preenchido).

**Backward-compat:**
14. Loga como founder (já tem ≥1 reading + clientes + perfil completo).
15. **EXPECTED:** Banner NÃO aparece (componente retorna null via short-circuit completedCount===3).

**Status:** [ ] PASS / [ ] FAIL / [ ] PENDING — _founder preenche pós-smoke_

## Cenário 2 — E-mail "leitura pronta" (ONBOARD-02)

**Setup:**
- Founder loga em prod com terapeuta-teste (alt account com inbox real).
- Tem ≥1 reading com status='ready' + report_generated IS NULL + notification_sent_at IS NULL.

**Steps:**
1. Click "Gerar análise" → pipeline Sonnet 2x roda (~3min).
2. Stream completa → report_generated populado → revalidatePath.
3. **EXPECTED:** E-mail chega na inbox do terapeuta-teste com:
   - From: noreply@iriscodex.com (sender Fase 11)
   - Subject: "Leitura pronta — [nome do cliente]"
   - Body contém link pra https://iriscodex.com/leituras/[id]
   - Body NÃO contém "diagnóstico"/"tratamento"/"cura"
4. Click no link no e-mail → autentica (se sessão expirou, magic-link normal) → vê reading.
5. **EXPECTED:** SELECT readings.notification_sent_at WHERE id=[id] retorna non-NULL.

**Idempotência:**
6. Click "Regenerar análise" no mesmo reading (founder bypass cap).
7. Pipeline roda novamente, report_generated atualiza.
8. **EXPECTED:** Nenhum NOVO e-mail chega (gate `if reading.notification_sent_at == null` curto-circuita).
9. **EXPECTED:** SELECT readings.notification_sent_at continua igual ao timestamp do 1º envio (não foi atualizado).

**Falha gracefully:**
10. Founder temporariamente unset RESEND_API_KEY no Vercel + redeploy.
11. Faz nova reading → gera análise.
12. **EXPECTED:** Pipeline NÃO trava. Vercel logs mostram "[notify-report] RESEND_API_KEY ausente — pulando email". report_generated salvo. notification_sent_at NULL.
13. Reset env var.

**Status:** [ ] PASS / [ ] FAIL / [ ] PENDING

## Cenário 3 — Dogfooding gate visibility (ONBOARD-04)

**Setup:**
- Founder loga como founder (FOUNDER_EMAIL).

**Steps:**
1. Navegar pra /admin/relatorios.
2. Scroll até o fim — **EXPECTED:** Bloco "Dogfooding gate — ONBOARD-04 (Fase 9)" visível abaixo de "Aproveitamento por dispositivo".
3. **EXPECTED — 4 KPIs visíveis:**
   - Data de início: 15/05/2026
   - Semanas decorridas: 2 (ou conforme data atual)
   - Semanas consecutivas qualifying: X / 3
   - Status do gate: ABERTO ou FECHADO
4. **EXPECTED — Histórico semanal:**
   - Tabela com semanas listadas DESC (mais recente primeiro)
   - Colunas: Semana | Reais | Autoexame | Total | Qualifica?
   - Counts batem com o conhecimento do founder do uso real (memory).
5. **EXPECTED — copy footer:**
   - "Critério (D-05): 3 semanas consecutivas com ≥3 leituras em clientes reais (is_self=false), sem notas paralelas. Founder declara passa/não-passa via memory project_dogfooding_gate_status."

**Non-founder gate:**
6. Loga como terapeuta-teste (não-founder).
7. Navegar pra /admin/relatorios.
8. **EXPECTED:** 404 Not Found (notFound() via isFounderEmail check linha 42-44).

**Status:** [ ] PASS / [ ] FAIL / [ ] PENDING

## Aceitação geral

- [ ] Cenário 1 PASS
- [ ] Cenário 2 PASS
- [ ] Cenário 3 PASS
- [ ] Founder declarou dogfooding gate status em `~/.claude/projects/.../memory/project_dogfooding_gate_status.md` (fora deste plan)

## Commits Fase 9

- 09-01: 6d23b1b (migration 0032) + 004c41b (types regen)
- 09-02: 1773d2c (test RED) + e998c65 (OnboardingWizard) + b84d862 (wire dashboard)
- 09-03: a695870 (notify-report-ready) + 51a8209 (wire analyze/route.ts)
- 09-04: 47fd629 (dogfooding module) + c75fca9 (relatorios bloco)
- 09-05: [preencher hash]
