'use client'

/**
 * ExportPdfButton — top-action button that opens the print page.
 *
 * Plan 7.4-19 (UAT-3 PDF export via Print CSS — founder picked this over
 * @react-pdf/renderer to avoid a new dep). Clicking navigates to
 * /leituras/[id]/print which auto-triggers window.print().
 *
 * Available regardless of isDelivered state — therapist can re-export a
 * delivered reading at any time. Hidden Editar/Regenerar/Entregar buttons
 * (when isDelivered=true) reflect that those modify state; PDF export does
 * not.
 */
import Link from 'next/link'
import { Download } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ExportPdfButtonProps {
  readingId: string
}

export function ExportPdfButton({ readingId }: ExportPdfButtonProps) {
  return (
    <Link
      href={`/leituras/${readingId}/print`}
      className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
      data-testid="reading-mode-export-pdf"
    >
      <Download className="h-4 w-4" aria-hidden />
      Exportar PDF
    </Link>
  )
}
