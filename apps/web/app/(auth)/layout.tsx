export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
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
