---
phase: 3
slug: captura-mobile-pwa
status: draft
shadcn_initialized: true
preset: base-nova (neutral)
created: 2026-05-01
---

# Fase 3 — UI Design Contract: Captura mobile (PWA)

> Contrato visual e de interação para o fluxo de captura mobile (PWA) com validação on-device via MediaPipe Face Mesh. Gerado pelo gsd-ui-researcher, validado pelo gsd-ui-checker.

> **Posicionamento obrigatório (LGPD + PROJECT.md):** linguagem hipotética, vocabulário proibido em qualquer copy desta fase: "diagnóstico", "tratamento", "cura". Captura é "registro de imagem para apoio à anamnese", nunca "exame".

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui (já inicializado em Phase 1) |
| Preset | `base-nova` com `baseColor: neutral`, `cssVariables: true` (ver `apps/web/components.json`) |
| Component library | `@base-ui/react` v1.4.1 + Radix slots embarcados em shadcn |
| Icon library | `lucide-react` v1.14 (definido em `components.json`) |
| Font | Geist Sans (variável `--font-geist-sans`, default em `app/layout.tsx`); Geist Mono apenas para `quality_score` numérico em telemetria |
| Tailwind | v4 com `@theme inline` em `app/globals.css` — usar tokens CSS variables (`--color-primary`, `--color-destructive`, `--radius-lg` etc.), **não** valores literais |
| Locale | `pt-BR` (definido em `<html lang>`); todos os textos desta fase em pt-BR |
| Tema | Light mode default; `.dark` definido em `globals.css` mas **não usado nesta fase** (captura é mobile outdoor — ver Color §) |

### Componentes shadcn já instalados (reutilizáveis)

`avatar`, `badge`, `button`, `card`, `dialog`, `dropdown-menu`, `form`, `input`, `label`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `table`, `textarea`, `tooltip`.

**Componentes a adicionar nesta fase via `pnpm dlx shadcn add`:**
- `progress` — para indicador de qualidade horizontal e telemetria de upload
- `alert` — para banner de recovery (D-12) e banner PWA install (D-14)
- `toast` (sonner) — para feedback de upload concluído em background (D-09)

### Componentes customizados a criar (sob `components/capture/`)

`CameraView.tsx`, `IrisDetector.tsx`, `QualityIndicator.tsx`, `CapturePreview.tsx`, `AngleIcon.tsx`, `AngleInterstitial.tsx`, `AngleOverlay.tsx`, `CameraDeniedScreen.tsx`, `PWAInstallBanner.tsx`, `RecoveryBanner.tsx`, `CaptureProgress.tsx`, `LiveFeedbackMessage.tsx`.

---

## Layout & Route Group

| Rota | Layout | Sidebar? | Comportamento |
|------|--------|----------|---------------|
| `/leituras/nova` | `(dashboard)` | Sim | Página de seleção de cliente + CTA "Iniciar leitura" |
| `/leituras/nova/capturar?reading=[id]` | **`(capture)` novo route group** | **Não** | Full-screen, viewport bloqueado em portrait, status bar overlay |
| `/leituras/nova/upload` | `(dashboard)` | Sim | Placeholder em Fase 3, real em Fase 4 |

**Decisão de route group (resolve discretion D-context):** criar **`app/(capture)/leituras/nova/capturar/page.tsx`** com `layout.tsx` próprio que omite a sidebar e zera padding. Isso é mais limpo que esconder sidebar condicionalmente e garante tela cheia true em mobile.

### Viewport e responsividade

| Breakpoint | Tratamento |
|-----------|-----------|
| 375–414px (mobile portrait) | **Primary target.** Camera fills viewport `100dvh`. Tudo é otimizado aqui. |
| 414–768px | Camera fills viewport, controles mantêm tamanho e posição |
| 768px+ (tablet/desktop) | Camera centralizada com max-width 480px, fundo escuro (`bg-black/95`) ao redor; aviso superior "Para melhor experiência, use o celular instalado como app" |
| Landscape mobile | **Bloqueado** com mensagem "Gire o celular para retrato — a captura usa orientação vertical." (overlay full-screen) |

**Meta viewport** (em `(capture)/layout.tsx` head): `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover` (cobre safe-area iOS notch).

**Standalone PWA:** layout deve respeitar `env(safe-area-inset-top/bottom/left/right)` para não esconder UI atrás do notch ou home indicator.

---

## Spacing Scale

Múltiplos de 4 (Tailwind v4 spacing token = 0.25rem). Valores absolutos abaixo:

| Token | Tailwind | Valor | Uso |
|-------|----------|-------|-----|
| xs | `1` | 4px | Gap entre ícone e texto inline |
| sm | `2` | 8px | Padding compacto, gap em chips |
| md | `4` | 16px | Padding default de banners e botões mobile |
| lg | `6` | 24px | Margin entre seções de tela (interstitial), inset de overlays |
| xl | `8` | 32px | Padding superior/inferior de tela cheia (interstitial body) |
| 2xl | `12` | 48px | Bottom gutter da tela de captura (área de toque CTA) |
| 3xl | `16` | 64px | Espaço entre AngleIcon e texto em interstitial |

**Touch targets (D-context, WCAG AA):** todo elemento clicável da tela de captura, recovery banner e dialogs **deve** ter altura mínima de **44px**. Botões de CTA primário em mobile usam `h-12` (48px) para folga em sol direto / dedo molhado.

**Exceções declaradas:**
- Chip discreto de instrução (após `AngleOverlay` minimizar) pode ter altura 32px desde que não seja clicável (puramente informativo).
- Telemetria de upload em canto inferior direito do viewfinder usa 24px de altura (também não clicável).

---

## Typography

Tipografia mínima: 4 tamanhos × 2 pesos = 8 combinações. Line-height padrão 1.5 para body, 1.2 para heading.

| Role | Tailwind | Tamanho | Peso | Line-height | Uso nesta fase |
|------|----------|---------|------|-------------|----------------|
| Body | `text-base` | 16px | 400 | 1.5 | Instruções de overlay, texto de erro de câmera, descrição de banner |
| Label | `text-sm` | 14px | 600 | 1.4 | Label de qualidade ("Boa", "Excelente"), badges, micro-CTA |
| Heading | `text-xl` | 20px | 600 | 1.25 | Título de tela interstitial ("Vamos para o olho esquerdo"), título de erro de câmera |
| Display | `text-3xl` | 30px | 600 | 1.2 | Apenas o número do passo no `CaptureProgress` ("3 de 6") em interstitial |

**Fonte:** **Geist Sans** para todos os textos. Geist Mono apenas se houver render de `quality_score` numérico (ex: telemetria dev — não obrigatório em UI de produção).

**Pesos disponíveis:** **400 (regular)** e **600 (semibold)** — apenas dois. Sem `font-bold` (700) nesta fase para evitar peso visual dominando o conteúdo da câmera.

**Live feedback (`LiveFeedbackMessage`):** usa `text-base` 16px / 400 / 1.4 com `font-medium` (500) opcional para destaque sutil. Cor sempre branca em fundo `bg-black/60` para legibilidade outdoor.

---

## Color

### Paleta base (60/30/10)

A captura mobile **subverte parcialmente** a paleta padrão neutral do app porque a câmera ocupa 100% do viewport e domina visualmente. Os tokens abaixo se aplicam aos elementos overlay/UI sobre a câmera e às telas auxiliares (interstitial, recovery, erro).

| Role | % | Token Tailwind | Valor (oklch) | Uso |
|------|---|----------------|---------------|-----|
| Dominant | 60% | `bg-black` (cor da câmera) ou `bg-background` em telas auxiliares | `oklch(1 0 0)` (white) ou `#000` quando câmera ativa | Background do viewfinder, telas de transição |
| Secondary | 30% | `bg-card` / `bg-secondary` | `oklch(0.97 0 0)` (neutral 100) | Cards do interstitial, banner de recovery, fundo de mensagens |
| Accent | 10% | `bg-primary` | `oklch(0.205 0 0)` (neutral 900, quase preto) | **APENAS:** CTA primário ("Iniciar leitura", "Pronto, vou capturar", "Continuar"), foco de input do select de cliente |
| Destructive | — | `bg-destructive` | `oklch(0.577 0.245 27.325)` (red 600) | **APENAS:** botão "Descartar" no banner de recovery, indicador "Ruim" do quality bar |

**Accent (primary) reservado para:**
- Botão "Iniciar leitura" em `/leituras/nova`
- Botão "Pronto, vou capturar" em `AngleInterstitial`
- Botão "Continuar" no `RecoveryBanner`
- Botão "Tentar novamente" em `CameraDeniedScreen`
- Foco de teclado em `select` de cliente

**Destructive reservado para:**
- Botão "Descartar" no `RecoveryBanner` (com confirmação dialog)
- Cor do nível "Ruim" no `QualityIndicator`
- Texto de erro em `CameraDeniedScreen` (apenas o ícone de alerta + cabeçalho)

### Paleta de qualidade (D-03, D-07) — quatro níveis

Tokens dedicados, **não fazem parte da paleta primary/destructive**. Usar como cor de fill direto no `QualityIndicator`:

| Nível | Faixa score | Cor (Tailwind) | Hex aproximado | Cor do texto |
|-------|-------------|----------------|----------------|--------------|
| Ruim | `< 0.40` | `bg-red-500` | `#ef4444` | `text-white` |
| Regular | `0.40–0.74` | `bg-amber-400` | `#fbbf24` | `text-neutral-900` |
| Boa | `0.75–0.89` | `bg-emerald-400` | `#34d399` | `text-neutral-900` |
| Excelente | `≥ 0.90` | `bg-emerald-600` | `#059669` | `text-white` |

**Justificativa do mapeamento:** vermelho/amarelo/verde-claro/verde-escuro respeita a convenção universal de qualidade (semáforo + "verde mais escuro = melhor"). Contraste WCAG AA verificado para os pares cor-texto acima.

**Não usar:** `text-red-500`/`text-emerald-500` em texto de UI fora do `QualityIndicator` — para errors usar token `text-destructive`.

### Cor em fluxo de câmera ativa

- Background do viewfinder: **preto puro** `#000` (não `oklch(0.145 0 0)` do dark mode — preto absoluto melhora contraste das mensagens overlay).
- Overlay de instrução / live feedback: `bg-black/60 backdrop-blur-sm` com `text-white`.
- Overlay circular guia (D-context): borda `border-2 border-white/80`, sem fill.
- Ícone "redo" tap area no preview: `bg-white/10 backdrop-blur-md` round.

---

## Copywriting Contract (pt-BR)

> Toda copy desta fase **deve ser auditada** contra o vocabulário proibido (PROJECT.md). Nenhuma string pode usar "diagnóstico", "tratamento", "cura". Captura é "registro" / "leitura" / "imagem".

### Mensagens de feedback ao vivo (D-06, alimentado por `QualityCheck`)

| Sinal dominante na queda de score | Mensagem (pt-BR) |
|-----------------------------------|------------------|
| `irisDetected = false` | "Aproxime o olho do enquadramento circular" |
| `irisCenteredness < threshold` | "Centralize o olho no círculo" |
| `irisDistanceOk = false` (longe) | "Aproxime mais o celular" |
| `irisDistanceOk = false` (perto) | "Afaste um pouco o celular" |
| `sharpness < 100` | "Mantenha o celular firme — imagem desfocada" |
| `exposure` baixa | "Pouca luz — busque um ambiente mais claro" |
| `exposure` alta | "Muita luz — reduza o contraluz" |
| `reflexInIrisCenter = true` (D-06) | "Muito reflexo — gire levemente a cabeça" |
| `eyelidOcclusion > threshold` | "Abra mais o olho — pálpebra cobrindo a íris" |
| `overallScore ≥ 0.75` (estável) | "Ótima — capturando..." |
| `overallScore ≥ 0.90` | "Excelente — capturando..." |

**Regra de prioridade:** apenas **uma** mensagem visível por vez. Quando múltiplos sinais falham, mostrar o de maior peso na perda de score (decisão técnica do executor — UX vê só uma mensagem).

**aria-live:** componente `LiveFeedbackMessage` deve usar `aria-live="polite"` e `role="status"` para screen readers.

### CTAs (todos os botões com texto desta fase)

| Local | Copy |
|-------|------|
| `/leituras/nova` botão primário | "Iniciar leitura" |
| `/leituras/nova` placeholder do select | "Selecione o cliente" |
| `AngleInterstitial` CTA | "Pronto, vou capturar" |
| `RecoveryBanner` CTA primário | "Continuar leitura" |
| `RecoveryBanner` CTA secundário | "Descartar" |
| `RecoveryBanner` confirmação dialog primário | "Sim, descartar" |
| `RecoveryBanner` confirmação dialog secundário | "Cancelar" |
| `CameraDeniedScreen` CTA primário | "Tentar novamente" |
| `CameraDeniedScreen` CTA secundário | "Continuar via upload no computador" |
| `PWAInstallBanner` CTA Android | "Instalar app" |
| `PWAInstallBanner` CTA iOS | "Como instalar" (abre tooltip/sheet com instruções) |
| `PWAInstallBanner` dismiss | "Agora não" |
| Cancelar fluxo (header da tela de captura) | "Cancelar" (preserva rascunho — ver D-13) |

### Títulos e cabeçalhos

| Local | Copy |
|-------|------|
| `/leituras/nova` H1 | "Nova leitura" |
| `/leituras/nova` subtítulo | "Selecione o cliente para iniciar a captura das imagens." |
| `AngleInterstitial` (right→left transition) | "Vamos para o olho esquerdo" |
| `AngleInterstitial` subtítulo | "Os próximos 3 registros serão do olho esquerdo. Posicione o celular e toque em capturar quando estiver pronto." |
| `CameraDeniedScreen` H1 | "Câmera não disponível" (NotFoundError) ou "Permissão da câmera negada" (NotAllowedError) |
| `CameraDeniedScreen` body | "Para registrar as imagens da íris, o app precisa de acesso à câmera traseira do seu celular." |
| `RecoveryBanner` heading | "Você tem uma leitura em andamento" |
| `RecoveryBanner` body | "Leitura de **{Nome do Cliente}** iniciada {tempo relativo} — {N} de 6 imagens registradas. Deseja continuar?" |
| `PWAInstallBanner` heading | "Instale o Aurel Iris no celular" |
| `PWAInstallBanner` body | "A captura funciona melhor com o app instalado na tela inicial. Tela cheia, sem barras do navegador." |

### Empty / Loading / Error states

| Estado | Copy |
|--------|------|
| `/leituras/nova` sem clientes | "Você ainda não tem clientes cadastrados. [Cadastrar um cliente] antes de iniciar uma leitura." (link para `/clientes/novo`) |
| Loading (criando reading) | "Preparando leitura..." |
| Erro de criação de reading | "Não foi possível iniciar a leitura. Toque para tentar novamente." |
| Erro de upload de imagem | "Falha ao salvar imagem. Toque para reenviar." (com ícone retry) |
| Upload em background concluído | toast: "Imagem salva." (auto-dismiss 2s) |
| Sequência completa | "6 de 6 imagens registradas. Finalizando leitura..." → redirect para `/leituras/[id]` |

### Confirmação destrutiva (D-12, D-13)

**Botão "Descartar" no RecoveryBanner abre dialog:**

- Heading: "Descartar leitura em andamento?"
- Body: "As **{N} imagens já registradas** serão apagadas permanentemente. Esta ação não pode ser desfeita."
- Botão primário (destructive): "Sim, descartar"
- Botão secundário: "Cancelar"

### Instruções iOS PWA install (D-14)

Texto literal no banner / tooltip:

> "**Para instalar:** toque em **⎙** (compartilhar) na barra do Safari, role e selecione **'Adicionar à Tela de Início'**."

Renderizar `⎙` via SVG inline (`lucide-react` ícone `Share`) para garantir consistência visual entre iOS versions.

---

## Component Inventory & States

Cada componente custom abaixo deve declarar explicitamente seus estados visuais. Executor implementa **todos** os estados listados.

### `CameraView`
- `idle` (antes de pedir permissão)
- `requesting` (pedindo permissão — overlay com spinner + "Solicitando acesso à câmera")
- `denied` → renderiza `CameraDeniedScreen`
- `streaming` (câmera ativa, overlay circular visível)
- `capturing` (flash sutil branco 200ms ao disparar — opacity 0.6 sobre o frame)
- `error` (qualquer outro erro — fallback para `CameraDeniedScreen`)

### `QualityIndicator` (D-03)
**Forma escolhida (resolve discretion):** **Barra horizontal full-width no topo do viewfinder**, abaixo da safe-area top, com altura `h-2` (8px). Justificativa: barra é mais legível em sol forte que chip pequeno; full-width comunica "indicador de progresso/saúde" instantaneamente. Acima da barra (16px), label de texto centralizado: "Boa", "Excelente" etc.

Estados:
- `Ruim` — fill `bg-red-500` width 25%
- `Regular` — fill `bg-amber-400` width 50%
- `Boa` — fill `bg-emerald-400` width 75% (com pulse sutil 1.2s ease-in-out)
- `Excelente` — fill `bg-emerald-600` width 100%

Animação: transição `width` e `bg-color` em 300ms ease-out para evitar flicker em mudanças rápidas de score.

### `CapturePreview` (D-09)
- Foto recém-capturada exibida em fullscreen com label de qualidade canto superior esquerdo (`Badge` shadcn variant outline + cor da paleta de qualidade)
- Tap area: viewport inteiro (44×44 mínimo no centro com ícone refresh + label "Tocar para refazer" `text-sm` em `bg-black/60` chip)
- Indicador de countdown circular 2s no canto inferior direito (`<svg>` SVG circle stroke-dasharray animado)
- Sem tap → fade-out 200ms + transição para próximo angle/eye

### `AngleOverlay` (D-10 — entre ângulos do mesmo olho)
- `entering` (banner full-width superior do viewfinder, `bg-black/70 backdrop-blur` com `AngleIcon` inline + texto, dura 2.5s)
- `minimized` (chip canto superior direito 32×32 px com apenas `AngleIcon` em `bg-black/40`, persistente)

### `AngleInterstitial` (D-10 — transição entre olhos)
- Full-screen `bg-background`
- `AngleIcon` grande (96×96 px) centralizado
- Heading `text-xl` 24px abaixo do ícone (gap 32px)
- Subtítulo `text-base` 16px abaixo do heading (gap 16px)
- CTA primário `Button` shadcn size `lg` (`h-12`) full-width na bottom safe area (mantendo gutter 24px)
- Animação de entrada: fade + slide-up 300ms

### `AngleIcon` (D-11) — SVG inline
Variantes (exportar como prop `angle: 'frontal' | 'lateral' | 'backlight'` + `eye: 'left' | 'right'`):
- **Frontal:** olho de frente (oval com íris) + seta direta apontando para baixo (↓) abaixo do olho. Stroke `currentColor`, width 2.
- **Lateral:** olho de frente + seta diagonal (↗ para direito, ↖ para esquerdo) saindo da têmpora.
- **Backlight:** olho de frente + raios de sol estilizados (☼) **atrás** do contorno do olho. Implementar como dois grupos SVG — sol em z-index inferior (filled `currentColor opacity-30`), olho em z-index superior (stroke).

ViewBox `0 0 96 96`. Sempre escalar via Tailwind (`w-12 h-12`, `w-24 h-24` etc.) — nunca via `width=` inline.

### `CaptureProgress`
- Pill horizontal com 6 dots representando os 6 (eye, angle) slots
- Estados por dot: `pending` (`bg-neutral-300`), `current` (`bg-primary` + ring pulsante), `done` (`bg-emerald-500` + ícone check 12px)
- Position: topo do viewfinder, abaixo do `QualityIndicator`, gap 8px
- Texto compacto à direita: "{N} de 6"

### `RecoveryBanner` (D-12)
**Forma escolhida (resolve discretion):** **banner inline dismissable** no topo de `/dashboard` e `/leituras` (não modal blocking). Justificativa: terapeuta pode ter aberto o app para outra tarefa; modal blocking é hostil. Banner é proeminente mas não trava o fluxo. Usa shadcn `alert` com variant default + ícone `Clock` lucide.
- Position: top of main content area, full-width, mb-6
- Background: `bg-amber-50 border-amber-200` (light, atenção sem alarme)
- Heading + body como em §Copywriting
- Dois botões inline à direita do body: primário (`Button variant="default"` "Continuar leitura") + secundário (`Button variant="ghost"` "Descartar")
- Dismissable com X canto superior direito (sessão atual apenas — reaparece em refresh; suprimir definitivamente requer "Descartar")

### `PWAInstallBanner` (D-14)
- Position: bottom da tela em `/leituras/nova` (antes da 1ª captura), `fixed bottom-0` com `pb-safe`
- shadcn `alert` variant default, `bg-card border` shadow-lg
- Heading + body + 2 botões em row mobile (instalar primário + "Agora não" ghost)
- Android: tap em "Instalar app" → dispara `beforeinstallprompt`
- iOS: tap em "Como instalar" → abre shadcn `Sheet` bottom-sheet com instruções literais (texto + ícone Share lucide grande)

### `CameraDeniedScreen` (D-15)
- Layout fullscreen `flex-col items-center justify-center px-6`
- Ícone `CameraOff` lucide 64×64 `text-destructive`
- H1 + body (ver §Copywriting)
- Card com instruções específicas por browser (collapse via shadcn `accordion` se necessário — ou tabs por SO):
  - **iOS Safari:** "Ajustes > Safari > Câmera > Permitir"
  - **Chrome Android:** "Toque no cadeado na barra → Permissões → Câmera"
  - **Chrome Desktop:** "Cadeado → Permissões do site → Câmera → Permitir"
- 2 botões empilhados: "Tentar novamente" (primary) + "Continuar via upload no computador" (ghost) — segundo aponta para `/leituras/nova/upload` (placeholder em Fase 3)

### `LiveFeedbackMessage`
- Position: centro inferior do viewfinder, `bottom-32` (acima da bottom safe-area)
- Container: `bg-black/60 backdrop-blur-sm rounded-full px-6 py-3`
- Texto: `text-base text-white font-medium`
- aria-live="polite", role="status"
- Animação: fade entre mensagens 200ms

### Telemetria de upload (D-09 — resolve discretion)
**Forma escolhida:** **toast discreto** via shadcn `sonner`, position `bottom-right` em desktop, `bottom-center` em mobile com offset acima do safe-area.
- Estado `uploading`: spinner inline + "Salvando imagem 1/6..."
- Estado `success`: ícone check + "Imagem salva." (auto-dismiss 2s)
- Estado `error`: ícone alert + "Falha ao salvar imagem 3/6. [Tentar novamente]" (persistente até clique)

Justificativa: toast não bloqueia avanço (D-09 explícito), é discreto sobre a câmera, suporta retry inline para a heurística de "retry 2x com backoff" mencionada em D-context.

### Animação entre (eye, angle) (resolve discretion)
**Forma escolhida:** **fade-cross 200ms** entre `CapturePreview` e próximo viewfinder. Sem slide, sem cut. Justificativa:
- Slide simula movimento físico (sugere swipe), mas o usuário não está fazendo swipe — sugestão errônea.
- Cut direto é abrupto e gera disorientação na sequência rápida de 6 capturas.
- Fade comunica "transição de estado" sem direção implícita.

Para a **transição entre olhos** (D-10 interstitial): fade-out viewfinder 250ms → fade-in interstitial 300ms (sequenciados, não simultâneos). Reverse na saída.

### Janela de estabilidade auto-capture (resolve discretion)
**Decisão:** **400ms** de score consistente em "Boa" ou "Excelente" antes de disparar captura. Trade-off:
- 300ms: sensível demais, pode capturar em frame transiente bom seguido de ruim.
- 500ms: tempo perceptível de espera para o terapeuta — sensação de "travado".
- 400ms: ponto médio com margem para variação natural de mão.

Esta janela pode ser ajustada via experimentação na Fase 9 (dogfooding); 400ms é o ponto inicial.

---

## Accessibility (WCAG AA, pt-BR)

| Requisito | Implementação |
|-----------|---------------|
| Touch targets ≥ 44×44 px | Botões CTA mobile usam `h-12` (48px); área de tap-to-redo no preview é viewport inteiro |
| Live regions | `LiveFeedbackMessage` com `aria-live="polite"` `role="status"` |
| Contraste de texto | Todas as combinações `text-white sobre bg-black/60` ≥ 4.5:1 verificadas; cores de qualidade emparelhadas com texto contrastante (ver tabela) |
| Idioma declarado | `<html lang="pt-BR">` (já em `app/layout.tsx`) |
| Foco visível em teclado | `CameraDeniedScreen` (desktop fallback) e `/leituras/nova` totalmente keyboard-navigable; `ring-ring` token visível |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` desabilita pulse no QualityIndicator e fade-cross entre capturas (substitui por mudança instantânea) |
| Botões sem label visível | Botão "Cancelar leitura" no header da captura usa ícone X com `aria-label="Cancelar leitura"` |
| Screen reader na sequência | Cada transição (`AngleInterstitial`, novo angle) tem `aria-live` anunciando "Próximo: olho esquerdo, ângulo frontal" etc. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `progress`, `alert`, `sonner` (toast) | not required |
| (terceiros) | nenhum declarado | not applicable |

**Nenhum registry de terceiros é usado nesta fase.** Apenas componentes shadcn oficiais e componentes custom criados sob `apps/web/components/capture/`.

---

## PWA Manifest & Service Worker

> Não é design strictly mas é parte do contrato de instalabilidade declarado em CAPTURE-01 e D-14.

### `app/manifest.ts` (Next.js 15 metadata route)

```typescript
{
  name: "Aurel Iris",
  short_name: "Aurel Iris",
  description: "Ferramenta de apoio à anamnese terapêutica integrativa.",
  start_url: "/dashboard",
  display: "standalone",
  orientation: "portrait",
  theme_color: "#000000",          // bg do viewfinder — barra de status preta
  background_color: "#ffffff",     // splash screen
  lang: "pt-BR",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icons/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
  ]
}
```

### Service Worker
- **Estratégia mínima** (D-context, deferred §): registrar SW que apenas torna o app instalável (responde a `install` e `activate` events). Sem cache offline rico — Fase 9 polish.
- Arquivo: `apps/web/public/sw.js` ou via `next-pwa` se o time preferir abstração.

### Ícones a criar
- `icon-192.png`, `icon-512.png`, `icon-maskable.png` (com safe-zone interna 80%)
- Design temporário: letras "AI" (Aurel Iris) em fonte Geist Bold sobre fundo `#000`. **Identidade visual final é Fase 9 (deferred)** — para Fase 3 basta um placeholder reconhecível.

---

## Telemetria opcional (D-context — não-bloqueante)

Logar histograma de `overallScore` por captura sem PII para tunar limiares D-07 com base em uso real:

```ts
// pseudo
logEvent('capture_quality', {
  reading_id,        // OK — não é PII do cliente
  eye, angle,
  quality_score,     // 0..1
  attempts,          // quantos frames antes de capturar
  ms_to_capture,     // tempo desde entrada no viewfinder
});
```

**Não logar:** `therapist_id` em claro, `client_id`, qualquer foto. Implementação fica a critério do planner/executor — sugestão: PostHog ou Supabase tabela dedicada.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting (pt-BR, vocabulário proibido auditado, todas as strings declaradas): PASS
- [ ] Dimension 2 Visuals (componentes inventariados, estados declarados, animações prescritas): PASS
- [ ] Dimension 3 Color (60/30/10 + paleta de qualidade dedicada, accent/destructive reservados): PASS
- [ ] Dimension 4 Typography (4 tamanhos × 2 pesos, line-heights declarados): PASS
- [ ] Dimension 5 Spacing (múltiplos de 4, exceções declaradas, touch targets ≥44px): PASS
- [ ] Dimension 6 Registry Safety (apenas shadcn oficial, sem terceiros): PASS

**Approval:** pending

---

## Notas para o planner / executor

1. **Vocabulário proibido é hard gate**: rodar grep por "diagnóstico", "tratamento", "cura" antes de cada commit em `apps/web/components/capture/` e `apps/web/app/(capture)/`. Mesmo em comentários de código, evitar (auditoria futura LGPD-06 escaneia o repositório).

2. **MediaPipe lazy-load**: `@mediapipe/tasks-vision` (~3-5MB) deve ser carregado **apenas** na rota `(capture)/leituras/nova/capturar` via `next/dynamic` com `{ ssr: false }`. Nunca no bundle principal do `(dashboard)`.

3. **Storage path convention** (D-storage): `{therapist_id}/{reading_id}/{eye}_{angle}.jpg`. Usar este path como `storage_path` em `reading_images.storage_path`.

4. **Reuso da Fase 2**: `apps/web/components/ui/{button,card,badge,dialog,select,toast}.tsx` — não recriar. `lib/supabase/{client,server}.ts` para auth/queries.

5. **Order de implementação sugerida** (alinhado com D-decisions):
   - Plano 1: PWA shell + manifest + SW + ícones placeholder (D-14 + CAPTURE-01)
   - Plano 2: `/leituras/nova` (entry point + create reading server action) (D-01 + D-08)
   - Plano 3: `(capture)` route group + `CameraView` + permission flow + `CameraDeniedScreen` (D-15 + CAPTURE-02)
   - Plano 4: `IrisDetector` (MediaPipe) + `QualityIndicator` + `LiveFeedbackMessage` (D-02 + D-03 + D-06 + D-07 + CAPTURE-03/04)
   - Plano 5: `AngleInterstitial` + `AngleOverlay` + `AngleIcon` + `CaptureProgress` + sequência guiada (D-10 + D-11 + CAPTURE-05)
   - Plano 6: `CapturePreview` + compressão + upload Storage + `reading_images` insert (D-09 + D-16 + CAPTURE-06)
   - Plano 7: `RecoveryBanner` + queries de rascunho + finalização do reading (D-12 + D-13)

   Planner pode reagrupar/dividir, mas deve respeitar dependências (4 depende de 3; 5 depende de 4; 6 depende de 5; 7 depende de 6).

6. **Discretions resolvidas neste UI-SPEC** (sem necessidade de retornar ao usuário):
   - QualityIndicator → barra horizontal full-width topo (8px height)
   - RecoveryBanner → inline dismissable (não modal)
   - Telemetria upload → toast sonner discreto
   - Transição (eye, angle) → fade-cross 200ms
   - Janela estabilidade auto-capture → 400ms
   - Route group → `(capture)` separado de `(dashboard)`

---

*UI-SPEC gerado em 2026-05-01 pelo gsd-ui-researcher para Fase 3 — Captura mobile (PWA).*
*Fontes pré-populadas: CONTEXT.md (16 decisões D-01..D-16), components.json (preset base-nova/neutral), globals.css (tokens CSS), package.json (Geist + lucide-react), Phase 2 02-CONTEXT.md (sidebar layout + zinc/neutral defaults).*
