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
  formatCepBR,
  cepDigits,
} from '@/lib/profile/fields'
import { formatCpfBR } from '@/lib/auth/cpf'
import { completeProfileAction } from '@/app/actions/profile'

const inputClass =
  'h-11 w-full rounded-none border-0 border-b border-b-ink bg-transparent px-3 text-base outline-none transition-colors duration-[180ms] placeholder:text-mist focus-visible:border-b-teal'

type Initial = {
  phone: string
  cpf: string
  specialties: string[]
  tosAccepted: boolean
  cep: string
  address: string
  addressNumber: string
  complement: string
  district: string
  city: string
  state: string
}

const FIXED = SPECIALTIES as readonly string[]

export function CompleteProfileForm({
  initial,
  next,
  contexto = 'acesso',
}: {
  initial?: Initial
  /** Tela pedida antes do desvio do portão — já validada no server. */
  next?: string | null
  /**
   * 'compra' exige o endereço; 'acesso' o deixa opcional e recolhido.
   * Ver a nota grande em lib/gates/therapist-profile.ts.
   */
  contexto?: 'acesso' | 'compra'
}) {
  const exigeEndereco = contexto === 'compra'
  // specialties salvas: separa as da lista fixa do texto livre ("Outro").
  const savedSpecs = initial?.specialties ?? []
  const freeText = savedSpecs.find((s) => !FIXED.includes(s)) ?? ''
  const initialSelected = (() => {
    const fixed = savedSpecs.filter((s) => FIXED.includes(s))
    return freeText ? [...fixed, OTHER] : fixed
  })()

  const [phone, setPhone] = useState(initial?.phone ? formatPhoneBR(initial.phone) : '')
  const [cpf, setCpf] = useState(initial?.cpf ? formatCpfBR(initial.cpf) : '')
  const [selected, setSelected] = useState<string[]>(initialSelected)
  const [otherText, setOtherText] = useState(freeText)
  const [tosAccepted, setTosAccepted] = useState(initial?.tosAccepted ?? false)

  // endereço
  const [cep, setCep] = useState(initial?.cep ? formatCepBR(initial.cep) : '')
  const [address, setAddress] = useState(initial?.address ?? '')
  const [addressNumber, setAddressNumber] = useState(initial?.addressNumber ?? '')
  const [complement, setComplement] = useState(initial?.complement ?? '')
  const [district, setDistrict] = useState(initial?.district ?? '')
  const [city, setCity] = useState(initial?.city ?? '')
  const [uf, setUf] = useState(initial?.state ?? '')
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState<string | null>(null)

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

  async function lookupCep(raw: string) {
    const d = cepDigits(raw)
    if (d.length !== 8) return
    setCepLoading(true)
    setCepError(null)
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`)
      const data = await r.json()
      if (data?.erro) {
        setCepError('CEP não encontrado. Confira ou preencha manualmente.')
        return
      }
      // ViaCEP preenche o que tiver; o usuário completa/ajusta o resto.
      setAddress(data.logradouro ?? '')
      setDistrict(data.bairro ?? '')
      setCity(data.localidade ?? '')
      setUf((data.uf ?? '').toUpperCase())
    } catch {
      setCepError('Não foi possível buscar o CEP agora. Preencha manualmente.')
    } finally {
      setCepLoading(false)
    }
  }

  function onCepChange(v: string) {
    const masked = formatCepBR(v)
    setCep(masked)
    setCepError(null)
    if (cepDigits(masked).length === 8) void lookupCep(masked)
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
      contexto,
      cep,
      address,
      addressNumber,
      complement,
      district,
      city,
      state: uf,
      next: next ?? undefined,
    })
    // Sucesso → a action redireciona (pro destino guardado, ou /dashboard).
    // Só chega aqui em erro.
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
          <span className="text-mist">(1 a {MAX_SPECIALTIES})</span>
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

      {/* ── Endereço (NF-e + cobrança) ──
          ⭐ Fora do contexto de compra ele é OPCIONAL e vem recolhido: era o
          bloco que transformava a primeira entrada numa segunda tela de
          cadastro e travava quem ainda não tinha visto o produto funcionar. */}
      <fieldset className="flex flex-col gap-4 border-t border-b-ink/15 pt-5">
        <legend className="text-sm font-medium">
          Endereço{' '}
          <span className="text-mist">
            {exigeEndereco
              ? '(para a nota fiscal e o pagamento)'
              : '(opcional agora — pedimos na hora de comprar créditos)'}
          </span>
        </legend>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cep" className="text-sm font-medium">
            CEP
          </label>
          <div className="relative">
            <input
              id="cep"
              name="cep"
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              value={cep}
              onChange={(e) => onCepChange(e.target.value)}
              placeholder="00000-000"
              maxLength={9}
              className={inputClass}
            />
            {cepLoading && (
              <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-mist" />
            )}
          </div>
          {cepError && <span className="text-xs text-destructive">{cepError}</span>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="address" className="text-sm font-medium">
            Logradouro
          </label>
          <input
            id="address"
            name="address"
            type="text"
            autoComplete="address-line1"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Rua / Avenida"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="addressNumber" className="text-sm font-medium">
              Número
            </label>
            <input
              id="addressNumber"
              name="addressNumber"
              type="text"
              inputMode="numeric"
              value={addressNumber}
              onChange={(e) => setAddressNumber(e.target.value)}
              placeholder="123"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="complement" className="text-sm font-medium">
              Complemento{' '}
              <span className="text-mist">(opcional)</span>
            </label>
            <input
              id="complement"
              name="complement"
              type="text"
              autoComplete="address-line2"
              value={complement}
              onChange={(e) => setComplement(e.target.value)}
              placeholder="Apto, bloco…"
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="district" className="text-sm font-medium">
            Bairro
          </label>
          <input
            id="district"
            name="district"
            type="text"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="Bairro"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="city" className="text-sm font-medium">
              Cidade
            </label>
            <input
              id="city"
              name="city"
              type="text"
              autoComplete="address-level2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Cidade"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="uf" className="text-sm font-medium">
              UF
            </label>
            <input
              id="uf"
              name="uf"
              type="text"
              autoComplete="address-level1"
              value={uf}
              onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="SP"
              maxLength={2}
              className={inputClass + ' w-16 text-center'}
            />
          </div>
        </div>
      </fieldset>

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

      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
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
