import { describe, it, expect } from 'vitest'
import {
  validateUploadFile,
  ACCEPTED_MIME_TYPES,
  HEIC_MIME_TYPES,
} from './validate-file'

/**
 * Helper: cria um File com size customizado sem alocar bytes reais.
 * Necessário para testar boundary de 25 MB sem estourar memória do jsdom.
 */
function makeFile(opts: { type: string; name: string; size?: number }): File {
  const file = new File([new Uint8Array(8)], opts.name, { type: opts.type })
  if (opts.size !== undefined) {
    Object.defineProperty(file, 'size', { value: opts.size, writable: false })
  }
  return file
}

describe('validateUploadFile', () => {
  it('aceita File JPEG (1MB) sem flag de conversão', () => {
    const file = makeFile({ type: 'image/jpeg', name: 'photo.jpg', size: 1024 * 1024 })
    const result = validateUploadFile(file)
    expect(result).toEqual({ ok: true, needsHeicConversion: false })
  })

  it('aceita File PNG', () => {
    const file = makeFile({ type: 'image/png', name: 'photo.png', size: 1024 * 1024 })
    const result = validateUploadFile(file)
    expect(result.ok).toBe(true)
    expect(result.needsHeicConversion).toBe(false)
  })

  it('aceita File WebP', () => {
    const file = makeFile({ type: 'image/webp', name: 'photo.webp', size: 1024 * 1024 })
    const result = validateUploadFile(file)
    expect(result.ok).toBe(true)
    expect(result.needsHeicConversion).toBe(false)
  })

  it('aceita File HEIC com MIME image/heic e sinaliza needsHeicConversion=true', () => {
    const file = makeFile({ type: 'image/heic', name: 'photo.heic', size: 1024 * 1024 })
    const result = validateUploadFile(file)
    expect(result.ok).toBe(true)
    expect(result.needsHeicConversion).toBe(true)
  })

  it('aceita File HEIF com MIME image/heif e sinaliza needsHeicConversion=true', () => {
    const file = makeFile({ type: 'image/heif', name: 'photo.heif', size: 1024 * 1024 })
    const result = validateUploadFile(file)
    expect(result.ok).toBe(true)
    expect(result.needsHeicConversion).toBe(true)
  })

  it('aceita File com MIME vazio mas extensão .heic (fallback por extensão)', () => {
    const file = makeFile({ type: '', name: 'photo.heic', size: 1024 * 1024 })
    const result = validateUploadFile(file)
    expect(result.ok).toBe(true)
    expect(result.needsHeicConversion).toBe(true)
  })

  it('aceita File com extensão .HEIF case-insensitive', () => {
    const file = makeFile({ type: '', name: 'photo.HEIF', size: 1024 * 1024 })
    const result = validateUploadFile(file)
    expect(result.ok).toBe(true)
    expect(result.needsHeicConversion).toBe(true)
  })

  it('rejeita File GIF com mensagem pt-BR exata', () => {
    const file = makeFile({ type: 'image/gif', name: 'photo.gif', size: 1024 * 1024 })
    const result = validateUploadFile(file)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Formato não suportado. Use JPEG, PNG, WebP ou HEIC.')
  })

  it('rejeita File application/pdf', () => {
    const file = makeFile({ type: 'application/pdf', name: 'report.pdf', size: 1024 * 1024 })
    const result = validateUploadFile(file)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Formato não suportado')
  })

  it('rejeita File com size = 25 MB + 1 byte', () => {
    const file = makeFile({
      type: 'image/jpeg',
      name: 'huge.jpg',
      size: 25 * 1024 * 1024 + 1,
    })
    const result = validateUploadFile(file)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('máximo 25 MB')
  })

  it('aceita File com size exatamente 25 MB (limite inclusivo)', () => {
    const file = makeFile({
      type: 'image/jpeg',
      name: 'boundary.jpg',
      size: 25 * 1024 * 1024,
    })
    const result = validateUploadFile(file)
    expect(result.ok).toBe(true)
  })

  it('ACCEPTED_MIME_TYPES contém todos os 5 MIMEs esperados', () => {
    expect(ACCEPTED_MIME_TYPES.has('image/jpeg')).toBe(true)
    expect(ACCEPTED_MIME_TYPES.has('image/png')).toBe(true)
    expect(ACCEPTED_MIME_TYPES.has('image/webp')).toBe(true)
    expect(ACCEPTED_MIME_TYPES.has('image/heic')).toBe(true)
    expect(ACCEPTED_MIME_TYPES.has('image/heif')).toBe(true)
  })

  it('HEIC_MIME_TYPES contém apenas image/heic e image/heif', () => {
    expect(HEIC_MIME_TYPES.has('image/heic')).toBe(true)
    expect(HEIC_MIME_TYPES.has('image/heif')).toBe(true)
    expect(HEIC_MIME_TYPES.size).toBe(2)
  })
})
