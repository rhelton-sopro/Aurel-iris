'use client'

/**
 * EditorAccordion — 15 collapsible editable sections + read-only encerramento.
 * UI-SPEC §Surface 2 lines 226-260.
 *
 * Plan 12 (Direction Correction DC-6) — §14 Mensagem para o Cliente gets a
 * subtle warm-tone distinguishing treatment.
 * Plan 27 (UAT-iter-3) — §2.5 collapsed into §2; 15 strictly sequential
 * sections, Síntese Rápida = §15. SECTIONS is now DERIVED from the canonical
 * constants in types.ts (kills the prior triplicate-array drift).
 *
 * Note: accordion.tsx wraps @base-ui/react/accordion, which uses `multiple` prop
 * (not Radix `type="multiple"`), and `defaultValue` accepts an array of item values.
 */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import {
  NUMBERED_SECTION_HEADINGS,
  SECTION_KEY_BY_NUMBER,
  SECTION_TITLE_BY_NUMBER,
} from '@/lib/anthropic/types'

import { EditorSectionItem } from './EditorSectionItem'

export const SECTIONS: ReadonlyArray<{ key: string; number: string; title: string }> =
  NUMBERED_SECTION_HEADINGS.map((number) => ({
    key: SECTION_KEY_BY_NUMBER[number],
    number,
    title: SECTION_TITLE_BY_NUMBER[number],
  }))

export interface EditorAccordionProps {
  reportGenerated: Record<string, string>
  reportDelivered: Record<string, string>
  onSectionChange: (key: string, value: string) => void
  readOnly?: boolean
}

export function EditorAccordion({
  reportGenerated,
  reportDelivered,
  onSectionChange,
  readOnly,
}: EditorAccordionProps) {
  return (
    <Accordion
      multiple
      defaultValue={[]}
      className="w-full"
    >
      {SECTIONS.map((s) => {
        const generated = reportGenerated[s.key] ?? ''
        const delivered = reportDelivered[s.key] ?? generated
        const isEdited = delivered !== generated
        // DC-6 — §14 Mensagem para o Cliente is the warm-voice client-delivered
        // closer. Subtle amber tint + 'Voz do terapeuta' caption signal the
        // tonal shift from clinical-functional (§1..§13) to first-person
        // brand-warm. Founder will iterate visually after UAT (Plan 13).
        const isClientMessage = s.key === '14_mensagem_cliente'
        return (
          <AccordionItem
            key={s.key}
            value={s.key}
            data-section-tone={isClientMessage ? 'warm' : 'clinical'}
            className={isClientMessage ? 'bg-amber-50/30' : undefined}
          >
            <AccordionTrigger className="text-xl font-semibold">
              <span className="flex flex-col items-start gap-0.5">
                {isClientMessage && (
                  <span className="text-xs font-normal text-muted-foreground">
                    Voz do terapeuta · Para entrega ao cliente
                  </span>
                )}
                <span className="flex items-center gap-2">
                  {s.number}. {s.title}
                  {isEdited && (
                    <span className="text-sm font-normal text-muted-foreground">· editado</span>
                  )}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <EditorSectionItem
                sectionKey={s.key}
                number={s.number}
                title={s.title}
                generatedValue={generated}
                deliveredValue={delivered}
                onChange={(value) => onSectionChange(s.key, value)}
                readOnly={readOnly}
              />
            </AccordionContent>
          </AccordionItem>
        )
      })}
      <AccordionItem value="encerramento_disclaimer">
        <AccordionTrigger className="text-xl font-semibold">
          Encerramento (texto literal — não editável)
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2 px-2 pt-3">
            <p className="text-xs text-muted-foreground">
              Este encerramento é fixo por exigência de posicionamento legal. Ele aparece
              sempre, em todo relatório.
            </p>
            <div className="prose prose-sm prose-neutral max-w-none rounded-md border bg-muted/30 p-3">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {reportDelivered['encerramento_disclaimer'] ??
                  reportGenerated['encerramento_disclaimer'] ??
                  ''}
              </ReactMarkdown>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
