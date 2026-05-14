import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom não implementa ImageData (necessário para testes de lib/capture)
if (typeof globalThis.ImageData === 'undefined') {
  class ImageDataMock {
    data: Uint8ClampedArray
    width: number
    height: number
    colorSpace: PredefinedColorSpace = 'srgb'
    constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
      if (typeof dataOrWidth === 'number') {
        // ImageData(width, height)
        this.width = dataOrWidth
        this.height = widthOrHeight
        this.data = new Uint8ClampedArray(dataOrWidth * widthOrHeight * 4)
      } else {
        // ImageData(data, width, height?)
        this.data = dataOrWidth
        this.width = widthOrHeight
        this.height = height ?? dataOrWidth.length / (widthOrHeight * 4)
      }
    }
  }
  globalThis.ImageData = ImageDataMock as unknown as typeof ImageData
}

// jsdom não implementa matchMedia (usado por hooks/use-mobile)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// jsdom não implementa ResizeObserver
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

// jsdom não implementa PointerEvent — base-ui Checkbox/Select onClick handlers
// invocam `new PointerEvent('click', {...})` em jsdom (sem isso o handler
// lança ReferenceError silenciosamente e os onCheckedChange/onValueChange
// callbacks nunca disparam). Fallback para MouseEvent que tem o subset
// necessário (pointerType, pointerId default undefined).
if (typeof globalThis.PointerEvent === 'undefined') {
  // Cast: MouseEvent satisfies the subset of PointerEvent that base-ui touches
  // in jsdom (type + button + currentTarget). pointerType, pressure, tangentialPressure
  // are read-only undefined on MouseEvent which is acceptable for click semantics.
  globalThis.PointerEvent =
    globalThis.MouseEvent as unknown as typeof PointerEvent
}
