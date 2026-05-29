/**
 * Config isolado do one-shot de re-canonicalização (scripts/recanonicalize-one.spec.ts).
 * Reusa lib/canonicalize (server-only + sharp + Anthropic) via alias do shim,
 * ambiente node. Roda só via este config, nunca na suíte normal.
 *
 *   cd apps/web
 *   RECANON_READING_ID=<uuid> RECANON_THERAPIST_ID=<uuid> \
 *     npx vitest run --config scripts/recanonicalize-one.config.ts
 *
 * Fase 7.4 fix | prova do canonicalize no fluxo de convite
 */
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'node',
    globals: true,
    include: ['scripts/recanonicalize-one.spec.ts'],
    testTimeout: 180_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '..'),
      'server-only': path.resolve(__dirname, '..', 'tests/__mocks__/server-only.ts'),
    },
  },
})
