/**
 * Phase 6 RAG spot-check — fail-closed Route Handler (W4).
 *
 * GET /api/admin/rag-spot-check
 * Header: x-spot-check-token: <value of process.env.RAG_SPOT_CHECK_TOKEN>
 *
 * Returns 403 when RAG_SPOT_CHECK_TOKEN is unset OR the header mismatches.
 * Founder runs locally: RAG_SPOT_CHECK_TOKEN=$(openssl rand -hex 16) pnpm dev
 *
 * Reason for the Route Handler over a standalone tsx script: `lib/rag/search.ts`
 * declares `'use server'`, so importing `retrieveRelevantKnowledge` from a
 * standalone tsx process breaks at compile time. The Route Handler runs inside
 * the Next.js server context where server actions are first-class.
 *
 * Phase: 06-rag-ingestao | Plan: 06-13 | Decisions: D-R1, W4 (token-gated route handler is canonical)
 */
import { NextResponse, type NextRequest } from 'next/server'
import { retrieveRelevantKnowledge } from '@/lib/rag/search'
import type { IrisFeaturesForRag } from '@/lib/rag/build-queries'
import type { ReportSection } from '@/lib/rag/types'

export const runtime = 'nodejs'

interface Scenario {
  name: string
  features: IrisFeaturesForRag
  reportSections: ReportSection[]
  expectation: string
}

const SCENARIOS: Scenario[] = [
  {
    name: 'Success Criterion 5 — lacuna setor 7 (figado)',
    features: {
      constitution: { primary: 'biliar' },
      sectors: [{ hour: 7, findings: [{ type: 'lacuna_aberta' }] }],
      rings: {},
    },
    reportSections: ['constituicao'],
    expectation:
      'Top-5 chunks devem ser reconhecidamente sobre figado / lacunas em iridologia classica.',
  },
  {
    name: 'Anel de tensao + constituicao neurogenica',
    features: {
      constitution: { primary: 'neurogenica' },
      sectors: [],
      rings: { anel_tensao: { present: true } },
    },
    reportSections: ['psicoemocional', 'mensagem_final'],
    expectation:
      'Top-5 deve cobrir anel de tensao + neurogenica + dimensao psicoemocional.',
  },
  {
    name: 'Constituicao linfatica (cobertura cross-language)',
    features: {
      constitution: { primary: 'linfatica', secondary: 'biliar' },
      sectors: [],
      rings: {},
    },
    reportSections: ['constituicao'],
    expectation: 'Top-5 deve incluir fontes pt-BR + en + it (cross-lingual).',
  },
]

export async function GET(request: NextRequest) {
  const expectedToken = process.env.RAG_SPOT_CHECK_TOKEN
  if (!expectedToken) {
    return NextResponse.json(
      { error: 'RAG_SPOT_CHECK_TOKEN env var not set — fail-closed' },
      { status: 403 },
    )
  }
  const headerToken = request.headers.get('x-spot-check-token')
  if (headerToken !== expectedToken) {
    return NextResponse.json(
      { error: 'invalid or missing x-spot-check-token' },
      { status: 403 },
    )
  }

  const results = []
  for (const scenario of SCENARIOS) {
    const t0 = Date.now()
    try {
      const chunks = await retrieveRelevantKnowledge({
        features: scenario.features,
        reportSections: scenario.reportSections,
      })
      const top5 = chunks.slice(0, 5).map((c) => ({
        id: c.id,
        score: c.score,
        source_book: c.source_book,
        page: c.page,
        preview: c.text.replace(/\s+/g, ' ').slice(0, 200),
      }))
      results.push({
        scenario: scenario.name,
        expectation: scenario.expectation,
        elapsed_ms: Date.now() - t0,
        retrieved: chunks.length,
        top5,
      })
    } catch (err) {
      results.push({
        scenario: scenario.name,
        error: (err as Error).message,
      })
    }
  }

  return NextResponse.json({ results })
}
