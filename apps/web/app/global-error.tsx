'use client'

/**
 * Último anteparo: erro no PRÓPRIO layout raiz, onde `app/error.tsx` já não
 * roda. Precisa trazer as tags `<html>` e `<body>` porque substitui o layout
 * inteiro — e por isso não pode depender de nada do app (nem do Tailwind, que
 * pode ser justamente o que falhou). Estilo inline, de propósito.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          padding: '48px 24px',
          textAlign: 'center',
          background: '#F2EDE4',
          color: '#000',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 300,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
          }}
        >
          Alguma coisa quebrou aqui
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: 420,
            fontSize: 14,
            lineHeight: 1.6,
            color: '#7A7A7A',
          }}
        >
          Não foi você, e nada do seu trabalho foi perdido. Recarregar costuma
          resolver.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            border: '1px solid #000',
            background: '#1E6B61',
            color: '#fff',
            padding: '10px 20px',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
            cursor: 'pointer',
          }}
        >
          Tentar de novo
        </button>
        {error.digest && (
          <p
            style={{
              margin: 0,
              fontSize: 10.5,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#7A7A7A',
            }}
          >
            Código para o suporte: {error.digest}
          </p>
        )}
      </body>
    </html>
  )
}
