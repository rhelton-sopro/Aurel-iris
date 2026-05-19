'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { startSelfExamAction } from '@/app/actions/profile'

const inputClass =
  'h-11 w-full rounded-none border-0 border-b border-b-ink bg-transparent px-3 text-base outline-none transition-colors duration-[180ms] placeholder:text-mist focus-visible:border-b-teal'

export function AutoexameForm(p: {
  fullName: string
  email: string
  phone: string
  birthDate: string
  biologicalSex: 'feminino' | 'masculino' | ''
}) {
  const [birth, setBirth] = useState(p.birthDate)
  const [sex, setSex] = useState<'feminino' | 'masculino' | ''>(p.biologicalSex)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!birth) return setError('Informe sua data de nascimento.')
    if (sex !== 'feminino' && sex !== 'masculino')
      return setError('Selecione o sexo biológico.')
    setPending(true)
    const res = await startSelfExamAction({
      birth_date: birth,
      biological_sex: sex,
    })
    // Sucesso → a action redireciona p/ /leituras/nova?cliente=<id>.
    if (res?.error) {
      setError(res.error)
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error && (
        <div className="bg-destructive/10 border border-destructive text-sm px-4 py-2 rounded-none text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-none border border-b-ink/20 p-3 text-sm text-muted-foreground space-y-0.5">
        <div>
          <span className="text-ink font-medium">{p.fullName || '—'}</span>{' '}
          (você)
        </div>
        <div>{p.email}</div>
        <div>{p.phone || 'WhatsApp não informado'}</div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="birth" className="text-sm font-medium">
          Data de nascimento
        </label>
        <input
          id="birth"
          type="date"
          value={birth}
          onChange={(e) => setBirth(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sex" className="text-sm font-medium">
          Sexo biológico
        </label>
        <select
          id="sex"
          value={sex}
          onChange={(e) =>
            setSex(e.target.value as 'feminino' | 'masculino' | '')
          }
          className={inputClass}
        >
          <option value="">Selecione…</option>
          <option value="feminino">Feminino</option>
          <option value="masculino">Masculino</option>
        </select>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Preparando…
          </>
        ) : (
          'Continuar para a captura'
        )}
      </Button>
    </form>
  )
}
