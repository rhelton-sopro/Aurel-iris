/**
 * Config isolado do smoke do PDF do termo de consentimento
 * (scripts/smoke-consent-pdf.spec.ts).
 *
 * Espelha scripts/runner.vitest.config.ts: reusa os módulos de PRODUÇÃO
 * (operator.ts / hydrate-term.ts / pdf-template.tsx — todos `server-only`) via
 * o alias do shim, em ambiente `node` (fetch real pro Supabase + Gotenberg),
 * sem o setup jsdom compartilhado. Mantém vitest.config.ts / suíte intactos.
 *
 *   cd apps/web
 *   npx vitest run --config scripts/smoke-consent-pdf.config.ts
 *
 * Fase 8 | go-live | smoke do termo LGPD
 */
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'node',
    globals: true,
    include: ['scripts/smoke-consent-pdf.spec.ts'],
    // Sem timeout curto: o POST pro Gotenberg (Render) pode demorar no cold start.
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '..'),
      'server-only': path.resolve(__dirname, '..', 'tests/__mocks__/server-only.ts'),
    },
  },
})
