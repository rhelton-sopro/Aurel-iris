# Requirements

No PRD documents were classified in this ingest. This file is intentionally empty.

The SPEC document (`SPEC.md`) contains a phased roadmap (Phase 0–8) and feature scope which describe *what* the system does at the technical level, but it was not classified as a PRD and therefore does not yield formal `REQ-*` entries.

Downstream roadmap synthesis may derive an initial requirements skeleton by interpreting the SPEC's roadmap phases as candidate requirements, but they should be treated as inferred-from-SPEC and explicitly tagged as such — not as PRD-anchored requirements.

Suggested candidate requirement IDs (for downstream consideration only, not authoritative):

- `REQ-auth-magic-link` — Email + magic-link authentication via Supabase Auth (source: SPEC.md §1, §7 Phase 1)
- `REQ-clients-crud` — CRUD of therapist's clients with LGPD consent capture (source: SPEC.md §3, §7 Phase 1, §8)
- `REQ-pwa-mobile-capture` — PWA mobile capture of 3 angles × 2 eyes with on-device quality validation (source: SPEC.md §4.1, §7 Phase 2)
- `REQ-desktop-upload` — Desktop dropzone upload path with same storage structure (source: SPEC.md §7 Phase 3)
- `REQ-vision-pipeline` — Modal.com vision pipeline producing structured iris feature JSON (source: SPEC.md §4.2–§4.4, §7 Phase 4)
- `REQ-rag-ingestion` — One-shot ingestion of iridology PDFs into pgvector (source: SPEC.md §5, §7 Phase 5)
- `REQ-llm-analysis` — Claude Sonnet 4.6 analysis with retrieval, hypothetical-language report (source: SPEC.md §6, §7 Phase 6)
- `REQ-stripe-billing` — Stripe BRL/PIX checkout, three tiers, 14-day trial, webhook-driven status (source: SPEC.md §7 Phase 7)
- `REQ-lgpd-compliance` — Per-client consent term, encryption, access logs, deletion right (source: SPEC.md §8)
- `REQ-onboarding-and-email` — 3-step onboarding plus Resend transactional email (source: SPEC.md §7 Phase 8)

These are inferred suggestions only and require formal PRD ratification before being treated as binding requirements.
