'use client'

/**
 * EditorAccordion — 14 collapsible editable sections + 15th read-only encerramento.
 * UI-SPEC §Surface 2 lines 226-260.
 *
 * Plan 11 (Direction Correction DC-1) — section keys + titles remapped from
 * 13-section legacy to 14-section Iris Codex V1 structure.
 *
 * Plan 12 (Direction Correction DC-6) — §14 Mensagem para o Cliente gets a
 * subtle warm-tone distinguishing treatment (amber background + 'Voz do
 * terapeuta' caption) to signal it's the warm-voice client-delivered closer
 * vs the clinical-functional voice of §1..§13. Founder iterates visually
 * after UAT (Plan 13). §11 Afirmações optional toggle (DC-5) deferred to a
 * post-UAT plan — it lives OUTSIDE the §1..§14 numbered sequence per the
 * compromise locked in Plan 11.
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
  { key: '1_constituicao_temperamento', number: 1, title: 'Constituição e Temperamento' },
  { key: '2_mapa_organico', number: 2, title: 'Mapa Orgânico' },
  { key: '3_linha_tempo_emocional', number: 3, title: 'Linha do Tempo Emocional' },
  { key: '4_padroes_emocionais_ativos', number: 4, title: 'Padrões Emocionais Ativos' },
  { key: '5_eixo_psicossomatico', number: 5, title: 'Eixo Psicossomático' },
  { key: '6_herancas_transgeracionais', number: 6, title: 'Heranças Transgeracionais' },
  { key: '7_carencias_funcionais', number: 7, title: 'Carências Funcionais' },
  { key: '8_estado_mental_nervoso', number: 8, title: 'Estado Mental e Nervoso' },
  { key: '9_recursos_forcas', number: 9, title: 'Recursos e Forças' },
  { key: '10_dimensao_arquetipica', number: 10, title: 'Dimensão Arquetípica' },
  { key: '11_sugestoes_integrativas', number: 11, title: 'Sugestões Integrativas' },
  { key: '12_roteiro_anamnese', number: 12, title: 'Roteiro de Anamnese' },
  { key: '13_sintese_integrativa', number: 13, title: 'Síntese Integrativa' },
  { key: '14_mensagem_cliente', number: 14, title: 'Mensagem para o Cliente' },
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
      defaultValue={['1_constituicao_temperamento', '2_mapa_organico', '3_linha_tempo_emocional']}
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
