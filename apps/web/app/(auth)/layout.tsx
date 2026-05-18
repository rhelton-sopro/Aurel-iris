import Image from 'next/image'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))]">
      <Image
        src="/logo/iris_codex_horizontal.png"
        alt="Iris Codex"
        width={2000}
        height={1000}
        priority
        className="mb-8 h-auto w-[180px]"
      />
      <div className="w-full max-w-sm">
        {children}
      </div>
      <footer className="mt-8 pb-4">
        <p className="text-xs text-muted-foreground text-center">
          Ferramenta de apoio à anamnese terapêutica integrativa, não substitui avaliação médica.
        </p>
      </footer>
    </div>
  )
}
