# Phase 5: Pipeline de visão (Modal) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 05-pipeline-visao-modal
**Areas discussed:** Trigger & disparo, Comportamento em falha, Mapa setorial Jensen, Fixtures + testes por etapa

---

## Trigger & disparo

### Q1: Como o `analyze_iris` do Modal deve ser chamado a partir do Next.js?

| Option | Description | Selected |
|--------|-------------|----------|
| .spawn() + webhook | Async fire-and-forget direto no `finalizeReadingAction` + webhook callback. | |
| .remote() inline blocking | Síncrono dentro do server action, espera até 120s pelo JSON. | |
| Rota dedicada + .spawn() | Endpoint `app/api/readings/[id]/process` que finalize chama internamente; mesma rota expõe retry manual. | ✓ |

**User's choice:** Rota dedicada + .spawn()
**Notes:** Habilita botão `Reprocessar` em fase futura sem refactor; logs separados; separação clara entre "captura terminou" e "rodar pipeline".

### Q2: Após o terapeuta clicar `Concluir` e o pipeline iniciar, o que aparece na UI?

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect imediato p/ listagem | Vai para `/leituras` com badge `Processando`; webhook revalida. | ✓ |
| Página dedicada de processamento | Redirect para `/leituras/[id]` com polling 3s. | |
| Toast + permanece na captura | Permanece na rota com toast de pipeline iniciado. | |

**User's choice:** Redirect imediato p/ listagem
**Notes:** Casa com fluxo real de consultório (terapeuta termina captura, conversa com cliente, depois vê relatório). Sem polling client-side nesta fase.

### Q3: Botão `Reprocessar` já nesta fase?

| Option | Description | Selected |
|--------|-------------|----------|
| Botão `Reprocessar` na listagem | Para readings com `status='failed'`, mostra botão discreto que chama mesma rota dedicada. | ✓ |
| Sem retry manual nesta fase | Falha = refazer captura. Reprocessar diferido p/ Fase 7 ou 9. | |
| Auto-retry server-side, sem botão | Webhook tenta `.spawn()` de novo até 2x antes de marcar definitivo. | |

**User's choice:** Botão `Reprocessar` na listagem
**Notes:** Durante dogfooding o fundador vai bater em pipeline falhando — botão evita refazer captura inteira. Custa pouco código (rota dedicada já existe).

### Q4: Modal worker precisa baixar os JPEGs do Storage privado. TTL das signed URLs?

| Option | Description | Selected |
|--------|-------------|----------|
| 10 minutos | Cobre cold-start + retry interno + jitter; LGPD-friendly. | ✓ |
| 1 hora | Conservador; signed URL exposta em log vale 1h. | |
| 5 minutos | Mais agressivo; risco de TTL expirar mid-pipeline em cold-start pesado. | |

**User's choice:** 10 minutos
**Notes:** Matches com timeout 120s; alinhado com LGPD (dado biométrico exposto pelo mínimo necessário).

---

## Comportamento em falha

### Q1: Quando uma das 6 fotos falha em uma etapa do pipeline, o que acontece?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-eye soft degradation | Pipeline continua se ao menos 1 ângulo de cada olho ficar processável; warnings em image_quality. | ✓ |
| Hard fail no primeiro erro | Qualquer etapa que falhe → `status='failed'`; refazer captura inteira. | |
| Per-stage degradation | Cada etapa tenta seu melhor com null nos slots faltantes. | |

**User's choice:** Per-eye soft degradation
**Notes:** Dogfooding tolera fotos imperfeitas; LLM Fase 7 já vai precisar respeitar `image_quality.warnings`; falha só quando produto realmente não entrega.

### Q2: UX do `failed` na listagem `/leituras`?

| Option | Description | Selected |
|--------|-------------|----------|
| Badge `Falhou` + tooltip + Reprocessar | Tooltip do `processing_metadata.error_summary` (string curta pt-BR). | ✓ |
| Badge `Falhou` simples, sem detalhe | Só badge vermelho, sem mensagem. | |
| Badge + link `Ver detalhes` (cria stub) | Link abre stub `/leituras/[id]` com payload completo. | |

**User's choice:** Badge `Falhou` + tooltip + Reprocessar
**Notes:** Catálogo curto de error_summary strings (3–6) cobre os casos comuns; expansão futura. Vocabulário LGPD auditado.

### Q3: Modal `keep_warm` (manter container quente)?

| Option | Description | Selected |
|--------|-------------|----------|
| Cold-start aceito | Sem keep_warm; container sobe sob demanda. | ✓ |
| keep_warm=1 sempre | 1 container T4 sempre quente; ~$30–60/mês extra. | |
| keep_warm condicionado | Cron schedule horário comercial. | |

**User's choice:** Cold-start aceito
**Notes:** Dogfooding low-volume (3 leituras/semana) — keep_warm queimaria orçamento sem benefício. Reavaliar pós-Estágio 2.

### Q4: Idempotência do webhook (Modal pode mandar duplicado)?

| Option | Description | Selected |
|--------|-------------|----------|
| reading_id + status guard | Só aplica payload se `status='processing'`; ignora se já `ready`/`failed`/`edited`. | ✓ |
| Modal FunctionCall ID único | Trigger guarda `modal_call_id`; webhook valida match exato. | |
| Sem guard — idempotente por design | Sempre sobrescreve; assume Modal determinístico. | |

**User's choice:** reading_id + status guard
**Notes:** Não sobrescreve `ai_report_edited` da Fase 7 acidentalmente. Modal call ID guardado opcionalmente para defesa em profundidade (D-T5).

---

## Mapa setorial Jensen

### Q1: Onde mora a fonte canônica do mapa?

| Option | Description | Selected |
|--------|-------------|----------|
| Constante Python no vision-service | `pipeline/iris_maps/jensen.py` com `JENSEN_MAP: dict`. | |
| JSON asset versionado | `vision-service/data/jensen-map.json` lido em runtime. | ✓ |
| Tabela `iris_maps` no banco | Migration cria tabela populada via seed. | |

**User's choice:** JSON asset versionado
**Notes:** Editável sem mexer em código Python; potencialmente reusável pelo Next.js (Fase 7) para `IrisMap.tsx`.

### Q2: Idioma das strings de zona?

| Option | Description | Selected |
|--------|-------------|----------|
| pt-BR | `fígado`, `vesícula`, `pulmão lóbulo superior`. | ✓ |
| en (snake_case técnico) | `liver`, `gallbladder`, `lung_upper_lobe`. | |
| Bilingual (pt + en) | `{pt: 'fígado', en: 'liver'}`. | |

**User's choice:** pt-BR
**Notes:** LLM Fase 7 cita literalmente sem tradução intermediária; consistência com PROJECT.md (`Idioma do produto: pt-BR`); auditoria de vocabulário proibido funciona direto no JSON.

### Q3: Qual edição do mapa Jensen serve de fonte autorizada?

| Option | Description | Selected |
|--------|-------------|----------|
| Jensen Vol. 1 (1982 pt-BR) | Mesma edição indexada em RAG na Fase 6. | ✓ |
| Founder escreve manualmente | Versão consolidada baseada na prática + Battello + Lo Rito + tradição brasileira. | |
| Mapa público de referência (defer ao planner) | Researcher pesquisa mapa público em pt-BR. | |

**User's choice:** Jensen Vol. 1 (1982 pt-BR)
**Notes:** Consistência features↔RAG↔LLM. Founder valida draft do mapa antes do commit.

### Q4: Mapa para olho direito vs esquerdo (assimetria Jensen)?

| Option | Description | Selected |
|--------|-------------|----------|
| Mapa por olho separado | `{right: {...}, left: {...}}` independentes. | ✓ |
| Mapa único + lista de exceções por olho | Base simétrica + dict de exceções. | |
| Defer ao planner com pesquisa | Researcher consulta Jensen Vol. 1 e propõe estrutura. | |

**User's choice:** Mapa por olho separado
**Notes:** Respeita assimetria de Jensen (coração só no esquerdo, etc.); LLM Fase 7 recebe zonas corretas por olho sem inferir; reflete forma como iridologista pensa o mapa.

---

## Fixtures + testes por etapa

### Q1: Fonte das fotos de fixture?

| Option | Description | Selected |
|--------|-------------|----------|
| Founder grava set próprio | ~6–10 fotos consentidas, versionadas em `vision-service/tests/fixtures/iris/`. | ✓ |
| CASIA-Iris (dataset acadêmico) | Subset open de dataset NIR/IR. | |
| Sintéticas (Stable Diffusion ou shader) | Geradas com parâmetros controláveis. | |

**User's choice:** Founder grava set próprio
**Notes:** Alinhado com dogfooding-first; zero ambiguidade jurídica; matéria-prima realista do produto.

### Q2: Onde os testes rodam?

| Option | Description | Selected |
|--------|-------------|----------|
| Pytest local CPU + GH Actions | Sem GPU; sem Modal cloud em CI. | ✓ |
| Modal CI integration test | CI roda `analyze_iris` real com créditos Modal. | |
| Só manual antes de deploy | Sem CI; founder roda pytest local. | |

**User's choice:** Pytest local CPU + GH Actions
**Notes:** Custo CI = $0; cobre 95% do código; smoke manual de integration test antes de `modal deploy`.

### Q3: Tipo de assertion por etapa?

| Option | Description | Selected |
|--------|-------------|----------|
| Structural assertions | Shape e ranges válidos; sem comparar pixels. | |
| Snapshot/golden | Output `.npy`/`.json` byte-a-byte com tolerance. | |
| Híbrido: structural + 1 metric | Structural por etapa + 1 métrica numérica calibrada (IoU, constituition.primary). | ✓ |

**User's choice:** Híbrido: structural + 1 metric
**Notes:** Cobre regressão de qualidade sem ser frágil; precisa anotação manual das fixtures (`expected.json`) feita uma vez upfront pelo founder.

### Q4: Como armazenar fotos de fixture (LGPD + repo size)?

| Option | Description | Selected |
|--------|-------------|----------|
| Subset pequeno commitado + .gitattributes | ~3–5MB total; `CONSENT.md` ao lado. | ✓ |
| Git LFS | LFS para não inflar `.git`. | |
| Bucket Supabase de teste | Fixtures em bucket privado dedicado. | |

**User's choice:** Subset pequeno commitado + .gitattributes
**Notes:** Repo segue privado até LGPD review da Fase 8; CI sem fetch externo; mitigação clara via CONSENT.md.

---

## Claude's Discretion

- Estrutura interna de `vision-service/pipeline/` (organização de helpers)
- Forma exata da assinatura HMAC (algoritmo, header name, formato hex/base64)
- Estrutura do payload do webhook (full features inline vs result_ref + secondary fetch) — recomendação inicial: full inline
- Heurísticas OpenCV exatas (adaptive threshold params, morphology kernel size) calibradas contra fixtures
- HSV clustering exato para `iris_color` (k, espaço de cor, classificação)
- Parâmetros do Hough circular (`HoughCircles` minRadius/maxRadius/dp/param1/param2)
- Implementação do photometric compose (média ponderada vs decomposição albedo)
- Resolução do `daugman_polar` (256×512 padrão biométrico?), interpolação
- Parâmetros do CLAHE (clipLimit, tileGridSize)
- Naming convention exato dos warnings em `processing_metadata.warnings` e dos `asymmetry_notes`
- Posicionamento UI exato do badge na listagem
- Tooltip rendering library (shadcn já tem)
- Ferramenta de anotação manual das fixtures (`expected.json`)
- Strategy de logging dentro do Modal worker (print vs structlog)
- CI matrix exata (Python 3.11 só vs 3.11+3.12)
- Componente exato do badge na listagem (reuso de `<Badge>` shadcn)
- Modal SDK access pattern (web endpoint vs HTTP vs Python SDK em runtime separado)

## Deferred Ideas

- Polling client-side / Supabase Realtime / push notifications para live status — Fase 7 ou 9
- Tela de detalhe `/leituras/[id]` — Fase 7
- `keep_warm` Modal — pós-Estágio 2 quando volume justificar
- Auto-retry server-side de erros transitórios — polish futuro se virar dor
- U-Net pré-treinada CASIA-Iris para segmentação — v1.1
- CNN própria de detecção de lacunas/criptas — v2 (depende de banco de casos consentido)
- Multi-mapa simultâneo (Jensen + Jausas + Hidalgo) — v2 (PROJECT.md locked-out)
- Mapas Jausas/Hidalgo populados — v2
- Modal CI integration test com Modal cloud — manual antes de `modal deploy`
- Snapshot/golden tests por etapa — explicitamente rejeitado por fragilidade
- Modal volume / artifact storage para resultados intermediários — fora desta fase
- Pydantic strict no vision-service rejeitando outputs incompletos — D-F1 escolhe permissive
- Edição manual de features pelo terapeuta — fora do MVP
- Banco anonimizado de casos alimentando treinamento futuro — v2 (privacy review obrigatória)
- Live preview da pipeline ("etapa 3/6: compose...") — over-engineering para 30–90s
- Detecção de heterocromia setorial granular — v2 (heterocromia central já no JSON SPEC §4.3)
- Telemetria estruturada com OpenTelemetry / Sentry — fora; logs Modal+Vercel suficientes
- Versionamento de `model_version` via git commit hash — semver manual é fonte de verdade
