'use client'

/**
 * EditorAccordion — 13 collapsible editable sections + 14th read-only encerramento.
 * UI-SPEC §Surface 2 lines 226-260.
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

import { EditorSectionItem } from './EditorSectionItem'

export const SECTIONS: ReadonlyArray<{ key: string; number: number; title: string }> = [
  { key: '1_constituicao', number: 1, title: 'Constituição' },
  { key: '2_estrutural_fisica', number: 2, title: 'Estrutural Física' },
  { key: '3_indicacoes_sistemicas', number: 3, title: 'Indicações Sistêmicas' },
  { key: '4_toxemia', number: 4, title: 'Toxemia' },
  { key: '5_psicoemocional', number: 5, title: 'Psicoemocional' },
  { key: '6_cargas_temporais', number: 6, title: 'Cargas Temporais' },
  { key: '7_carencias_nutricionais', number: 7, title: 'Carências Nutricionais' },
  { key: '8_simbolico_espiritual', number: 8, title: 'Simbólico Espiritual' },
  { key: '9_cuidados_integrativos', number: 9, title: 'Cuidados Integrativos' },
  { key: '10_potenciais_forcas', number: 10, title: 'Potenciais e Forças' },
  { key: '11_afirmacoes_integracao', number: 11, title: 'Afirmações de Integração' },
  { key: '12_sintese_integrativa', number: 12, title: 'Síntese Integrativa' },
  { key: '13_mensagem_final', number: 13, title: 'Mensagem Final' },
]

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
      defaultValue={['1_constituicao', '2_estrutural_fisica', '3_indicacoes_sistemicas']}
      className="w-full"
    >
      {SECTIONS.map((s) => {
        const generated = reportGenerated[s.key] ?? ''
        const delivered = reportDelivered[s.key] ?? generated
        const isEdited = delivered !== generated
        return (
          <AccordionItem key={s.key} value={s.key}>
            <AccordionTrigger className="text-xl font-semibold">
              <span className="flex items-center gap-2">
                {s.number}. {s.title}
                {isEdited && (
                  <span className="text-sm font-normal text-muted-foreground">· editado</span>
                )}
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
