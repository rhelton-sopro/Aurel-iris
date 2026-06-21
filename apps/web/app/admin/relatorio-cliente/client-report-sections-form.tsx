'use client'

/**
 * Checkboxes pra ligar/desligar as seções da "Versão do cliente".
 *
 * A lista é apresentada na ORDEM e NUMERAÇÃO que o leitor vê no relatório
 * entregue (DISPLAY_SECTION_ORDER renumerado 1..15) — é assim que o founder
 * pensa as seções (ex.: Roteiro de Anamnese = 9). O §0 "Em poucas palavras" é a
 * abertura (sem número). O valor salvo são os heading-numbers INTERNOS.
 */
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DISPLAY_SECTION_ORDER, SECTION_TITLE_BY_NUMBER } from '@/lib/anthropic/types'
import { saveClientReportSections } from '@/app/actions/client-report'

interface Row {
  heading: string
  display: string
  title: string
}

const ROWS: Row[] = [
  { heading: '0', display: '—', title: 'Em poucas palavras (abertura)' },
  ...DISPLAY_SECTION_ORDER.map((h, i) => ({
    heading: h,
    display: String(i + 1),
    title: SECTION_TITLE_BY_NUMBER[h],
  })),
]

export function ClientReportSectionsForm({
  initialSelected,
}: {
  initialSelected: string[]
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected))
  const [pending, startTransition] = useTransition()

  const initialKey = useMemo(() => [...initialSelected].sort().join(','), [initialSelected])
  const currentKey = useMemo(() => [...selected].sort().join(','), [selected])
  const dirty = initialKey !== currentKey

  function toggle(heading: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(heading)) next.delete(heading)
      else next.add(heading)
      return next
    })
  }

  function onSave() {
    const headings = ROWS.map((r) => r.heading).filter((h) => selected.has(h))
    if (headings.length === 0) {
      toast.error('Selecione pelo menos uma seção.')
      return
    }
    startTransition(async () => {
      const res = await saveClientReportSections(headings)
      if (res.ok) toast.success('Seleção salva. Vale para os próximos PDFs gerados.')
      else toast.error(res.error ?? 'Falha ao salvar.')
    })
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-md border bg-card">
        {ROWS.map((r) => {
          const checked = selected.has(r.heading)
          return (
            <li key={r.heading}>
              <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(r.heading)}
                  className="h-4 w-4 accent-teal-dark"
                  data-testid={`client-section-${r.heading}`}
                />
                <span className="w-8 shrink-0 text-sm tabular-nums text-teal-dark">
                  {r.display}
                </span>
                <span className="text-sm text-foreground">{r.title}</span>
              </label>
            </li>
          )
        })}
      </ul>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={onSave} disabled={pending || !dirty} className="gap-2">
          {pending ? 'Salvando…' : 'Salvar seleção'}
        </Button>
        {dirty && !pending && (
          <span className="text-xs text-muted-foreground">Alterações não salvas.</span>
        )}
      </div>
    </div>
  )
}
