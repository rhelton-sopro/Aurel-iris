/**
 * KeyTraitChipGroup — renders constitutional_pattern.key_traits[] as chip Badges.
 * Returns null when traits is empty/undefined.
 *
 * Phase 7.4 | Plan 07.4-06 | Decisões: D-UI1
 */
import { Badge } from '@/components/ui/badge'
import { safeArray } from '@/lib/utils'

export interface KeyTraitChipGroupProps {
  traits: string[]
}

export function KeyTraitChipGroup({ traits }: KeyTraitChipGroupProps) {
  const safeTraits = safeArray<string>(traits)
  if (safeTraits.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2" aria-label="Características-chave">
      {safeTraits.map((trait, idx) => (
        <Badge key={`${trait}-${idx}`} variant="secondary">
          {trait}
        </Badge>
      ))}
    </div>
  )
}
