# Context

Running notes from non-PRD/non-ADR sources. The current ingest contained one SPEC document; the contextual / narrative / strategic content from that SPEC is recorded here for downstream synthesis. Pure technical decisions are kept in `constraints.md`.

---

## Topic: Product positioning and category

**Source:** SPEC.md preamble, §8

- Aurel Iris is a SaaS for AI-assisted iridology reading targeted at integrative therapists.
- Positioned explicitly as a *support tool for anamnesis*, never as diagnosis. This is simultaneously a product-design decision and a legal shield.
- Two-layer pipeline is the strategic differentiator: dedicated computer vision extracts objective features; LLM interprets them with reference to an indexed iridology knowledge base (RAG). The vision JSON — not "prompt talent" — is what makes each report genuinely different per client.

---

## Topic: Target user and usage scale

**Source:** SPEC.md §1, §7 Phase 8

- Primary user: integrative therapist (terapeuta integrativo), not the end client/patient. End clients do not have accounts.
- MVP launch scale: closed beta with 10–20 selected therapists.
- Internal validation pass with 5 therapists before public-ish beta.

---

## Topic: Iridology tradition references

**Source:** SPEC.md §6 system prompt

The product references and synthesizes these schools and authors as the canonical iridology corpus:

- Bernard Jensen
- Daniele Lo Rito
- Vida Battello
- Joseph Deck
- Theodor Lindemann
- Brazilian contemporary school

Initial RAG seed corpus mentioned (SPEC §5.2):
- Jensen — *Iridologia Vol. 1* (escola americana, pt)
- Battello — *Iridologia Clínica* (escola italiana, pt)

---

## Topic: Why two-layer (vision + LLM) instead of vision-only or LLM-only

**Source:** SPEC.md §4.3

> "Esse JSON é o coração do produto. É ele que vai pro LLM como evidência objetiva, e é ele que muda toda análise — não o 'talento do prompt'. Cada cliente gera um JSON diferente, e por isso cada relatório fica genuinamente diferente."

The product's defensibility rests on:
1. The objectivity of the vision-extracted features (auditable JSON).
2. The provenance-anchored prompt that requires citation `[ancorado em: features.X]` for every interpretation.
3. The RAG corpus of canonical iridology literature.

---

## Topic: Network-effect / data-moat thesis

**Source:** SPEC.md §4.4, §9

- MVP uses heuristics + pre-trained models. Long-term moat: an anonymized case bank (with consent) that lets the team train custom CNNs for lacuna/crypt detection in v2.
- This is explicitly listed in §9 as "v2, does not block MVP".

---

## Topic: Affirmation style and tone

**Source:** SPEC.md §6 (Section 11)

The 3–5 personalized affirmations in each report must resonate with the central frame:

> *"Tudo na vida acontece em favor do meu crescimento."*

Style attribution: Aurel Maat. Tone of voice across the product: deep but accessible; hypothetical; reverent without being mystically vague; specific (cites sign, sector, school); warm, integrative, embodied.

---

## Topic: Open decisions deferred to v2 (informational)

**Source:** SPEC.md §9

Explicitly out of MVP scope but recorded for forward planning:

- Temporal evolutionary analysis (compare same-client readings over time).
- Multi-map simultaneous view (Jensen + Hidalgo + Jausas comparative).
- White-label for iridology schools.
- Anonymized case bank → proprietary dataset for CNNs.
- "Modo formação" — student case study + quiz mode.
- FHIR / electronic health record integration.
- Public API for therapist site embeds.

These are NOT requirements for the MVP and should not appear in the initial roadmap as in-scope work.

---

## Topic: Cross-references named in SPEC

**Source:** SPEC.md classification `cross_refs`

Files referenced from the SPEC that downstream work will need to materialize:

- `components/capture/IrisDetector.tsx`
- `vision-service/modal_app.py`
- `scripts/ingest-knowledge.ts`
- `lib/rag/search.ts`
- `prompts/system.md`
- `prompts/feature-injection.md`
- `lib/anthropic/analyze.ts`

These are aspirational paths in the SPEC's prescribed folder structure (§2), not yet existing files in the repo. Treat as expected outputs of implementation work.
