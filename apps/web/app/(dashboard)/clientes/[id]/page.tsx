import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { resolveClientGate } from '@/lib/gates/client-gates'
import { UnderageBlockPanel } from '@/components/clientes/underage-block-panel'
import { ReadingsListManager } from '@/components/readings/readings-list-manager'
import { FichaClienteActions } from '@/components/clientes/FichaClienteActions'
import { LocalDateTime } from '@/components/ui/local-date-time'

/**
 * A lista deve refletir leituras criadas neste mesmo request (ex.: terapeuta
 * acabou de finalizar captura e voltou pra ficha do cliente). Sem
 * `force-dynamic` o RSC cache pode servir uma versão pré-captura.
 */
export const dynamic = 'force-dynamic'

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (!client || error) {
    notFound()
  }

  const gate = resolveClientGate(client)
  if (gate.status === 'incomplete') {
    redirect(gate.completionPath)
  }
  if (gate.status === 'blocked_underage') {
    return (
      <UnderageBlockPanel
        clientId={client.id}
        fullName={client.full_name}
        birthDate={gate.birthDate}
      />
    )
  }

  // Ponteiro corrente do consentimento (clients.consent_last_at) — mesma fonte
  // que o gate de criação de leitura consulta.
  const termoAssinadoEm =
    (client as { consent_last_at?: string | null }).consent_last_at ?? null

  const { data: readings } = await supabase
    .from('readings')
    .select(`
      id,
      status,
      created_at,
      vision_features,
      report_generated,
      is_delivered,
      reading_images(count)
    `)
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })

  // Quais leituras deste cliente têm MAPA DO SER (2026-07-30) — mesma razão da
  // lista global: sem isto, leitura nova aparece como "sem relatório". Coluna da
  // migration 0051, ainda fora dos tipos gerados.
  const { data: mapas } = await supabase
    .from('readings')
    .select('id, report_emocional_generated_at' as never)
    .eq('client_id', client.id)
    .not('report_emocional_generated_at' as never, 'is', null)
  const comMapa = new Set(
    ((mapas ?? []) as unknown as Array<{ id: string }>).map((m) => m.id),
  )

  const list = (readings ?? []).map((r) => ({ ...r, temMapa: comMapa.has(r.id) }))

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{client.full_name}</h1>
        {/* D-03: "Convidar" existia em /clientes e /leituras e sumia justamente
            DENTRO da ficha — onde ele está olhando ESTE cliente e decidindo o
            que fazer. Tinha que voltar pra lista pra convidar. */}
        <div className="flex flex-wrap items-center gap-2">
          <FichaClienteActions
            client={{ id: client.id, full_name: client.full_name }}
          />
          <Link href={`/clientes/${client.id}/editar`} className={cn(buttonVariants({ variant: 'outline' }))}>
            Editar cliente
          </Link>
        </div>
      </div>

      {/* ⚠️ Esta ficha JÁ buscava e-mail e telefone do banco (o select é `*`) e
          jogava os dois fora, mostrando só nascimento e notas — pra ver o
          WhatsApp do cliente o terapeuta tinha que entrar em "editar". Mesmo
          caso da tela de terapeutas corrigida em 843fef2. */}
      <div className="space-y-2 text-sm">
        {client.birth_date && (
          <p>
            <span className="font-medium">Nascimento:</span>{' '}
            {format(new Date(client.birth_date + 'T00:00:00'), 'dd/MM/yyyy')}
          </p>
        )}
        {client.email && (
          <p>
            <span className="font-medium">E-mail:</span>{' '}
            <a href={`mailto:${client.email}`} className="underline">
              {client.email}
            </a>
          </p>
        )}
        {client.phone && (
          <p>
            <span className="font-medium">WhatsApp:</span>{' '}
            <a
              href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {client.phone}
            </a>
          </p>
        )}
        {client.notes && (
          <p>
            <span className="font-medium">Notas:</span>{' '}
            <span className="text-muted-foreground whitespace-pre-wrap">{client.notes}</span>
          </p>
        )}
      </div>

      {/* D-04: o terapeuta só descobria que faltava o termo sendo BLOQUEADO ao
          criar a leitura — e o bloqueio aparecia numa caixa vermelha de erro, a
          mesma cor de "deu problema", como se ele tivesse errado. Aqui o estado
          fica visível antes, e assinar vira um passo, não um erro. */}
      {termoAssinadoEm ? (
        <p className="text-sm text-muted-foreground">
          Termo de consentimento assinado em{' '}
          <LocalDateTime iso={termoAssinadoEm} />.
        </p>
      ) : (
        <div className="flex flex-col gap-3 rounded-md border border-amber-400 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-900">
            <strong>Falta o termo de consentimento.</strong> Antes da primeira
            leitura, {client.full_name.trim().split(/\s+/)[0]} precisa ler e
            aceitar — no seu aparelho ou pelo link de convite.
          </p>
          <Link
            href={`/clientes/${client.id}/termo`}
            className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}
          >
            Colher assinatura
          </Link>
        </div>
      )}

      <div className="space-y-3 pt-4 border-t">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Leituras</h2>
          {list.length > 0 && (
            <Link
              href={`/leituras/nova?cliente=${client.id}`}
              className={cn(buttonVariants({ size: 'sm' }))}
            >
              Nova Leitura
            </Link>
          )}
        </div>

        <ReadingsListManager
          readings={list}
          newReadingHref={`/leituras/nova?cliente=${client.id}`}
        />
      </div>
    </div>
  )
}
