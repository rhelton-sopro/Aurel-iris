/**
 * PriorityFocusList — numbered 1/2/3 list of priority_focus[].
 * Sub-cap "Próximos 3 passos sugeridos" per UI-SPEC §Surface 1b line 225.
 * Uses safeArray() before iterating per MEMORY rule (jsonb fields may drift).
 *
 * Phase 7.4 | Plan 07.4-06 | Decisões: D-UI1
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { safeArray } from '@/lib/utils'

export interface PriorityFocusListProps {
  items: string[]
}

export function PriorityFocusList({ items }: PriorityFocusListProps) {
  const safeItems = safeArray<string>(items)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Foco prioritário</CardTitle>
        <p className="text-sm text-muted-foreground">Próximos 3 passos sugeridos</p>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {safeItems.map((item, idx) => (
            <li key={`${idx}-${item.slice(0, 20)}`} className="flex gap-3">
              <span className="text-base font-semibold text-muted-foreground">
                {idx + 1}.
              </span>
              <span className="text-base">{item}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
