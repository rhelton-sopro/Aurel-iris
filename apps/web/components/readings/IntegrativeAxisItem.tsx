/**
 * IntegrativeAxisItem — axis_name + status badge + markdown description.
 * Renders inside the Eixos integrativos Card; siblings separated by <Separator>.
 *
 * Status → Badge variant mapping (UI-SPEC §Status badge palette lines 162-171):
 *   ativo    → default  (accent fill, draws attention — axis expressing)
 *   latente  → outline  (border only, present but quiescent)
 *   inativo  → secondary (muted fill, de-emphasized)
 *
 * Phase 7.4 | Plan 07.4-06 | Decisões: D-UI1
 */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Badge } from '@/components/ui/badge'
import type { AxisStatus } from '@/lib/anthropic/report-schema'

const STATUS_LABEL: Record<AxisStatus, string> = {
  ativo: 'Ativo',
  latente: 'Latente',
  inativo: 'Inativo',
}

const STATUS_VARIANT: Record<AxisStatus, 'default' | 'outline' | 'secondary'> = {
  ativo: 'default',
  latente: 'outline',
  inativo: 'secondary',
}

export interface IntegrativeAxisItemProps {
  axisName: string
  status: AxisStatus
  description: string
}

export function IntegrativeAxisItem({
  axisName,
  status,
  description,
}: IntegrativeAxisItemProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-base font-semibold">{axisName}</h4>
        <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
      </div>
      <div className="prose prose-sm prose-neutral max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
      </div>
    </div>
  )
}
