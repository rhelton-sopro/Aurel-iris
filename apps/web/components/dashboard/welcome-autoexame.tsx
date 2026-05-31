import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Tela de boas-vindas do terapeuta novo (0 leituras + trial ativo). Foco único:
// levar ao AHA o mais rápido possível — a própria leitura, de graça, sem
// cadastrar ninguém (founder 2026-05-31). O botão dominante vai pro /autoexame
// (DOB + sexo + consentimento biométrico explícito → captura). O checklist de
// expansão (cliente, comprar) só aparece DEPOIS da primeira leitura.
export function WelcomeAutoexame({
  readingsRemaining,
}: {
  readingsRemaining: number
}) {
  const plural = readingsRemaining === 1 ? 'leitura grátis' : 'leituras grátis'
  return (
    <section
      data-testid="welcome-autoexame"
      className="rounded-md border-2 border-teal-700/20 bg-card p-6 sm:p-8 space-y-4 text-center"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
        Você tem {readingsRemaining} {plural}
      </p>
      <h2 className="text-2xl font-semibold tracking-tight">
        Vamos começar fazendo a sua leitura
      </h2>
      <p className="mx-auto max-w-md text-sm text-muted-foreground">
        A forma mais rápida de ver o Iris Codex funcionar é na sua própria íris —
        sem cadastrar ninguém. Peça pra alguém fotografar seus olhos e receba seu
        relatório em minutos.
      </p>
      <Link
        href="/leituras/autoexame"
        className={cn(buttonVariants({ size: 'lg' }), 'w-full sm:w-auto')}
      >
        Fazer minha leitura agora
      </Link>
    </section>
  )
}
