# Phase 4: Upload desktop — Discussion Log

**Discussion date:** 2026-05-03
**Mode:** default (no flags)
**Areas selected by user:** all 4 (Entry point + detecção, Associação eye/angle + mínimo, VLM gate + validação, Formatos/limites/UX)

---

## Area 1 — Entry point + detecção device

### Q1: Como o terapeuta vai escolher entre câmera mobile e upload desktop em /leituras/nova?
**Options:** Auto-detect device, sem escolha / Auto-detect + link de escape (Recommended) / Dois CTAs explícitos sempre / Tabs/toggle na própria tela
**User selected:** Auto-detect + link de escape
**Notes:** Reflete o cenário real (iPad/laptop com webcam) — escape evita dead-end sem adicionar fricção pra caso comum.

### Q2: O botão 'Nova leitura' em /clientes/[id] deve oferecer escolha do método, ou sempre cair no fluxo unificado /leituras/nova?
**Options:** Mantém link único para /leituras/nova / Dropdown com 2 opções
**User selected:** Mantém link único para /leituras/nova
**Notes:** Fluxo unificado, escolha de método na tela seguinte.

### Q3: Quando o `capture_method` deve ser gravado no reading?
**Options:** No momento da criação (action recebe param) / Duas actions separadas / Reading neutro no início, definido ao finalizar
**User selected:** No momento da criação (action recebe param)
**Notes:** Estende `createReadingAction` existente pra aceitar `method` no FormData. Simples, rastreável desde o início.

### Q4: O terapeuta pode trocar de método no meio do fluxo?
**Options:** Não — método é fixo no reading / Sim — reading é agnóstico durante o draft
**User selected:** Não — método é fixo no reading
**Notes:** Trocar = descartar e recriar. Evita estados inconsistentes (mistura de proveniências).

---

## Area 2 — Associação eye/angle + mínimo

### Q5: Como o terapeuta associa cada foto a um (olho, ângulo)?
**Options:** 6 dropzones fixas / Drop em massa + dropdown por foto / Drop em massa + drag para slots / Wizard sequencial (igual mobile)
**User selected:** Wizard sequencial (igual mobile)
**Notes:** Reusa SEQUENCE, AngleInterstitial, CapturePreview, getSlotInstructionCopy. Máximo reuso de código + consistência conceitual mobile/desktop. Bulk fica diferido.

### Q6: Quantas fotos são obrigatórias pra finalizar a leitura?
**Options:** Sempre 6 (igual mobile) / Mínimo 1 por olho (máx 6) / Qualquer 1–6 fotos
**User selected:** Sempre 6 (igual mobile)
**Notes:** Contrato uniforme com Fase 5 (Modal). Reduz casos especiais a jusante.

### Q7: Refazer slot já preenchido — pode substituir a foto?
**Options:** Sim, igual mobile / Só antes de finalizar; cancelar volta inteiro
**User selected:** Sim, igual mobile
**Notes:** Upsert em (reading_id, eye, angle). Mesmo padrão D-09 da Fase 3.

### Q8: Recovery banner (D-12 da Fase 3) cobre desktop também?
**Options:** Sim, mesmo banner / Não; desktop não tem recovery banner
**User selected:** Sim, mesmo banner
**Notes:** Banner roteia por capture_method ('mobile_camera' → /capturar, 'desktop_upload' → /upload). Reaproveita getDraftReading sem mudança.

---

## Area 3 — VLM gate + validação

### Q9: Como tratar a validação VLM (Haiku 4.5) nas fotos desktop?
**Options:** Reusa exato igual mobile (hard block) / Soft warning (não bloqueia) / Skip VLM totalmente / VLM no submit final, não por foto
**User selected:** Reusa exato igual mobile (hard block)
**Notes:** Custo ~$0.005/leitura aceito. Consistência de qualidade entre métodos garante input estável pra Modal/LLM.

### Q10: Que validações técnicas client-side bloqueiam o submit? (multi-select)
**Options:** MIME type ∈ {jpeg, png, webp} / Tamanho máximo / Dimensão mínima / Dimensão máxima com downsize
**User selected:** MIME type ∈ {jpeg, png, webp}
**Notes:** Sem dimensão mínima/máxima nem downsize. VLM cobre qualidade visual. Tamanho máximo foi tratado em pergunta separada (Q12).

---

## Area 4 — Formatos, limites e UX do upload

### Q11: HEIC (formato padrão de export do iPhone) — como tratar?
**Options:** Rejeita com mensagem em pt-BR / Converte client-side (lib heic2any/libheif-js) / Aceita e converte server-side
**User selected:** Converte client-side (lib heic2any/libheif-js)
**Notes:** Lib via dynamic import na rota /upload. Bundle restrito sem vazar pro resto do app. Fallback toast se conversão falhar.

### Q12: Limite de tamanho por foto: sem limite client-side, ou limite explícito?
**Options:** Sem limite client-side / Limite 25MB por foto / Limite 10MB por foto
**User selected:** Limite 25MB por foto
**Notes:** Cobre câmeras 24–40MP em JPEG normal. Total leitura ~150MB max — aceitável pra rede de consultório.

### Q13: Estratégia de upload no wizard desktop — imediato ou em batch?
**Options:** Imediato em background (igual mobile) / Imediato bloqueante / Batch no final
**User selected:** Imediato em background (igual mobile)
**Notes:** Reusa uploadWithRetry + AbortController + uploadPromisesRef pattern do capture-client.

### Q14: Cancelar/sair no meio do wizard desktop — mesmo comportamento do mobile?
**Options:** Sim, igual D-13 da Fase 3 / Cancelar = descartar imediatamente
**User selected:** Sim, igual D-13 da Fase 3
**Notes:** Cancelar preserva rascunho com status='pending'. Hard delete só via "Descartar" no banner de recovery.

---

## Scope creep redirected

Nenhum scope creep emergiu durante a discussão. Todas as decisões ficaram dentro do contrato da Fase 4 (Upload desktop produzindo a mesma estrutura de armazenamento do fluxo mobile).

## Deferred ideas

- Bulk upload com associação posterior (drop em massa + drag-to-slots ou auto-detect por VLM)
- Upload em chunks / resumível
- HEIC server-side via sharp
- Multi-foto por ângulo (3 frames, melhor é selecionado)
- EXIF metadata persistido
- Compressão WebP automática
- Drag-and-drop de pasta inteira
- Galeria histórica de fotos do terapeuta

(detalhes em CONTEXT.md `<deferred>`)

## Claude's discretion items

- Heurística exata de detecção mobile/desktop (matchMedia vs UA)
- Lib HEIC específica (heic2any vs libheif-js — planner pesquisa estado 2026)
- Componente exato da dropzone (react-dropzone vs custom vs `<input type="file">` estilizado)
- Loading state da conversão HEIC (toast vs spinner)
- Estilo do badge de qualidade no preview desktop
- Posicionamento exato do link de escape em /leituras/nova
- Reuso de `(capture)` route group vs manter em `(dashboard)` (sugestão: dashboard)
- Adaptação de copy em CapturePreview ("câmera" → "arquivo") via prop mode

---

*Discussion log written: 2026-05-03*
