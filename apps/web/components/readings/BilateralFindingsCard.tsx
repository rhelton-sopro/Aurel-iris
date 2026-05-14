/**
 * BilateralFindingsCard — conditional render. Returns null when asymmetry_present=false.
 * UI-SPEC §Surface 1b: omit card entirely from read view when no asymmetry
 * (line 223; card title appears only when asymmetry_present === true).
 *
 * Phase 7.4 | Plan 07.4-06 | Decisões: D-UI1
 */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface BilateralFindingsCardProps {
  asymmetryPresent: boolean
  description: string | null
}

export function BilateralFindingsCard({
  asymmetryPresent,
  description,
}: BilateralFindingsCardProps) {
  if (!asymmetryPresent || !description) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Achados bilaterais</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm prose-neutral max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  )
}
