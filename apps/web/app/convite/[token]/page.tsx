import Link from 'next/link'

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

    return (
      <div className="mx-auto w-full max-w-md px-4 py-8 space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Olá, {client?.full_name ?? 'paciente'}!</h2>
          <p className="text-sm text-muted-foreground">
            Seu terapeuta enviou este link para você fazer uma leitura iridológica
            pelo próprio celular. Você vai tirar <strong>6 fotos</strong> dos seus
            olhos (3 de cada). O resultado vai direto para o seu terapeuta.
          </p>
        </div>

        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 text-sm">
          <p className="font-medium">Para uma boa leitura:</p>
          <ul className="list-disc pl-5 space-y-1 text-foreground/80">
            <li>Use a câmera <strong>traseira</strong> (não a frontal).</li>
            <li>Tire as fotos com <strong>boa iluminação</strong>.</li>
            <li>Peça <strong>outra pessoa</strong> para fotografar você.</li>
          </ul>
        </div>

        <Link
          href={`/convite/${token}/capturar?client=${validation.token.client_id}`}
          className="block w-full rounded-md bg-foreground py-3 text-center text-sm font-medium text-background hover:opacity-90"
        >
          Começar leitura
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
