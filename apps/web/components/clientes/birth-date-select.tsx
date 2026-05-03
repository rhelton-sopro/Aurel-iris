'use client'

import * as React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Trio de selects (Dia · Mês · Ano) para data de nascimento — substitui o
 * `<input type="date">` nativo, que em mobile força navegação mês a mês.
 *
 * - Ano: do atual até MIN_YEAR (1920), em ordem decrescente — começa no atual
 *   pra reduzir scroll quando a data é recente.
 * - Mês: nomes em pt-BR.
 * - Dia: 1..31, com `daysInMonth(ano, mês)` aplicado quando ambos definidos
 *   (Fevereiro = 28 ou 29 conforme bissexto).
 *
 * Compose: monta `${yyyy}-${MM}-${dd}` e valida que a data é REAL (rejeita
 * combinações sintáticas como 31/02). Datas futuras filtradas via schema do
 * form (zod refine) — este componente não conhece "hoje".
 *
 * Hidden input com `name` propaga o valor composto para FormData/server action.
 */

const MIN_YEAR = 1920

const MONTHS_PT: ReadonlyArray<{ value: string; label: string }> = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
]

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30
  return 31
}

function decompose(iso: string): { day: string; month: string; year: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return { day: '', month: '', year: '' }
  return { year: m[1], month: m[2], day: m[3] }
}

/**
 * Devolve `yyyy-MM-dd` se os 3 forem strings não vazias E formarem uma data
 * REAL (rolagem de mês JS rejeitada — ex: 31/02 → '').
 */
function compose(day: string, month: string, year: string): string {
  if (!day || !month || !year) return ''
  const iso = `${year}-${month}-${day}`
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  if (
    date.getFullYear() !== parseInt(year, 10) ||
    date.getMonth() + 1 !== parseInt(month, 10) ||
    date.getDate() !== parseInt(day, 10)
  ) {
    return ''
  }
  return iso
}

interface BirthDateSelectProps {
  /** ISO `yyyy-MM-dd` ou string vazia. */
  value: string
  /** Disparado com a string ISO composta — '' se incompleta ou inválida. */
  onChange: (value: string) => void
  /** Nome do hidden input pra FormData (default 'birth_date'). */
  name?: string
}

export function BirthDateSelect({ value, onChange, name = 'birth_date' }: BirthDateSelectProps) {
  const [day, setDay] = React.useState(() => decompose(value).day)
  const [month, setMonth] = React.useState(() => decompose(value).month)
  const [year, setYear] = React.useState(() => decompose(value).year)

  // Re-sync se prop value mudar de fora (ex: form reset).
  React.useEffect(() => {
    const d = decompose(value)
    setDay(d.day)
    setMonth(d.month)
    setYear(d.year)
  }, [value])

  const currentYear = new Date().getFullYear()
  const yearNum = year ? parseInt(year, 10) : NaN
  const monthNum = month ? parseInt(month, 10) : NaN

  // Dias dependem de mês+ano (Fevereiro bissexto). Quando algum está vazio,
  // mostra 1..31 — usuário pode escolher e a validação de compose pega.
  const maxDays =
    !Number.isNaN(yearNum) && !Number.isNaN(monthNum)
      ? daysInMonth(yearNum, monthNum)
      : 31

  const days = React.useMemo(() => {
    const arr: string[] = []
    for (let d = 1; d <= maxDays; d++) arr.push(String(d).padStart(2, '0'))
    return arr
  }, [maxDays])

  const years = React.useMemo(() => {
    const arr: string[] = []
    for (let y = currentYear; y >= MIN_YEAR; y--) arr.push(String(y))
    return arr
  }, [currentYear])

  const composed = compose(day, month, year)
  const isPartial = (day || month || year) && !(day && month && year)

  const handleDayChange = (v: string | null) => {
    const newDay = v ?? ''
    setDay(newDay)
    onChange(compose(newDay, month, year))
  }
  const handleMonthChange = (v: string | null) => {
    const newMonth = v ?? ''
    setMonth(newMonth)
    onChange(compose(day, newMonth, year))
  }
  const handleYearChange = (v: string | null) => {
    const newYear = v ?? ''
    setYear(newYear)
    onChange(compose(day, month, newYear))
  }

  return (
    <>
      {/* Hidden input — value composto entra no FormData do server action. */}
      <input type="hidden" name={name} value={composed} />
      <div className="grid grid-cols-3 gap-2">
        <Select value={day || null} onValueChange={handleDayChange}>
          <SelectTrigger>
            <SelectValue placeholder="Dia" />
          </SelectTrigger>
          <SelectContent>
            {days.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={month || null} onValueChange={handleMonthChange}>
          <SelectTrigger>
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            {MONTHS_PT.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={year || null} onValueChange={handleYearChange}>
          <SelectTrigger>
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isPartial && (
        <p className="text-sm text-amber-600 mt-1">Preencha dia, mês e ano.</p>
      )}
    </>
  )
}
