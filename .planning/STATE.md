---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-05-03T17:35:00.000Z"
progress:
  total_phases: 9
  completed_phases: 3
  total_plans: 25
  completed_plans: 20
  percent: 36
---

# Estado do projeto

## Referência ao projeto

Ver: .planning/PROJECT.md (atualizado em 2026-04-30)

**Valor central:** Cada cliente atendido produz um JSON de features genuinamente diferente, e por isso cada relatório é genuinamente diferente. Pipeline de visão objetivo + LLM ancorado em RAG é o coração do produto.
**Foco atual:** Fase 4 (Upload desktop) — em execução, 2/7 plans concluídos.

## Posição atual

Fase: 4 de 9 — **EM EXECUÇÃO** (Upload desktop)
Plan corrente: 04-03 (próximo); 04-02 concluído em 2026-05-03.
Próxima fase: Fase 5 (Pipeline de visão / Modal)
Status: Executing — Wave 1 completa (04-01 ✓ + 04-02 ✓). Pronto para Wave 2 paralela (04-03 UploadDropzone + 04-04 CapturePreview/AngleInterstitial mode prop). Modo sequencial — Windows/PowerShell sem worktrees.
Última atividade: 2026-05-03 — Plan 04-02 concluído (extender createReadingAction + getDraftReading). 4 commits (a13e217 RED, 02b8283 GREEN Task 1, e1fefa4 Task 2 com narrowCaptureMethod helper, 478b3a3 deferred-items). 12/12 testes schema vitest verdes. UPLOAD-02 marcado completo (server action grava capture_method real + roteia condicionalmente). Fundação server-side para D-03/D-04/D-15 entregue: enum exposto via CAPTURE_METHODS, schema Zod com default mobile_camera (compat retroativa Fase 3), DraftReading.capture_method para Fase 9 RecoveryBanner.

Progresso: [████░░░░░░] 36% (3/9 fases + 2/7 plans Fase 4)

## Métricas de performance

**Velocidade:**

- Total de plans concluídos: 8
- Duração média: ~11 min/plan
- Tempo total de execução: ~97 min

**Por fase:**

| Fase | Plans | Total | Média/plan |
|-------|-------|-------|------------|
| 1 — Setup | 6 | ~75 min | ~12 min |
| 4 — Upload desktop | 2 (parcial) | ~22 min | ~11 min |

**Tendência recente:**

- Últimos plans: 04-02 (12 min, 2 tasks, 4 commits TDD, 12 testes verdes, 2 auto-fixes Rule 2/3 narrowing defensivo).
- Tendência: dentro do envelope esperado.

*Atualizado após a conclusão de cada plan.*

## Contexto acumulado

### Decisões

Decisões são logadas em PROJECT.md (tabela "Decisões-chave").
Decisões recentes que afetam o trabalho atual:

- **Bootstrap (2026-04-30):** stack inteira do SPEC herdada como "decidida sem ADR ratificado" — pode ser honrada ou re-decidida via ADR em qualquer fase.
- **Bootstrap (2026-04-30):** métrica de sucesso primária = uso semanal real do fundador em clientes reais; beta com 10–20 terapeutas é Estágio 2 condicional.
- **Bootstrap (2026-04-30):** LGPD + posicionamento "ferramenta de apoio à anamnese, não diagnóstico" tratados como restrições não-negociáveis em PROJECT.md (vocabulário proibido, copy obrigatória, ancoragem do prompt em features do JSON).
- **Plan 04-01 (2026-05-03):** heic2any@0.0.4 aprovado para HEIC→JPEG client-side via dynamic import, mesmo fora da janela de 24m do PLAN. Justificativas: MIT > LGPL-3.0 do libheif-js (alternativa) em SaaS comercial; T-04-01-03 do threat model já registra `accept` da supply-chain; HEIC é commodity em 2026; deps zero + zero CVEs históricos. Auditoria de manutenção/licenciamento volta na Fase 9 (revisão jurídica healthtech). Decisão registrada via checkpoint:decision do desenvolvedor — ver `.planning/phases/04-upload-desktop/04-01-SUMMARY.md` "Deviations".
- **Plan 04-01 (2026-05-03):** Pattern de lib pura em `apps/web/lib/upload/` estabelecido espelhando `apps/web/lib/capture/` — whitelist como `ReadonlySet<string>` exportada, dynamic import dentro da função (não top-level), boundary inclusivo no limite de tamanho.
- **Plan 04-02 (2026-05-03):** Pattern de enum canônico estabelecido em `readings.schemas.ts`: `CAPTURE_METHODS = [...] as const` (UPPER_SNAKE) + `type CaptureMethod = (typeof CAPTURE_METHODS)[number]` — fonte única consumível por Zod, TypeScript e UI. Mesmo pattern do `BLOCKING_REASONS` em validate-image.ts. Default no Zod schema (`.default('mobile_camera')`) torna compat retroativa um contrato explícito.
- **Plan 04-02 (2026-05-03):** Helper `narrowCaptureMethod(value: string | null | undefined): CaptureMethod` adicionado em `readings.ts` para defesa em profundidade contra `string | null` que o Supabase retorna em `capture_method` (gen-types não enxerga o CHECK enum do banco). Pattern reutilizável para qualquer coluna enum lida de `getDraftReading`-like queries em fases futuras.

### Todos pendentes

Nenhum ainda.

### Bloqueadores / Preocupações

- **Sem ADRs ratificados:** as 21 constraints do SPEC (Next.js / Supabase / Modal / Sonnet 4.6 / Voyage / Stripe / Resend) estão como `locked: false`. Não bloqueia execução, mas qualquer plan-phase deve estar consciente de que pode formalmente re-decidir via ADR — particularmente antes da Fase 5 (Modal) e Fase 7 (LLM), onde a escolha tem maior impacto técnico.
- **Revisão jurídica healthtech (~R$ 2–4k) recomendada antes de qualquer rollout externo na Fase 9.** Não é pré-requisito para dogfooding interno do fundador (Estágio 1), mas é gate para Estágio 2. **Adicional pós-04-01:** auditoria de licenciamento de heic2any@0.0.4 (MIT, fora da janela de manutenção de 24m) e dívida pré-existente do `audit:vocabulary` em comentários técnicos da Fase 3 (8 ocorrências, ver `.planning/phases/04-upload-desktop/deferred-items.md`). **Adicional pós-04-02:** 2 erros tsc pré-existentes em `lib/capture/quality-scoring.test.ts` (referência a `WEIGHTS.reflex` removido durante a pivô VLM da UAT 03) — documentados em `deferred-items.md`, não bloqueiam Fase 4.
- **Corpus RAG seed (Fase 6) depende de obter PDFs de Jensen Vol. 1 e Battello em pt** — verificar disponibilidade legal/licenciamento antes de ingerir.
- **Fase 3 — Plan 03-08 (RecoveryBanner + PWAInstallBanner + listagem rascunhos):** features não foram implementadas como originalmente planejadas. finalizeReadingAction foi absorvida em fixes pós-execução. RecoveryBanner D-12 (banner de recovery após interrupção) e PWAInstallBanner D-14 (CTA de install nag) ficaram como **dívida de polish** pra retomar antes do beta externo (Estágio 2 / Fase 9).
- **Fase 3 — PWA standalone Android Chrome:** install funciona mas abre com URL bar (não modo standalone). Hipótese: SW não registra em prod, ou ícone 404, ou start_url redireciona. iOS Safari funciona normal. Investigar antes do beta externo.
- **Custo VLM em produção:** ~$0.0008/foto via Claude Haiku 4.5. Projeção: ~$21/mês com 100 terapeutas × 30 sessões × 6 fotos. Aceitável pra Estágio 1+2.

## Itens diferidos

| Categoria | Item | Status | Diferido em |
|-----------|------|--------|-------------|
| audit:vocabulary | 8 ocorrências de "diagnóstico" em comentários técnicos da Fase 3 (`app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/api/capture/validate/route.ts`, `components/capture/CapturePreview.tsx`) — não em strings de UI; pré-existentes ao Plan 04-01 (verificado por stash + audit em tree limpo). Detalhe em `.planning/phases/04-upload-desktop/deferred-items.md`. | Open | 2026-05-03 (Plan 04-01) |
| heic2any maintenance | heic2any@0.0.4 sem release há ~37 meses (último 2023-03-29). Aprovado pelo desenvolvedor via checkpoint:decision para Plan 04-01; auditar antes do gate da Fase 9 (revisão jurídica healthtech). | Open (aceito) | 2026-05-03 (Plan 04-01) |
| tsc legacy | 2 erros TS2339 em `lib/capture/quality-scoring.test.ts:47,54` referenciando `WEIGHTS.reflex` (resíduo da pivô VLM Fase 3). Pré-existentes ao Plan 04-02. Não bloqueiam — escopo de cleanup futuro da Fase 3. | Open | 2026-05-03 (Plan 04-02) |

## Continuidade de sessão

Última sessão: 2026-05-03 (17:20–17:35 UTC) — **Plan 04-02 concluído** (extender createReadingAction + getDraftReading).

Stopped at: 04-02-SUMMARY.md gerado, STATE.md+ROADMAP.md+REQUIREMENTS.md atualizados; pronto para retomar com Wave 2 da Fase 4 (Plans 04-03 UploadDropzone e 04-04 capture mode prop, paralelos).

Resume file: `.planning/phases/04-upload-desktop/04-03-upload-dropzone-component-PLAN.md` (ou 04-04 conforme orquestrador escolher)

---

Sessão anterior (2026-05-03 manhã): **Fase 3 fechada via UAT 03**.

**Pivôs arquiteturais durante UAT (sem replanning formal):**
- MediaPipe FaceLandmarker → pupil detection pixel-based → Otsu adaptativo → bypass → **Claude Haiku 4.5 VLM via /api/capture/validate** (4 iterações; última solução é a definitiva).
- Streaming PWA com live quality gate → **câmera nativa via `<input capture="environment">`** com análise pós-captura.
- Removido: Laplacian variance, useCamera, CameraView, CameraDeniedScreen, IrisDetector, RecoveryBanner, PWAInstallBanner.
- Adicionado: `@anthropic-ai/sdk@0.92.0`, `exifr@7.1.3` (front-cam detection), `app/api/capture/validate/route.ts`, `lib/capture/validate-image.ts`, `lib/capture/camera-detection.ts`, `lib/capture/post-capture-analysis.ts`.

**UAT 03 cobertura:** 13 testes principais (cold start, PWA install iOS Safari, fluxo cliente→captura→preview→finalize→storage, timezone). 1 issue conhecido (PWA standalone Android, não-blocking pra Estágio 1).

**20 commits de calibração** culminando em VLM gate confiável: detecta sem_olho, dois_olhos, muito_longe, olho_fechado, reflexo_total, borrado; classifica quality em ruim/regular/boa/excelente.

Próxima ação: `/gsd-execute-plan 4 2` (plan 04-02) ou `/gsd-execute-phase 4` para retomar a wave inteira.
