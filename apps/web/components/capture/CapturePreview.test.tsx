import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CapturePreview } from './CapturePreview'
import type { PostCaptureAnalysis } from '@/lib/capture/post-capture-analysis'

describe('CapturePreview', () => {
  it('renders the image and quality badge', () => {
    render(
      <CapturePreview imageUrl="blob:test" qualityScore={0.95} onRedo={vi.fn()} onConfirm={vi.fn()} />
    )
    expect(screen.getByAltText('Foto capturada')).toHaveAttribute('src', 'blob:test')
    expect(screen.getByText(/Excelente/)).toBeInTheDocument()
  })

  it('renders "Boa" badge for score 0.80', () => {
    render(
      <CapturePreview imageUrl="blob:test" qualityScore={0.80} onRedo={vi.fn()} onConfirm={vi.fn()} />
    )
    expect(screen.getByText(/Boa/)).toBeInTheDocument()
  })

  it('calls onRedo when "Refazer" is clicked', () => {
    const onRedo = vi.fn()
    render(
      <CapturePreview imageUrl="blob:test" qualityScore={0.85} onRedo={onRedo} onConfirm={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Refazer/ }))
    expect(onRedo).toHaveBeenCalled()
  })

  it('calls onConfirm when "Confirmar" is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <CapturePreview imageUrl="blob:test" qualityScore={0.85} onRedo={vi.fn()} onConfirm={onConfirm} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/ }))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('shows alert reasons when analysis flags issues', () => {
    const analysis: PostCaptureAnalysis = {
      laplacianVariance: 50,
      irisRadiusPx: 200,
      imageWidth: 3840,
      imageHeight: 2160,
      sharpnessThreshold: 200,
      sharpnessAlert: true,
      irisAlert: true,
      hasAlert: true,
    }
    render(
      <CapturePreview
        imageUrl="blob:test"
        qualityScore={0.50}
        analysis={analysis}
        onRedo={vi.fn()}
        onConfirm={vi.fn()}
      />
    )
    expect(screen.getByText(/Qualidade abaixo do ideal/)).toBeInTheDocument()
    expect(screen.getByText(/Imagem pouco nítida/)).toBeInTheDocument()
    expect(screen.getByText(/Íris pequena/)).toBeInTheDocument()
  })

  it('does not show alert when analysis has no issues', () => {
    const analysis: PostCaptureAnalysis = {
      laplacianVariance: 250,
      irisRadiusPx: 500,
      imageWidth: 3840,
      imageHeight: 2160,
      sharpnessThreshold: 200,
      sharpnessAlert: false,
      irisAlert: false,
      hasAlert: false,
    }
    render(
      <CapturePreview
        imageUrl="blob:test"
        qualityScore={0.85}
        analysis={analysis}
        onRedo={vi.fn()}
        onConfirm={vi.fn()}
      />
    )
    expect(screen.queryByText(/Qualidade abaixo do ideal/)).not.toBeInTheDocument()
  })
})
