---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: phase_complete
last_updated: "2026-05-03T00:00:00.000Z"
progress:
  total_phases: 9
  completed_phases: 3
  total_plans: 18
  completed_plans: 18
  percent: 33
---

# Estado do projeto

## Referência ao projeto

Ver: .planning/PROJECT.md (atualizado em 2026-04-30)

**Valor central:** Cada cliente atendido produz um JSON de features genuinamente diferente, e por isso cada relatório é genuinamente diferente. Pipeline de visão objetivo + LLM ancorado em RAG é o coração do produto.
**Foco atual:** Fase 3 fechada via UAT (2026-05-03). Próximo: Fase 4 — Upload desktop.

## Posição atual

Fase: 3 de 9 — **CONCLUÍDA** (Captura mobile / PWA)
Próxima: Fase 4 (Upload desktop)
Status: Phase 3 complete, ready to plan Phase 4
Última atividade: 2026-05-03 — UAT 03 fechado em 13 testes + 20 rodadas de calibração do gate VLM. Captura completa funcional iPhone Safari (PWA standalone iOS); fluxo nativo + Claude Haiku 4.5 validation + finalize → /leituras.

Progresso: [███░░░░░░░] 33% (3/9 fases)

## Métricas de performance

**Velocidade:**

- Total de plans concluídos: 6
- Duração média: ~12 min/plan (incluindo descoberta+fix de bug de grants e 3 iterações de vercel.json)
- Tempo total de execução: ~75 min de Wave 1 ao deploy production

**Por fase:**

| Fase | Plans | Total | Média/plan |
|-------|-------|-------|------------|
| 1 — Setup | 6 | ~75 min | ~12 min |

**Tendência recente:**

- Últimos 5 plans: —
- Tendência: — (sem amostra ainda)

*Atualizado após a conclusão de cada plan.*

## Contexto acumulado

### Decisões

Decisões são logadas em PROJECT.md (tabela "Decisões-chave").
Decisões recentes que afetam o trabalho atual:

- **Bootstrap (2026-04-30):** stack inteira do SPEC herdada como "decidida sem ADR ratificado" — pode ser honrada ou re-decidida via ADR em qualquer fase.
- **Bootstrap (2026-04-30):** métrica de sucesso primária = uso semanal real do fundador em clientes reais; beta com 10–20 terapeutas é Estágio 2 condicional.
- **Bootstrap (2026-04-30):** LGPD + posicionamento "ferramenta de apoio à anamnese, não diagnóstico" tratados como restrições não-negociáveis em PROJECT.md (vocabulário proibido, copy obrigatória, ancoragem do prompt em features do JSON).

### Todos pendentes

Nenhum ainda.

### Bloqueadores / Preocupações

- **Sem ADRs ratificados:** as 21 constraints do SPEC (Next.js / Supabase / Modal / Sonnet 4.6 / Voyage / Stripe / Resend) estão como `locked: false`. Não bloqueia execução, mas qualquer plan-phase deve estar consciente de que pode formalmente re-decidir via ADR — particularmente antes da Fase 5 (Modal) e Fase 7 (LLM), onde a escolha tem maior impacto técnico.
- **Revisão jurídica healthtech (~R$ 2–4k) recomendada antes de qualquer rollout externo na Fase 9.** Não é pré-requisito para dogfooding interno do fundador (Estágio 1), mas é gate para Estágio 2.
- **Corpus RAG seed (Fase 6) depende de obter PDFs de Jensen Vol. 1 e Battello em pt** — verificar disponibilidade legal/licenciamento antes de ingerir.
- **Fase 3 — Plan 03-08 (RecoveryBanner + PWAInstallBanner + listagem rascunhos):** features não foram implementadas como originalmente planejadas. finalizeReadingAction foi absorvida em fixes pós-execução. RecoveryBanner D-12 (banner de recovery após interrupção) e PWAInstallBanner D-14 (CTA de install nag) ficaram como **dívida de polish** pra retomar antes do beta externo (Estágio 2 / Fase 9).
- **Fase 3 — PWA standalone Android Chrome:** install funciona mas abre com URL bar (não modo standalone). Hipótese: SW não registra em prod, ou ícone 404, ou start_url redireciona. iOS Safari funciona normal. Investigar antes do beta externo.
- **Custo VLM em produção:** ~$0.0008/foto via Claude Haiku 4.5. Projeção: ~$21/mês com 100 terapeutas × 30 sessões × 6 fotos. Aceitável pra Estágio 1+2.

## Itens diferidos

Nenhum (bootstrap inicial, sem milestone anterior).

| Categoria | Item | Status | Diferido em |
|-----------|------|--------|-------------|
| *(nenhum)* | | | |

## Continuidade de sessão

Última sessão: 2026-05-03 — **Fase 3 fechada via UAT 03**.

**Pivôs arquiteturais durante UAT (sem replanning formal):**
- MediaPipe FaceLandmarker → pupil detection pixel-based → Otsu adaptativo → bypass → **Claude Haiku 4.5 VLM via /api/capture/validate** (4 iterações; última solução é a definitiva).
- Streaming PWA com live quality gate → **câmera nativa via `<input capture="environment">`** com análise pós-captura.
- Removido: Laplacian variance, useCamera, CameraView, CameraDeniedScreen, IrisDetector, RecoveryBanner, PWAInstallBanner.
- Adicionado: `@anthropic-ai/sdk@0.92.0`, `exifr@7.1.3` (front-cam detection), `app/api/capture/validate/route.ts`, `lib/capture/validate-image.ts`, `lib/capture/camera-detection.ts`, `lib/capture/post-capture-analysis.ts`.

**UAT 03 cobertura:** 13 testes principais (cold start, PWA install iOS Safari, fluxo cliente→captura→preview→finalize→storage, timezone). 1 issue conhecido (PWA standalone Android, não-blocking pra Estágio 1).

**20 commits de calibração** culminando em VLM gate confiável: detecta sem_olho, dois_olhos, muito_longe, olho_fechado, reflexo_total, borrado; classifica quality em ruim/regular/boa/excelente.

Próxima ação: `/clear` + `/gsd-discuss-phase 4` ou `/gsd-plan-phase 4` (Upload desktop — dropzone produzindo a mesma estrutura `reading_images` da Fase 3).
