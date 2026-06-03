import { notFound } from 'next/navigation'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { isFounderEmail } from '@/lib/auth/founder'
import { fetchTherapistsMap } from '@/lib/admin/reports'
import { fetchRegenCandidates } from '@/lib/admin/regen'
import { SECTION_TITLE_BY_NUMBER } from '@/lib/anthropic/types'

// Sempre fresco — reflete o estado de auditoria/foto do minuto.
export const dynamic = 'force-dynamic'

// Rótulos legíveis pras chaves obrigatórias que podem aparecer em `missing`.
const KEY_LABEL: Record<string, string> = {
  '0_em_poucas_palavras': '§0 Em poucas palavras',
  essence_phrase: 'Em uma palavra (essência)',
  encerramento_disclaimer: 'Encerramento',
}
function missingLabel(key: string): string {
  if (KEY_LABEL[key]) return KEY_LABEL[key]
  const n = key.split('_')[0]
  const title = (SECTION_TITLE_BY_NUMBER as Record<string, string>)[n ?? '']
  return title ? `§${n} ${title}` : key
}

export default async function AdminRegenerarPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>
}) {
  // Gate de founder (defense-in-depth; espelha admin/layout.tsx).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isFounderEmail(user.email)) {
    notFound()
  }

  const sp = await searchParams
  const showAll = sp.all === '1'

  const [therapists, candidates] = await Promise.all([
    fetchTherapistsMap(),
    fetchRegenCandidates({ all: showAll }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Regeneração</h2>
        <p className="text-sm text-muted-foreground">
          Relatórios cujo gate de auditoria apontou seções faltando. A foto da
          íris é <strong>retida</strong> nesses casos (até 24h) — você pode
          regenerar abrindo a leitura. Relatórios completos têm a foto apagada na
          geração.
        </p>
      </div>

      {/* toggle incompletos / todos */}
      <div className="flex items-center gap-2">
        <Link
          href="/admin/regenerar"
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            !showAll
              ? 'border-foreground bg-foreground text-background'
              : 'border-border bg-card hover:bg-muted/40'
          }`}
        >
          Incompletos
        </Link>
        <Link
          href="/admin/regenerar?all=1"
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            showAll
              ? 'border-foreground bg-foreground text-background'
              : 'border-border bg-card hover:bg-muted/40'
          }`}
        >
          Todos os gerados
        </Link>
      </div>

      {candidates.length === 0 ? (
        <p className="rounded-md border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {showAll
            ? 'Nenhum relatório gerado ainda.'
            : 'Nenhum relatório incompleto. 🎉 Todos passaram no gate de auditoria.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {candidates.map((c) => {
            const owned = c.therapist_id === user.id
            const therapist = therapists.get(c.therapist_id)
            const therapistLabel = owned
              ? 'Você (founder)'
              : (therapist?.full_name ?? therapist?.email ?? c.therapist_id.slice(0, 8))
            const photoGone = c.images_purged_at != null
            const incomplete = c.completeness != null && !c.completeness.complete

            return (
              <li
                key={c.id}
                className="rounded-md border bg-card px-4 py-3 text-sm"
                style={
                  incomplete
                    ? { borderColor: 'var(--destructive, #b91c1c)' }
                    : undefined
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">
                      {c.client_name ?? 'Cliente sem nome'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {therapistLabel} ·{' '}
                      {c.report_generated_at
                        ? new Date(c.report_generated_at).toLocaleString('pt-BR')
                        : '—'}
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground/70">
                      {c.id}
                    </div>

                    {/* veredito de completude */}
                    {c.completeness == null ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Sem auditoria de completude (relatório legado).
                      </p>
                    ) : incomplete ? (
                      <p className="mt-2 text-xs">
                        <span className="font-medium text-destructive">
                          Incompleto ({c.completeness.present_count}/
                          {c.completeness.required_count}).
                        </span>{' '}
                        Faltou:{' '}
                        <span className="text-foreground">
                          {c.completeness.missing.map(missingLabel).join(' · ')}
                        </span>
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Completo ({c.completeness.present_count}/
                        {c.completeness.required_count}).
                      </p>
                    )}

                    {/* status da foto */}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Foto da íris:{' '}
                      {photoGone ? (
                        <span>
                          apagada em{' '}
                          {new Date(c.images_purged_at as string).toLocaleString('pt-BR')}
                        </span>
                      ) : (
                        <span className="text-foreground">presente</span>
                      )}
                    </p>
                  </div>

                  {/* ação */}
                  <div className="shrink-0">
                    {owned ? (
                      photoGone ? (
                        <span className="text-xs text-muted-foreground">
                          foto já apagada — refaça com novas fotos
                        </span>
                      ) : (
                        <Link
                          href={`/leituras/${c.id}`}
                          className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
                        >
                          Abrir leitura →
                        </Link>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        leitura de outro terapeuta
                      </span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
