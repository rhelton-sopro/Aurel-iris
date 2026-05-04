---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-05-04T17:00:00.000Z"
progress:
  total_phases: 9
  completed_phases: 4
  total_plans: 42
  completed_plans: 34
  percent: 81
---

# Estado do projeto

## Referência ao projeto

Ver: .planning/PROJECT.md (atualizado em 2026-04-30)

**Valor central:** Cada cliente atendido produz um JSON de features genuinamente diferente, e por isso cada relatório é genuinamente diferente. Pipeline de visão objetivo + LLM ancorado em RAG é o coração do produto.
**Foco atual:** Fase 5 (Pipeline de visão / Modal) — **EM EXECUÇÃO** desde 2026-05-04. Wave 0 ✓ + Wave 1a ✓ + Wave 1b ✓ (9/17 plans). Próximo: Wave 1c (05-10 modal_app).

## Posição atual

Fase: 5 de 9 — **EM EXECUÇÃO** (Pipeline de visão / Modal)
Plan: 9/17 (Wave 0 ✓ + Wave 1a ✓ + Wave 1b ✓)
Próxima ação: spawn de Wave 1c (`05-10` modal_app — orchestrator que une as 6 stages num único endpoint Modal `analyze_iris`). Depois Wave 2 (Next.js integration: 05-11..05-14), Wave 3 (CI + audit + smoke: 05-15..05-17).
Status: executing — Wave 1b fechada via founder UAT (D-J3 checkpoint:human-verify aprovado com 1 fix em right h9 = pulmao/pleura/bronquios/torax). 88/88 pytest verdes em vision-service (4 skips esperados). audit:vocabulary limpo.
Última atividade: 2026-05-04 — Wave 1b concluída: 05-09 features (extract_all + compute_asymmetry + classify_iris_color via LAB k-means; jensen-map.json pt-BR aprovado pelo founder com correção em right h9). 20 novos tests (6 iris_maps + 14 features incluindo B4 anti-regression). Worktree base ficou stale (Bash bloqueado para o agent), orchestrator finalizou aplicando os 5 arquivos novos direto em main.

Progresso: [████████░░] 81% (4/9 fases concluídas + 9/17 plans Fase 5 — 34/42 plans do milestone v1.0)

## Métricas de performance

**Velocidade:**

- Total de plans concluídos: 12
- Duração média: ~10 min/plan
- Tempo total de execução: ~182 min

**Por fase:**

| Fase | Plans | Total | Média/plan |
|-------|-------|-------|------------|
| 1 — Setup | 6 | ~75 min | ~12 min |
| 4 — Upload desktop | 6 (parcial) | ~107 min | ~18 min |

**Tendência recente:**

- Últimos plans: 04-06 (~30 min, 1 task, 1 commit, +73 −10 linhas, build OK /leituras/nova 3.98 kB, 160/160 testes verdes excluindo pré-existente Fase 3, zero auto-fixes — execução verbatim do PLAN), 04-05 (~20 min, 2 tasks, 2 commits, 466 linhas total, build OK + bundle splitting validado, 63/63 testes Fase 3 verdes, zero auto-fixes), 04-04 (~30 min ativo / ~80 min wall-clock incluindo rate limit, 2 tasks, 3 commits — 1 RED prévio + GREEN + Task 2, 9 testes novos verdes, zero auto-fixes), 04-03 (5 min, 1 task TDD, 2 commits, 10 testes verdes, 4 auto-fixes Rule 2 a11y hardening).
- Tendência: 04-06 dentro do envelope esperado para entry-point form (1 arquivo, 1 task, sem TDD por design). Sem deviations — PLAN escrito com action verbatim viabilizou execução direta. Cobertura UI virá via UAT 04-07 (próximo).

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
- **Plan 04-06 (2026-05-03):** Pattern de auto-detect device com link de escape em ambos os lados estabelecido em `new-reading-form.tsx`: `useEffect` com `window.matchMedia('(pointer: coarse) and (hover: none)')` (mais robusto que User-Agent — cobre iPad em modo desktop), SSR-safe default `'mobile_camera'`, listener `'change'` com cleanup. Pattern de **dois submits no mesmo form** via override de hidden input por `<button type="submit" name="method" value="<oposto>">` — quando o botão é clicado, browser inclui SEU value no FormData e o hidden input com mesmo `name` é sobrescrito (HTML form behavior canônico, Pattern G de 04-PATTERNS.md). Zero JS adicional para o caminho de escape — funciona com JS desabilitado.
- **Plan 04-06 (2026-05-03):** Decisão de remover botão "Cancelar" do form de nova leitura: usuário em `/leituras/nova` chegou aqui por escolha (clicou em "Nova leitura" no sidebar ou em `/clientes/[id]`); "voltar" é responsabilidade do browser back button. Imports relacionados (`Link`, `buttonVariants`, `cn`) removidos consistentemente — sem dead code. Decisão registrada nos comments do PLAN — pode voltar como Link discreto se UI review reclamar. Padrão de "fluxo unidirecional sem cancelar redundante" pode ser aplicado a outros forms se houver consenso.

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

Última sessão: 2026-05-04 — **Fase 5 Wave 0 (05-01 + 05-02) concluída** e mergeada em main (commits `51f5a51` + `00f43c5`). Status: `executing`; 2/17 plans Fase 5; 27/42 plans v1.0.

Stopped at: aguardando confirmação do usuário para spawnar **Wave 1a** (`05-03..05-08` — 6 plans paralelos: Pydantic schemas + detect/segment/compose/normalize/enhance). Próximo gate humano natural: Wave 1b (05-09 features) tem `checkpoint:human-verify`; antes disso é execução paralela limpa.

Recovery feito de bad-merge inicial em branch stale `agent-ae868b6c096eba96f` — main restaurada via reflog para `f597353` antes dos merges corretos. `HANDOFF.json` legado da Fase 3 removido.

Smoke verde rodado em Wave 0:

- 05-01 vision-service test infra → 10/10 pytest verdes; `audit:vocabulary` CLI funcional
- 05-02 apps/web service-role + HMAC → 19/19 vitest verdes; pattern discriminated union `HmacVerificationResult`

Resume file: `.planning/phases/05-pipeline-visao-modal/05-CONTEXT.md` (planejamento de fase) + `05-{NN}-PLAN.md` para cada plan ativo.

Próxima ação: `/gsd-execute-phase 5` retoma Wave 1a (executor detecta Wave 0 ✓ e spawna 6 plans paralelos).

---

Sessão anterior (2026-05-04 madrugada UTC): **Fase 4 (Upload desktop) fechada** via UAT founder + gsd-verifier passed (4/4 success criteria, 2/2 requirements UPLOAD-01/02). 7/7 plans concluídos. Smoke: `pnpm build` verde, bundle splitting de heic2any validado (chunk dedicado 1.35 MB).

Sessão anterior anterior (2026-05-03 manhã): **Fase 3 fechada via UAT 03**. 20 commits de calibração culminando em VLM gate confiável (Claude Haiku 4.5 via /api/capture/validate). PWA standalone Android pendente como dívida não-blocking pra Estágio 1.
