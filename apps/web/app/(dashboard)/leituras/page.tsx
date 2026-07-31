import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { cleanupStaleEmptyReadingsAction } from '@/app/actions/readings'
import { ReadingsListManager } from '@/components/readings/readings-list-manager'
import { LeiturasHeaderActions } from '@/components/readings/LeiturasHeaderActions'

/**
 * Página dinâmica: a lista deve refletir leituras criadas neste mesmo request
 * (cenário comum: usuário acabou de finalizar captura e navegou pra cá). Sem
 * `force-dynamic`, o RSC cache do Next.js pode servir uma versão pré-captura.
 */
export const dynamic = 'force-dynamic'

export default async function LeiturasPage() {
  // GC silencioso: apaga rascunhos com 0/6 fotos criados há > 1h.
  await cleanupStaleEmptyReadingsAction()

  const supabase = await createClient()

  const [{ data: readings }, { data: clients }] = await Promise.all([
    supabase
      .from('readings')
      .select(`
        id,
        status,
        created_at,
        vision_features,
        report_generated,
        is_delivered,
        images_purged_at,
        client:clients(id, full_name, is_self),
        reading_images(count)
      `)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('clients')
      .select('id, full_name')
      .order('full_name', { ascending: true }),
  ])

  // Quais destas leituras têm MAPA DO SER (2026-07-30). Query separada porque a
  // coluna é da migration 0051 e ainda não está em types/database.ts.
  //
  // ⚠️ Sem isto a lista fica gravemente errada: ela deriva "tem relatório" só de
  // `report_generated`, e a foto é purgada logo após a geração — então uma leitura
  // nova, recém-gerada com sucesso, apareceria como "Fotos apagadas" (leitura morta,
  // sem caminho a não ser refazer a captura). Exatamente o oposto do que aconteceu.
  const { data: mapas } = await supabase
    .from('readings')
    .select('id, report_emocional_generated_at' as never)
    .not('report_emocional_generated_at' as never, 'is', null)
    .limit(200)
  const comMapa = new Set(
    ((mapas ?? []) as unknown as Array<{ id: string }>).map((m) => m.id),
  )

  const list = (readings ?? []).map((r) => ({ ...r, temMapa: comMapa.has(r.id) }))
  const availableClients = (clients ?? []).map((c) => ({
    id: c.id,
    full_name: c.full_name,
  }))

  return (
    <div className="space-y-6">
      {/* Mobile: título + actions empilhados verticalmente. Desktop (sm+):
          row com space-between. Founder UAT 2026-05-22: "Nova leitura"
          saía do enquadramento em telas pequenas porque o flex row não
          quebrava — agora wrap em col abaixo de sm. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <h1 className="text-[22px] font-light uppercase tracking-display text-ink">Leituras</h1>
        <div className="flex flex-wrap items-center gap-2">
          <LeiturasHeaderActions availableClients={availableClients} />
          {list.length > 0 && (
            <Link href="/leituras/nova" className={cn(buttonVariants())}>
              Nova leitura
            </Link>
          )}
        </div>
      </div>

      <ReadingsListManager readings={list} showClient newReadingHref="/leituras/nova" />
    </div>
  )
}
