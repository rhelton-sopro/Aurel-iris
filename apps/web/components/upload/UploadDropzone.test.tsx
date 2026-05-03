import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UploadDropzone } from './UploadDropzone'

function makeFile(name = 'photo.jpg', type = 'image/jpeg', sizeBytes = 1024) {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

describe('UploadDropzone', () => {
  it('renders pt-BR drop instructions', () => {
    render(<UploadDropzone onFileAccepted={vi.fn()} />)
    expect(screen.getByText(/Arraste e solte/)).toBeInTheDocument()
    expect(screen.getByText(/selecione arquivo/)).toBeInTheDocument()
  })

  it('renders the format hint footer', () => {
    render(<UploadDropzone onFileAccepted={vi.fn()} />)
    expect(
      screen.getByText(/JPEG · PNG · WebP · HEIC — máx\. 25 MB/),
    ).toBeInTheDocument()
  })

  it('renders slotLabel when provided', () => {
    render(
      <UploadDropzone
        onFileAccepted={vi.fn()}
        slotLabel="Foto 1 de 6 — Olho ESQUERDO"
      />,
    )
    expect(screen.getByText(/Foto 1 de 6/)).toBeInTheDocument()
  })

  it('calls onFileAccepted when a file is dropped', () => {
    const onFileAccepted = vi.fn()
    const { container } = render(
      <UploadDropzone onFileAccepted={onFileAccepted} />,
    )
    const dropzone = container.querySelector('[role="button"]') as HTMLElement
    const file = makeFile()
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })
    expect(onFileAccepted).toHaveBeenCalledWith(file)
  })

  it('calls onFileAccepted when a file is chosen via input', () => {
    const onFileAccepted = vi.fn()
    const { container } = render(
      <UploadDropzone onFileAccepted={onFileAccepted} />,
    )
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    const file = makeFile()
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    fireEvent.change(input)
    expect(onFileAccepted).toHaveBeenCalledWith(file)
  })

  it('updates data-dragover attribute on dragOver / dragLeave', () => {
    const { container } = render(<UploadDropzone onFileAccepted={vi.fn()} />)
    const dropzone = container.querySelector('[role="button"]') as HTMLElement
    expect(dropzone.dataset.dragover).toBe('false')
    fireEvent.dragOver(dropzone)
    expect(dropzone.dataset.dragover).toBe('true')
    fireEvent.dragLeave(dropzone)
    expect(dropzone.dataset.dragover).toBe('false')
  })

  it('does NOT call onFileAccepted when disabled and file is dropped', () => {
    const onFileAccepted = vi.fn()
    const { container } = render(
      <UploadDropzone onFileAccepted={onFileAccepted} disabled />,
    )
    const dropzone = container.querySelector('[role="button"]') as HTMLElement
    fireEvent.drop(dropzone, { dataTransfer: { files: [makeFile()] } })
    expect(onFileAccepted).not.toHaveBeenCalled()
  })

  it('sets aria-disabled when disabled', () => {
    const { container } = render(
      <UploadDropzone onFileAccepted={vi.fn()} disabled />,
    )
    const dropzone = container.querySelector('[role="button"]') as HTMLElement
    expect(dropzone.getAttribute('aria-disabled')).toBe('true')
  })

  it('input file accept attribute includes HEIC MIMEs and extensions', () => {
    const { container } = render(<UploadDropzone onFileAccepted={vi.fn()} />)
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    const accept = input.getAttribute('accept') ?? ''
    expect(accept).toContain('image/heic')
    expect(accept).toContain('image/heif')
    expect(accept).toContain('image/jpeg')
    expect(accept).toContain('image/png')
    expect(accept).toContain('image/webp')
    expect(accept).toContain('.heic')
    expect(accept).toContain('.heif')
  })

  it('does not update dragover state when disabled', () => {
    const { container } = render(
      <UploadDropzone onFileAccepted={vi.fn()} disabled />,
    )
    const dropzone = container.querySelector('[role="button"]') as HTMLElement
    fireEvent.dragOver(dropzone)
    expect(dropzone.dataset.dragover).toBe('false')
  })
})
