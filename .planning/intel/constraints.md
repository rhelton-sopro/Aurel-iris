# Constraints

All constraints below derive from the single SPEC document `SPEC.md` (Aurel Iris — Especificação Técnica do MVP).

---

## Stack — Frontend & API

**Type:** protocol
**Source:** SPEC.md §1

- Next.js 15 (App Router) on Vercel for frontend and API.
- TypeScript, Tailwind, shadcn/ui as UI baseline.
- App Router folder layout under `app/(auth)`, `app/(dashboard)`, `app/api` is prescribed (SPEC.md §2).

---

## Stack — Authentication

**Type:** protocol
**Source:** SPEC.md §1, §7 Phase 1

- Supabase Auth, email + magic link flow.
- Middleware-based route protection.

---

## Stack — Database & Vector Store

**Type:** schema
**Source:** SPEC.md §1, §3

- Supabase Postgres with `pgvector` extension; serves as both relational DB and vector store.
- Embedding column dimension is `1024` to match Voyage AI `voyage-3`.
- HNSW index using `vector_cosine_ops` on `knowledge_chunks.embedding`.
- Row-Level Security enabled on `profiles`, `clients`, `readings`, `reading_images`, `subscriptions`.
- `knowledge_chunks` is readable by any authenticated user (shared corpus).

---

## Database Schema (canonical tables)

**Type:** schema
**Source:** SPEC.md §3

Tables: `profiles`, `clients`, `readings`, `reading_images`, `knowledge_chunks`, `subscriptions`.

Key invariants:
- `profiles.id` references `auth.users(id) on delete cascade`.
- `profiles.subscription_status` enum-by-convention: `trial | active | cancelled | past_due`. Default `trial`. `trial_ends_at` defaults to `now() + interval '14 days'`.
- `clients.therapist_id` is a non-null FK to `profiles(id)` with cascade delete; `clients.consent_signed_at` and `clients.consent_document_url` are required for LGPD-compliant operation (column nullable but workflow-required).
- `readings.status` enum-by-convention: `pending | processing | ready | failed | edited`. Default `pending`.
- `readings.capture_method` enum-by-convention: `mobile_camera | desktop_upload`.
- `readings.iris_map` enum-by-convention: `jensen | jausas | hidalgo`. Default `jensen`.
- `readings.vision_features` is `jsonb` and is the canonical evidence object produced by the vision pipeline.
- `reading_images.eye` ∈ `{left, right}`; `reading_images.angle` ∈ `{frontal, lateral, backlight}`.
- Up to 6 images per reading (3 angles × 2 eyes) per SPEC §3 comment.
- `knowledge_chunks.embedding vector(1024)` (Voyage `voyage-3`).
- `subscriptions.plan` enum-by-convention: `starter | professional | school`. `stripe_subscription_id` unique.

Indexes mandated:
- `clients(therapist_id)`
- `readings(therapist_id)`, `readings(client_id)`, `readings(status)`
- `reading_images(reading_id)`
- HNSW on `knowledge_chunks(embedding)` with `vector_cosine_ops`.

RLS policies mandated:
- "Therapists only see their own clients" — `using (auth.uid() = therapist_id)` on `clients`.
- "Therapists only see their own readings" — `using (auth.uid() = therapist_id)` on `readings`.
- "Knowledge chunks are public to authenticated users" — `using (auth.role() = 'authenticated')` on `knowledge_chunks`.

---

## Stack — Storage

**Type:** protocol
**Source:** SPEC.md §1, §8

- Supabase Storage; private bucket per therapist enforced via RLS.
- Pipeline consumers receive signed URLs (not direct bucket reads).
- Encryption at rest (provided by Supabase) and HTTPS in transit are mandatory.

---

## Stack — Payments

**Type:** protocol
**Source:** SPEC.md §1, §7 Phase 7

- Stripe Brazil with PIX enabled.
- BRL pricing.
- Three tiers: Starter (R$ 89/mês, 20 análises), Profissional (R$ 189/mês, ilimitado), Escola (R$ 490/mês, contato/white-label leve).
- 14-day automatic trial.
- Subscription status is webhook-driven into `subscription_status` and `subscriptions` table.
- Middleware blocks analyses when trial expired without active subscription.

---

## Stack — Vision Pipeline

**Type:** api-contract
**Source:** SPEC.md §1, §4

- Modal.com serverless GPU (Python, OpenCV-based).
- T4 GPU, 120s timeout per analysis (`@app.function(image=image, gpu="T4", timeout=120)`).
- Communication: webhook from Next.js → Modal; callback webhook from Modal → `app/api/vision/webhook/route.ts` with HMAC-secured payload.
- Input contract: `analyze_iris(reading_id: str, image_urls: list[dict])` where each dict is `{eye, angle, url}`.
- Pipeline stages mandated and ordered: `detect → segment → compose → normalize → enhance → features`.
- MVP libraries: MediaPipe Face Mesh for iris detection; Hough Transform circular (OpenCV) baseline for segmentation; heuristics in OpenCV for lacuna/crypt detection; HSV clustering for color analysis.
- v1.1 upgrade path: U-Net pre-trained on CASIA-Iris.

---

## On-device Capture Validation

**Type:** api-contract
**Source:** SPEC.md §4.1

- `IrisDetector.tsx` wraps MediaPipe `FaceLandmarker`.
- Iris landmark indices: 468–477 (right eye), 473–477 (left eye).
- `validateFrame` returns `QualityCheck` with: `irisDetected`, `irisCenteredness`, `irisDistanceOk`, `sharpness` (Laplacian variance, threshold > 100), `exposure`, `reflexInIrisCenter`, `eyelidOcclusion`, `overallScore`.
- Capture is gated: only allowed when `overallScore >= 0.75`.

---

## Vision Output Contract (the JSON delivered to LLM)

**Type:** api-contract
**Source:** SPEC.md §4.3

This JSON is the canonical evidence object. Every LLM interpretation must be anchored to features in this JSON.

Top-level shape:
```
{
  "right_eye": { ... },
  "left_eye":  { ... },
  "asymmetry_notes": [string],
  "processing_metadata": { "model_version": string, "processing_time_ms": number }
}
```

Per-eye shape (right_eye / left_eye):
- `constitution`: `{ primary, confidence, indicators[] }`
- `iris_color`: `{ primary, secondary, central_heterochromia }`
- `fiber_density`: `{ score, interpretation }`
- `collarette`: `{ shape, diameter_ratio, decentralization }`
- `pupil`: `{ centralization, shape, size_ratio }`
- `sectors[]`: each `{ hour: 1..12, zones[], findings[] }`. Findings include `{ type: "lacuna" | "pigmentacao" | ..., depth?, size_mm?, color?, extension? }`.
- `rings`: `{ nerve_rings: { present, count, intensity }, lymphatic_rosary: { present }, sodium_ring: { present }, senile_arc: { present } }`
- `global_signs`: `{ radii_solaris[], transversal_signs[], tofus[] }`
- `image_quality`: `{ composite_score, warnings[] }`

---

## Stack — LLM

**Type:** protocol
**Source:** SPEC.md §1, §6, §7 Phase 6

- Provider: Anthropic API.
- Model: Claude Sonnet 4.6.
- Streaming required.
- Response stored raw in `readings.ai_report_raw`; therapist edits stored in `readings.ai_report_edited`.

---

## Stack — Embeddings (RAG)

**Type:** protocol
**Source:** SPEC.md §1, §5

- Provider: Voyage AI.
- Model: `voyage-3`.
- Embedding dimension: 1024.
- Batch size: up to 128 texts per call.

---

## RAG Retrieval Contract

**Type:** api-contract
**Source:** SPEC.md §5.4

- `retrieveRelevantKnowledge(features)` issues multiple queries derived from features:
  - Constitution-based query.
  - Per-sector queries when `findings.length > 0`.
  - Global-sign queries (e.g., nerve rings).
- Per-query top-K = 5 chunks; results deduplicated and ranked; cap at 30 chunks (~15k tokens) injected to prompt.
- Sonnet 4.6 context window (200k tokens) provides ample headroom.

---

## Chunking Strategy

**Type:** protocol
**Source:** SPEC.md §5.3

- Target chunk size: 500 tokens; overlap: 80.
- Split priority: `["chapter", "section", "paragraph"]`.
- Auto-tagging via LLM producing 3–5 tags per chunk for metadata filters.

---

## Prompt Contract

**Type:** api-contract
**Source:** SPEC.md §6

- Base system prompt at `prompts/system.md`. Operating principles enforced:
  1. No diagnosis — hypotheses only.
  2. No fabricated signs — interpretations must cite features from the JSON.
  3. Use injected RAG knowledge over generalist knowledge.
  4. Mandatory hypothetical language; banned phrasings include "the client has", "diagnose", "is sick with", "trauma confirmed at age X".
  5. Temporal-trauma framing must be hypothesis to be confirmed in anamnesis.
- Mandatory report structure: 13 numbered sections (Constitution, Structural, Systemic, Toxemia, Psychoemotional, Temporal-load hypotheses, Nutritional, Symbolic/Spiritual, Integrative care suggestions, Strengths, Affirmations, Synthesis, Final message).
- Mandatory literal closing disclaimer present in §6.
- Feature-injection template at `prompts/feature-injection.md` with `<client_context>`, `<features>`, `<knowledge>` blocks.
- Output language: Brazilian Portuguese.

---

## Email — Transactional

**Type:** protocol
**Source:** SPEC.md §1, §7 Phase 8

- Provider: Resend.
- Use cases: confirmations, receipts, "leitura pronta" notifications, exports.

---

## NFR — Cost Envelope (MVP scale 10–20 therapists)

**Type:** nfr
**Source:** SPEC.md §1

- Vercel Pro: $20/mo
- Supabase Pro: $25/mo
- Modal pay-per-use: ~$30–80/mo at MVP volume
- Anthropic API: ~$0.30 per analysis (Sonnet 4.6)
- Voyage embeddings: ~$20 one-time indexing cost
- **Operational total target: ~$100–150/mo** at 10–20 therapists.

---

## NFR — Compliance / LGPD

**Type:** nfr
**Source:** SPEC.md §8

- Iris photo classified as biometric + health data (sensitive category under LGPD).
- Per-client consent term required, signable digitally (DocuSeal or Clicksign suggested).
- Encryption at rest (Supabase native) and in transit (HTTPS mandatory).
- Per-therapist private Storage bucket with RLS.
- Right of erasure: cascading delete button.
- Access logs on image reads.
- **Forbidden vocabulary** in any product surface (UI, reports, marketing): "diagnóstico", "tratamento", "cura".
- Mandatory positioning copy: "ferramenta de apoio à anamnese terapêutica integrativa, não substitui avaliação médica".
- Recommended pre-launch: healthtech/data-protection legal review (~R$ 2–4k budgeted).

---

## NFR — Product Positioning Disclaimer (structural)

**Type:** nfr
**Source:** SPEC.md preamble & §6 closing block

- All reports must use hypothetical language and explicitly state they are anamnesis-support tools, not diagnoses.
- The mandated closing disclaimer in §6 must appear literally on every generated report.

---

## Roadmap Phasing (technical schedule)

**Type:** protocol
**Source:** SPEC.md §7

Total target: ~5–6 weeks to closed MVP.

- Phase 0 — Setup (1–2 days): account creation, env vars, Next.js init, schema migration.
- Phase 1 — Auth + Dashboard básico (2–3 days).
- Phase 2 — Captura mobile / PWA (4–6 days).
- Phase 3 — Upload desktop (1–2 days).
- Phase 4 — Pipeline de visão / Modal (5–7 days).
- Phase 5 — RAG ingestion (2–3 days).
- Phase 6 — Análise LLM (3–5 days).
- Phase 7 — Pagamento + LGPD (3–4 days).
- Phase 8 — Polish + beta fechado (1 week).
