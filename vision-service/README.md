# vision-service

Pipeline de visão computacional do Aurel Iris (Modal serverless GPU).

> **Status:** Esqueleto — Fase 1 (Setup). Implementação real em Fase 5.

Contrato e arquitetura: ver `SPEC.md` §4 e `.planning/ROADMAP.md` Fase 5.

## Setup local (futuro — Fase 5)

```bash
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# .venv\Scripts\activate   # Windows
pip install -r requirements.txt
modal token new             # autentica com Modal Cloud
modal run modal_app.py::analyze_iris   # após implementação
```

## Estrutura

- `modal_app.py` — Modal App com função `analyze_iris(reading_id, image_urls)` (SPEC §4.2).
- `pipeline/` — Etapas do pipeline:
  - `detect.py` — Detecção de íris (MediaPipe Face Mesh, indices 468-477 / 473-477).
  - `segment.py` — Segmentação (Hough circular OpenCV; U-Net pré-treinada CASIA-Iris em v1.1).
  - `compose.py` — Composição photometric stereo (3 ângulos -> 1 imagem rica).
  - `normalize.py` — Normalização polar Daugman (rubber sheet).
  - `enhance.py` — CLAHE.
  - `features.py` — Extração das features finais (SPEC §4.3 schema).
- `models/` — Pesos pré-treinados (vazio na Fase 1).
