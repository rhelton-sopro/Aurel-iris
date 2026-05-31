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

  it('blocks Confirmar when VLM rejects with sem_olho (hard reject)', () => {
    const analysis: PostCaptureAnalysis = {
      imageWidth: 3840,
      imageHeight: 2160,
      vlmInvalidAlert: true,
      hasAlert: true,
      cameraDetection: { kind: 'rear', source: 'exif' },
      vlmValidation: { quality: 'ruim', reason: 'sem_olho', source: 'vlm' },
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
    expect(screen.getByText(/Foto rejeitada/)).toBeInTheDocument()
    expect(screen.getByText(/Foto não contém um olho/)).toBeInTheDocument()
    const confirmButton = screen.getByRole('button', { name: /Confirmar/ })
    expect(confirmButton).toBeDisabled()
  })

  it('blocks Confirmar when VLM rejects with dois_olhos (hard reject)', () => {
    const analysis: PostCaptureAnalysis = {
      imageWidth: 3840,
      imageHeight: 2160,
      vlmInvalidAlert: true,
      hasAlert: true,
      cameraDetection: { kind: 'rear', source: 'exif' },
      vlmValidation: { quality: 'ruim', reason: 'dois_olhos', source: 'vlm' },
    }
    render(
      <CapturePreview
        imageUrl="blob:test"
        qualityScore={0.20}
        analysis={analysis}
        onRedo={vi.fn()}
        onConfirm={vi.fn()}
      />
    )
    expect(screen.getByText(/Apenas um olho por foto/)).toBeInTheDocument()
    expect(screen.getByText(/Foto rejeitada/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirmar/ })).toBeDisabled()
  })

  it('blocks Confirmar when VLM rejects with olho_fechado (hard reject)', () => {
    const analysis: PostCaptureAnalysis = {
      imageWidth: 3840,
      imageHeight: 2160,
      vlmInvalidAlert: true,
      hasAlert: true,
      cameraDetection: { kind: 'rear', source: 'exif' },
      vlmValidation: { quality: 'ruim', reason: 'olho_fechado', source: 'vlm' },
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
    expect(screen.getByText(/Olho fechado ou coberto/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirmar/ })).toBeDisabled()
  })

  it('blocks Confirmar with muito_longe — founder 2026-05-31 (bloqueia TODA foto ruim)', () => {
    // 2026-05-31: founder mudou o gate — TODA foto quality='ruim' do VLM
    // bloqueia (isVlmRejection), não só os BLOCKING_REASONS. muito_longe (que
    // saiu dos blocking reasons em maio) voltava a vazar: terapeuta confirmava
    // e ENVIAVA foto ruim ("erro grave"). Agora qualquer 'ruim' exige refazer.
    const analysis: PostCaptureAnalysis = {
      imageWidth: 3840,
      imageHeight: 2160,
      vlmInvalidAlert: true,
      hasAlert: true,
      cameraDetection: { kind: 'rear', source: 'exif' },
      vlmValidation: { quality: 'ruim', reason: 'muito_longe', source: 'vlm' },
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
    expect(screen.getByText(/Rosto\/olho muito distante/)).toBeInTheDocument()
    expect(screen.getByText(/Foto rejeitada — refaça/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirmar/ })).toBeDisabled()
  })

  it('blocks Confirmar when VLM rejects with borrado (Phase 07.1.6 hard-block)', () => {
    // Phase 07.1.6 prep: borrado promovido de soft-warning a hard-block.
    // Fotos sem fibras contáveis destroem análise iridológica downstream.
    const analysis: PostCaptureAnalysis = {
      imageWidth: 3840,
      imageHeight: 2160,
      vlmInvalidAlert: true,
      hasAlert: true,
      cameraDetection: { kind: 'rear', source: 'exif' },
      vlmValidation: { quality: 'ruim', reason: 'borrado', source: 'vlm' },
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
    expect(screen.getByText(/Foto borrada/)).toBeInTheDocument()
    expect(screen.getByText(/Foto rejeitada/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirmar/ })).toBeDisabled()
  })

  it('allows Confirmar when VLM fallback (network failure)', () => {
    // Source='fallback' nunca é hard-block — não bloqueia o terapeuta por
    // falha de rede. valid:true também garante que não vira alert.
    const analysis: PostCaptureAnalysis = {
      imageWidth: 3840,
      imageHeight: 2160,
      vlmInvalidAlert: false,
      hasAlert: false,
      cameraDetection: { kind: 'rear', source: 'exif' },
      vlmValidation: { quality: 'boa', reason: 'olho_detectado', source: 'fallback', error: 'timeout' },
    }
    render(
      <CapturePreview
        imageUrl="blob:test"
        qualityScore={0.70}
        analysis={analysis}
        onRedo={vi.fn()}
        onConfirm={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /Confirmar/ })).not.toBeDisabled()
  })

  it('shows reflexo parcial message when quality is regular (no block)', () => {
    const analysis: PostCaptureAnalysis = {
      imageWidth: 3840,
      imageHeight: 2160,
      vlmInvalidAlert: false,
      hasAlert: false,
      cameraDetection: { kind: 'rear', source: 'exif' },
      vlmValidation: { quality: 'regular', reason: 'olho_detectado', source: 'vlm' },
    }
    render(
      <CapturePreview
        imageUrl="blob:test"
        qualityScore={0.55}
        analysis={analysis}
        onRedo={vi.fn()}
        onConfirm={vi.fn()}
      />
    )
    expect(screen.getByText(/Reflexo parcial atrapalha/)).toBeInTheDocument()
    expect(screen.getByText(/Qualidade abaixo do ideal/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirmar/ })).not.toBeDisabled()
  })

  it('does not show alert when analysis has no issues', () => {
    const analysis: PostCaptureAnalysis = {
      imageWidth: 3840,
      imageHeight: 2160,
      vlmInvalidAlert: false,
      hasAlert: false,
      cameraDetection: { kind: 'rear', source: 'exif' },
      vlmValidation: { quality: 'excelente', reason: 'olho_detectado', source: 'vlm' },
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

describe('CapturePreview mode prop (Fase 4)', () => {
  it('renders "Refazer" by default (mode omitted)', () => {
    render(
      <CapturePreview imageUrl="blob:test" qualityScore={0.85} onRedo={vi.fn()} onConfirm={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: 'Refazer' })).toBeInTheDocument()
  })

  it('renders "Trocar arquivo" when mode=upload', () => {
    render(
      <CapturePreview
        imageUrl="blob:test"
        qualityScore={0.85}
        onRedo={vi.fn()}
        onConfirm={vi.fn()}
        mode="upload"
      />
    )
    expect(screen.getByRole('button', { name: 'Trocar arquivo' })).toBeInTheDocument()
  })

  it('still calls onRedo when "Trocar arquivo" is clicked (mode=upload)', () => {
    const onRedo = vi.fn()
    render(
      <CapturePreview
        imageUrl="blob:test"
        qualityScore={0.85}
        onRedo={onRedo}
        onConfirm={vi.fn()}
        mode="upload"
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Trocar arquivo' }))
    expect(onRedo).toHaveBeenCalled()
  })
})
