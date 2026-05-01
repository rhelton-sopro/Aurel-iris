---
phase: 01-setup
plan: 02
subsystem: infra

tags: [python, modal, vision-pipeline, opencv, mediapipe, monorepo]

requires:
  - phase: 01-setup/01
    provides: "Monorepo root scaffolding com .vercelignore excluindo vision-service/"
provides:
  - "vision-service/ skeleton paralelo a apps/web/ (D-01 monorepo)"
  - "vision-service/requirements.txt com 8 deps SPEC §4.2 + Modal SDK"
  - "vision-service/modal_app.py declarando Modal app aurel-iris-vision (gpu=T4, timeout=120s) com analyze_iris stub"
  - "vision-service/pipeline/ subpackage importável com 6 stubs (detect, segment, compose, normalize, enhance, features)"
  - "vision-service/README.md orientando Fase 5"
  - "vision-service/models/ placeholder pros pesos pré-treinados"
affects: [05-vision-pipeline, 01-04-supabase-link, 01-06-vercel-deploy]

tech-stack:
  added:
    - "Python 3.11 (pinned via .python-version)"
    - "modal SDK >=0.64 (declarado em requirements.txt; nao instalado nesta fase)"
    - "opencv-python-headless, numpy, scikit-image, mediapipe, torch, torchvision, Pillow, supabase (declarados; instalacao em Fase 5 via Modal image)"
  patterns:
    - "Estrutura SPEC §4.2 fixada em arquivo: 6 stages em ordem (detect -> segment -> compose -> normalize -> enhance -> features)"
    - "Stubs com NotImplementedError + docstring referenciando SPEC (cada modulo aponta para a secao canonica)"
    - "Vocabulario LGPD compliant em codigo Python tambem (zero diagnostico/tratamento/cura em vision-service/)"

key-files:
  created:
    - vision-service/.python-version
    - vision-service/requirements.txt
    - vision-service/modal_app.py
    - vision-service/README.md
    - vision-service/models/.gitkeep
    - vision-service/pipeline/__init__.py
    - vision-service/pipeline/detect.py
    - vision-service/pipeline/segment.py
    - vision-service/pipeline/compose.py
    - vision-service/pipeline/normalize.py
    - vision-service/pipeline/enhance.py
    - vision-service/pipeline/features.py
  modified: []

key-decisions:
  - "Python 3.11 pinado (.python-version) em vez de 3.12: Modal debian_slim default suporta 3.11 oficialmente; 3.12 ainda tem inconsistencias com torch/mediapipe wheels (alvo de Fase 5)"
  - "requirements.txt usa lower bounds (>=) em vez de pins exatos (==): Fase 5 fara pin definitivo apos primeiro deploy bem-sucedido com auditoria via pip-audit"
  - "modal SDK incluido em requirements.txt (alem das 8 deps do SPEC §4.2): permite que Fase 5 rode 'modal run' local sem editar requirements"
  - "Cada modulo do pipeline expoe exatamente 1 funcao publica conforme nome canonico SPEC §4.2 (find_iris, iris_mask, photometric_combine, daugman_polar, clahe, extract_all)"
  - "pipeline/__init__.py reexporta todos os 6 modulos via 'from . import' + __all__: garante que 'from pipeline import detect, segment, ...' funciona sem rodar import lazy"
  - "NotImplementedError com mensagem 'implement in Phase 5' em todas as funcoes: torna falha rapida e orientadora se alguem rodar prematuramente"

patterns-established:
  - "Vocabulario proibido: zero ocorrencias de diagnostico/tratamento/cura em vision-service/ (auditado via grep)"
  - "Layout monorepo D-01 reforcado: vision-service/ e apps/web/ sao subdirs paralelos do mesmo repo"
  - ".vercelignore (criado em 01-01) ja exclui vision-service/ — Vercel nao tentara buildar Python"

requirements-completed: [SETUP-01]

duration: ~4min
completed: 2026-04-30
---

# Phase 1 Plan 02: Vision-Service Skeleton Summary

**Skeleton vision-service/ Python paralelo a apps/web/ com Modal app aurel-iris-vision (gpu=T4, timeout=120s) declarado, requirements.txt cobrindo as 8 deps do SPEC §4.2 + Modal SDK, e subpackage pipeline/ com 6 stubs nas etapas detect -> segment -> compose -> normalize -> enhance -> features.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-01T00:59:02Z
- **Completed:** 2026-05-01T01:02:54Z
- **Tasks:** 2 (ambas auto)
- **Files committed:** 12 (5 root vision-service + 7 pipeline/)

## Accomplishments

- `vision-service/` criado paralelo a `apps/web/` reforcando D-01 (monorepo unico, nao 2 repos).
- `requirements.txt` lista todas as 8 deps do SPEC §4.2 (`opencv-python-headless`, `numpy`, `scikit-image`, `mediapipe`, `torch`, `torchvision`, `Pillow`, `supabase`) + Modal SDK; lower bounds compativeis com Fase 5.
- `modal_app.py` declara `app = modal.App("aurel-iris-vision")` e `analyze_iris(reading_id: str, image_urls: list[dict]) -> dict` com `gpu="T4"` e `timeout=120` — contrato exato do SPEC §4.2 fixado.
- `pipeline/` subpackage com 7 arquivos (`__init__.py` + 6 stages); import `from pipeline import detect, segment, compose, normalize, enhance, features` funciona sem erro a partir de `vision-service/`.
- `README.md` orienta planner/exec de Fase 5 com setup local, comandos Modal e estrutura.
- `models/.gitkeep` placeholder pros pesos pre-treinados (Fase 5).
- Vocabulario clean: 0 ocorrencias de "diagnostico"/"tratamento"/"cura" em qualquer arquivo de `vision-service/`.

## Task Commits

1. **Task 1: Criar estrutura vision-service/ com requirements.txt e Modal app stub** - `19c4410` (feat)
   - Files: `.python-version`, `requirements.txt`, `modal_app.py`, `README.md`, `models/.gitkeep`

2. **Task 2: Criar pipeline/ subpackage com 6 stubs** - `0da5f39` (feat)
   - Files: `pipeline/__init__.py`, `pipeline/detect.py`, `pipeline/segment.py`, `pipeline/compose.py`, `pipeline/normalize.py`, `pipeline/enhance.py`, `pipeline/features.py`

**Plan metadata commit:** sera criado pelo orquestrador (per `<sequential_execution>` do prompt).

## Files Created/Modified

### vision-service/ root (Task 1)
- `vision-service/.python-version` — `3.11` (Modal debian_slim default).
- `vision-service/requirements.txt` — 8 deps do SPEC §4.2 + `modal>=0.64.0`.
- `vision-service/modal_app.py` — Modal app `aurel-iris-vision` com `analyze_iris` stub que lanca `NotImplementedError` (contrato SPEC §4.2: `gpu="T4"`, `timeout=120`).
- `vision-service/README.md` — orienta Fase 5 (setup local, comandos `modal run`, estrutura).
- `vision-service/models/.gitkeep` — placeholder.

### vision-service/pipeline/ (Task 2)
- `pipeline/__init__.py` — reexporta os 6 modulos via `from . import compose, detect, enhance, features, normalize, segment` + `__all__`.
- `pipeline/detect.py` — `find_iris(image)` (MediaPipe Face Mesh; SPEC §4.4).
- `pipeline/segment.py` — `iris_mask(image, detection)` (Hough OpenCV baseline; U-Net em v1.1).
- `pipeline/compose.py` — `photometric_combine(segmented_images)` (3 angulos -> 1 composite).
- `pipeline/normalize.py` — `daugman_polar(composite_image)` (rubber sheet).
- `pipeline/enhance.py` — `clahe(normalized_image)` (CLAHE).
- `pipeline/features.py` — `extract_all(enhanced_image, composite_image)` (SPEC §4.3 schema: constitution, iris_color, fiber_density, collarette, pupil, sectors, rings, global_signs, image_quality).

Cada funcao publica lanca `NotImplementedError` com mensagem mencionando "Phase 5". Cada modulo tem docstring referenciando a secao canonica da SPEC.

### Snapshot do `requirements.txt`

```
opencv-python-headless>=4.10.0
numpy>=1.26.0
scikit-image>=0.24.0
mediapipe>=0.10.14
torch>=2.4.0
torchvision>=0.19.0
Pillow>=10.4.0
supabase>=2.7.0
modal>=0.64.0
```

## Decisions Made

1. **Python 3.11 pinado em `.python-version`** — Modal `debian_slim` default suporta 3.11 oficialmente; 3.12 ainda tem inconsistencias com torch/mediapipe wheels (Fase 5 valida e pode promover para 3.12 se cabivel). Versao instalada localmente nesta maquina (3.10) eh suficiente pra `ast.parse` mas o pin `.python-version` orienta o tooling de Fase 5.
2. **Lower bounds (`>=`) em vez de pins exatos (`==`)** — Fase 5 fara pin definitivo apos primeiro deploy bem-sucedido + `pip-audit`. Plan 1.2 nao instala nada, entao drift ainda nao eh risco.
3. **`modal` SDK incluido alem das 8 deps do SPEC §4.2** — permite que Fase 5 rode `modal run modal_app.py` localmente sem editar `requirements.txt`. Documentado no comentario do arquivo.
4. **NotImplementedError em todas as funcoes** — falha rapida e orientadora; mensagem inclui "Phase 5" pra rastrear quem deve implementar.
5. **`pipeline/__init__.py` com `from . import` explicito + `__all__`** — `from pipeline import detect, segment, ...` funciona em uma so linha, evita lazy import surpresa.

Todas as decisoes alinhadas ao plan; nenhuma deviacao.

## Deviations from Plan

None - plan executed exactly as written.

(Verificacao: Task 1 e Task 2 entregaram exatamente os arquivos listados em `<files>` com os conteudos especificados em `<action>`. Cada acceptance criterion foi atendido na primeira execucao do verify chain.)

## Auth Gates Encountered

Nenhum (plan 1.2 nao toca em servicos externos com auth — Modal/Anthropic/Supabase entram a partir do plan 1.3).

## Issues Encountered

- Python local eh 3.10.11; `.python-version` pina 3.11. Sem impacto: `ast.parse` eh forward-compat para a sintaxe usada (sem match-case especifico de 3.10/3.11), entao a verificacao automatica passa. Modal usa sua propria image em deploy (Fase 5).
- `__pycache__/` foi criado pelo teste de import de Task 2; ja coberto pelo `.gitignore` (linha `__pycache__/` em `# python (vision-service)`), entao nao vazou pro commit.

## User Setup Required

None - nenhum servico externo configurado nesta fase. Modal CLI sera autenticado em Fase 5.

## Next Phase Readiness

**Pronto para Wave 2 (plan 01-03 Supabase init + plan 01-04 Supabase link + types):**
- `vision-service/` skeleton firme; `.vercelignore` (criado em 01-01) ja exclui — Vercel nao tentara buildar Python.
- Wave 1 completa: `apps/web/` (01-01) + `vision-service/` (01-02) ambos prontos paralelo.

**Pronto para Fase 5 (Pipeline de visao / Modal):**
- Contratos do SPEC §4.2 fixados em codigo (`app.name`, `gpu`, `timeout`, signature de `analyze_iris`, ordem das 6 etapas).
- Subpackage `pipeline/` importavel: Fase 5 substitui cada `NotImplementedError` por implementacao real sem refator estrutural.
- Pesquisa de Fase 5 ja tem destino claro pra modelos pre-treinados (`vision-service/models/`).

**Sem blockers.**

## Self-Check: PASSED

- [x] `vision-service/.python-version` contem `3.11`
- [x] `vision-service/requirements.txt` contem todas as 8 strings do SPEC §4.2 + `modal`
- [x] `vision-service/modal_app.py` contem `modal.App("aurel-iris-vision")`, `gpu="T4"`, `timeout=120`, `def analyze_iris`, `from pipeline import detect, segment, compose, normalize, enhance, features`
- [x] `vision-service/modal_app.py` parses cleanly (`ast.parse` retorna 0)
- [x] `vision-service/README.md` referencia "Fase 5" e "SPEC.md §4"
- [x] `vision-service/models/` existe com `.gitkeep`
- [x] 7 arquivos em `vision-service/pipeline/` (`__init__.py`, `detect.py`, `segment.py`, `compose.py`, `normalize.py`, `enhance.py`, `features.py`)
- [x] `pipeline/__init__.py` reexporta os 6 modulos
- [x] Cada modulo tem 1 funcao publica conforme SPEC §4.2 com `NotImplementedError` mencionando "Phase 5"
- [x] Cada modulo tem docstring referenciando SPEC (§4.2/§4.3/§4.4)
- [x] `from pipeline import detect, segment, compose, normalize, enhance, features` executa sem erro a partir de `vision-service/`
- [x] vocabulario clean (`grep -riE 'diagn[óo]stico|tratamento|\bcura\b' vision-service/` retorna 0 matches)
- [x] commits Task 1 (`19c4410`) e Task 2 (`0da5f39`) presentes em `git log`
- [x] STATE.md e ROADMAP.md NAO modificados (orquestrador faz isso)
- [x] `.vercelignore` ja cobre `vision-service/` (criado em 01-01; verificado nesta fase)

---

*Phase: 01-setup*
*Plan: 02*
*Completed: 2026-04-30*
