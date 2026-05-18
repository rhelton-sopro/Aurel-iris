import Link from 'next/link'
import Image from 'next/image'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-2xl w-full text-center space-y-6">
        <Image
          src="/logo/iris_codex_horizontal.png"
          alt="Iris Codex"
          width={2000}
          height={1000}
          priority
          className="mx-auto h-auto w-[280px]"
        />
        <p className="text-lg text-muted-foreground">
          A íris como mapa do ser.
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
