# Phase 3: Captura mobile (PWA) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 03-captura-mobile-pwa
**Areas discussed:** Fluxo de entrada + criação do reading, Revisão entre capturas (retake), Instruções entre os 6 ângulos, Sessão interrompida (recovery), PWA install, Câmera negada, Compressão pré-upload

---

## Área 1 — Fluxo de entrada + criação do reading

### Q1.1 — De onde inicia o fluxo de captura?

| Opção | Descrição | Selecionada |
|--------|-------------|----------|
| Ambos: cliente + rota global | `/clientes/[id]` botão + `/leituras/nova` rota global | ✓ |
| Só a partir do cliente | Botão em `/clientes/[id]` é único entry point | |
| Só rota global | Só `/leituras/nova` existe; botão do cliente redireciona | |

**Resposta do usuário:** "Ambos os pontos de entrada."
**Notas:** Usuário também antecipou decisões de captura (auto), UI de qualidade (4 níveis), persistência, badge no relatório, e reflexo como sinal suave. Locked como D-01 a D-06.

### Q1.2 — Mapeamento dos limiares de qualidade

**Proposta apresentada:** Ruim <0.40 / Regular 0.40–0.74 / Boa 0.75–0.89 / Excelente ≥0.90

**Resposta do usuário:** "Limiares aceitos como propostos."
**Notas:** Locked como D-07.

### Q1.3 — Quando o registro `readings` é criado no banco?

| Opção | Descrição | Selecionada |
|--------|-------------|----------|
| (a) Ao iniciar | `status='pending'` antes da 1ª foto, `reading_id` no storage path, recovery server-side | ✓ |
| (b) Após 1ª foto | Atomic com primeira imagem | |
| (c) Só ao concluir as 6 | Mais simples, sem rastreabilidade de incompletas | |

**Resposta do usuário:** "(a) Criar o registro readings ao iniciar o fluxo com status='pending'. Permite recovery e rastreabilidade desde o início."
**Notas:** Locked como D-08.

---

## Área 2 — Revisão entre capturas (retake)

### Q2.1 — Pós-captura: auto-avança ou preview?

| Opção | Descrição | Selecionada |
|--------|-------------|----------|
| (a) Auto-avança direto | Zero friction, sem preview | |
| (b) Preview com botões Manter/Refazer | Controle explícito | |
| (c) Preview passivo 2s + tap-to-refazer | Avança sozinho mas permite refazer com tap | ✓ |

**Resposta do usuário:** "(c) Preview passivo que avança sozinho em 2 segundos mas permite tocar para refazer. Zero fricção no fluxo normal, mas terapeuta tem controle se quiser."
**Notas:** Locked como D-09. Combina com D-02 (auto-capture) — fluxo todo é zero-friction quando qualidade é boa, com escape hatches via tap.

---

## Área 3 — Instruções entre os 6 ângulos

### Q3.1 — Como mostrar a instrução do próximo ângulo?

| Opção | Descrição | Selecionada |
|--------|-------------|----------|
| (a) Tela interstitial dedicada | Full-screen, câmera para, diagrama + botão | |
| (b) Overlay inline | Banner em viewfinder, câmera continua ativa | |
| (c) Híbrido | Interstitial entre olhos, overlay entre ângulos | ✓ |

**Resposta do usuário:** "(c) Híbrido: interstitial na transição de olho (right→left) + overlay inline nas transições de ângulo. Clareza onde importa, fluidez no resto."
**Notas:** Locked como D-10. Interstitial só na 4ª captura (`right/backlight → left/frontal`); demais transições via overlay.

### Q3.2 — Conteúdo da instrução

| Opção | Descrição | Selecionada |
|--------|-------------|----------|
| (a) Ícone vetorial SVG | Olho + seta indicando ângulo | ✓ |
| (b) Foto/ilustração | Precisa asset gráfico real | |
| (c) Só texto | Minimalista, sem ícone | |

**Resposta do usuário:** "(a) Ícone vetorial SVG simples do olho com seta indicando o ângulo. Sem precisar de asset gráfico real."
**Notas:** Locked como D-11. Componente sugerido: `components/capture/AngleIcon.tsx` com variantes frontal/lateral/backlight.

---

## Área 4 — Sessão interrompida (recovery)

### Q4.1 — Recovery ao reabrir o app com leitura incompleta

| Opção | Descrição | Selecionada |
|--------|-------------|----------|
| (a) Banner/prompt automático | "Você tem leitura incompleta de [Nome]. Continuar?" | ✓ |
| (b) Recovery passivo | Sem prompt, só badge em `/leituras` | |
| (c) Sempre começa do zero | Job de limpeza apaga incompletas após N horas | |

**Resposta do usuário:** "(a) Banner automático 'Você tem uma leitura incompleta de [Nome]. Continuar?' — o terapeuta não vai lembrar que deixou incompleto, o app precisa lembrar por ele."
**Notas:** Locked como D-12. Banner é dismissable mas reaparece até reading ser completado ou descartado explicitamente.

### Q4.2 — Cancelar leitura durante o fluxo

| Opção | Descrição | Selecionada |
|--------|-------------|----------|
| (a) Hard delete com confirmação | Apaga reading + imagens parciais | |
| (b) Sai mantendo rascunho | Reading fica em `pending`, vai pro recovery | ✓ |
| (c) Sem botão de cancelar | Só sai navegando | |

**Resposta do usuário:** "(b) Cancelar sai do fluxo mas mantém como rascunho. O terapeuta decide depois se continua ou descarta. Evita perda acidental de fotos já capturadas."
**Notas:** Locked como D-13. Hard delete só via "Descartar" no banner de recovery (D-12), com confirmação.

---

## Área 5 — PWA install

### Q5.1 — Estratégia de prompt de instalação

| Opção | Descrição | Selecionada |
|--------|-------------|----------|
| (a) Banner proativo antes da 1ª captura | Recomenda forte, não força | ✓ |
| (b) Passivo (só Add to Home Screen do browser) | Sem prompt do app | |
| (c) Força (bloqueia captura sem PWA instalado) | Por causa de quirks iOS Safari | |

**Resposta do usuário:** "Banner proativo antes da 1ª captura, não força mas recomenda forte."
**Notas:** Locked como D-14. Android: `beforeinstallprompt`; iOS: instruções visuais ⎙ → "Adicionar à Tela de Início". Dismissable com TTL ~7 dias.

---

## Área 6 — Câmera negada / browser sem suporte

### Q6.1 — Tratamento de erro de câmera

| Opção | Descrição | Selecionada |
|--------|-------------|----------|
| (a) Tela de erro com instruções + fallback upload | Diagnóstico + redirect para upload desktop | ✓ |
| (b) Página explicativa de como reabilitar | Sem fallback alternativo | |
| (c) Bloquear até consentir | Sem alternativa | |

**Resposta do usuário:** "Tela de erro com instruções de como reabilitar + botão para continuar via upload desktop (Fase 4)."
**Notas:** Locked como D-15. Botão aponta para `/leituras/nova/upload` (placeholder em Fase 3, real em Fase 4).

---

## Área 7 — Compressão pré-upload

### Q7.1 — Estratégia de compressão

| Opção | Descrição | Selecionada |
|--------|-------------|----------|
| Original sem compressão | ≥3MB/foto, 18MB+/leitura | |
| JPEG 0.85 + max 2048px | ~500KB/foto, ~3MB/leitura | ✓ |
| JPEG 0.7 + max 1280px | Ainda menor mas perde detalhe | |

**Resposta do usuário:** "JPEG 0.85 + max 2048px (~500KB cada). Qualidade suficiente para o pipeline, viável em 4G brasileiro. Upload de 18MB por leitura é inaceitável em rede móvel."
**Notas:** Locked como D-16. Reavaliar qualidade do pipeline durante spike da Fase 5.

---

## Claude's Discretion

Áreas onde o usuário deferiu para implementação (capturadas em CONTEXT.md `<decisions>` → "Claude's Discretion"):
- Posicionamento e estilo exato do indicador de qualidade
- Animação de transição entre ângulos
- Janela de estabilidade para auto-captura (300-500ms sugerido)
- Forma exata do banner de recovery (modal vs banner)
- Estratégia de service worker para Fase 3 (mínimo OK)
- Telemetria de upload (toast/spinner/progress)
- Formato exato do SVG de `AngleIcon.tsx`
- Tratamento de erro de upload (retry strategy)
- Hooks customizados (organização interna)

## Deferred Ideas

Capturadas em CONTEXT.md `<deferred>`. Resumo:
- Service worker offline-first (Fase 9)
- Tema visual / identidade Aurel Iris (Fase 9)
- Listagem completa `/leituras` com filtros (Fase 7+)
- Termo LGPD antes de capturar (Fase 8)
- Logs de auditoria de Storage (Fase 8)
- Upload em chunks / resumível (não necessário com 500KB)
- Multi-foto por ângulo (reavaliar pós-dogfooding)
- Compressão WebP (esperar suporte universal)
