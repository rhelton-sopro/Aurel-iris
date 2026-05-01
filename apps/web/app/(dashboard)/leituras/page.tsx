import { Eye } from 'lucide-react'

export default function LeiturasPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
      <Eye className="h-16 w-16 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Em breve</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        A captura e análise de íris estará disponível em breve.
      </p>
    </div>
  )
}
