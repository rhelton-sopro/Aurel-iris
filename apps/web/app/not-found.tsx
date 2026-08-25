import Link from 'next/link'
import Image from 'next/image'

/**
 * Tela de "não encontrei" — vale pra todo `notFound()` do app (leitura apagada,
 * cliente que não existe, URL digitada errada).
 *
 * ⚠️ Antes NÃO existia: o Next servia a própria página padrão dele, em inglês,
 * fundo branco, fonte do sistema, sem logo e sem caminho de volta. Num produto
 * que se vende pelo acabamento, era a pior tela do app — e era justamente a que
 * aparecia no pior momento.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center">
      <Image
        src="/logo/iris_codex_horizontal.png"
        alt="Iris Codex"
        width={2000}
        height={1000}
        priority
        className="h-auto w-[150px]"
      />

      <div className="max-w-md space-y-2">
        <h1 className="text-[22px] font-light uppercase tracking-display text-ink">
          Não encontramos esta página
        </h1>
        <p className="text-sm leading-relaxed text-mist">
          O endereço pode estar incompleto, ou o que estava aqui foi removido —
          é o caso de uma leitura ou de um cliente que você excluiu.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="border border-ink bg-teal-dark px-5 py-2.5 text-xs font-normal uppercase tracking-label text-white"
        >
          Ir para o Dashboard
        </Link>
        <Link
          href="/leituras"
          className="border border-ink px-5 py-2.5 text-xs font-normal uppercase tracking-label text-ink"
        >
          Ver minhas leituras
        </Link>
      </div>
    </main>
  )
}
