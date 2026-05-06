#!/usr/bin/env node
/**
 * pnpm rag:spot-check — cross-platform RAG retrieval spot-check (Phase 6, plan 06-13).
 *
 * Original 06-13 PLAN wired the script to a curl one-liner with bash-style
 * ${RAG_SPOT_CHECK_TOKEN} expansion. That syntax doesn't expand under PowerShell
 * or Windows cmd when pnpm forks a shell for the script — token arrives as the
 * literal string "${RAG_SPOT_CHECK_TOKEN}" and the Route Handler returns 403.
 *
 * This Node script reads the env var via process.env (works everywhere Node runs)
 * and uses the built-in fetch (Node 18+). No deps; no shell quoting; one file.
 *
 * Usage:
 *   $env:RAG_SPOT_CHECK_TOKEN = (New-Guid).ToString()    # PowerShell
 *   pnpm dev                                              # Terminal A
 *   pnpm rag:spot-check                                   # Terminal B
 *
 * Exits non-zero on any of: token unset, fetch failure, non-2xx response,
 * malformed JSON. Writes JSON to stdout on success.
 */

const TOKEN = process.env.RAG_SPOT_CHECK_TOKEN;
if (!TOKEN) {
  console.error(
    'rag-spot-check: RAG_SPOT_CHECK_TOKEN env var not set. ' +
    'Set it in BOTH the terminal running pnpm dev AND the terminal running this script. ' +
    'Example (PowerShell):  $env:RAG_SPOT_CHECK_TOKEN = (New-Guid).ToString()'
  );
  process.exit(1);
}

const URL = process.env.RAG_SPOT_CHECK_URL || 'http://localhost:3000/api/admin/rag-spot-check';

try {
  const response = await fetch(URL, {
    headers: { 'x-spot-check-token': TOKEN },
  });
  const text = await response.text();

  if (!response.ok) {
    console.error(`rag-spot-check: HTTP ${response.status} ${response.statusText}`);
    console.error(text);
    process.exit(2);
  }

  // Pretty-print JSON. Fall back to raw text if response wasn't JSON.
  try {
    const json = JSON.parse(text);
    console.log(JSON.stringify(json, null, 2));
  } catch {
    console.log(text);
  }
} catch (err) {
  console.error(`rag-spot-check: fetch failed — ${err.message}`);
  console.error('Is the dev server running? Try `pnpm dev` in another terminal first.');
  process.exit(3);
}
