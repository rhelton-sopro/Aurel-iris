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

  it('shows VLM rejection + sharpness when both alerts fire', () => {
    const analysis: PostCaptureAnalysis = {
      laplacianVariance: 50,
      imageWidth: 3840,
      imageHeight: 2160,
      sharpnessThreshold: 200,
      sharpnessAlert: true,
      vlmInvalidAlert: true,
      hasAlert: true,
      cameraDetection: { kind: 'rear', source: 'exif' },
      vlmValidation: { valid: false, reason: 'sem olho', source: 'vlm' },
    }
    render(
      <CapturePreview
        imageUrl="blob:test"
        qualityScore={0.30}
        analysis={analysis}
        onRedo={vi.fn()}
        onConfirm={vi.fn()}
      />
    )
    expect(screen.getByText(/Qualidade abaixo do ideal/)).toBeInTheDocument()
    expect(screen.getByText(/Imagem pouco nítida/)).toBeInTheDocument()
    expect(screen.getByText(/Foto não contém um olho/)).toBeInTheDocument()
  })

  it('shows VLM-specific reason when reason is "muito longe"', () => {
    const analysis: PostCaptureAnalysis = {
      laplacianVariance: 250,
      imageWidth: 3840,
      imageHeight: 2160,
      sharpnessThreshold: 200,
      sharpnessAlert: false,
      vlmInvalidAlert: true,
      hasAlert: true,
      cameraDetection: { kind: 'rear', source: 'exif' },
      vlmValidation: { valid: false, reason: 'muito longe', source: 'vlm' },
    }
    render(
      <CapturePreview
        imageUrl="blob:test"
        qualityScore={0.30}
        analysis={analysis}
        onRedo={vi.fn()}
        onConfirm={vi.fn()}
      />
    )
    expect(screen.getByText(/Olho muito distante/)).toBeInTheDocument()
  })

  it('does not show alert when analysis has no issues', () => {
    const analysis: PostCaptureAnalysis = {
      laplacianVariance: 250,
      imageWidth: 3840,
      imageHeight: 2160,
      sharpnessThreshold: 200,
      sharpnessAlert: false,
      vlmInvalidAlert: false,
      hasAlert: false,
      cameraDetection: { kind: 'rear', source: 'exif' },
      vlmValidation: { valid: true, reason: 'olho detectado', source: 'vlm' },
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
