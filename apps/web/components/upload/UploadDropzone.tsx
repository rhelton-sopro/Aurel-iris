'use client'

import * as React from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface UploadDropzoneProps {
  /** Callback chamado com o File aceito. Caller decide validação subsequente
   *  (validateUploadFile + convertHeicToJpeg + VLM gate). */
  onFileAccepted: (file: File) => void
  /** Desabilita drop e click (ex: phase='analyzing' do upload-client). */
  disabled?: boolean
  /** Texto opcional exibido dentro da dropzone
   *  (ex: 'Foto 1 de 6 — Olho ESQUERDO · Frente'). */
  slotLabel?: string
}

/**
 * Dropzone para captura de UM arquivo de imagem.
 *
 * Dois caminhos paralelos chamam o mesmo callback onFileAccepted:
 *  - Drag-and-drop nativo do navegador (handleDrop).
 *  - Click no container -> input file picker (handleInputChange).
 *
 * Componente é PURAMENTE apresentacional: nenhuma validação de MIME ou tamanho
 * acontece aqui (responsabilidade do caller via lib/upload/validate-file).
 *
 * CONTEXT D-05: wizard sequencial — uma dropzone por slot.
 * CONTEXT D-10: aceita JPEG/PNG/WebP/HEIC/HEIF (MIME + extensão fallback).
 * CONTEXT D-11: HEIC entra como input — caller chama convertHeicToJpeg após validar.
 *
 * Threat model T-04-03-01 (Tampering): este componente não valida o arquivo,
 * apenas repassa pro caller. Defesa em camadas: validateUploadFile (Plan 04-01)
 * é a primeira barreira; VLM gate é a segunda; Storage RLS é a terceira.
 *
 * Threat model T-04-03-03 (DoS visual): handler usa e.dataTransfer.files[0]
 * apenas — drop de pasta inteira ou múltiplos arquivos é silenciosamente
 * truncado para o primeiro. UX consistente com wizard sequencial (D-05).
 *
 * Threat model T-04-03-04 (Tampering a11y): suporte de teclado (Enter/Space)
 * + aria-disabled refletindo estado disabled.
 */
export function UploadDropzone({
  onFileAccepted,
  disabled,
  slotLabel,
}: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setIsDragOver(true)
  }
  const handleDragLeave = () => setIsDragOver(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file) onFileAccepted(file)
  }
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Permite re-selecionar o mesmo arquivo após Refazer (sem isso, o segundo
    // change não dispara para o mesmo path).
    e.target.value = ''
    if (file) onFileAccepted(file)
  }
  const handleContainerClick = () => {
    if (!disabled) inputRef.current?.click()
  }
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      inputRef.current?.click()
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleContainerClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        isDragOver
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/30 hover:border-muted-foreground/60',
        disabled && 'pointer-events-none opacity-50',
      )}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={`Área de upload${slotLabel ? ` — ${slotLabel}` : ''}`}
      data-dragover={isDragOver ? 'true' : 'false'}
    >
      <Upload className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <div className="text-center space-y-1">
        {slotLabel && <p className="text-sm font-medium">{slotLabel}</p>}
        <p className="text-sm text-muted-foreground">
          Arraste e solte ou{' '}
          <span className="text-primary underline">selecione arquivo</span>
        </p>
        <p className="text-xs text-muted-foreground/70">
          JPEG · PNG · WebP · HEIC — máx. 25 MB
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
        // Evita que o click no input dispare o handler do container (que faria
        // inputRef.current?.click() de novo, abrindo o picker em loop).
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
