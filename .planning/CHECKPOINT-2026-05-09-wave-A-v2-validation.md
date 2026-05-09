# Checkpoint — Wave A v2 validação + P0c soft revert + anchor regex broaden + PLAN 07.1-03 (sessão noite 2026-05-09)

> Continuação direta do `CHECKPOINT-2026-05-09-B1a-modal-verification.md`. Sessão longa (~14 commits) cobrindo Wave A v1 → v2 → soft revert + responsável-product backlog + PLAN 07.1-03 spec.

## TL;DR

- ✅ Wave A v1 (P0c + A2 + A3 + database.ts regen) entregue cedo na sessão
- ❌ Validação Wave A v1 falhou em 3/4 critérios — P0c FAIL, A2 PARTIAL, A3 PASS, anchor 21%
- ✅ Wave A v2 (P0c v2 + A2 v2 + anchor mandate) entregue mid-sessão pra endereçar falhas
- ❌ Validação Wave A v2 falhou de novo em 2/4 — P0c FAIL OUTRA VEZ (literal anti-pattern emitido), A2 PARTIAL (melhorou), A3 PASS, anchor 0% (Sonnet adotou novo formato compacto)
- 💡 **Pivô crítico do founder:** "não vejo problema... o sonnet puxar o cadastro... e ja combinar com a pessoa e idade" — premissa original do P0c estava sobre-corrigida
- ✅ **Soft revert do P0c** — Princípio 6 simplificado (mantém só lacuna do cadastro + low confidence), reminders inline em §2/§5/§6 removidos
- ✅ **Anchor regex broaden** — audit.ts aceita formato compacto `[\`feature.path\`]` além do verbose `[ancorado em: ...]`
- 📋 **Backlog Phase 9** — responsible-product (Q1 confidence visível + Q2 calibração linguística + Q3 checklist visual) capturado em todo
- 📐 **PLAN 07.1-03** — `/admin/calibration` page spec'd (8-14h estimativa, 7 atomic tasks, 5 waves)
- ⏳ **Calibration sprint** deferido pra próxima sessão — usa /admin/calibration depois de implementada

---

## Sequência detalhada da sessão

### Fase 1 — Wave A v1 entrega (commits `4e8672a` → `65f48ce`)

3 prompt edits em `apps/web/prompts/system.md`:
- **P0c** (`98c52ea`): Princípio 6 forçando declaração de cadastro-dependentes
- **A2** (`2d6e37f`): Princípio 7 forçando voz dupla
- **A3** (`1d2ce94`): strengthening anti-duplicação encerramento legal

+ database.ts regen (`65f48ce`) pra migration 0008 que estava uncommited.

### Fase 2 — Validação Wave A v1 (regen 1)

Founder triggou regen do Rhelton via UI. Resultado:

| Critério | v1 |
|---|---|
| A3 (disclaimer único) | ✅ PASS |
| A2 (voz dupla) | 🟡 PARTIAL |
| P0c (cadastro prefix) | ❌ FAIL — Sonnet usou "Nailli" como nome feminino sem declarar base do cadastro |
| Anchor rate | 21% (regex parcial — Sonnet emitia formato variante que C1 só cobria parcialmente) |

Diagnóstico: 5 falhas estruturais do P0c v1 — exemplo "Correto" autodestrutivo, gatilho condicional ambíguo, anti-padrão "extrapolar" não-cognitivo pra Sonnet, regra global sem reforço seccional, e item 6 de 7 numa lista longa.

### Fase 3 — Wave A v2 entrega (commits `1799ff0` + `664f94b`)

- **P0c v2 + A2 v2 bundle** (`1799ff0`): Princípio 6 reescrito (incondicional, checklist literal de termos, anti-padrão proibido literal, padrão correto estrutural, sem conteúdo a copiar) + reminders inline em §2/§3/§4/§5/§6/§7 com ênfase CRÍTICO em §6
- **Anchor mandate** (`664f94b`): preâmbulo OBRIGATÓRIO + per-section paths em §2-6 com meta de 95%

### Fase 4 — Validação Wave A v2 (regen 2)

Resultado:

| Critério | v2 | Δ vs v1 |
|---|---|---|
| A3 (disclaimer único) | ✅ PASS | mantém |
| A2 (voz dupla) | 🟡 PARTIAL-improved | melhorou marginalmente |
| P0c (cadastro prefix) | ❌ FAIL | inalterado — Sonnet emitiu literalmente o anti-pattern adicionado ("Para uma mulher de 37 anos, ...") |
| Anchor rate | 0% | piorou — Sonnet adotou novo formato compacto `[\`feature.path\`]` que regex não cobria |
| Forbidden vocab | 0 | mantém |

Diagnóstico:
- **P0c v2 falhou apesar do anti-padrão LITERAL no prompt.** Sonnet tem prior treinado tão forte em "Para uma mulher de X anos, ..." como construção iridológica padrão que minha proibição literal não venceu. Limite arquitetural do prompt-engineering atingido.
- **Anchor 0% é regressão de FORMATO, não de TAXA.** Sonnet IS emitindo anchors abundantemente, mas no formato compacto `[\`left_eye.collarette\`]` (sem o "ancorado em:" preâmbulo). O regex existente exigia o preâmbulo literal.

### Fase 5 — Backlog responsible-product capturado (commit `227f19d`)

Founder insight estratégico: "a maioria dos terapeutas que vão usar o Iris Codex NÃO são iridologistas" → quality protection é gate de Estágio 2 (Phase 9), não nice-to-have.

3 itens capturados em `.planning/todos/pending/2026-05-09-responsible-product-non-iridologist-therapists.md`:
- **Q1**: Confidence visível por achado na UI
- **Q2**: Sonnet calibra linguagem por confidence (auto-omit < 0.4, hedge extra 0.4-0.8)
- **Q3**: Checklist de validação visual antes de gerar relatório

+ proposta metodológica de **calibração colaborativa founder ↔ AI assistant**: pulls 30-50 readings, founder anota ground truth, AI deriva calibração quantitativa (centroides LAB, confidence bands, checklist items). Mesmo dataset serve Wave B (B1b) + Phase 9 (Q1+Q2+Q3) + Phase 10 (seed dataset).

### Fase 6 — PLAN 07.1-03 admin-calibration-page (commit `94f7c97`)

Founder spec'd em detalhe a tool central pra calibração: página `/admin/calibration` protegida por founder-email gate, com lista de leituras + filtro de status, detalhe com 6 fotos lado a lado + features brutos formatados como relatório técnico (sem LLM) + form de anotação ground truth (cor real, constituição real, achados certos/inventados/faltantes) + botão copy técnico + botão download fotos.

PLAN 07.1-03 escrito (631 linhas, 7 atomic tasks across 5 waves, estimativa 8-14h, 2 founder gates flagged: RLS strategy + FOUNDER_EMAIL value).

### Fase 7 — Anchor regex broaden (commit `36ad36c`)

Decisão entre tighten prompt vs broaden regex → broaden regex (audit permissive em FORMATO, strict em SUBSTÂNCIA). Novo regex em audit.ts:

```js
const ANCHOR_RE =
  /(?:\[\s*ancorado em\s*:[^\]]+\])|(?:\[[^\]]*`[a-z_]\w*(?:\.[a-z_]\w*|\[\d+\])*`[^\]]*\])/giu
```

Aceita formato verbose (regression preserved) E compact (novo). Compact requer pelo menos um backticked identifier com path-shape — evita false positives em `[Markdown link](url)` ou `[outro conteúdo]`.

5 novos test cases (audit.test.ts: 31 → 36 verde):
- Compact basic, compact com array index, compact identifier simples, regression verbose, regression bracket sem backtick.

### Fase 8 — Founder pivô + P0c soft revert (commit `91de774`)

**User input crítico:** "não vejo problema... o sonnet puxar o cadastro... e ja combinar com a pessoa e idade.."

Re-leitura do output do Sonnet com olho fresco:
- Sonnet integra "Nailli" naturalmente (~25 ocorrências), "37 anos" em §2 + §10, sexo feminino implícito coerente
- Premissa original do P0c (terapeuta vai ver ficção sem perceber) estava overcorrected — o terapeuta INSERIU o cadastro, ele sabe o que está lá
- A UI mostra cadastro ao lado do relatório
- Cadastro errado é classe rara de bug; usuário real cadastra com cuidado
- Forçar prosa burocrática "Considerando o cadastro de..." é caro em tom + UX, ganho marginal de auditabilidade

**Decisão:** soft revert. Princípio 6 simplificado pra manter só dois requisitos narrow:
- (a) Declarar lacuna do cadastro quando campo necessário está ausente
- (b) Declarar baixa confidence quando feature.confidence < 0.6

Removido do Princípio 6: checklist literal de termos, anti-padrão proibido, padrão correto estrutural, framing de auditabilidade.

Removido dos section reminders: §2 P6 sex-specific bullet, §5 P6 cadastro-dependent bullet, §6 CRÍTICO downgrade pra "Princípio 6 (parcial)" — só pede declaração de lacuna quando idade ausente.

Mantido intacto: Princípio 7 (duas vozes) + section reminders pra P7, anchor mandate global + per-section, A3 anti-duplicação, Princípio 4 (linguagem hipotética).

Net: prompt perdeu ~40 linhas de bloat. Comportamento de Sonnet não deve regressão (estava ignorando P0c v2 mesmo). "Cadastro-compliance" futura migra de prompt pra UI (/admin/calibration).

---

## Estado final do system.md

Princípios 1-5 inalterados.
Princípio 6 reduzido (cadastro gap + low confidence only).
Princípio 7 inalterado (voz dupla).
"OBRIGATÓRIO — política de ancoragem" intacta.
§2-6 com reminders apenas pra P7 + anchor (P6 reminders removidos).
§13 + Encerramento section com A3 strengthening intactos.
Total: 267 linhas (era 294 antes do soft revert; 140 baseline pré-Wave-A).

---

## Commits da sessão (ordem cronológica)

| Commit | Fase | Tipo |
|---|---|---|
| `4e8672a` | 1 | docs: checkpoint B1a Modal verification |
| `98c52ea` | 1 | Wave A v1 — P0c |
| `2d6e37f` | 1 | Wave A v1 — A2 |
| `1d2ce94` | 1 | Wave A v1 — A3 |
| `65f48ce` | 1 | chore: database.ts regen 0008 |
| `1799ff0` | 3 | Wave A v2 — P0c v2 + A2 v2 bundle |
| `664f94b` | 3 | Wave A v2 — anchor mandate |
| `227f19d` | 5 | docs: backlog Phase 9 responsible-product |
| `94f7c97` | 6 | docs: PLAN 07.1-03 admin-calibration-page |
| `36ad36c` | 7 | fix: audit ANCHOR_RE broaden compact format |
| `91de774` | 8 | fix: prompts P0c soft revert |

13 commits na sessão (incluindo este checkpoint = 14).

---

## Decisões registradas

| Decisão | Quando | Rationale |
|---|---|---|
| **Wave A v1 falhou — investigar prompt structural failures** | mid-sessão | P0c falhou completamente; precisava entender por quê antes de v2 |
| **Wave A v2 com 5 reforços** | mid-sessão | Endereçou as 5 falhas estruturais identificadas; ainda falhou por razão estrutural mais profunda (Sonnet's prior em "para uma mulher de X anos" overrides any anti-pattern) |
| **Anchor regex broaden em vez de prompt tighten** | end-sessão | Audit deve ser permissive em FORMATO e strict em SUBSTÂNCIA. Brigar com Sonnet por prompt produz mais drift. |
| **P0c soft revert (não full revert)** | end-sessão | User clarification que cadastro implícito é OK; mantém valor narrow (gap declaration + low confidence) sem o bloat; remove Princípio 6 burocrático |
| **Calibration sprint deferido** | end-sessão | Sessão pesada (14 commits); calibração precisa de tempo bloqueado e tools (PLAN 07.1-03 implementado primeiro) |
| **PLAN 07.1-03 antes de PLAN 07.1-02 (Wave B)** | end-sessão | Wave B precisa fixtures; fixtures vêm de /admin/calibration; sequência muda |
| **Backlog Phase 9 RESP-01..03 com calibração colaborativa metodológica** | end-sessão | Quality protection pra non-iridologist therapists é gate de Estágio 2, não nice-to-have. Calibração colaborativa começa em Phase 7.1 (não Phase 9) porque Wave B já precisa das fixtures |

---

## O que digitar pra continuar

```
/gsd-resume-work
```

Sequência sugerida da próxima sessão:

1. **Implementar PLAN 07.1-03** — `/admin/calibration` page (8-14h, provavelmente sessão dedicada). 7 atomic tasks across 5 waves. Founder gate em task 1 (RLS strategy) e task 7 (smoke test).
2. **Calibration sprint** — founder usa `/admin/calibration` pra anotar primeira leva de N=20-30 fixtures Rhelton + outras leituras existentes. Tempo estimado ~3-5h (5-10 min/leitura).
3. **AI deriva calibração quantitativa** — confusion matrix vision_features vs ground truth, suggested centroides LAB, suggested confidence bands.
4. **Abrir PLAN 07.1-02** (Wave B) — P0a + P0b + B1d + B1b bundled, agora com decisões data-driven.
5. **Refinar Phase 9 backlog** — RESP-01..03 ganham requirement codes formais em REQUIREMENTS.md baseados nos dados coletados.

---

## Estado git no fim da sessão

- Branch: `main`
- Origin: pushable (push manual a fazer pelo founder)
- Working tree: clean (zero uncommited)
- Untracked: `.claude/`, `livros/`, `Estatégia comercial e mkt/` (esperado)

## Tests verdes ao final da sessão

- apps/web audit.test.ts: 36/36 (era 31; +5 novos cases C1.b)
- vision-service: 22/22 (sem mudança)
- Lint: clean
- audit:vocabulary: 13 hits baseline (8 Phase 3 + 5 do C1+C2 do 1e58a88; sem mudança nesta sessão — system.md soft revert preservou allowlist marker)
