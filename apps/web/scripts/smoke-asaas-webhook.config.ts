/**
 * Config isolado do smoke de auth do webhook Asaas
 * (scripts/smoke-asaas-webhook.spec.ts).
 *
 * Faz fetch real contra uma URL de deploy (preview/prod). Roda só via este
 * config, nunca na suíte normal (excluído em vitest.config.ts). Ambiente node;
 * não importa módulos server-only (é HTTP puro), então não precisa do alias.
 *
 *   cd apps/web
 *   npx vitest run --config scripts/smoke-asaas-webhook.config.ts
 *
 * Fase 8 | go-live passo 5 | smoke do webhook Asaas
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'node',
    globals: true,
    include: ['scripts/smoke-asaas-webhook.spec.ts'],
    testTimeout: 30_000, // cold start do deploy
  },
})
