export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))]">
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
