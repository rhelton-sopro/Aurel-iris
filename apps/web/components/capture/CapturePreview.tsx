'use client'

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  type QualityLevel,
  levelFromScore,
  LEVEL_BG_CLASS,
  LEVEL_TEXT_CLASS,
  LEVEL_LABEL,
} from '@/lib/capture/quality-scoring'
import type { PostCaptureAnalysis } from '@/lib/capture/post-capture-analysis'
import { isBlockingRejection } from '@/lib/capture/validate-image'
import type { CaptureMode } from '@/lib/capture/sequence'

interface CapturePreviewProps {
  /** URL (object URL) do blob capturado */
  imageUrl: string
  qualityScore: number
  /** Reabre câmera nativa para nova captura no mesmo slot */
  onRedo: () => void
  /** Avança para o próximo slot */
  onConfirm: () => void
  /**
   * Resultado da análise pós-captura. Quando `hasAlert=true`, mostra os motivos
   * acima dos botões (não bloqueia — usuário ainda pode confirmar).
   */
  analysis?: PostCaptureAnalysis | null
  /**
   * Modo de captura. Quando 'upload', botão Refazer mostra "Trocar arquivo".
   * Default 'camera' preserva comportamento Fase 3.
   */
  mode?: CaptureMode
}

/**
 * Preview pós-captura no fluxo de input nativo.
 * Sem auto-timeout: o usuário sempre confirma ou refaz manualmente.
 *
 * Layout: imagem com letterbox, badge de qualidade no topo, painel inferior com:
 *  - alertas de qualidade (quando analysis.hasAlert)
 *  - dois botões de mesmo tamanho: "Refazer" (secundário neutro) + "Confirmar" (primário)
 */
export function CapturePreview({
  imageUrl,
  qualityScore,
  onRedo,
  onConfirm,
  analysis,
  mode,
}: CapturePreviewProps) {
  const level: QualityLevel = levelFromScore(qualityScore)
  // Mostra alerta também para quality=regular (warning informativo, sem block).
  const isRegularQuality = analysis?.vlmValidation?.quality === 'regular'
  const showAlert = analysis?.hasAlert === true || isRegularQuality

  // Reasons UI: motivo humano-legível baseado na razão retornada pelo VLM.
  const reasons: string[] = []
  if (analysis?.vlmInvalidAlert && analysis.vlmValidation) {
    const r = analysis.vlmValidation.reason
    const messages: Record<string, string> = {
      sem_olho: 'Foto não contém um olho — refaça apontando para o olho do paciente',
      dois_olhos: 'Apenas um olho por foto — refaça com close de um único olho',
      muito_longe: 'Rosto/olho muito distante — aproxime a câmera para um close apenas do olho',
      borrado: 'Foto borrada — refaça com a câmera mais firme',
      reflexo_total: 'Reflexo cobre a íris inteira — mude o ângulo da luz',
      olho_fechado: 'Olho fechado ou coberto — abra o olho completamente',
    }
    reasons.push(messages[r] ?? `Foto rejeitada: ${r}`)
  }
  // Mensagem específica pra qualidade 'regular'. Atualmente o único critério
  // do prompt é "reflexo parcial cobre 30-70% da íris". Se no futuro 'regular'
  // ganhar outros gatilhos, ampliar este branch.
  if (isRegularQuality) {
    reasons.push('Reflexo parcial atrapalha a leitura da íris — tente mudar o ângulo da luz')
  }

  // Bloqueio do Confirmar: sem_olho, olho_fechado e muito_longe são rejeições
  // "duras" — não faz sentido permitir avançar. borrado / reflexo_total são
  // warnings — usuário pode confirmar e seguir se entender que está
  // aceitável (decisão clínica do iridologista).
  const isBlocked = analysis?.vlmValidation
    ? isBlockingRejection(analysis.vlmValidation)
    : false

  return (
    <div
      role="dialog"
      aria-label="Preview da captura"
      aria-modal="true"
      className="absolute inset-0 z-40 bg-black flex items-center justify-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Foto capturada"
        className="max-w-full max-h-full object-contain"
      />

      <Badge
        variant="outline"
        className={`absolute top-[calc(env(safe-area-inset-top)+12px)] left-3 ${LEVEL_BG_CLASS[level]} ${LEVEL_TEXT_CLASS[level]} border-0`}
      >
        {LEVEL_LABEL[level]} · {Math.round(qualityScore * 100)}%
      </Badge>

      {/* Debug overlay — UAT 03. Mostra dados de validação pra diagnóstico
          em devices sem console (iPhone Chrome). Remove ou gate com ?debug=1
          quando estabilizar. */}
      {analysis && (
        <div className="absolute top-[calc(env(safe-area-inset-top)+12px)] right-3 max-w-[60%] bg-black/80 text-green-300 font-mono text-[10px] leading-tight px-2 py-1.5 rounded">
          <div>quality: {analysis.vlmValidation.quality}</div>
          <div>reason: {analysis.vlmValidation.reason}</div>
          <div>src: {analysis.vlmValidation.source}</div>
          {analysis.vlmValidation.error && (
            <div className="text-red-300">err: {analysis.vlmValidation.error.slice(0, 40)}</div>
          )}
          <div>cam={analysis.cameraDetection.kind}/{analysis.cameraDetection.source}</div>
          <div>img={analysis.imageWidth}×{analysis.imageHeight}</div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-[calc(env(safe-area-inset-bottom)+24px)] px-4">
        <div className="rounded-2xl bg-black/85 backdrop-blur-sm p-4 max-w-sm w-full">
          {showAlert && reasons.length > 0 && (
            <>
              <p
                className={`text-sm font-semibold mb-2 ${
                  isBlocked ? 'text-red-300' : 'text-white'
                }`}
              >
                {isBlocked ? 'Foto rejeitada — refaça' : 'Qualidade abaixo do ideal'}
              </p>
              <ul className="text-xs text-white/80 space-y-1 mb-4">
                {reasons.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
            </>
          )}

          {/* Dois botões de mesmo tamanho.
              "Refazer" secundário (reabre câmera). "Confirmar" primário (avança).
              Confirmar é DESABILITADO quando VLM rejeitou com razão dura
              (sem_olho ou olho_fechado) — não faz sentido aceitar foto sem olho. */}
          <div className="flex gap-2">
            <Button
              onClick={onRedo}
              variant="secondary"
              className="flex-1 h-11 text-sm font-semibold"
            >
              {mode === 'upload' ? 'Trocar arquivo' : 'Refazer'}
            </Button>
            <Button
              onClick={onConfirm}
              variant="default"
              disabled={isBlocked}
              aria-disabled={isBlocked}
              className="flex-1 h-11 text-sm font-semibold"
            >
              Confirmar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
