'use client'

import { useActionState, useEffect } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { saveCalibrationDiagnosis } from '@/app/actions/calibration'
import {
  DIAGNOSIS_MAX_CHARS,
  type DiagnosisFormState,
} from '@/lib/calibration/constants'

interface CalibrationDiagnosisFormProps {
  readingId: string
  existingDiagnosis: string | null
  diagnosisUpdatedAt: string | null
}

const initialState: DiagnosisFormState = {}

export function CalibrationDiagnosisForm({
  readingId,
  existingDiagnosis,
  diagnosisUpdatedAt,
}: CalibrationDiagnosisFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveCalibrationDiagnosis,
    initialState,
  )

  useEffect(() => {
    if (state.ok) {
      toast.success('Diagnóstico salvo')
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state])

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="reading_id" value={readingId} />

      <div className="space-y-2">
        <Label htmlFor="diagnosis">
          Diagnóstico / ação de calibração (texto livre)
        </Label>
        <p className="text-xs text-muted-foreground">
          Cole aqui o resultado preenchido da análise externa (3 seções:
          ANOTAÇÃO HUMANA + DIAGNÓSTICO COMPARATIVO + AÇÃO DE CALIBRAÇÃO PROPOSTA).
          Vira histórico operacional do que foi observado e do que precisa ser
          feito no código.
        </p>
        <Textarea
          id="diagnosis"
          name="diagnosis"
          defaultValue={existingDiagnosis ?? ''}
          rows={20}
          maxLength={DIAGNOSIS_MAX_CHARS}
          placeholder="Cole aqui o relatório preenchido externamente..."
          className="font-mono text-sm"
        />
        {diagnosisUpdatedAt && (
          <p className="text-xs text-muted-foreground">
            Última atualização: {new Date(diagnosisUpdatedAt).toLocaleString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
            })}
          </p>
        )}
      </div>

      {state.error && (
        <div className="bg-destructive/10 border border-destructive text-sm px-4 py-2 rounded text-destructive">
          {state.error}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending} aria-busy={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar diagnóstico/ação
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
