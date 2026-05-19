'use client'

/**
 * AdvancedAnalysisCTA — placeholder CTA + "Em breve V1.1" modal (D-ADD2).
 *
 * V1: display-only, no `reading_addons` row created (D-ADD1 — table stays empty).
 * V1.1 will wire the actual 2nd Sonnet call + credit charge + persist into
 * `reading_addons`.
 *
 * Locked copy per UI-SPEC §Surface 1c lines 231-246 — verbatim. Do not paraphrase.
 *
 * Phase 7.4 | Plan 07.4-07 | Decisões: D-ADD1, D-ADD2, D-ADD3
 */
import { useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function AdvancedAnalysisCTA() {
  const [open, setOpen] = useState(false)
  const okRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          {/* base-ui Tooltip.Trigger uses `render` prop (not Radix asChild). */}
          <TooltipTrigger render={<span />}>
            <Button
              variant="outline"
              onClick={() => setOpen(true)}
              className="w-full sm:w-auto"
              data-testid="advanced-analysis-cta"
            >
              <Sparkles className="size-4" aria-hidden />
              Análise Iridológica Aprofundada — 1 crédito
            </Button>
          </TooltipTrigger>
          <TooltipContent>Em breve na V1.1</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent initialFocus={okRef}>
          <DialogHeader>
            <DialogTitle className="text-xl">
              Análise Iridológica Aprofundada
            </DialogTitle>
            <DialogDescription className="sr-only">
              Informações sobre a análise iridológica aprofundada — em breve na V1.1.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 text-sm">
            <p className="font-semibold">Em breve (V1.1).</p>
            <p>
              Esta análise técnica usa nomenclatura iridológica formal (Jensen, Lo Rito,
              Deck/Angerer, Lindemann) com correlação multi-escola, dados estruturados de
              sinais por zona, e confiabilidade por observação.
            </p>
            <p>Custo previsto: 1 crédito por leitura.</p>
            <p>
              Persistência: análise salva por cliente. Você acessa quantas vezes quiser
              depois, sem cobrar de novo.
            </p>
          </div>
          <DialogFooter>
            <Button
              ref={okRef}
              variant="default"
              onClick={() => setOpen(false)}
              data-testid="advanced-analysis-cta-ok"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
