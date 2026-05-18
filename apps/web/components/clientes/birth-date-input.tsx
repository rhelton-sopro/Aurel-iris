'use client'

import * as React from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

/**
 * Campo de data de nascimento — input mascarado DD/MM/AAAA + popover de
 * calendário com SELECTS de mês e ano no header (sem navegação mês a mês
 * obrigatória).
 *
 * Validações em tempo real (mostradas só quando o input está completo —
 * 10 caracteres — pra não atrapalhar a digitação):
 *  - Range de ano: 1920..currentYear
 *  - Mês 01..12
 *  - Dia 01..daysInMonth(ano, mês) com bissexto correto pra Fevereiro
 *  - Data não pode estar no futuro
 *
 * O hidden input com `name="birth_date"` propaga o ISO yyyy-MM-dd quando
 * a data é válida; '' caso contrário (cobre estado parcial / inválido).
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

const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30
  return 31
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Aplica máscara DD/MM/AAAA conforme o usuário digita (apenas dígitos contam). */
function maskBirthDate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function isoToBr(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return ''
  return `${m[3]}/${m[2]}/${m[1]}`
}

interface ParseResult {
  iso: string
  valid: boolean
  /** null quando válido OU quando ainda parcial (sem mostrar erro). */
  error: string | null
}

function parseBrDate(text: string, todayMidnight: Date): ParseResult {
  if (!text) return { iso: '', valid: false, error: null }
  // Só valida (e potencialmente mostra erro) quando a string está completa.
  if (text.length < 10) return { iso: '', valid: false, error: null }

  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  if (!m) return { iso: '', valid: false, error: 'Use o formato DD/MM/AAAA' }

  const day = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  const year = parseInt(m[3], 10)
  const currentYear = todayMidnight.getFullYear()

  if (year < MIN_YEAR) return { iso: '', valid: false, error: `Ano deve ser ${MIN_YEAR} ou posterior` }
  if (year > currentYear) return { iso: '', valid: false, error: 'Ano não pode ser futuro' }
  if (month < 1 || month > 12) return { iso: '', valid: false, error: 'Mês inválido' }

  const max = daysInMonth(year, month)
  if (day < 1 || day > max) return { iso: '', valid: false, error: `Dia inválido para o mês selecionado` }

  const date = new Date(year, month - 1, day)
  if (date > todayMidnight) return { iso: '', valid: false, error: 'Data não pode estar no futuro' }

  return { iso: `${m[3]}-${m[2]}-${m[1]}`, valid: true, error: null }
}

interface CalendarCell {
  day: number
  monthRel: 'prev' | 'current' | 'next'
  iso: string
}

function buildCalendarGrid(year: number, month: number): CalendarCell[] {
  const firstWeekday = new Date(year, month - 1, 1).getDay() // 0 = Domingo
  const totalDays = daysInMonth(year, month)
  const cells: CalendarCell[] = []

  // Padding do mês anterior.
  if (firstWeekday > 0) {
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const prevTotal = daysInMonth(prevYear, prevMonth)
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const d = prevTotal - i
      cells.push({
        day: d,
        monthRel: 'prev',
        iso: `${prevYear}-${pad2(prevMonth)}-${pad2(d)}`,
      })
    }
  }

  // Mês corrente.
  for (let d = 1; d <= totalDays; d++) {
    cells.push({
      day: d,
      monthRel: 'current',
      iso: `${year}-${pad2(month)}-${pad2(d)}`,
    })
  }

  // Padding do mês seguinte até completar 42 (6 semanas × 7).
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  let nextDay = 1
  while (cells.length < 42) {
    cells.push({
      day: nextDay,
      monthRel: 'next',
      iso: `${nextYear}-${pad2(nextMonth)}-${pad2(nextDay)}`,
    })
    nextDay++
  }

  return cells
}

interface BirthDateInputProps {
  /** ISO yyyy-MM-dd ou string vazia. */
  value: string
  /** Disparado com a string ISO quando válida; '' caso contrário. */
  onChange: (value: string) => void
  /** Nome do hidden input pra FormData/server action. */
  name?: string
  /** Aria-label para acessibilidade do input. */
  'aria-label'?: string
}

export function BirthDateInput({
  value,
  onChange,
  name = 'birth_date',
  ...rest
}: BirthDateInputProps) {
  const [text, setText] = React.useState(() => isoToBr(value))
  const [open, setOpen] = React.useState(false)

  const todayMidnight = React.useMemo(() => {
    const t = new Date()
    return new Date(t.getFullYear(), t.getMonth(), t.getDate())
  }, [])
  const currentYear = todayMidnight.getFullYear()
  const currentMonth = todayMidnight.getMonth() + 1

  const parsed = React.useMemo(
    () => parseBrDate(text, todayMidnight),
    [text, todayMidnight],
  )

  // Sync externa: prop value muda (form reset, edição).
  React.useEffect(() => {
    setText(isoToBr(value))
  }, [value])

  // Picker state — começa no mês/ano da data válida, ou hoje.
  const [pickerYear, setPickerYear] = React.useState(currentYear)
  const [pickerMonth, setPickerMonth] = React.useState(currentMonth)

  // Sincroniza picker com o valor digitado quando válido.
  React.useEffect(() => {
    if (parsed.valid) {
      const [y, m] = parsed.iso.split('-')
      setPickerYear(parseInt(y, 10))
      setPickerMonth(parseInt(m, 10))
    }
  }, [parsed.iso, parsed.valid])

  // Quando o popover abre, posiciona no mês/ano da data válida (se houver).
  const handleOpenChange = React.useCallback((isOpen: boolean) => {
    if (isOpen && parsed.valid) {
      const [y, m] = parsed.iso.split('-')
      setPickerYear(parseInt(y, 10))
      setPickerMonth(parseInt(m, 10))
    }
    setOpen(isOpen)
  }, [parsed.iso, parsed.valid])

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskBirthDate(e.target.value)
    setText(masked)
    const p = parseBrDate(masked, todayMidnight)
    onChange(p.valid ? p.iso : '')
  }

  const handleDayClick = (cell: CalendarCell) => {
    if (cell.monthRel !== 'current') return
    const cellDate = new Date(`${cell.iso}T00:00:00`)
    if (cellDate > todayMidnight) return // futura — não selecionável
    setText(isoToBr(cell.iso))
    onChange(cell.iso)
    setOpen(false)
  }

  const goPrevMonth = () => {
    if (pickerMonth === 1) {
      if (pickerYear <= MIN_YEAR) return
      setPickerMonth(12)
      setPickerYear(pickerYear - 1)
    } else {
      setPickerMonth(pickerMonth - 1)
    }
  }
  const goNextMonth = () => {
    if (pickerYear === currentYear && pickerMonth === currentMonth) return
    if (pickerMonth === 12) {
      setPickerMonth(1)
      setPickerYear(pickerYear + 1)
    } else {
      setPickerMonth(pickerMonth + 1)
    }
  }
  const isAtPrevBoundary = pickerYear === MIN_YEAR && pickerMonth === 1
  const isAtNextBoundary = pickerYear === currentYear && pickerMonth === currentMonth

  const cells = React.useMemo(
    () => buildCalendarGrid(pickerYear, pickerMonth),
    [pickerYear, pickerMonth],
  )

  const years = React.useMemo(() => {
    const arr: string[] = []
    for (let y = currentYear; y >= MIN_YEAR; y--) arr.push(String(y))
    return arr
  }, [currentYear])

  const todayIso = `${currentYear}-${pad2(currentMonth)}-${pad2(todayMidnight.getDate())}`
  const selectedIso = parsed.valid ? parsed.iso : null

  return (
    <>
      {/* hidden input — entra no FormData do server action. */}
      <input type="hidden" name={name} value={parsed.valid ? parsed.iso : ''} />

      <div className="relative">
        <Input
          type="text"
          inputMode="numeric"
          placeholder="DD/MM/AAAA"
          value={text}
          onChange={handleTextChange}
          maxLength={10}
          autoComplete="bday"
          className="pr-10"
          aria-invalid={parsed.error ? true : undefined}
          {...rest}
        />
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger
            type="button"
            aria-label="Abrir calendário"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CalendarIcon className="h-4 w-4" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-3">
            {/* Header: setas + selects de mês e ano */}
            <div className="flex items-center gap-1 mb-3">
              <button
                type="button"
                onClick={goPrevMonth}
                disabled={isAtPrevBoundary}
                aria-label="Mês anterior"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="flex-1">
                <Select
                  value={pad2(pickerMonth)}
                  onValueChange={(v) => v && setPickerMonth(parseInt(v, 10))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS_PT.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-20">
                <Select
                  value={String(pickerYear)}
                  onValueChange={(v) => v && setPickerYear(parseInt(v, 10))}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
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

              <button
                type="button"
                onClick={goNextMonth}
                disabled={isAtNextBoundary}
                aria-label="Próximo mês"
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Cabeçalho de dias da semana */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS_PT.map((d) => (
                <div
                  key={d}
                  className="h-7 flex items-center justify-center text-[11px] font-medium text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Grid de dias */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell, idx) => {
                const cellDate = new Date(`${cell.iso}T00:00:00`)
                const isFuture = cellDate > todayMidnight
                const disabled = cell.monthRel !== 'current' || isFuture
                const isSelected = selectedIso === cell.iso
                const isToday = todayIso === cell.iso

                return (
                  <button
                    key={`${cell.iso}-${idx}`}
                    type="button"
                    onClick={() => handleDayClick(cell)}
                    disabled={disabled}
                    aria-label={cell.iso}
                    aria-pressed={isSelected}
                    className={cn(
                      'h-9 w-9 rounded-none text-sm transition-colors flex items-center justify-center',
                      cell.monthRel === 'current'
                        ? 'text-foreground'
                        : 'text-muted-foreground/40',
                      isFuture && cell.monthRel === 'current' && 'text-muted-foreground/40',
                      !disabled && !isSelected && 'hover:bg-accent hover:text-accent-foreground',
                      isSelected && 'bg-teal-dark text-white hover:bg-teal-dark',
                      isToday && !isSelected && 'ring-1 ring-teal',
                      disabled && 'cursor-not-allowed',
                    )}
                  >
                    {cell.day}
                  </button>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {parsed.error && (
        <p className="text-sm text-destructive mt-1">{parsed.error}</p>
      )}
    </>
  )
}
