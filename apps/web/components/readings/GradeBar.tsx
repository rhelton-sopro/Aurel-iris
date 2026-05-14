/**
 * GradeBar — 5-segment visual bar showing tendency_grade (D-UI4).
 * Palette amber-200 → red-700 resolved in UI-SPEC §Color Grade visual bar palette.
 * Color is REINFORCEMENT only; sibling GradeBadge carries the numeric grade textually
 * so colorblind users never lose the data (UI-SPEC §Accessibility Floor).
 *
 * Phase 7.4 | Plan 07.4-06 | Decisões: D-UI4
 */
import { cn } from '@/lib/utils'

const GRADE_FILL = {
  1: 'bg-amber-200',
  2: 'bg-amber-400',
  3: 'bg-orange-500',
  4: 'bg-red-500',
  5: 'bg-red-700',
} as const

export interface GradeBarProps {
  grade: 1 | 2 | 3 | 4 | 5
  className?: string
}

export function GradeBar({ grade, className }: GradeBarProps) {
  return (
    <div
      className={cn('flex w-24 gap-0.5', className)}
      role="img"
      aria-label={`Intensidade da tendência: ${grade} de 5`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          aria-hidden
          className={cn(
            'h-2 flex-1 rounded-sm',
            i <= grade ? GRADE_FILL[grade] : 'bg-muted',
          )}
        />
      ))}
    </div>
  )
}
