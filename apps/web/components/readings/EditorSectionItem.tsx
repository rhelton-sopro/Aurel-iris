'use client'

/**
 * EditorSectionItem — single accordion item.
 * Layout: vertical stack inside AccordionContent: Textarea above, preview below.
 * UI-SPEC §Surface 2 lines 237-250.
 */
import { ChangeEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

// Strip the leading `## §N — Title` (or `### N. Title` legacy form) heading
// line + trailing blank lines, so the rendered body doesn't duplicate the
// accordion-trigger title. Handles both Phase 7.4 14-section (`## §N — `) and
// legacy 13-section (`### N. `) shapes via the same regex shape as parser.ts
// BOUNDARY_RE. The `u` flag is mandatory for `\p{Pd}` (Unicode Dash Punctuation).
// Plan 07.4-14 — UAT-2 fix: founder reported `##` markers visible in preview.
const STRIP_LEADING_HEADING_RE = /^[ \t]*#{2,3}[ \t]+§?[ \t]*\d{1,2}[ \t]*[\p{Pd}.][^\n]*\n+/u

export interface EditorSectionItemProps {
  sectionKey: string
  number: number
  title: string
  generatedValue: string
  deliveredValue: string
  onChange: (value: string) => void
  readOnly?: boolean
}

export function EditorSectionItem({
  sectionKey,
  number: _number,
  title: _title,
  generatedValue,
  deliveredValue,
  onChange,
  readOnly,
}: EditorSectionItemProps) {
  const isEdited = deliveredValue !== generatedValue
  const charCount = deliveredValue.length

  return (
    <div className="space-y-3 px-2 pt-3">
      <div className="space-y-2">
        <Label htmlFor={`textarea-${sectionKey}`} className="text-sm">
          Texto da seção
        </Label>
        <Textarea
          id={`textarea-${sectionKey}`}
          value={deliveredValue}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          className="min-h-[200px] font-mono text-sm"
          disabled={readOnly}
        />
        <p className="text-xs text-muted-foreground">
          {charCount} caracteres
          {isEdited && <span className="ml-2">· editado</span>}
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-sm">Pré-visualização</Label>
        <div className="prose prose-sm prose-neutral max-w-none rounded-md border bg-muted/30 p-3">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {deliveredValue.replace(STRIP_LEADING_HEADING_RE, '')}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
