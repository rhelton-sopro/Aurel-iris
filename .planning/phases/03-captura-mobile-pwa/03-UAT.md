---
status: complete
phase: 03-captura-mobile-pwa
source:
  - 03-01-SUMMARY.md
  - 03-02-SUMMARY.md
  - 03-03-SUMMARY.md
  - 03-04-SUMMARY.md
  - 03-05-SUMMARY.md
  - 03-06-SUMMARY.md
  - 03-07-SUMMARY.md
  - "post-refactor commits: 4eb31c7..9cb10c2 (16 commits)"
notes: |
  Plan 03-08 (RecoveryBanner / PWAInstallBanner / listagem rascunhos) NÃO foi executado.
  Refactor 18b4277 substituiu streaming PWA por câmera nativa; 499e95d substituiu MediaPipe
  por detecção de pupila pós-captura; ce09efa adicionou finalizeReadingAction na 6ª foto.
  Tests refletem o comportamento atual (pós-refactor), não o planejado.
started: 2026-05-03T00:00:00Z
updated: 2026-05-03T00:00:00Z
---

## Current Test

[testing complete — Phase 3 closed 2026-05-03]

## Tests

### 1. Cold Start Smoke Test
expected: Mate qualquer dev server rodando. Limpe estado efêmero (caches, lock files). Suba o app do zero (`pnpm dev`). Server boota sem erros, /api/health/db retorna 200 com count de clientes da sessão. Migration 0004 está aplicada.
result: pass

### 2. PWA Install — Android Chrome
expected: Em um Android com Chrome, abra a URL do app e faça login. O Chrome oferece "Adicionar à tela inicial" (ou um botão de install). Após instalar, o ícone aparece na home screen e abrir o ícone abre o app em modo standalone (sem barra de URL do navegador).
result: issue
reported: "PWA instala e ícone aparece na home screen, mas abre com barra de URL do Chrome (não está em modo standalone)"
severity: major

### 3. PWA Install — iOS Safari
expected: Em um iPhone com Safari, abra a URL do app e faça login. Tap no botão Compartilhar → "Adicionar à Tela de Início". Ícone aparece na home screen; abrir o ícone abre o app em modo standalone (sem barra de URL).
result: pass
notes: "Pré-requisitos corrigidos antes do retest: 4677b6c (CTA de login na landing) + 89f4ca2 (safe-area-inset em DashboardHeader + AppSidebar + auth layout)."

### 4. Iniciar Nova Leitura a partir do Cliente
expected: Em /clientes/[id], o botão "Nova Leitura" está ativo (não desabilitado). Tap nele abre /leituras/nova já com o cliente pré-selecionado no select.
result: pass
notes: "Fluxo principal funciona. Issue lateral encontrado (select mostrava UUID em vez de nome) corrigido inline — ver Gaps. Causa raiz: base-ui Select.Value mostra raw value por padrão, fix com children render-prop fazendo lookup nos items."

### 5. Confirmar Cliente → Tela de Captura com Instrução
expected: Em /leituras/nova com cliente selecionado, ao confirmar/avançar, navega para /leituras/nova/capturar. A tela de captura abre fullscreen (sem sidebar do dashboard) e mostra uma tela de instrução inicial antes da primeira foto.
result: pass

### 6. Câmera Nativa Abre — Rear Camera
expected: Ao tap no botão de capturar, a câmera nativa do sistema abre (não um stream em página) usando câmera traseira. No iOS abre o app de câmera; no Android abre o picker de câmera. Após tirar a foto, retorna ao app.
result: pass

### 7. Aviso de Câmera Frontal Obrigatória
expected: Se o usuário usar câmera frontal (selfie) ao invés da traseira, o app detecta após a captura e mostra aviso "use câmera traseira" rejeitando a foto.
result: issue
reported: "Foto tirada com câmera frontal (selfie) passou sem nenhum aviso. Sistema deveria detectar e mostrar 'Use a câmera traseira' rejeitando a foto. Não aconteceu."
severity: major

### 8. Análise Pós-Captura + Preview com Badge
expected: Após captura, o app analisa a foto (detecção de pupila + sharpness), mostra o preview da imagem com um badge de qualidade (excelente/aceitável/ruim) e um countdown circular de 2s antes de avançar.
result: pass
notes: "Pass em iPhone Safari (não PWA standalone). Preview com Refazer/Confirmar aparece corretamente. 2 issues pré-existentes confirmados (banner overlap + falso negativo de íris) + 2 novos issues adicionados (reflexo + privacidade) — ver Gaps."

### 9. Tap-to-Redo Refaz a Foto
expected: Durante o preview de 2s, tap na imagem cancela o avanço e re-abre a câmera nativa para refazer aquela foto específica.
result: pass
notes: "Tap-to-redo funciona. User reconfirmou os 2 issues conhecidos (banner overlap + frontal-cam detection ausente) durante este teste — sem nova info, gaps já abertos."

### 10. Transição Olho Esquerdo → Direito (AngleInterstitial)
expected: Após capturar 3 fotos do olho esquerdo (left/frontal, left/lateral, left/backlight), aparece tela de transição (AngleInterstitial) avisando que vai começar olho direito. Tap em continuar inicia sequência right/*.
result: pass
notes: "User confirmou implicitamente em rodada subsequente: 'pede para trocar de olho.... ok'. AngleInterstitial entre slot 2 (left/backlight) e slot 3 (right/frontal) aparece como esperado."

### 10. Transição Olho Direito → Esquerdo
expected: Após capturar as 3 fotos do olho direito (frontal, lateral, backlight), aparece uma tela de transição (AngleInterstitial) avisando que vai começar o olho esquerdo. Tap em continuar inicia a sequência do olho esquerdo.
result: [pending]

### 11. Finalize na 6ª Captura → Redirect para /leituras
expected: Após a 6ª foto (left/backlight) ser confirmada no preview, o app aguarda o último upload completar, mostra toast "Leitura concluída" e redireciona para /leituras. Nenhuma corrida entre redirect e upload (commit antes de redirect).
result: [pending]

### 12. /leituras Mostra Horário em Fuso Local
expected: Em /leituras, a leitura recém-criada aparece com data/hora em fuso horário local do usuário (ex: 17:42 BRT), não em UTC.
result: [pending]

### 13. 6 Imagens no Supabase Storage
expected: Em Supabase Studio → Storage → bucket iris-captures, há 6 arquivos sob `{therapist_id}/{reading_id}/` com nomes `right_frontal.jpg`, `right_lateral.jpg`, `right_backlight.jpg`, `left_frontal.jpg`, `left_lateral.jpg`, `left_backlight.jpg`. Tabela reading_images tem 6 linhas correspondentes com eye/angle/storage_path/quality_score preenchidos.
result: [pending]

## Summary

total: 13
passed: 8
issues: 2
pending: 3
skipped: 0
blocked: 0
gaps_total: 7

## Outras observações do UAT (não são gaps de Fase 3)

- truth: "Login/signup bloqueados durante UAT por rate limit (3 eixos: per-email + per-IP + per-project) do Supabase OTP usando SMTP default"
  status: env_constraint_resolved
  reason: "Volume de testes do UAT consumiu cota global do projeto; sintoma 'Ocorreu um erro' era genérico demais. Email novo também caía em 429 porque os 3 eixos (per-IP, per-project) ainda estavam saturados."
  severity: cosmetic
  test: meta
  fix_commits:
    - "267ff50 — login/page.tsx: branch 429 + console.error com status/message/code + mensagem real exposta"
    - "eced8f9 — signup/page.tsx: mesmo padrão (branches 429, already-registered, signups-disabled)"
  resolution: "Resolvido fora do código (2026-05-03): Resend configurado como SMTP custom no Supabase (domínio soprodaorigem.com verificado, Sender 'Iris Codex'). Rate limit agora é 30 emails/hora Supabase + 100/dia Resend free tier — adequado pra UAT/dogfooding."
  followup_polish:
    - "Os 2 commits de visibilidade (267ff50, eced8f9) foram diagnósticos — quando estabilizar, substituir error.message exposto no form por copy amigável"
    - "Antes do beta com 10-20 terapeutas: monitorar uso Resend free tier (100/dia, 3000/mês) e fazer upgrade pro Pro se necessário"
    - "Revalidar rate limits no Supabase Dashboard antes do beta externo (não deixar 30/hora para sempre se precisar de mais)"

## Gaps

- truth: "PWA abre em modo standalone (sem barra de URL) após instalar no Android Chrome"
  status: failed
  reason: "User reported: PWA instala e ícone aparece na home screen, mas abre com barra de URL do Chrome (não está em modo standalone)"
  severity: major
  test: 2
  environment: "produção — aurel-iris-web.vercel.app via HTTPS, Android Chrome"
  symptom_signal: "prompt do Chrome dizia 'Adicionar à tela inicial' (shortcut), não 'Instalar app' (PWA standalone) — app falha critérios de installability"
  artifacts: []
  missing: []
  hypotheses:
    - "Service Worker não registrou em produção (apesar de Serwist build gerar public/sw.js)"
    - "Algum ícone PWA retorna 404 em produção (verificar /icons/icon-192.png, /icons/icon-512.png, /icons/icon-maskable.png)"
    - "<link rel='manifest'> não está no <head> renderizado"
    - "start_url '/dashboard' redireciona para /login (sem auth) e Chrome rejeita por start_url não navegável"
  notes: "manifest.ts JÁ tem display: 'standalone' (linha 9) — hipótese inicial estava incorreta; investigar em DevTools → Application → Manifest > Installability"

- truth: "Select de cliente em /leituras/nova mostra o nome do cliente (não o UUID) quando há valor selecionado"
  status: fixed_inline
  reason: "User reported: select mostrava UUID em vez de nome (ex: '2eba81e9-fb54-4b26-9e41-e50a8625b245' em vez de 'mamae')"
  severity: major
  test: 4
  root_cause: "base-ui Select.Value renderiza o raw value por padrão (diferente do Radix que auto-resolve a label do SelectItem matching). Hipótese inicial do user (usar full_name como label / id como value) estava incorreta — código JÁ fazia isso. Fix real: children render-prop em SelectValue para fazer lookup de full_name pelo id selecionado."
  fix_commit: "6dd61d7"
  files_changed:
    - "apps/web/app/(dashboard)/leituras/nova/new-reading-form.tsx"

- truth: "App detecta câmera frontal (selfie) após captura e rejeita a foto com aviso 'Use a câmera traseira'"
  status: partial_fix_under_diagnostic
  reason: "User reported (test 7): foto tirada com câmera frontal passou sem aviso. Test 10 reconfirmou: fix 7829a36 não está rejeitando em prod no iPhone — provável que iOS Safari estripa LensModel/LensMake do EXIF na captura via <input capture='environment'>."
  severity: major
  tests: [7, 10]
  history:
    - "499e95d (pré-existente): banner advisory passivo, sem detection — não rejeitava nada"
    - "7829a36: detectCameraSource via exifr + dialog de confirmação manual em kind=unknown"
    - "35fc168: dialog removido por feedback de UX (6 dialogs por sessão = fricção); aviso bold-red prominente no AngleInterstitial antes de cada captura; console.log diagnóstico do EXIF efetivamente lido"
  current_state: "kind=front auto-reject (toast + volta pra instruction). kind=unknown passa direto, confia no aviso visual. Diagnóstico ativo via console.log para confirmar se iOS está strippando EXIF."
  pending_diagnostic: "Aguardando user testar e colar do console: '[camera-detection] exif read: { ... }' — se raw=undefined ou raw={} confirma que iOS Safari strippa o EXIF na captura nativa."
  if_ios_strips_exif:
    - "Não há solução técnica via EXIF — campo é stripado antes de chegar ao client"
    - "Próxima opção: heurística geométrica (irisRadiusPx vs FOV) — ~70% confiabilidade, requer dataset de calibração"
    - "OU: confiar exclusivamente no aviso visual + treinamento do operador (UX, não código)"
    - "OU: investigar API File System Access ou navigator.mediaDevices.getUserMedia (volta pra streaming + face detection on-the-fly em vez de native camera)"

- truth: "Banner amber 'Mantenha a luz de frente...' não sobrepõe o badge de qualidade do CapturePreview"
  status: fixed_inline
  fix_commit: "35fc168"
  fix_summary: "Banner agora oculta durante phase='previewing' — só aparece em instruction/analyzing. Área do badge de qualidade fica limpa."
  legacy_status: failed
  reason: "User reported: banner amarelo está sobre o badge vermelho 'Ruim' no canto superior esquerdo, tampando a informação"
  severity: minor
  tests: [7, 8]
  confirmed_in_test_8: "Comportamento reproduzido também em iPhone Safari não-PWA — não é específico de PWA standalone."
  root_cause: "Banner amber em capture-client.tsx:258 é absolute top-0 z-[60] pt-[env(safe-area-inset-top)] (cobre área de 0 até ~24-32px abaixo do safe-area-top). Badge de qualidade em CapturePreview.tsx:73 é absolute top-[calc(env(safe-area-inset-top)+12px)] left-3 — fica 12px abaixo do safe-area-top, dentro da área coberta pelo banner. Ordem z não resolve porque banner z-60 > badge z (default no parent)."
  artifacts:
    - path: "apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx"
      issue: "Banner amber em top-0 cobre região onde o badge do preview se posiciona"
    - path: "apps/web/components/capture/CapturePreview.tsx"
      issue: "Badge top-[calc(env(safe-area-inset-top)+12px)] colide com banner"
  user_suggestion: "Mover badge para abaixo da tarja OU mover tarja para o rodapé"
  missing:
    - "Reposicionar badge para top abaixo do banner (top-[calc(env(safe-area-inset-top)+44px)] aprox), OU mover banner para bottom, OU esconder banner durante phase=previewing"

- truth: "Detecção de pupila funciona em todas as cores de íris + face shot é detectado como problema"
  status: fixed_with_otsu
  reason: "Histórico complexo (4 rodadas): falsos negativos em íris claras → bypass total → reverter bypass → threshold adaptativo Otsu."
  severity: major
  tests: [7, 8, 10]
  history:
    - "Round 1 (7829a36): pupil detection com threshold fixo 40 — UAT 7/8 false negative em íris claras"
    - "Round 2 (278369d): bypass via Infinity em imageWidth>2000 — UAT 10 face shots passavam como Excelente"
    - "Round 3 (d21f717): bypass revertido + score simplificado — fundamentalmente o detector ainda era frágil"
    - "Round 4 (7db1918): threshold ADAPTATIVO via Otsu's method, clamped em [15, 90]. Cada foto calibra seu próprio threshold baseado no histograma. Alert irisUndetected agora condicional (só dispara com dupla evidência: não detectada E sharpness baixa)."
  current_state: "Otsu adapta o threshold à iluminação de cada foto. Foto bem iluminada (pupila lum=70) detecta corretamente. Foto escura idem. Foto com reflexo idem. Alert undetected só dispara em fotos genuinamente ruins (borradas E sem pupila detectável)."
  fix_commit: "7db1918"
  followup_if_persiste:
    - "Detector alternativo HoughCircles (busca por bordas circulares — robusto a luminância)"
    - "Lower IRIS_ACCEPTABLE_PX de 300 pra 200"
    - "OpenCV.js completo — alto custo de bundle (10MB)"

- truth: "App detecta reflexo excessivo na íris e sinaliza como critério de qualidade (reflexo grande cobre zonas iridológicas)"
  status: missing_feature
  reason: "User feature request: detectar reflexo excessivo na íris como critério de qualidade. Reflexo grande cobre zonas de análise iridológica e invalida a leitura."
  severity: minor
  test: 8
  is_new_feature: true
  root_cause: "post-capture-analysis.ts atualmente avalia apenas (1) tamanho da íris via pupil detection e (2) sharpness via Laplacian variance. Não há detecção de specular highlights (reflexos brilhantes). Histórico SPEC: existiu um sub-score 'reflex' em quality-scoring.ts que foi removido no refactor MediaPipe→pupil-detection (causa dos 2 erros TS pré-existentes em quality-scoring.test.ts:47,54 — o teste ainda referencia QUALITY_WEIGHTS.reflex que não existe mais). Re-introduzir como passo de pós-captura."
  artifacts:
    - path: "apps/web/lib/capture/post-capture-analysis.ts"
      issue: "Sem detector de reflexos especulares — saída atual ignora overexposed regions"
    - path: "apps/web/lib/capture/quality-scoring.test.ts"
      issue: "Testes referenciam reflex weight que não existe mais (lines 47, 54) — limpar OU re-introduzir reflex"
  missing:
    - "Detector simples: contar pixels com luminance > THRESHOLD (ex: 240/255) dentro do disco da íris; alertar se cluster > X% da área do disco"
    - "Adicionar campo reflexAlert: boolean ao PostCaptureAnalysis"
    - "Renderizar alert no CapturePreview junto com sharpnessAlert/irisAlert"

- truth: "Nome completo do paciente NÃO fica exposto durante a captura (apenas primeiro nome ou anonimizado por privacidade LGPD)"
  status: missing_privacy_safeguard
  reason: "User raised: nome completo do paciente exposto durante captura — considerar mostrar apenas primeiro nome por privacidade."
  severity: minor
  test: 8
  is_new_feature: true
  root_cause: "capture-client.tsx:266 renderiza <span>{clientName}</span> no header da tela de captura. Nome completo é repassado via prop CaptureClientProps.clientName (linha 58). Sem truncamento/anonimização. Especialmente exposto em PWA standalone se outra pessoa estiver olhando o celular do terapeuta durante consulta. Relevante para postura LGPD do produto (ferramenta de apoio à anamnese — minimização de dados visíveis quando não necessário)."
  artifacts:
    - path: "apps/web/app/(capture)/leituras/nova/capturar/capture-client.tsx"
      issue: "linha 266 renderiza clientName completo no header durante todo o fluxo de captura"
  missing:
    - "Helper getFirstName(fullName) em lib/clientes/ ou similar — primeiro token whitespace-split"
    - "Aplicar getFirstName na prop clientName recebida do server component (page.tsx do capture)"
    - "Considerar copy: 'Capturando: {firstName}' em vez de só {firstName} pra contexto"
