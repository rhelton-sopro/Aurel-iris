import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { cleanupStaleEmptyReadingsAction } from '@/app/actions/readings'
import { ReadingsListManager } from '@/components/readings/readings-list-manager'

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

  const { data: readings } = await supabase
    .from('readings')
    .select(`
      id,
      status,
      created_at,
      vision_features,
      report_generated,
      is_delivered,
      client:clients(id, full_name, is_self),
      reading_images(count)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  const list = readings ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-light uppercase tracking-display text-ink">Leituras</h1>
        {list.length > 0 && (
          <Link href="/leituras/nova" className={cn(buttonVariants())}>
            Nova leitura
          </Link>
        )}
      </div>

      <ReadingsListManager readings={list} showClient newReadingHref="/leituras/nova" />
    </div>
  )
}
