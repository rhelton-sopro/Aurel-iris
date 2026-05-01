import { Upload } from 'lucide-react'

export default function UploadPlaceholderPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
      <Upload className="h-16 w-16 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Upload no computador em breve</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        Disponível na Fase 4. Use a captura mobile pelo celular para registrar imagens agora.
      </p>
    </div>
  )
}
