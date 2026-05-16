/**
 * Isolated vitest config for the manual Column C runner
 * (scripts/run-sonnet-direct.spec.ts).
 *
 * Why a separate config: the runner reuses the EXACT production orchestrator
 * (server-only modules + `@/` alias + the real parser/audit) but must run in
 * the `node` environment (the Anthropic SDK refuses a browser-like env) and
 * WITHOUT the shared jsdom setup file (tests/setup.ts touches `window`).
 * This keeps the main vitest.config.ts / test suite untouched.
 *
 *   cd apps/web
 *   RUN_SONNET_DIRECT_READING=<id> [RUN_SONNET_DIRECT_PERSIST=1] \
 *     npx vitest run --config scripts/runner.vitest.config.ts \
 *     scripts/run-sonnet-direct.spec.ts
 *
 * Phase 7.4 | Column C | calibration harness
 */
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  // Mirror the main config: disable PostCSS (Tailwind v4 plugin is
  // incompatible with vite 5's CJS plugin loading; the runner needs no CSS).
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'node',
    globals: true,
    include: ['scripts/run-sonnet-direct.spec.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '..'),
      'server-only': path.resolve(__dirname, '..', 'tests/__mocks__/server-only.ts'),
    },
  },
})
