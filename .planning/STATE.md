---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-05-03T22:56:53Z"
progress:
  total_phases: 9
  completed_phases: 3
  total_plans: 25
  completed_plans: 23
  percent: 42
---

# Estado do projeto

## Referência ao projeto

Ver: .planning/PROJECT.md (atualizado em 2026-04-30)

**Valor central:** Cada cliente atendido produz um JSON de features genuinamente diferente, e por isso cada relatório é genuinamente diferente. Pipeline de visão objetivo + LLM ancorado em RAG é o coração do produto.
**Foco atual:** Fase 4 (Upload desktop) — em execução, 5/7 plans concluídos. Wave 3 fechada. UPLOAD-01 e UPLOAD-02 entregues.

## Posição atual

Fase: 4 de 9 — **EM EXECUÇÃO** (Upload desktop)
Plan corrente: 04-06 (próximo); 04-05 concluído em 2026-05-03.
Próxima fase: Fase 5 (Pipeline de visão / Modal)
Status: Executing — Wave 1 completa (04-01 ✓ + 04-02 ✓). Wave 2 fechada (04-03 ✓ UploadDropzone + 04-04 ✓ capture mode prop). **Wave 3 fechada** (04-05 ✓ wizard assembly — page.tsx + upload-client.tsx ponta-a-ponta). Próximo: Wave 4 (04-06 entry point /leituras/nova com auto-detect e CTAs duplos), depois Wave 5 (04-07 UAT). Modo sequencial — Windows/PowerShell sem worktrees.
Última atividade: 2026-05-03 — Plan 04-05 concluído (upload wizard page + client). 2 commits (5ece1f7 page.tsx server component, 459df6f upload-client.tsx wizard). 466 linhas total (85 page + 381 client). State machine `Phase = 'instruction'|'analyzing'|'previewing'|'finalizing'` clonada do capture-client com 3 substituições cirúrgicas: UploadDropzone na phase='instruction', handleFileAccepted (validateUploadFile -> convertHeicToJpeg -> analyzeCapturedJpeg), CapturePreview mode='upload'. AngleInterstitial NÃO renderizado (alert de câmera traseira/flash mobile-only não se aplica). Build OK com bundle splitting validado: heic2any em chunk dedicado de 1.35MB, rota /upload First Load = 3.4 kB (paridade com /capturar). 63/63 testes Fase 3 verdes — zero regressão. Vocabulário LGPD limpo nos 2 arquivos novos. Zero auto-fixes Rule 1/2/3 — plano executado exatamente como escrito.

Progresso: [████░░░░░░] 42% (3/9 fases + 5/7 plans Fase 4)

## Métricas de performance

**Velocidade:**

- Total de plans concluídos: 11
- Duração média: ~10 min/plan
- Tempo total de execução: ~152 min

**Por fase:**

| Fase | Plans | Total | Média/plan |
|-------|-------|-------|------------|
| 1 — Setup | 6 | ~75 min | ~12 min |
| 4 — Upload desktop | 5 (parcial) | ~77 min | ~15 min |

**Tendência recente:**

- Últimos plans: 04-05 (~20 min, 2 tasks, 2 commits, 466 linhas total, build OK + bundle splitting validado, 63/63 testes Fase 3 verdes, zero auto-fixes), 04-04 (~30 min ativo / ~80 min wall-clock incluindo rate limit, 2 tasks, 3 commits — 1 RED prévio + GREEN + Task 2, 9 testes novos verdes, zero auto-fixes), 04-03 (5 min, 1 task TDD, 2 commits, 10 testes verdes, 4 auto-fixes Rule 2 a11y hardening).
- Tendência: 04-05 dentro do envelope esperado para wizard assembly (clone cirúrgico do capture-client com 3 substituições + assembly de 4 deps Wave 1+2). Foi 4× mais rápido que 04-04 (que teve rate limit). Sem TDD por design do PLAN — cobertura virá via UAT 04-07.

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
- **Plan 04-03 (2026-05-03):** Pattern de componente UI puro estabelecido em `apps/web/components/upload/`: zero imports de `lib/upload/*` ou `lib/capture/*` — componente repassa `File` via callback `onFileAccepted` para o caller (upload-client em Wave 3) decidir validação. Defesa em camadas: `validateUploadFile` (04-01) é a primeira barreira; VLM gate é a segunda; Storage RLS é a terceira. `data-dragover='true|false'` como contrato semântico de teste em vez de asserção de classe Tailwind.
- **Plan 04-03 (2026-05-03):** Hardening proativo a11y para componente custom com `role="button"`: `tabIndex={disabled ? -1 : 0}` + `onKeyDown` (Enter/Space → click) + `focus-visible:ring-2 ring-primary ring-offset-2`. Padrão WCAG-correto para qualquer dropzone/control não-nativo; replicar nos próximos componentes UI custom. Threat T-04-03-04 mitigado.
- **Plan 04-04 (2026-05-03):** Pattern de adaptação cirúrgica de componentes Fase 3 para Fase 4 via prop opcional `mode?: CaptureMode` com default `'camera'` no parâmetro/destructuring — zero impacto em call sites existentes (capture-client.tsx Fase 3 não foi tocado; default preserva strings originais). Tipo `CaptureMode = 'camera' | 'upload'` exportado de `lib/capture/sequence.ts` como fonte única de verdade reutilizável por todos os componentes downstream. CONTEXT D-05 (reuso) honrado sem duplicar AngleInterstitial nem CapturePreview.
- **Plan 04-05 (2026-05-03):** Clone cirúrgico viável: clonar `capture-client.tsx` (350 linhas) preservando `Phase` state machine, refs (`slotAbortRefs`, `uploadPromisesRef`, `finalizingTriggeredRef`), `executeUpload`, `handleRedo`, useEffects de finalização e cleanup — substituindo APENAS (a) `<input capture>` por `UploadDropzone`, (b) `handleFileSelected (ChangeEvent)` por `handleFileAccepted (File)` com pipeline `validateUploadFile -> convertHeicToJpeg -> analyzeCapturedJpeg`, (c) `CapturePreview mode='upload'`. Resultado: 381 linhas, paralelismo 1:1 com capture-client (auditável via diff). Pattern reutilizável se Fase futura precisar de outra fonte (ex: import de galeria, captura via webcam — basta novo handler de input).
- **Plan 04-05 (2026-05-03):** AngleInterstitial **NÃO** é renderizado em fluxo de upload mesmo após Plan 04-04 ter adicionado `mode` prop. Razão: o alert hardcoded "Use a câmera traseira · Nunca utilize o flash" do JSX é mobile-only — terapeuta no desktop está subindo foto pré-existente e não tem câmera traseira/flash. A prop `mode` afeta apenas o CTA via `getSlotInstructionCopy`, não remove o alert. Solução adotada: heading inline (`Foto N de 6 — Olho ESQUERDO · Frente`) + UploadDropzone visível diretamente na phase='instruction'. Mantém o componente AngleInterstitial inalterado para fluxo mobile.
- **Plan 04-05 (2026-05-03):** Bundle splitting de heic2any **VALIDADO em produção via `pnpm build`**: heic2any aparece em chunk dedicado de 1.35 MB (`7ef09c20.*.js`), separado do bundle inicial. Rota `/leituras/nova/upload` First Load JS = 3.4 kB + 228 kB shared (paridade com `/capturar` 3.56 kB) — confirmação de evidência do dynamic import correto em `lib/upload/heic-to-jpeg.ts` (Plan 04-01). CONTEXT D-11 honrado.

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

Última sessão: 2026-05-03 (22:36–22:56 UTC) — **Plan 04-05 concluído** (upload wizard page + client). Wave 3 fechada. UPLOAD-01 e UPLOAD-02 entregues.

Stopped at: 04-05-SUMMARY.md gerado, STATE.md+ROADMAP.md+REQUIREMENTS.md atualizados; pronto para retomar com **Plan 04-06 (Wave 4 — entry point)** que tem dependência apenas em Wave 1 (já completa) — pode iniciar imediatamente. Depois Wave 5 (04-07 UAT smoke) que depende de Waves 3+4.

Resume file: `.planning/phases/04-upload-desktop/04-06-*-PLAN.md`.

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
