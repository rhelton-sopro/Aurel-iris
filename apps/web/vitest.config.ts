import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  css: {
    // Disable PostCSS processing in tests — @tailwindcss/postcss v4 is incompatible
    // with vite 5.x plugin loading (requires string-form plugins); tests don't need CSS.
    postcss: {
      plugins: [],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/.next/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // server-only throws in non-Next.js environments (jsdom / vitest).
      // Map to a no-op shim so server-side modules can be unit-tested.
      'server-only': path.resolve(__dirname, 'tests/__mocks__/server-only.ts'),
    },
  },
})
