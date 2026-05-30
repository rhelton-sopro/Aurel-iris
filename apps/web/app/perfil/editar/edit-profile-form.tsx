'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { updateProfileBasicAction } from '@/app/actions/profile'
import { formatPhoneBR } from '@/lib/profile/fields'

export function EditProfileForm({
  initialFullName,
  initialPhone,
}: {
  initialFullName: string
  initialPhone: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [fullName, setFullName] = useState(initialFullName)
  const [phone, setPhone] = useState(formatPhoneBR(initialPhone))
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await updateProfileBasicAction({ fullName, phone })
      if (result?.error) {
        setError(result.error)
        toast.error(result.error)
        return
      }
      toast.success('Perfil atualizado.')
      router.push('/dashboard')
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="fullName" className="block text-sm font-medium text-ink">
          Nome completo
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Seu nome"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="phone" className="block text-sm font-medium text-ink">
          Telefone (WhatsApp)
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(formatPhoneBR(e.target.value))}
          placeholder="(11) 99999-9999"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          disabled={isPending}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full rounded-md bg-teal-dark px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Salvando…' : 'Salvar alterações'}
      </button>
    </div>
  )
}
