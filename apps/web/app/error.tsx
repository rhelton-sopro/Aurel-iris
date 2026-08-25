'use client'

import { useEffect } from 'react'
import Link from 'next/link'

/**
 * Tela de erro do app — captura o que quebrar em qualquer rota abaixo da raiz.
 *
 * ⚠️ Antes NÃO existia: qualquer erro de render virava a tela padrão do Next em
 * inglês ("Application error: a client-side exception has occurred"), sem marca
 * e sem saída. Aqui a pessoa lê em português, tem um botão que tenta de novo
 * (a maioria dos casos é oscilação de rede numa query) e um caminho de volta.
 *
 * O `digest` aparece porque é o que liga esta tela ao registro do servidor: sem
 * ele, um relato de "deu erro" não tem como ser encontrado no log.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app] erro não tratado:', error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="text-[22px] font-light uppercase tracking-display text-ink">
          Alguma coisa quebrou aqui
        </h1>
        <p className="text-sm leading-relaxed text-mist">
          Não foi você. Na maioria das vezes é a conexão oscilando no meio de uma
          consulta — tentar de novo resolve. Nada do seu trabalho foi perdido.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="border border-ink bg-teal-dark px-5 py-2.5 text-xs font-normal uppercase tracking-label text-white"
        >
          Tentar de novo
        </button>
        <Link
          href="/dashboard"
          className="border border-ink px-5 py-2.5 text-xs font-normal uppercase tracking-label text-ink"
        >
          Ir para o Dashboard
        </Link>
      </div>

      {error.digest && (
        <p className="text-[10.5px] uppercase tracking-label text-mist">
          Código para o suporte: {error.digest}
        </p>
      )}
    </main>
  )
}
