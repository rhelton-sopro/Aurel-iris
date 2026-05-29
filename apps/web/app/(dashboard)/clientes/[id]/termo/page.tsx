import { notFound } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { TermoConsultorioClient } from './termo-consultorio-client'

/**
 * /clientes/[id]/termo — assinatura do termo biométrico no fluxo de CONSULTÓRIO
 * (office_handoff): o cliente lê e aceita no aparelho do TERAPEUTA, antes da
 * primeira leitura. É o destino do CTA quando createReadingAction bloqueia por
 * termo ausente (readings.ts).
 *
 * Consentimento a nível de CLIENTE (sem reading_id ainda — o gate roda antes do
 * INSERT reading). Ao assinar: gera PDF + registra client_consents + atualiza
 * clients.consent_last_at + envia CÓPIA ao e-mail do cliente (LGPD art. 9).
 *
 * RLS de clients garante que o terapeuta só vê os próprios clientes.
 */
export const dynamic = 'force-dynamic'

export default async function TermoConsultorioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: client, error } = await supabase
    .from('clients')
    .select('id, full_name, consent_last_at')
    .eq('id', id)
    .single()

  if (!client || error) notFound()

  const consentLastAt = (client as { consent_last_at?: string | null }).consent_last_at ?? null

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">
          Termo de consentimento — {client.full_name}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Antes da primeira leitura, o cliente precisa ler e aceitar o termo de
          consentimento para tratamento de dados biométricos. <strong>Entregue o
          aparelho ao cliente</strong> para que ele mesmo confirme — a aceitação
          é uma ação afirmativa do titular.
        </p>
        {consentLastAt ? (
          <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground/80">
            Este cliente já assinou em{' '}
            <strong>
              {new Date(consentLastAt).toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
              })}
            </strong>
            . Reassine apenas se necessário.
          </p>
        ) : null}
      </div>

      <TermoConsultorioClient clientId={client.id} clienteNome={client.full_name} />
    </div>
  )
}
