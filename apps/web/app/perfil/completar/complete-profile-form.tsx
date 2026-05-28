'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  SPECIALTIES,
  OTHER,
  MAX_SPECIALTIES,
  formatPhoneBR,
} from '@/lib/profile/fields'
import { formatCpfBR } from '@/lib/auth/cpf'
import { completeProfileAction } from '@/app/actions/profile'

const inputClass =
  'h-11 w-full rounded-none border-0 border-b border-b-ink bg-transparent px-3 text-base outline-none transition-colors duration-[180ms] placeholder:text-mist focus-visible:border-b-teal'

export function CompleteProfileForm() {
  const [phone, setPhone] = useState('')
  const [cpf, setCpf] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [otherText, setOtherText] = useState('')
  const [tosAccepted, setTosAccepted] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const otherSelected = selected.includes(OTHER)

  function toggleSpecialty(s: string) {
    setSelected((prev) => {
      if (prev.includes(s)) return prev.filter((x) => x !== s)
      if (prev.length >= MAX_SPECIALTIES) return prev
      return [...prev, s]
    })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const res = await completeProfileAction({
      phone,
      cpf,
      specialties: selected,
      otherText,
      tosAccepted,
    })
    // Sucesso → a action faz redirect('/dashboard'). Só chega aqui em erro.
    if (res?.error) {
      setError(res.error)
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive text-sm px-4 py-2 rounded-none text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className="text-sm font-medium">
          WhatsApp
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          autoFocus
          value={phone}
          onChange={(e) => setPhone(formatPhoneBR(e.target.value))}
          placeholder="(11) 99999-9999"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="cpf" className="text-sm font-medium">
          CPF
        </label>
        <input
          id="cpf"
          name="cpf"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={cpf}
          onChange={(e) => setCpf(formatCpfBR(e.target.value))}
          placeholder="000.000.000-00"
          maxLength={14}
          data-testid="profile-cpf"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          Especialidades{' '}
          <span className="text-mist">
            (1 a {MAX_SPECIALTIES})
          </span>
        </span>
        <div className="flex flex-wrap gap-2">
          {SPECIALTIES.map((s) => {
            const on = selected.includes(s)
            const disabled = !on && selected.length >= MAX_SPECIALTIES
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSpecialty(s)}
                disabled={disabled}
                aria-pressed={on}
                className={
                  'rounded-none border px-3 py-1.5 text-sm transition-colors ' +
                  (on
                    ? 'border-teal bg-teal text-white'
                    : disabled
                      ? 'border-b-ink/20 text-mist cursor-not-allowed'
                      : 'border-ink text-ink hover:border-teal hover:text-teal')
                }
              >
                {s}
              </button>
            )
          })}
        </div>
        {otherSelected && (
          <input
            type="text"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            placeholder="Qual especialidade?"
            className={inputClass + ' mt-1'}
          />
        )}
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={tosAccepted}
          onChange={(e) => setTosAccepted(e.target.checked)}
          className="mt-1"
        />
        <span>
          Li e aceito os{' '}
          <Link href="/termos" target="_blank" className="underline">
            Termos de Uso
          </Link>{' '}
          e a{' '}
          <Link href="/privacidade" target="_blank" className="underline">
            Política de Privacidade
          </Link>
          .
        </span>
      </label>

      <Button
        type="submit"
        className="w-full"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Salvando...
          </>
        ) : (
          'Concluir e continuar'
        )}
      </Button>
    </form>
  )
}
