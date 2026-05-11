# Checkpoint 2026-05-11 — Phase 07.1.5 closeout + Phase 07.1.6 architectural decision

## TL;DR

- **Phase 07.1.5 P1 executou com verdict B_INFEASIBLE.** HSV color pre-segmentation (Approach B) implementada e iterada 3 ciclos contra Nailli; convergência monotônica observada (974→496→279 px max-center-spread no olho direito) mas gate <=50 px inalcançável — color mask deixa eyeball/sclera como single connected component, Hough trava no eyeball outer arc.
- **Phase 07.1.5 P2 não executado.** AUTO-BLOCKED em Task 0 conforme founder directive 2026-05-11 ("Auto-block C-branch — não quero que ele tome essa decisão sozinho dado o custo e complexidade"). Founder decidiu ESCALATE_NEW_PHASE.
- **Investigação arquitetural:** proposta de canonical capture pipeline upstream (Haiku/Sonnet bbox + sharp crop + resize 800×800) discutida como alternativa ao U-Net.
- **Probe Haiku (`probe-haiku-iris-landmarks.mjs --model=claude-haiku-4-5-20251001`):** confirmou templating — radius_pct=0.12 em 5/6 fotos, rotation_angle_deg=-8 em 5/6, center_x≈0.58 em 4/6. VLM landmark detection via Haiku **inviável** (não mede per-image, retorna defaults plausíveis com confiança falsa).
- **Probe Sonnet (`--model=claude-sonnet-4-6`):** 5/6 crops visualmente aprovados pelo founder. Bbox center varia per-image (range 0.35-0.52 em x, 0.22-0.45 em y) — comportamento de medição real, não template. Custo $0.0474 / 6 fotos = ~$0.05/reading. **Viável** para canonical capture.
- **Smoking gun crítico no Sonnet:** `rotation_angle_deg = -3.00` em **TODAS as 6 fotos** — rotation detection via VLM **morta independente do modelo**. Canonical CROP funciona; canonical ROTATION não.
- **Fix em produção (commit `ed7b7be`, pushed):** Haiku validate prompt endurecido — borrado quantitativo (>=10 fibras radiais contáveis), muito_longe qualitativo (íris cabe 5× na menor dim?), borrado + reflexo_total promovidos a hard-block (Confirmar disabled).
- **Decisão arquitetural:** Phase 07.1.6 = **canonical capture via Sonnet bbox** (substitui U-Net escalation). Sem rotation correction (terapeuta é responsável pela orientação da câmera).

## Decisões locked nesta sessão

| ID | Decisão | Razão |
|---|---|---|
| C-01 | Phase 07.1.6 = canonical capture via Sonnet bbox, NÃO U-Net | Sonnet probe 5/6 acertou; U-Net resolve só detect/segment (sintoma) enquanto canonical resolve detect/segment + Sonnet Vision downstream economy + corpus standardization (4 ganhos) |
| C-02 | Sem rotation correction automática | Sonnet templatou rotation 100% — VLM rotation detection inviável; terapeuta fica responsável pela orientação |
| C-03 | Crop floor: max(2.5×r, 0.4×min(W,H)) | Mitiga falha do left_lateral (radius_pct=0.10 produzia crop pequeno demais) sem lógica condicional baseada em confidence |
| C-04 | Sonnet 4.6 (não Haiku 4.5) como landmark detector | Haiku templata bbox (radius=0.12 em 5/6, x=0.58 em 4/6). Sonnet mede per-image. Custo $0.05/reading vs $0.006 — trivial |
| C-05 | Manter 2 calls Anthropic (Haiku validate client-side + Sonnet bbox server-side) | Unificar em 1 call exigiria mudar UX flow (terapeuta vê feedback DEPOIS do upload); custo extra $0.003/reading é ruído |
| C-06 | borrado + reflexo_total = hard-block | Falso negativo destrói downstream (parser produz lixo, classifier produz lixo); falso positivo só pede pra refazer |
| C-07 | Threshold muito_longe qualitativo "5×" (diameter ≤ 1/5 menor dim) | Probe mostrou Haiku não estima percentual numérico bem; framing espacial "íris cabe 5× ao longo da menor dim" é verificável visualmente |
| C-08 | Code órfão em quality-scoring.ts (WEIGHTS, computeQualityCheck, dominantFailure) — deixar parado | Não é executado em produção (capture flow usa nativeCamera + QUALITY_TO_SCORE table direta do Haiku). Decidir delete vs revive depois |

## Commits desta sessão (na ordem cronológica)

| Commit | Escopo | Descrição |
|---|---|---|
| `a67eb1f` | 07.1.5-01 P1 | test(Wave 0): RED scaffolding — 6 unit tests + 3 detect tests (BLOCKER-3 MediaPipe non-regression guard com mocked landmarker) + conftest synthetic_close_up_eye fixture + probe --dump-detect-table flag |
| `173c6ea` | 07.1.5-01 P1 | feat(Wave 1): pipeline/masks.py public color_iris_mask (HSV→inRange→MORPH_CLOSE→MORPH_OPEN) + integração em _hough_circle_fallback (lines 119→123) + segment.py iris_mask additive defense + return dict `_detector: hough_color_masked` |
| `7bfb5b6` | 07.1.5-01 P1 | tune(Wave 2): 3 ciclos de _COLOR_MASK_* constants — Nailli still infeasible |
| `f415ac8` | 07.1.5-01 P1 | docs(P1 SUMMARY): BINARY verdict B_INFEASIBLE + 8 sections (threshold trajectory + per-fixture convergence tables + D-05 fixture rationale + visual gate PNGs + test gate evidence + empirical evidence appendix) |
| `d4d8322` | 07.1.5 tracking | docs: record P1 B_INFEASIBLE verdict + auto-block P2 in STATE/ROADMAP |
| `ed7b7be` | capture/validate | fix: tighten Haiku blur criterion + qualitative distance threshold + BLOCKING_REASONS += borrado/reflexo_total |

Todos pushed para origin/main.

## Artefatos não commitados (gitignored, persistem localmente)

- `apps/web/scripts/probe-haiku-iris-landmarks.mjs` — script de probe (gitignored via `apps/web/scripts/output/` no .gitignore root, mas o script em si é committable; **não foi commitado nesta sessão** — decidir se vale guardar pra reusabilidade na próxima sessão)
- `apps/web/scripts/output/landmarks-probe-haiku-4-5.json` + `crops-haiku-4-5/` — 6 crops Haiku (3/6 com íris cropada errada por templating)
- `apps/web/scripts/output/landmarks-probe-sonnet-4-6.json` + `crops-sonnet-4-6/` — 6 crops Sonnet (5/6 corretos, founder-aprovados)
- `C:\Users\rhelt\AppData\Local\Temp\nailli_postfix_detect_diagnostics.json` — Cycle 3 final per-eye/per-angle segment circles (BLOCKER-2 input que P2 nunca consumiu)

## Findings arquiteturais não-óbvios

1. **`quality-scoring.ts` é código órfão em produção.** WEIGHTS / computeQualityCheck / overallScore / dominantFailure / feedbackMessage não são consumidos pelo capture flow real. Production usa `<input type="file" capture="environment">` (native camera) + table simples QUALITY_TO_SCORE = {ruim:0.20, regular:0.55, boa:0.82, excelente:0.95}. Os 3 test failures pre-existing em quality-scoring.test.ts são consequência disso — referenciam `WEIGHTS.reflex` que foi removido. Decisão deferida pra futuro: delete vs reactivate via FaceMesh.

2. **Não há live overlay durante a captura.** Native camera nativo iPhone/Android renderiza sua própria UI; o app só pode mostrar feedback DEPOIS do shutter (CapturePreview com badge derivado da resposta do Haiku). Reactivar live overlay exigiria mudar de native camera pra `getUserMedia` + canvas + MediaPipe FaceLandmarker — escopo grande, deferido.

3. **VLM landmark detection é fundamentalmente unreliable em produção.** Haiku templata bbox com confiança 0.78-0.88 (alta!) — nenhum sinal interno de incerteza. Sonnet melhora bbox center significativamente mas templata rotation 100%. Implicação geral: VLMs são bons em classificação semântica, ruins em localização espacial precisa. Pra qualquer feature que precise de coords pixel-accurate, usar VLM como signal mas com human verification ou downstream geometric check.

## Phase 07.1.6 escopo proposto (locked, aguardando /gsd-discuss-phase pra refinar)

```
Phase 07.1.6: Canonical Capture Pipeline
Goal: Modal recebe imagens 800×800 com íris centrada via Sonnet bbox + sharp crop
upstream, eliminando o problema de detect/segment do 07.1.5 fixando geometria
upstream em vez de adicionar mais modelo downstream.

Approach: Sonnet 4.6 retorna iris_bbox no upload pipeline; sharp crop com floor
de tamanho (max(2.5×r, 0.4×min(W,H))); Modal contract atualizado pra esperar
canonical 800×800. Sem rotação (VLM rotation provadamente unreliable).

Plans esperados (5-6):
1. Sonnet canonicalize endpoint (apps/web/app/api/capture/canonicalize/route.ts)
   - server-side call usando @anthropic-ai/sdk + extended prompt
   - confidence threshold gate (fallback to "no crop" if conf < 0.5)
   - sharp crop com floor de tamanho
2. Upload flow rewire (capture-client → canonicalize → dual upload original/canonical)
3. Modal contract update + feature flag (CANONICAL_INPUT=true/false)
4. Backfill migration script (existing ~10-20 readings → re-canonicalize)
5. Tests: bbox accuracy regression suite (Nailli + 2-3 fixtures como golden set)
6. Founder UAT + smoke procedure docs

Out-of-scope (locked):
- Rotation correction automática (VLM unreliable; terapeuta responsável)
- Iris segmentation polish dentro do crop (Modal Hough continua sendo o segmenter)
- LightIrisNet / U-Net / qualquer GPU model novo
- 07.1.5 P2 fica formalmente ABANDONED com verdict ESCALATE_NEW_PHASE -> 07.1.6 canonical

Cross-cutting:
- Confidence threshold é gate empírico (Sonnet 5/6 success → precisa fallback robusto pro 1/6)
- Modal redeploy é founder-gated
- Pre-requisito: capture/validate fix do commit ed7b7be (Haiku tighten) — sem isso, fotos ruins entram no canonical pipeline e produzem crops sobre lixo
```

## Próxima ação

`/gsd-discuss-phase 07.1.6` — locked decisions C-01..C-08 acima já cobrem ~70% das gray areas; discuss-phase vai endereçar:
- Confidence threshold exato pro fallback
- Feature flag default (canonical=true em prod desde dia 1, ou opt-in?)
- Backfill estratégia (one-shot script vs background job vs nunca)
- Bbox regression suite tooling (golden JSON + visual diff?)

Phase 07.1.5 P2 fica formalmente ABANDONED — não voltar nele.
