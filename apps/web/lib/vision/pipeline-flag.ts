/**
 * Modal vision-pipeline kill-switch (Phase 7.4 Sonnet-direct flip).
 *
 * The Modal vision-service (Hough/SAM segmentation + feature extraction) is
 * RETIRED — the single pipeline is now Sonnet-direct (Column C). This flag
 * keeps the retirement **reversible by construction**: the Modal trigger
 * code is archived, not deleted, and re-enables with one env var + redeploy
 * (mirrors the `CANONICAL_CAPTURE_ENABLED` pattern).
 *
 * Default OFF (Modal does NOT run). Set `MODAL_PIPELINE_ENABLED=true` to
 * restore the old vision-features path.
 *
 * Phase 7.4 | Sonnet-direct pipeline
 */
export function isModalPipelineEnabled(): boolean {
  return process.env.MODAL_PIPELINE_ENABLED === 'true'
}
