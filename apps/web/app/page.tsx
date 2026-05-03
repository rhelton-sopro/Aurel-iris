import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-2xl w-full text-center space-y-6">
        <h1 className="text-4xl font-bold">Aurel Iris</h1>
        <p className="text-lg text-muted-foreground">
          Ferramenta de apoio à anamnese terapêutica integrativa.
        </p>
        <p className="text-sm text-muted-foreground">
          Não substitui avaliação médica.
        </p>
        <div className="flex justify-center gap-3 pt-4">
          <Link href="/login" className={cn(buttonVariants())}>
            Entrar
          </Link>
          <Link href="/signup" className={cn(buttonVariants({ variant: 'outline' }))}>
            Criar conta
          </Link>
        </div>
      </div>
    </main>
  );
}
