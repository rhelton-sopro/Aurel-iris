// Vitest shim for the `server-only` package.
// In Next.js production builds, importing `server-only` throws when bundled for
// the browser (preventing accidental client-side usage of server modules).
// In vitest (jsdom), we replace it with a no-op so server utilities can be
// unit-tested without triggering the guard.
export {}
