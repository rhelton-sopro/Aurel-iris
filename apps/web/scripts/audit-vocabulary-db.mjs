#!/usr/bin/env node
// scripts/audit-vocabulary-db.mjs
// LGPD audit for the metadata.tags_livres field of knowledge_chunks.
//
// RESEARCH Pitfall 6: chunk content may quote forbidden words verbatim from books
// (allowed — citação direta do material original); but tags WE write must NEVER
// include them. Therefore this audit scans ONLY metadata.tags_livres, NOT content.
// At MVP scale (~thousands of rows) we paginate the entire knowledge_chunks table
// and apply the narrow check client-side; PostgREST does not support `jsonb::text
// ILIKE` in its filter qualifier, and the per-row tags_livres array is already
// the only field we want to inspect (so a server-side pre-filter would be moot).
//
// W6 word-boundary parity: hits are narrowed via \b<term>\b regex (case-insensitive)
// to mirror the file-scan audits in audit_vocabulary.py and audit-vocabulary.mjs.
// Substring matching would diverge — `naturocultura` would fire here but NOT in the
// file-scan audits, producing false-positive noise.
//
// Phase: 06-rag-ingestao | Plan: 06-12 | Decisions: D-T6, RESEARCH Pitfall 6, W6

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) {
  console.error('SUPABASE_URL is not set')
  process.exit(2)
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is not set')
  process.exit(2)
}
// RESEARCH Pitfall 14 — defensive shape check (anon keys also start with eyJ but
// other malformed values won't); does NOT bypass auth, just catches misconfig early.
if (!SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ')) {
  console.error('SUPABASE_SERVICE_ROLE_KEY appears malformed (no eyJ prefix)')
  process.exit(2)
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Same forbidden vocabulary as audit_vocabulary.py and audit-vocabulary.mjs.
const FORBIDDEN_TERMS = ['diagnóstico', 'tratamento', 'cura']

// W6 word-boundary regex builder. Mirrors the \b...\b semantics used by the
// Python (re.IGNORECASE | re.UNICODE) and JS (/.../i) file-scan audits — keeps
// the three audits consistent so a hit in the DB matches a hit in source files.
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function termHitsTags(term, tags) {
  const re = new RegExp('\\b' + escapeRegex(term) + '\\b', 'i')
  return Array.isArray(tags) && tags.some((t) => re.test(String(t)))
}

// Page size for pagination through knowledge_chunks. PostgREST defaults cap at
// 1000 rows per request; we paginate via .range() so the audit scales beyond that.
const PAGE_SIZE = 1000

async function main() {
  const hits = []
  // Pitfall 6: scope the flag strictly to metadata.tags_livres. We do NOT scan
  // the chunk content (verbatim book quotes may legitimately contain forbidden
  // words — citação direta do material original). At MVP scale (~2761 rows)
  // a full scan with client-side narrowing is sub-second and avoids PostgREST's
  // limited support for `jsonb::text ILIKE` in the filter qualifier.
  let from = 0
  let scanned = 0
  while (true) {
    const { data, error } = await client
      .from('knowledge_chunks')
      .select('id, source_book, metadata')
      .range(from, from + PAGE_SIZE - 1)
    if (error) {
      console.error('Query failed:', error.message)
      process.exit(2)
    }
    if (!data || data.length === 0) break
    scanned += data.length
    for (const row of data) {
      const tagsLivres = row.metadata?.tags_livres || []
      if (!Array.isArray(tagsLivres) || tagsLivres.length === 0) continue
      for (const term of FORBIDDEN_TERMS) {
        // W6 word-boundary regex narrowing — mirrors file-scan audits.
        if (termHitsTags(term, tagsLivres)) {
          hits.push({
            id: row.id,
            source_book: row.source_book,
            term,
            tags_livres: tagsLivres,
          })
        }
      }
    }
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  if (hits.length === 0) {
    console.log(
      `OK: zero hits across ${FORBIDDEN_TERMS.join(', ')} in metadata.tags_livres ` +
        `(${scanned} chunk${scanned === 1 ? '' : 's'} scanned)`,
    )
    process.exit(0)
  }
  console.error(`VOCAB FAIL — ${hits.length} chunk(s) have forbidden vocab in tags_livres:`)
  for (const h of hits) {
    console.error(
      `  id=${h.id} | source_book="${h.source_book}" | term="${h.term}" | tags_livres=${JSON.stringify(h.tags_livres)}`,
    )
  }
  process.exit(1)
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(2)
})
