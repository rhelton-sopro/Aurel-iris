/**
 * ClinicalNote — small bottom prose, NO Card wrapper. Renders the disclaimer +
 * clinical note at text-sm text-muted-foreground per UI-SPEC §Layout Patterns
 * (lines 408-410).
 *
 * Phase 7.4 | Plan 07.4-06 | Decisões: D-UI1
 */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export interface ClinicalNoteProps {
  note: string
}

export function ClinicalNote({ note }: ClinicalNoteProps) {
  if (!note) return null
  return (
    <div className="text-sm text-muted-foreground">
      <h4 className="mb-2 font-semibold text-foreground">Nota clínica</h4>
      <div className="prose prose-sm prose-neutral max-w-none text-muted-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{note}</ReactMarkdown>
      </div>
    </div>
  )
}
