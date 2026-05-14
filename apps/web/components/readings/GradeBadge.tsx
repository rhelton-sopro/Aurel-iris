/**
 * GradeBadge — text-level "Grade {n}/5 · {label}" badge. Text is the PRIMARY
 * channel for grade information (D-UI4 accessibility — color is reinforcement).
 *
 * Phase 7.4 | Plan 07.4-06 | Decisões: D-UI4
 */
import { Badge } from '@/components/ui/badge'
import type { TendencyLabel } from '@/lib/anthropic/report-schema-shared'

export interface GradeBadgeProps {
  grade: 1 | 2 | 3 | 4 | 5
  label: TendencyLabel
}

export function GradeBadge({ grade, label }: GradeBadgeProps) {
  return (
    <Badge variant="outline" className="font-medium">
      Grade {grade}/5 · {label}
    </Badge>
  )
}
