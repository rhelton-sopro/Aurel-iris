# Fase 4 — UAT (User Acceptance Testing)

**Status:** ✅ Aprovado pelo founder em 2026-05-03 (resposta `approved` ao checkpoint do Plan 04-07).

**Pré-requisitos:**
- Branch da Fase 4 buildando localmente (`pnpm dev` no apps/web).
- Conta de terapeuta de teste com pelo menos 1 cliente cadastrado (Fase 2).
- Acesso ao Supabase Dashboard (verificação de DB).
- Acesso à console do browser (DevTools / Network / Application).

**Smoke automated antes do UAT:**
- [ ] `cd apps/web && pnpm test:run` exit 0
- [ ] `cd apps/web && pnpm tsc --noEmit -p .` exit 0
- [ ] `cd apps/web && pnpm audit:vocabulary` exit 0
- [ ] `cd apps/web && pnpm build` exit 0 (verificar nas trees do build que `heic2any` aparece em chunk separado)

---

## Cenário 1: Auto-detect device em desktop (CONTEXT D-01)

**Setup:** Abrir `/leituras/nova` em laptop/desktop com mouse (não-touch).

**Passos:**
1. Logar como terapeuta.
2. Navegar para `/leituras/nova`.
3. Selecionar um cliente do dropdown.

**Esperado:**
- [ ] Botão primário mostra "Selecionar arquivos no computador" (não "Iniciar captura mobile").
- [ ] Botão secundário (escape) mostra "Quero usar a câmera deste dispositivo".
- [ ] DevTools console: nenhum erro/warning.

---

## Cenário 2: Auto-detect device em iPad/touch (CONTEXT D-01)

**Setup:** Abrir `/leituras/nova` em iPad ou Chrome DevTools "device emulation" → iPad.

**Passos:**
1-3. Idem Cenário 1.

**Esperado:**
- [ ] Botão primário mostra "Iniciar captura mobile".
- [ ] Botão secundário mostra "Tenho fotos prontas — subir do computador".

---

## Cenário 3: Submit no desktop cria reading com capture_method='desktop_upload' (UPLOAD-02)

**Setup:** Estar em `/leituras/nova` com cliente selecionado em desktop.

**Passos:**
1. Clicar no botão primário "Selecionar arquivos no computador".
2. Aguardar redirect.

**Esperado:**
- [ ] URL após redirect: `/leituras/nova/upload?reading=<uuid>` (não `/capturar`).
- [ ] Network tab DevTools: criação do reading via server action.
- [ ] Supabase Dashboard → tabela readings → última linha tem `capture_method = 'desktop_upload'`, `status = 'pending'`.
- [ ] Página de upload renderiza header com nome do cliente + X.
- [ ] UploadDropzone visível com texto "Arraste e solte ou selecione arquivo" + footer "JPEG · PNG · WebP · HEIC — máx. 25 MB".
- [ ] Heading mostra "Foto 1 de 6 — Olho ESQUERDO · Frente".

---

## Cenário 4: Submit do escape no desktop redireciona para /capturar (D-01)

**Setup:** Idem Cenário 3 em desktop.

**Passos:**
1. Clicar no botão escape "Quero usar a câmera deste dispositivo".

**Esperado:**
- [ ] Redirect para `/leituras/nova/capturar?reading=<uuid>` (fluxo mobile).
- [ ] Reading criado tem `capture_method = 'mobile_camera'` (escape funcionou).

---

## Cenário 5: Validação de tipo rejeita PDF (UPLOAD-01)

**Setup:** Estar em `/leituras/nova/upload?reading=<uuid>` com slot 1 vazio.

**Passos:**
1. Arrastar um arquivo `.pdf` para a dropzone.

**Esperado:**
- [ ] Toast vermelho: "Formato não suportado. Use JPEG, PNG, WebP ou HEIC." (texto exato).
- [ ] Phase NÃO mudou para 'analyzing' (sem spinner).
- [ ] Reading_images permanece com 0 linhas (Supabase Dashboard).

---

## Cenário 6: Validação de tamanho rejeita arquivo > 25MB (UPLOAD-01, D-12)

**Setup:** Estar em `/leituras/nova/upload?reading=<uuid>`.

**Passos:**
1. Arrastar um JPEG ≥ 26MB (criar via `dd if=/dev/urandom of=test.jpg bs=1M count=26` ou similar).

**Esperado:**
- [ ] Toast vermelho contém: "Foto muito grande, máximo 25 MB."
- [ ] Sem entrada em `reading_images`.

---

## Cenário 7: HEIC convert client-side (CONTEXT D-11)

**Setup:** Ter um arquivo HEIC pequeno (1-2MB) — exportado de iPhone real ou amostra teste.

**Passos:**
1. Estar em `/leituras/nova/upload?reading=<uuid>` slot 1.
2. Arrastar o `.heic`.

**Esperado:**
- [ ] Toast amarelo "Convertendo HEIC..." aparece momentaneamente.
- [ ] Toast desaparece após conversão.
- [ ] Phase muda para 'analyzing' (spinner).
- [ ] Network tab: 1 POST para `/api/capture/validate` com `imageBase64` no payload (HEIC já convertido pra JPEG no client).
- [ ] DevTools → Network → JS chunks: confirmar que `heic2any` foi baixado em chunk separado (após o drag, não no carregamento inicial da página).

**Validação de bundle (independente):**
- [ ] `pnpm build` output mostra `heic2any` em chunk próprio (auditável também via `next dev` → DevTools Network → filtrar por "heic").

---

## Cenário 8: Wizard fim-a-fim 6 fotos (UPLOAD-02, D-05, D-06, D-09, D-13)

**Setup:** Reading novo desktop_upload com 0 fotos.

**Passos:**
1. Arrastar 6 JPEGs/PNGs válidos (1 por slot, todos com olhos visíveis pra passar VLM).
2. Para cada slot:
   - VLM aprova (badge "Boa" ou "Excelente").
   - Clicar "Confirmar" no preview.
   - Slot avança automaticamente.
3. No 6º Confirmar, esperar finalize.

**Esperado:**
- [ ] Cada upload mostra toast "Salvando imagem N/6..." e depois "Imagem salva.".
- [ ] Após 6/6, toast "Leitura registrada." + redirect para `/leituras`.
- [ ] Supabase Dashboard → readings (last): `capture_method = 'desktop_upload'`, `status = 'pending'`.
- [ ] Supabase Dashboard → reading_images filtrado por reading_id: 6 linhas, todas com `eye` ∈ {left,right} × `angle` ∈ {frontal,lateral,backlight}, `storage_path` no formato `{therapist_id}/{reading_id}/originais/{eye}_{angle}.jpg`, `quality_score` numérico, `width`/`height` numéricos.
- [ ] Supabase Dashboard → Storage → bucket iris-captures → folder do therapist_id → folder do reading_id → folder `originais` → 6 arquivos `.jpg`.

---

## Cenário 9: VLM hard block (D-09)

**Setup:** Estar em algum slot do upload com phase='instruction'.

**Passos:**
1. Subir uma foto SEM olho visível (ex: paisagem aleatória).

**Esperado:**
- [ ] Phase passa por 'analyzing' → 'previewing'.
- [ ] CapturePreview mostra badge vermelho "Ruim".
- [ ] Mensagem "Foto rejeitada — refaça" + lista de razões (ex: "Foto não contém um olho").
- [ ] Botão "Confirmar" disabled (greyed out).
- [ ] Botão "Trocar arquivo" habilitado (texto pt-BR exato — Plan 04-04).
- [ ] Clicar "Trocar arquivo" volta phase='instruction', dropzone visível.

---

## Cenário 10: Cancelar preserva rascunho (D-14)

**Setup:** Reading desktop_upload em andamento com 2/6 fotos subidas.

**Passos:**
1. Clicar no X do header.

**Esperado:**
- [ ] Redirect para `/leituras` (sem dialog de confirmação).
- [ ] Supabase Dashboard → readings: linha ainda existe, `status = 'pending'`, `capture_method = 'desktop_upload'`.
- [ ] reading_images: 2 linhas (não 0; uploads em background completaram).

---

## Cenário 11: page.tsx guard — capture_method='mobile_camera' redireciona (D-04)

**Setup:** Reading novo criado pelo fluxo mobile (`/leituras/nova/capturar?reading=<id>`) com 0 fotos.

**Passos:**
1. Manualmente trocar URL para `/leituras/nova/upload?reading=<id>`.

**Esperado:**
- [ ] Redirect imediato para `/leituras/nova/capturar?reading=<id>`.
- [ ] Sem mudança no `capture_method` do reading (continua 'mobile_camera').

---

## Cenário 12: Vocabulário proibido LGPD (project-wide)

**Passos:**
1. `cd apps/web && pnpm audit:vocabulary`

**Esperado:**
- [ ] Exit 0.
- [ ] Output: "OK (nenhum match)".

---

## Cenário 13: getDraftReading retorna capture_method (forward Fase 9)

**Setup:** Pelo menos 1 reading 'pending' com `capture_method='desktop_upload'` no DB.

**Passos:**
1. Em terminal/REPL ou via componente de teste: chamar `getDraftReading()` autenticado como o terapeuta dono.

**Esperado:**
- [ ] Retorno inclui `capture_method: 'desktop_upload'` no objeto.
- [ ] Esta validação é **forward para Fase 9** — Fase 4 NÃO renderiza um RecoveryBanner UI; apenas garante que o backend está pronto.

---

## Cenário 14: Sem regressão na captura mobile (Fase 3 inalterada)

**Setup:** iPhone Safari ou DevTools em modo iPad.

**Passos:**
1. `/leituras/nova` → cliente → "Iniciar captura mobile".
2. Capturar 6 fotos via `<input capture>` original da Fase 3.
3. Finalizar.

**Esperado:**
- [ ] Tudo funciona como antes (zero regressão).
- [ ] reading.capture_method = 'mobile_camera'.
- [ ] reading_images com path `{therapist_id}/{reading_id}/originais/{eye}_{angle}.jpg`.

---

## Itens explicitamente DEFERIDOS para Fase 9 (RecoveryBanner UI + PWA standalone polish)

- **RecoveryBanner.tsx visual** — apenas o `getDraftReading` retornando `capture_method` ficou pronto na Fase 4. A UI do banner (alerta no dashboard, dismissable, query no layout) é responsabilidade da Fase 9, alinhada com STATE.md ("RecoveryBanner D-12 e PWAInstallBanner D-14 deferidos pra Fase 9 — polish pré-beta").
- **Multi-foto por ângulo (3 frames, melhor é selecionado)** — diferido em CONTEXT.
- **Bulk upload com associação posterior** — diferido em CONTEXT.

---

## Sign-off

- [ ] **Founder dogfood:** subiu pelo menos 1 leitura real (cliente real) via fluxo desktop em consultório, sem cair em workaround.
- [ ] **VLM custo confirmado:** Network tab mostra ~6 calls a `/api/capture/validate` por leitura, custo agregado consistente com STATE.md projeção.
- [ ] **Sem vocabulário proibido:** `audit:vocabulary` verde após push final.
- [ ] **Build clean:** `pnpm build` exit 0 com `heic2any` em chunk separado.

---

*Phase: 04-upload-desktop*
*UAT criado: pelos Plans 04-01..04-07 (post-execution)*
*Última atualização: TBD pelo founder após sign-off*
