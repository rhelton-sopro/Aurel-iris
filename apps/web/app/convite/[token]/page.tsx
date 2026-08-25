import Link from 'next/link'
import { Camera, RotateCcw } from 'lucide-react'

import { OrdemDosOlhos } from '@/components/convite/OrdemDosOlhos'
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
    // Beco sem saída (2026-08-25): a tela dizia "peça outro link ao seu
    // terapeuta" e parava ali. Agora ela diz QUEM é o terapeuta e abre o
    // WhatsApp dele com o pedido já escrito — o cliente resolve sozinho, e o
    // terapeuta fica sabendo na hora em vez de nunca.
    let terapeuta: { nome: string; telefone: string | null } | null = null
    if (validation.status !== 'not_found') {
      const service = createServiceClient()
      const { data: prof } = await service
        .from('profiles')
        .select('full_name, phone')
        .eq('id', validation.therapist_id)
        .maybeSingle<{ full_name: string | null; phone: string | null }>()
      if (prof?.full_name) {
        terapeuta = { nome: prof.full_name, telefone: prof.phone }
      }
    }
    return <InvalidTokenPanel reason={validation.status} terapeuta={terapeuta} />
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
          {/* ⛔ NUNCA "paciente" — quem está aqui é CLIENTE do terapeuta, e a
              palavra é justamente o que separa este produto do vocabulário
              médico. Sem nome, cumprimenta sem substantivo nenhum. */}
          <h2 className="text-2xl font-semibold">
            {client?.full_name ? `Olá, ${client.full_name}!` : 'Olá!'}
          </h2>
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

        <OrdemDosOlhos />

        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 text-sm">
          <p className="font-medium">Para uma boa leitura:</p>
          <ul className="list-disc pl-5 space-y-1 text-foreground/80">
            <li>Tire as fotos com <strong>boa iluminação</strong>.</li>
            <li>Peça <strong>outra pessoa</strong> para fotografar você.</li>
          </ul>
        </div>

        {/* Aviso de prazo (furo corrigido 2026-06-29): por privacidade, as fotos
            são apagadas 24h após a captura (cron photo-ttl).
            2026-08-10 — o relógio passou a contar da ÚLTIMA FOTO, não de quando o
            cliente abre o link, então o texto mudou junto: dizer "depois que você
            começa" descreveria um prazo que não é mais o que o sistema aplica. E
            "após o envio" é o que o termo assinado promete, palavra por palavra. */}
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>
            <strong>Conclua as 6 fotos de uma vez.</strong> Por privacidade, as
            imagens são apagadas automaticamente{' '}
            <strong>24 horas depois que você envia a última foto</strong>. Se
            passar desse prazo, será preciso recomeçar a leitura.
          </p>
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

      {/* Também aqui: o cliente NOVO vai do cadastro direto pra captura e não
          passa pela tela de boas-vindas, onde este aviso aparece. Sem isto, o
          único caminho que ele veria é o rótulo foto a foto — que é justamente
          o que não estava bastando. */}
      <OrdemDosOlhos />

      <InviteRegistrationForm token={token} />
    </div>
  )
}

function InvalidTokenPanel({
  reason,
  terapeuta,
}: {
  reason: 'not_found' | 'expired' | 'already_used'
  terapeuta: { nome: string; telefone: string | null } | null
}) {
  const messages: Record<typeof reason, { title: string; body: string }> = {
    not_found: {
      title: 'Convite não encontrado',
      body: 'Verifique o link enviado pelo seu terapeuta. Se acabou de receber e o link não funciona, peça que ele gere um novo.',
    },
    expired: {
      title: 'Convite expirado',
      body: 'Este link de convite passou da validade de 7 dias. É preciso um link novo para fazer a leitura.',
    },
    already_used: {
      title: 'Convite já utilizado',
      body: 'Este convite é de uso único e já foi usado. Se precisa fazer uma nova leitura, é preciso um link novo.',
    },
  }
  const { title, body } = messages[reason]

  const pedido = `Olá${terapeuta ? `, ${terapeuta.nome.trim().split(/\s+/)[0]}` : ''}! O meu link da leitura da íris não está mais funcionando. Pode me mandar um novo?`
  const digitos = terapeuta?.telefone?.replace(/\D/g, '') ?? ''
  const waHref = digitos
    ? `https://wa.me/${digitos}?text=${encodeURIComponent(pedido)}`
    : null

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{body}</p>

      {terapeuta && (
        <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
          <p className="text-sm">
            Quem enviou este link foi{' '}
            <strong className="text-foreground">{terapeuta.nome}</strong>.
          </p>
          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-md bg-foreground py-3 text-center text-sm font-medium text-background hover:opacity-90"
            >
              Pedir um novo link no WhatsApp
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">
              Entre em contato com {terapeuta.nome.trim().split(/\s+/)[0]} para
              receber um novo link.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
