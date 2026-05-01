import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CameraDeniedScreen } from './CameraDeniedScreen'

describe('CameraDeniedScreen', () => {
  it('renders NotAllowedError heading', () => {
    render(<CameraDeniedScreen errorType="NotAllowedError" onRetry={vi.fn()} />)
    expect(screen.getByText('Permissão da câmera negada')).toBeInTheDocument()
  })

  it('renders NotFoundError heading', () => {
    render(<CameraDeniedScreen errorType="NotFoundError" onRetry={vi.fn()} />)
    expect(screen.getByText('Câmera não disponível')).toBeInTheDocument()
  })

  it('renders unknown error fallback', () => {
    render(<CameraDeniedScreen errorType={null} onRetry={vi.fn()} />)
    expect(screen.getByText('Câmera não disponível')).toBeInTheDocument()
  })

  it('renders link to /leituras/nova/upload', () => {
    render(<CameraDeniedScreen errorType="NotAllowedError" onRetry={vi.fn()} />)
    const link = screen.getByText('Continuar via upload no computador')
    expect(link.closest('a')).toHaveAttribute('href', '/leituras/nova/upload')
  })

  it('renders retry button', () => {
    render(<CameraDeniedScreen errorType="NotAllowedError" onRetry={vi.fn()} />)
    expect(screen.getByText('Tentar novamente')).toBeInTheDocument()
  })
})
