'use client'

import { useActionState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { saveAnnotation, markReviewed } from '@/app/actions/calibration'
import {
  CONSTITUTION_OPTIONS,
  IRIS_COLOR_OPTIONS,
  type AnnotationFormState,
  type ConstitutionOption,
  type IrisColorOption,
} from '@/lib/calibration/constants'
import { useEffect, useState } from 'react'

const IRIS_COLOR_LABEL: Record<IrisColorOption, string> = {
  azul: 'Azul',
  verde: 'Verde',
  castanho: 'Castanho',
  mista_biliar: 'Mista (biliar)',
  mista_hematogenea: 'Mista (hematogênica)',
  outra: 'Outra',
}

const CONSTITUTION_LABEL: Record<ConstitutionOption, string> = {
  linfatica: 'Linfática',
  biliar: 'Biliar',
  hematogenea: 'Hematogênica',
  mista_biliar: 'Mista biliar',
  mista_hematogenea: 'Mista hematogênica',
  neurogenica: 'Neurogênica',
}

export interface ExistingAnnotation {
  reading_id: string
  real_iris_color: string
  real_constitution: string
  findings_correct: string | null
  findings_invented: string | null
  findings_missed: string | null
  notes: string | null
  reviewed: boolean
}

interface AnnotationFormProps {
  readingId: string
  existingAnnotation: ExistingAnnotation | null
}

const initialState: AnnotationFormState = {}

export function AnnotationForm({ readingId, existingAnnotation }: AnnotationFormProps) {
  const [state, formAction, isPending] = useActionState(saveAnnotation, initialState)
  const [isReviewing, startReviewTransition] = useTransition()
  const [reviewed, setReviewed] = useState(existingAnnotation?.reviewed ?? false)

  // Controlled select values — needed because base-ui Select with hidden input
  // requires explicit name+value to populate FormData.
  const [irisColor, setIrisColor] = useState<string>(
    existingAnnotation?.real_iris_color ?? '',
  )
  const [constitution, setConstitution] = useState<string>(
    existingAnnotation?.real_constitution ?? '',
  )

  useEffect(() => {
    if (state.ok) {
      toast.success('Anotação salva')
      setReviewed(false) // saving flips back to non-reviewed
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state])

  function handleMarkReviewed() {
    startReviewTransition(async () => {
      const result = await markReviewed(readingId)
      if (result.ok) {
        toast.success('Anotação marcada como revisada')
        setReviewed(true)
      } else {
        toast.error(result.error ?? 'Falha ao marcar revisada')
      }
    })
  }

  const fieldErrors = state.fieldErrors ?? {}

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="reading_id" value={readingId} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="real_iris_color">Cor real da íris</Label>
            <Select
              name="real_iris_color"
              value={irisColor || null}
              onValueChange={value => setIrisColor(value ?? '')}
            >
              <SelectTrigger id="real_iris_color">
                <SelectValue placeholder="Selecione a cor observada" />
              </SelectTrigger>
              <SelectContent>
                {IRIS_COLOR_OPTIONS.map(opt => (
                  <SelectItem key={opt} value={opt}>
                    {IRIS_COLOR_LABEL[opt]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.real_iris_color && (
              <p className="text-sm text-destructive">
                {fieldErrors.real_iris_color.join(', ')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="real_constitution">Constituição real</Label>
            <Select
              name="real_constitution"
              value={constitution || null}
              onValueChange={value => setConstitution(value ?? '')}
            >
              <SelectTrigger id="real_constitution">
                <SelectValue placeholder="Selecione a constituição observada" />
              </SelectTrigger>
              <SelectContent>
                {CONSTITUTION_OPTIONS.map(opt => (
                  <SelectItem key={opt} value={opt}>
                    {CONSTITUTION_LABEL[opt]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.real_constitution && (
              <p className="text-sm text-destructive">
                {fieldErrors.real_constitution.join(', ')}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="findings_correct">Achados corretos do pipeline</Label>
          <p className="text-xs text-muted-foreground">
            Achados que o pipeline reportou e você confirma observar (separados por linha ou vírgula).
          </p>
          <Textarea
            id="findings_correct"
            name="findings_correct"
            defaultValue={existingAnnotation?.findings_correct ?? ''}
            rows={3}
            placeholder="ex: lacuna setor 7, anel nervoso OD"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="findings_invented">Achados inventados (falsos positivos)</Label>
          <p className="text-xs text-muted-foreground">
            Achados que o pipeline reportou mas NÃO existem.
          </p>
          <Textarea
            id="findings_invented"
            name="findings_invented"
            defaultValue={existingAnnotation?.findings_invented ?? ''}
            rows={3}
            placeholder="ex: cripta setor 3 inexistente"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="findings_missed">Achados faltantes (falsos negativos)</Label>
          <p className="text-xs text-muted-foreground">
            Achados que você observa mas o pipeline NÃO reportou.
          </p>
          <Textarea
            id="findings_missed"
            name="findings_missed"
            defaultValue={existingAnnotation?.findings_missed ?? ''}
            rows={3}
            placeholder="ex: rosário linfático OE não detectado"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notas</Label>
          <Textarea
            id="notes"
            name="notes"
            defaultValue={existingAnnotation?.notes ?? ''}
            rows={3}
            placeholder="Contexto, dúvidas, observações livres..."
          />
        </div>

        {state.error && !Object.keys(fieldErrors).length && (
          <div className="bg-destructive/10 border border-destructive text-sm px-4 py-2 rounded text-destructive">
            {state.error}
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" disabled={isPending} aria-busy={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : existingAnnotation ? (
              'Atualizar anotação'
            ) : (
              'Salvar anotação'
            )}
          </Button>
        </div>
      </form>

      {existingAnnotation && (
        <div className="border-t pt-4 flex items-center gap-3">
          {reviewed ? (
            <span className="text-sm text-emerald-700">
              ✓ Anotação revisada
            </span>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMarkReviewed}
              disabled={isReviewing}
              aria-busy={isReviewing}
            >
              {isReviewing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Marcando...
                </>
              ) : (
                'Marcar como revisada'
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
