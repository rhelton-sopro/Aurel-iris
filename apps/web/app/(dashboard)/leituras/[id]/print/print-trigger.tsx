'use client'

/**
 * PrintTrigger — auto-trigger window.print() shortly after mount.
 *
 * Plan 7.4-19 (UAT-3 PDF export via Print CSS): user clicks "Exportar PDF"
 * → navigates to /leituras/[id]/print → this component fires print dialog
 * after a 250ms delay so the print-optimized layout has time to render.
 *
 * The user can cancel the dialog and re-trigger manually via Ctrl+P / Cmd+P
 * (the print page banner explains how). Returns null — pure side effect.
 */
import { useEffect } from 'react'

export function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        window.print()
      } catch {
        // Some environments (popup blockers, headless tests) prevent
        // window.print(). Banner copy already instructs Ctrl+P fallback.
      }
    }, 250)
    return () => clearTimeout(t)
  }, [])
  return null
}
