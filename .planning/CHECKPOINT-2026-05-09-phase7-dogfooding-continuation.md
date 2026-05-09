# Checkpoint Phase 7 dogfooding — 2026-05-09 sessão

> Continuação direta do checkpoint 2026-05-08. Próxima sessão: `/gsd-resume-work` ou lê este arquivo.

## TL;DR onde paramos

Sessão de hoje atacou 2 frentes:

1. **Bugs descobertos no fluxo Phase 7 LLM (Nailli reading 71a7bf1d)** — todos resolvidos via 5 commits
2. **Visibilidade visual do pipeline de visão** — plano definido, **implementação ainda não iniciada**

## Frente 1: Phase 7 bugs — RESOLVIDOS

### Sequência do problema
- Streaming completou (~5min, ~$0.30) mas relatório aparecia vazio na tela `/editar`
- Banner "Termos clinicamente afirmativos detectados: diagnóstico" aparecia falsamente

### Diagnóstico
- **Bug 1 — audit:** `audit.ts` varria `encerramento_disclaimer` (server-appended literal mandado por SPEC) que CONTÉM "diagnóstico médico" por design → audit sempre disparava
- **Bug 2 — parser:** regex `^### (\d{1,2})\.` strict-only, Sonnet 4.6 usou `## N.` (H2) porque adicionou seu próprio `# Doc Title` no topo → 0 boundaries detectadas → 12/13 seções perdidas
- **Bug 3 — encerramento duplicado:** Sonnet copiou o blockquote do encerramento literal no fim da seção 13 + route apendou outra cópia

### Commits (na ordem)
```
94f1c7d feat(analyze): persist raw LLM stream to readings.report_raw_text
c559470 fix(audit): skip encerramento_disclaimer in forbidden vocab scan
3b423aa fix(parser): accept ## N. headings (H2), not just ### N. (H3)
f66be8f chore(scripts): add reparse-reading.mjs for parser-miss recovery
bb481c6 fix(prompts): harden system.md vocab discipline + encerramento clarity
```

### Recovery sem queimar regen attempt
Script `apps/web/scripts/reparse-reading.mjs` lê `report_raw_text`, aplica parser corrigido, persiste sections + audit_metadata SEM tocar `regeneration_count`. Nailli (regen_count=2/3) recuperada. 1 attempt ainda sobrando como reserva.

### Pendência humana
- User estava editando manualmente seção 13 da Nailli em `/leituras/71a7bf1d-747f-4de8-9129-13b69197c6a4/editar`:
  - Trocar "não um diagnóstico, mas um convite" por "não uma definição clínica, mas um convite"
  - Remover blockquote duplicado do encerramento (4 linhas com `>`)
  - Salvar edição
  - Entregar ao cliente
- **Ainda não confirmou conclusão da edição/entrega**
- **Ainda não fez `git push`** dos 5 commits

### Migration 0008 deployment status
- Migration aplicada no Supabase remoto (`supabase db push --linked`) — confirmado pelo raw capture funcionando
- Types regenerados — assumido por funcionar mas não verificamos `apps/web/types/database.ts` diff

## Frente 2: Pipeline visibility — PLANO DEFINIDO, NÃO IMPLEMENTADO

### Pergunta do user
"Como podemos saber se o algoritmo viu a íris certinho... se fez o stereo (= compose, fundir 3 ângulos)... desconsiderou os reflexos? Não sou iridologista mas quero precisão cirúrgica."

### Descobertas críticas
1. **`iris_circle` não vaza pro JSON** — é interno (detect → segment → normalize → compose → features), `EyeFeatures` schema é `extra="forbid"`. Não dá pra ver onde algoritmo desenhou íris só olhando `vision_features`.
2. **Pipeline NÃO tem detecção/máscara explícita de reflexos.** Apenas:
   - `segment.py:77` usa `medianBlur` para atenuar specular highlights pré-Hough
   - `compose.py:20` reduz peso do `backlight` (0.2 vs 0.4) por high specular content
   - "Exclusão de reflexos" = emergente do photometric average. Validar = olhar imagem composta. Se reflexo sumiu, OK; se persistir, falhou.

### Decisões do user (via AskUserQuestion)
- **Stereo = compose step** (fusão dos 3 ângulos por olho)
- **Nível de visualização: mínimo cirúrgico** — 6 detection overlays + 2 composed images per leitura
- **Acesso: URLs em SQL** (sem UI) — `SELECT vision_features->'debug' FROM readings WHERE id = ...`
- **Escopo: reprocess Nailli + capturas futuras** — admin endpoint pra disparar Modal de novo

### Plano técnico definido (NÃO codado ainda)
Files a tocar:
1. `vision-service/pipeline/detect.py` — adicionar `render_detection_overlay(image, iris_circle, pupil_circle) -> bytes` (cv2.circle)
2. `vision-service/pipeline/compose.py` — adicionar `composed_to_jpeg_bytes(composed_dict) -> bytes`
3. `vision-service/pipeline/schemas.py` — adicionar `Debug` model com `detection_overlays: list[dict]` + `composed_per_eye: dict[str, str]`. Adicionar `debug: Optional[Debug]` em `IrisFeatures`
4. `vision-service/modal_app.py` — adicionar helper `_upload_debug_image(reading_id, name, jpg_bytes) -> str` (httpx + Supabase Storage signed URL); integrar em `run_pipeline` após detect (per angle) e após compose (per eye)
5. `apps/web/app/api/vision/webhook/route.ts` — Zod aceita `debug` opcional
6. `supabase/migrations/0009_storage_bucket_pipeline_debug.sql` — bucket `iris-pipeline-debug` (privado, apenas service_role uploadeia, signed URLs pra leitura)
7. `apps/web/app/api/admin/readings/[id]/reprocess/route.ts` — NOVO endpoint admin (auth-gated via secret), refetch reading_images, gera signed URLs, chama Modal endpoint
   - OU alternativa: script `apps/web/scripts/reprocess-reading.mjs` (mesmo padrão do reparse-reading.mjs)

### Estimativa
~2-3hrs código + 1 redeploy Modal + 1 captura nova de teste OU 1 reprocess

### Decisão pendente
Se Modal vai uploadear DIRETO pro Supabase Storage (precisa adicionar `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` ao Modal Secret `aurel-iris-vision`) OU se Modal envia JPEGs base64 no webhook payload e a route handler do Vercel uploadeia (evita Modal Secret update mas infla payload pra ~1.4MB). Tendência: **direct Modal → Storage** (mais limpo, mais rápido), com 1 step manual de update do Modal Secret.

## Estado git no fim da sessão

- Branch: `main`
- Origin: pushado até `bcc1129` (checkpoint anterior)
- 5 commits novos local-only aguardando push: `94f1c7d`, `c559470`, `3b423aa`, `f66be8f`, `bb481c6`
- Vercel: rodando build velho (sem os 5 commits novos) — afeta SOMENTE futuras geração; reparse já rodou via script local
- Modal: `0446d76` (Hough tightened) — sem visibility ainda
- DB: leitura `71a7bf1d-747f-4de8-9129-13b69197c6a4` em status `ready`, `report_generated` populado com 13 sections + encerramento, `audit_metadata.forbidden_vocab` tem 1 hit (section 13, "diagnóstico", 2 occurrences) — esperado (a editar manual)

## O que digitar amanhã pra continuar

```
/gsd-resume-work
```

Vai injetar o STATE.md + último checkpoint no contexto. Daí pode dizer "vamos atacar a frente 2 (pipeline visibility)" OU "primeiro confirma a Nailli ficou ok e push dos commits".

Sequência sugerida amanhã:
1. Confirma você fez `git push` (se não fez, faz)
2. Confirma Nailli foi entregue
3. Daí: "vamos atacar pipeline visibility — direct Modal upload approach" — eu já tenho o plano todo neste checkpoint
4. ~2-3hrs implementação + Modal Secret update + redeploy Modal + reprocess Nailli

## Nota sobre setup novo

- Statusline PowerShell-nativo configurado em `.claude/settings.local.json` + `.claude/statusline.ps1` — mostra modelo + dir + branch (sem `ctx:%` porque o JSON do Claude Code não tem esse campo na versão atual)
- Próxima sessão deve aparecer statusline funcionando direto
