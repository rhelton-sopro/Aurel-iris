import Link from 'next/link'
import { Camera, RotateCcw } from 'lucide-react'

import { validateToken } from '@/lib/invite/tokens'
import { createServiceClient } from '@/lib/supabase/service'
import { InviteRegistrationForm } from './InviteRegistrationForm'

export const dynamic = 'force-dynamic'

/**
 * Landing pública do convite. 3 estados possíveis:
 *  - token inválido/expirado/usado → mensagem clara, sem detalhes técnicos
 *  - token válido + client_id NULL → form de cadastro inline
 *  - token válido + client_id existente → tela de boas-vindas + botão
 *    "Começar leitura" que vai direto pra captura (skip cadastro)
 *
 * Tudo server-side. NÃO expõe therapist_id/client_id desnecessariamente
 * pra evitar leak via view source.
 */
export default async function InviteLandingPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const validation = await validateToken(token)

  if (validation.status !== 'ok') {
    return <InvalidTokenPanel reason={validation.status} />
  }

  // Cliente existente: busca nome para boas-vindas (service-role bypassa RLS).
  if (validation.token.client_id) {
    const service = createServiceClient()
    const { data: client } = await service
      .from('clients')
      .select('full_name')
      .eq('id', validation.token.client_id)
      .maybeSingle()

    // Resume detection: se token aponta pra reading em pending com 1-5
    // imagens, o cliente abandonou no meio (provável network drop). Mostra
    // copy de "continue de onde parou" em vez de "vai tirar 6 fotos do zero".
    // Reading.status='ready'/'analyzing' não retoma (já completou) — auto-
    // finalize do upload route OU finalize endpoint cobrem esse caso.
    let resumeProgress: { captured: number; remaining: number } | null = null
    if (validation.token.used_by_reading_id) {
      const { data: existing } = await service
        .from('readings')
        .select('status, reading_images(eye)')
        .eq('id', validation.token.used_by_reading_id)
        .maybeSingle()
      const captured = existing?.reading_images?.length ?? 0
      if (existing?.status === 'pending' && captured > 0 && captured < 6) {
        resumeProgress = { captured, remaining: 6 - captured }
      }
    }

    return (
      <div className="mx-auto w-full max-w-md px-4 py-8 space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Olá, {client?.full_name ?? 'paciente'}!</h2>
          {resumeProgress ? (
            <p className="text-sm text-muted-foreground">
              Você já enviou <strong>{resumeProgress.captured} de 6 fotos</strong>{' '}
              nesta leitura. Falta{resumeProgress.remaining === 1 ? '' : 'm'}{' '}
              <strong>
                {resumeProgress.remaining} foto{resumeProgress.remaining === 1 ? '' : 's'}
              </strong>{' '}
              pra concluir — vamos continuar de onde parou.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Seu terapeuta enviou este link para você fazer uma leitura iridológica
              pelo próprio celular. Você vai tirar <strong>6 fotos</strong> dos seus
              olhos (3 de cada). O resultado vai direto para o seu terapeuta.
            </p>
          )}
        </div>

        {/* Aviso de câmera traseira destacado — founder UAT 2026-05-22:
            cliente tirou com frontal apesar do aviso anterior. Mesmo
            tratamento alto-contraste do AngleInterstitial. */}
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border-2 border-red-700 bg-red-600 px-4 py-4 flex items-center gap-3 shadow-md"
        >
          <div className="relative flex-shrink-0">
            <Camera className="h-10 w-10 text-white" strokeWidth={2.5} />
            <RotateCcw
              className="absolute -bottom-1 -right-1 h-4 w-4 text-white bg-red-700 rounded-full p-0.5"
              strokeWidth={3}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-extrabold uppercase tracking-wide text-white leading-tight">
              Use a câmera traseira
            </span>
            <span className="text-xs text-white/90 leading-tight mt-0.5">
              NÃO a selfie/frontal. Peça outra pessoa para fotografar você.
            </span>
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 text-sm">
          <p className="font-medium">Para uma boa leitura:</p>
          <ul className="list-disc pl-5 space-y-1 text-foreground/80">
            <li>Tire as fotos com <strong>boa iluminação</strong>.</li>
            <li>Peça <strong>outra pessoa</strong> para fotografar você.</li>
          </ul>
        </div>

        <Link
          href={`/convite/${token}/capturar?client=${validation.token.client_id}`}
          className="block w-full rounded-md bg-foreground py-3 text-center text-sm font-medium text-background hover:opacity-90"
        >
          {resumeProgress ? 'Continuar leitura' : 'Começar leitura'}
        </Link>
      </div>
    )
  }

  // Cliente novo: form de cadastro inline.
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Bem-vinda(o) ao Iris Codex</h2>
        <p className="text-sm text-muted-foreground">
          Seu terapeuta enviou este link para você fazer uma leitura
          iridológica pelo próprio celular. Comece preenchendo seus dados —
          o resultado vai direto para o terapeuta.
        </p>
      </div>
      <InviteRegistrationForm token={token} />
    </div>
  )
}

function InvalidTokenPanel({
  reason,
}: {
  reason: 'not_found' | 'expired' | 'already_used'
}) {
  const messages: Record<typeof reason, { title: string; body: string }> = {
    not_found: {
      title: 'Convite não encontrado',
      body: 'Verifique o link enviado pelo seu terapeuta. Se acabou de receber e o link não funciona, peça que ele gere um novo.',
    },
    expired: {
      title: 'Convite expirado',
      body: 'Este link de convite passou da validade (7 dias). Peça ao seu terapeuta para gerar um novo.',
    },
    already_used: {
      title: 'Convite já utilizado',
      body: 'Este convite é de uso único e já foi usado. Se precisa fazer uma nova leitura, peça ao terapeuta para enviar um novo link.',
    },
  }
  const { title, body } = messages[reason]
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  )
}
