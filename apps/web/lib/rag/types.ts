/**
 * Shared types for RAG retrieval — Phase 6 (D-R6, D-P2).
 *
 * KnowledgeChunkMetadata MUST mirror the metadata jsonb shape produced by
 * `vision-service/scripts/lib/manifest.py` BookEntry + chunker output.
 * Cross-reference: see `vision-service/scripts/lib/manifest.py` Pydantic model.
 * RESEARCH Pitfall 9 — single source of truth in two places (Python persister
 * payload ↔ TypeScript retrieval consumer).
 *
 * LGPD: this file declares structure only. No vocabulário proibido —
 * audited by `pnpm audit:vocabulary` (DIRS extension to `lib/rag/` lands in 06-12).
 */
import type { Database } from '@/types/database'

export type ReportSection =
  | 'constituicao'
  | 'psicoemocional'
  | 'transgeracional'
  | 'simbolico'
  | 'mensagem_final'
  | 'mental_cognitivo'
  | 'nutricao_carencias'

export interface KnowledgeChunkMetadata {
  autor: string
  escola:
    | 'Jensen'
    | 'Rayid'
    | 'Italiana'
    | 'Alemã'
    | 'Brasileira'
    | 'Espanhola'
    | 'Andrews-britânica'
    | null
  idioma: 'pt' | 'en' | 'it' | 'es' | 'de'
  ano: number | null
  constituicao_referenciada: string[]
  setores_referenciados: string[]
  sinais_referenciados: string[]
  dimensoes: string[]
  tags_livres: string[]
  /** D-N1 forward-compat: situating sentence prepended at embedding time. */
  contextual_sentence?: string
}

export interface KnowledgeChunkRow {
  id: string
  /** = `content` column in DB (post-D-N1 includes contextual sentence prefix). */
  text: string
  source_book: string
  /** = `source_chapter` column. */
  chapter: string | null
  /** Section is stored inside `metadata` jsonb (no dedicated column in 0005). */
  section: string | null
  /** = `source_page` column. */
  page: number | null
  metadata: KnowledgeChunkMetadata
  source_type: 'biblioteca' | 'clinical_data'
  /** 1 - cosine_distance, post-weighting (D-R4). */
  score: number
}

export type SearchResult = KnowledgeChunkRow

export class RagError extends Error {
  public readonly cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'RagError'
    this.cause = cause
  }
}

/** Re-export keeps the Database type alive in this module — cross-reference for
 *  `knowledge_chunks` Row shape (apps/web/types/database.ts) and ingestion shape
 *  parity defended in RESEARCH Pitfall 9. */
export type _DatabaseImported = Database
