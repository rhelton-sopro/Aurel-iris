---
phase: 04-upload-desktop
plan: 07
type: execute
wave: 5
depends_on:
  - 02
  - 05
  - 06
files_modified:
  - apps/web/app/actions/readings.test.ts
  - .planning/phases/04-upload-desktop/04-UAT.md
autonomous: false
requirements:
  - UPLOAD-01
  - UPLOAD-02

tags:
  - phase-04
  - upload-desktop
  - recovery
  - uat

must_haves:
  truths:
    - "Teste vitest verifica que getDraftReading retorna `capture_method` no DraftReading (smoke contra schema, sem hit no DB real)."
    - "UAT.md documenta 8+ cenários funcionais cobrindo CONTEXT D-01 a D-15 aplicáveis a Phase 4."
    - "UAT.md documenta cenário de RecoveryBanner D-12 sendo deferido pra Fase 9 e descreve estado do `getDraftReading` (com capture_method) que Fase 9 vai consumir."
    - "UAT.md valida storage path canônico via SQL/curl manual."
    - "UAT.md valida ausência de vocabulário proibido em todas as superfícies novas (audit:vocabulary)."
    - "UAT.md valida que reading criado no upload tem capture_method='desktop_upload' no DB (verificável via Supabase Dashboard ou curl)."
    - "Wave 5 confirma a deferência explícita da UI do RecoveryBanner para Fase 9 (nenhum componente novo de UI é criado nesta fase — apenas ajuste de getDraftReading que já foi feito em Plan 04-02)."
  artifacts:
    - path: "apps/web/app/actions/readings.test.ts"
      provides: "Smoke test que valida shape do DraftReading com capture_method"
      contains: "capture_method"
    - path: ".planning/phases/04-upload-desktop/04-UAT.md"
      provides: "Plano de UAT manual cobrindo D-01..D-15 e success criteria de UPLOAD-01/02"
      contains: "UPLOAD-01"
      min_lines: 80
  key_links:
    - from: "apps/web/app/actions/readings.test.ts"
      to: "DraftReading type ampliado em Plan 04-02"
      via: "Schema test confirma shape"
      pattern: "capture_method"
---

<objective>
Fechar a Fase 4 com:

1. **Smoke test schema-level** confirmando que `DraftReading` (após Plan 04-02) carrega `capture_method` — necessário pra Fase 9 ter o getDraftReading correto pra implementar o RecoveryBanner UI sem refactor.

2. **Decisão arquitetural explícita: RecoveryBanner UI fica deferido pra Fase 9** (alinhado com STATE.md "RecoveryBanner D-12 ficou como dívida de polish pra retomar antes do beta externo"). Esta fase NÃO cria `components/recovery/RecoveryBanner.tsx` nem o injeta no layout — apenas garante que o **contrato** (getDraftReading retornando capture_method) está pronto. Fase 9 escreve a UI.

   **Justificativa**: o problema do RecoveryBanner é UX (quando aparecer, em que páginas, dismissable, tracking de dismissals) e independe da Fase 4. Fase 4 entrega o que precisa: o backend extension. UI fica pra Fase 9 onde sobrelapa com PWAInstallBanner D-14 e listagem de leituras com filtro de pending.

3. **UAT.md** documentando cenários manuais de validação ponta-a-ponta para o developer/founder rodar antes de declarar a Fase 4 fechada (mesmo padrão da Fase 3 UAT 03).

4. **Checkpoint human-verify** ao final pra que o developer confirme que o fluxo desktop funciona em uma sessão real (smoke de produção).

Implementa: parte server-side de **D-15** (recovery routing — getDraftReading.capture_method já entregue em Plan 04-02; UAT confirma). Sucesso de fase **UPLOAD-01**, **UPLOAD-02** validados via UAT.

Output: 1 teste vitest adicional (smoke) + 1 documento UAT.md + 1 checkpoint.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-upload-desktop/04-CONTEXT.md
@.planning/phases/04-upload-desktop/04-PATTERNS.md

# Plans desta fase
@.planning/phases/04-upload-desktop/04-01-validate-file-heic-libs-PLAN.md
@.planning/phases/04-upload-desktop/04-02-extender-create-reading-action-PLAN.md
@.planning/phases/04-upload-desktop/04-03-upload-dropzone-component-PLAN.md
@.planning/phases/04-upload-desktop/04-04-adaptar-componentes-capture-mode-PLAN.md
@.planning/phases/04-upload-desktop/04-05-upload-wizard-page-client-PLAN.md
@.planning/phases/04-upload-desktop/04-06-entry-point-device-detect-PLAN.md

# Referência do UAT da Fase 3 pra estilo (não há arquivo formal — gerado em commit)
# Use commit log de 2026-05-03 (e5d9fd4) como reference: 13 testes, cold start,
# PWA install, fluxo cliente→captura→preview→finalize→storage, timezone.

@apps/web/app/actions/readings.ts
@apps/web/app/actions/readings.schemas.ts
@apps/web/app/actions/readings.test.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Adicionar smoke test do shape de DraftReading (com capture_method)</name>
  <read_first>
    - apps/web/app/actions/readings.test.ts (após Plan 04-02 — pra ver tests existentes)
    - apps/web/app/actions/readings.schemas.ts (DraftReading ampliado)
  </read_first>
  <files>
    apps/web/app/actions/readings.test.ts
  </files>
  <behavior>
    Test 1: `DraftReading` aceita shape com capture_method='mobile_camera' (compile-time check via const)
    Test 2: `DraftReading` aceita shape com capture_method='desktop_upload' (compile-time check via const)
    Test 3: TypeScript rejeita capture_method='other_value' (não testável runtime, mas adicionar comentário documentando)
  </behavior>
  <action>
**Apend** ao final de `apps/web/app/actions/readings.test.ts` (não substituir testes existentes):

```typescript
import type { DraftReading } from './readings.schemas'

describe('DraftReading shape (Phase 4 — D-15 recovery routing)', () => {
  it('accepts capture_method=mobile_camera', () => {
    const draft: DraftReading = {
      id: VALID_READING_UUID,
      created_at: '2026-05-03T00:00:00.000Z',
      client_id: VALID_CLIENT_UUID,
      client_name: 'Test Client',
      imagesCaptured: 3,
      capture_method: 'mobile_camera',
    }
    expect(draft.capture_method).toBe('mobile_camera')
  })

  it('accepts capture_method=desktop_upload', () => {
    const draft: DraftReading = {
      id: VALID_READING_UUID,
      created_at: '2026-05-03T00:00:00.000Z',
      client_id: VALID_CLIENT_UUID,
      client_name: 'Test Client',
      imagesCaptured: 0,
      capture_method: 'desktop_upload',
    }
    expect(draft.capture_method).toBe('desktop_upload')
  })

  it('uses capture_method to determine recovery route (forward to Fase 9)', () => {
    const draft: DraftReading = {
      id: VALID_READING_UUID,
      created_at: '2026-05-03T00:00:00.000Z',
      client_id: VALID_CLIENT_UUID,
      client_name: 'Test Client',
      imagesCaptured: 0,
      capture_method: 'desktop_upload',
    }
    // Logic that Fase 9 RecoveryBanner.tsx will use:
    const expectedRoute = draft.capture_method === 'desktop_upload'
      ? `/leituras/nova/upload?reading=${draft.id}&resume=true`
      : `/leituras/nova/capturar?reading=${draft.id}&resume=true`
    expect(expectedRoute).toBe(`/leituras/nova/upload?reading=${draft.id}&resume=true`)
  })

  it('mobile_camera draft routes to /capturar', () => {
    const draft: DraftReading = {
      id: VALID_READING_UUID,
      created_at: '2026-05-03T00:00:00.000Z',
      client_id: VALID_CLIENT_UUID,
      client_name: 'Test Client',
      imagesCaptured: 2,
      capture_method: 'mobile_camera',
    }
    const expectedRoute = draft.capture_method === 'desktop_upload'
      ? `/leituras/nova/upload?reading=${draft.id}&resume=true`
      : `/leituras/nova/capturar?reading=${draft.id}&resume=true`
    expect(expectedRoute).toBe(`/leituras/nova/capturar?reading=${draft.id}&resume=true`)
  })
})
```

Os 4 testes documentam:
- O contrato de `DraftReading.capture_method` está estável (compile-time + runtime check).
- A lógica de roteamento (D-15) está documentada como "expected route" — Fase 9 implementa o componente, usando exatamente esta lógica.
- Vocabulário proibido ausente (testes só usam strings neutras).
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:run app/actions/readings.test.ts</automated>
    Todos os testes (existentes + 4 novos) passando.

    Adicionalmente:
    - `pnpm tsc --noEmit -p .` exit 0.
    - `grep -c "capture_method" apps/web/app/actions/readings.test.ts` retorna ≥ 4.
  </verify>
  <acceptance_criteria>
    - 4 testes novos passam.
    - Os testes cobrem ambos os valores de capture_method e a lógica de routing que a Fase 9 usará.
    - Compile-time check via `const draft: DraftReading = {...}` valida shape.
    - `pnpm tsc --noEmit` exit 0.
  </acceptance_criteria>
  <done>
    Contrato de DraftReading documentado e validado para a Fase 9 consumir sem refactor.
  </done>
</task>

<task type="auto">
  <name>Task 2: Criar 04-UAT.md com cenários manuais</name>
  <read_first>
    - .planning/phases/04-upload-desktop/04-CONTEXT.md (todos os Decisions D-01..D-15)
    - .planning/ROADMAP.md Fase 4 — Success Criteria (4 itens)
    - .planning/REQUIREMENTS.md UPLOAD-01, UPLOAD-02
  </read_first>
  <files>
    .planning/phases/04-upload-desktop/04-UAT.md
  </files>
  <action>
Criar `.planning/phases/04-upload-desktop/04-UAT.md` com este conteúdo:

````markdown
# Fase 4 — UAT (User Acceptance Testing)

**Status:** Pronto para execução manual pelo founder após Plans 04-01 a 04-07 concluídos.

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
````

**Notas:**
- Vocabulário proibido ausente em todo o documento. Strings de teste usam "Foto não contém um olho", "Formato não suportado", "Foto muito grande" — todas neutras.
- Esta UAT.md é referência **manual** (não automatizada). Execute-plan deve marcar este plano como `autonomous: false` (já está no frontmatter) para forçar checkpoint.
  </action>
  <verify>
    <automated>test -f .planning/phases/04-upload-desktop/04-UAT.md && wc -l .planning/phases/04-upload-desktop/04-UAT.md | awk '{ exit ($1 >= 80) ? 0 : 1 }'</automated>
    Arquivo existe com ≥ 80 linhas.

    Adicionalmente:
    - `grep -c "Cenário" .planning/phases/04-upload-desktop/04-UAT.md` retorna ≥ 14.
    - `grep -c "UPLOAD-01\\|UPLOAD-02" .planning/phases/04-upload-desktop/04-UAT.md` retorna ≥ 2.
    - `grep -c "D-0[0-9]\\|D-1[0-5]" .planning/phases/04-upload-desktop/04-UAT.md` retorna ≥ 8 (cobre maior parte das decisões).
  </verify>
  <acceptance_criteria>
    - `04-UAT.md` criado com 14 cenários numerados.
    - UAT cobre: auto-detect (D-01), capture_method=desktop_upload (UPLOAD-02), validação tipo+tamanho (UPLOAD-01), HEIC convert (D-11), wizard 6 fotos (D-05/06/09/13), VLM hard block (D-09), cancelar preserva (D-14), guard de método imutável (D-04), vocabulário proibido, getDraftReading capture_method, regressão mobile.
    - Documenta deferência explícita do RecoveryBanner UI pra Fase 9.
    - Documento sem vocabulário proibido (auditável).
  </acceptance_criteria>
  <done>
    UAT plan documentado, founder pode executar manualmente após o smoke automated passar.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Checkpoint final — Founder valida fluxo desktop em sessão real</name>
  <what-built>
    A Fase 4 está código-completa após Plans 04-01..04-06 + smoke test do Plan 04-07. Todo o automated verify (testes vitest, tsc, audit:vocabulary, build) deve passar antes deste checkpoint. O que falta é validação manual / dogfooding.
  </what-built>
  <how-to-verify>
    Executar UAT manual seguindo `.planning/phases/04-upload-desktop/04-UAT.md`:

    1. **Smoke automated** primeiro:
       - `cd apps/web && pnpm test:run` → exit 0.
       - `cd apps/web && pnpm tsc --noEmit -p .` → exit 0.
       - `cd apps/web && pnpm audit:vocabulary` → exit 0.
       - `cd apps/web && pnpm build` → exit 0, com `heic2any` em chunk separado (verificar nas trees).

    2. **Cenários manuais críticos** (mínimo MVP do UAT):
       - Cenário 1 — auto-detect desktop ✓
       - Cenário 3 — desktop submit cria reading com capture_method=desktop_upload ✓
       - Cenário 5 — validação rejeita PDF ✓
       - Cenário 6 — validação rejeita > 25MB ✓
       - Cenário 8 — wizard fim-a-fim 6 fotos ✓
       - Cenário 9 — VLM hard block + Trocar arquivo ✓
       - Cenário 10 — Cancelar preserva rascunho ✓
       - Cenário 11 — guard D-04 (capture_method imutável) ✓
       - Cenário 14 — sem regressão na captura mobile ✓

    3. **HEIC opcional** (se founder tiver iPhone à mão):
       - Cenário 7 — HEIC convert client-side ✓
       - Verificar que heic2any aparece em chunk separado no Network tab.

    4. **Forward Fase 9** (não bloqueante):
       - Cenário 13 — getDraftReading retorna capture_method (smoke via SQL ou logged session).

    Se algum cenário falha, abrir issue, atualizar 04-UAT.md com o estado, e iterar.
  </how-to-verify>
  <resume-signal>
    Digite "approved" quando os cenários críticos do UAT passarem em sessão real.
    Digite "needs-fix: <descrição>" se algo quebrou — uma rodada de gap closure será planejada.
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

(Threats endereçados pelos Plans anteriores; este plano apenas documenta UAT.)

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-07-01 | Repudiation | UAT.md | mitigate | UAT documenta evidências verificáveis (linhas no DB, paths no Storage, output de audit:vocabulary). Founder pode auditar pós-sessão. ASVS L1 V7.1.1 (logging) é responsabilidade do Supabase audit log (Fase 8 LGPD-04). |
| T-04-07-02 | Information Disclosure | UAT smoke | accept | Cenários do UAT incluem instrução de inspecionar Supabase Dashboard. Acesso ao Dashboard já é gated por auth Supabase do founder. Sem novo canal de leak. |
</threat_model>

<verification>
1. `cd apps/web && pnpm test:run app/actions/readings.test.ts` exit 0 (incluindo 4 testes novos deste plan).
2. `04-UAT.md` existe com ≥ 14 cenários.
3. Founder executou UAT manual e marcou ✓ nos checkboxes críticos.
4. Checkpoint resolved com "approved" ou levou a um plan adicional de gap closure.
</verification>

<success_criteria>
- 4 testes vitest novos passando (DraftReading shape).
- 04-UAT.md criado com 14 cenários cobrindo todas as decisões aplicáveis a Phase 4.
- RecoveryBanner UI explicitamente deferido para Fase 9 com justificativa.
- Checkpoint manual aprovado pelo founder.
- Build limpo, audit:vocabulary verde, tsc verde.
</success_criteria>

<output>
Após completar, criar `.planning/phases/04-upload-desktop/04-07-SUMMARY.md` documentando:
- Smoke automated final results (linhas de output dos comandos).
- 14 cenários do UAT com checkboxes (✓/✗).
- Estado final do reading criado durante o UAT (id, capture_method, count de reading_images).
- Decisões registradas durante UAT que afetam STATE.md (ex: "PWA Android Chrome ainda com URL bar — non-blocking").
- Confirmação de que RecoveryBanner UI fica diferido (alinhado com STATE.md já existente).
- Tempo total da Fase 4 (Wave 1 → Wave 5).
</output>
