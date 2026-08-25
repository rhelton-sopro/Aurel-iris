import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { cleanupStaleEmptyReadingsAction } from '@/app/actions/readings'
import { ReadingsListManager } from '@/components/readings/readings-list-manager'
import { LeiturasHeaderActions } from '@/components/readings/LeiturasHeaderActions'
import { LeiturasBusca } from '@/components/readings/LeiturasBusca'

/**
 * Página dinâmica: a lista deve refletir leituras criadas neste mesmo request
 * (cenário comum: usuário acabou de finalizar captura e navegou pra cá). Sem
 * `force-dynamic`, o RSC cache do Next.js pode servir uma versão pré-captura.
 */
export const dynamic = 'force-dynamic'

// Quantas leituras por página. 50 era o teto ANTES — só que sem paginação: quem
// passasse disso simplesmente não enxergava mais as antigas, e não havia busca
// pra chegar nelas por outro caminho.
const POR_PAGINA = 50

export default async function LeiturasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; p?: string }>
}) {
  // GC silencioso: apaga rascunhos com 0/6 fotos criados há > 1h.
  await cleanupStaleEmptyReadingsAction()

  const { q, p } = await searchParams
  const busca = (q ?? '').trim()
  const pagina = Math.max(1, Number.parseInt(p ?? '1', 10) || 1)
  const de = (pagina - 1) * POR_PAGINA

  const supabase = await createClient()

  // A busca é por NOME do cliente, então resolve-se em duas etapas: acha os
  // clientes que casam e filtra as leituras por eles. Sem isto não havia como
  // chegar numa leitura de dois meses atrás a não ser rolando.
  let idsDaBusca: string[] | null = null
  if (busca) {
    const { data: achados } = await supabase
      .from('clients')
      .select('id')
      .ilike('full_name', `%${busca}%`)
    idsDaBusca = (achados ?? []).map((c) => c.id)
  }

  let query = supabase
    .from('readings')
    .select(
      `
        id,
        status,
        created_at,
        vision_features,
        report_generated,
        is_delivered,
        images_purged_at,
        client:clients(id, full_name, is_self),
        reading_images(count)
      `,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(de, de + POR_PAGINA - 1)

  if (idsDaBusca !== null) {
    // Busca sem resultado: filtra por lista vazia em vez de ignorar o filtro —
    // senão "nome que não existe" devolveria a lista inteira.
    query = query.in('client_id', idsDaBusca.length ? idsDaBusca : ['-'])
  }

  const [{ data: readings, count: total }, { data: clients }] = await Promise.all([
    query,
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
  //
  // ⛔ Esta consulta tinha `.limit(200)` SEM ordem definida. Do terapeuta que
  // passasse de 200 leituras com Mapa do Ser em diante, as que ficassem de fora
  // do recorte arbitrário apareceriam como "Fotos apagadas" — ou seja, como
  // leitura morta que precisa ser refeita. Agora ela pergunta APENAS pelas
  // leituras que estão nesta página: o conjunto é exato por construção, e não
  // existe mais teto pra estourar.
  const idsDaPagina = (readings ?? []).map((r) => r.id)
  const { data: mapas } = idsDaPagina.length
    ? await supabase
        .from('readings')
        .select('id, report_emocional_generated_at' as never)
        .in('id', idsDaPagina)
        .not('report_emocional_generated_at' as never, 'is', null)
    : { data: [] }
  const comMapa = new Set(
    ((mapas ?? []) as unknown as Array<{ id: string }>).map((m) => m.id),
  )

  const list = (readings ?? []).map((r) => ({ ...r, temMapa: comMapa.has(r.id) }))
  const totalLeituras = total ?? list.length
  const totalPaginas = Math.max(1, Math.ceil(totalLeituras / POR_PAGINA))
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

      <LeiturasBusca valorInicial={busca} />

      <ReadingsListManager readings={list} showClient newReadingHref="/leituras/nova" />

      {totalPaginas > 1 && (
        <nav
          aria-label="Paginação das leituras"
          className="flex items-center justify-between gap-3 border-t pt-4 text-sm"
        >
          <span className="text-muted-foreground">
            Página {pagina} de {totalPaginas} · {totalLeituras}{' '}
            {totalLeituras === 1 ? 'leitura' : 'leituras'}
          </span>
          <div className="flex items-center gap-2">
            {pagina > 1 && (
              <Link
                href={`/leituras?${new URLSearchParams({ ...(busca ? { q: busca } : {}), p: String(pagina - 1) })}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                ← Anteriores
              </Link>
            )}
            {pagina < totalPaginas && (
              <Link
                href={`/leituras?${new URLSearchParams({ ...(busca ? { q: busca } : {}), p: String(pagina + 1) })}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                Mais antigas →
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  )
}
