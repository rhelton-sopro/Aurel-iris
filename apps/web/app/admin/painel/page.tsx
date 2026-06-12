import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Sparkles, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isFounderEmail } from '@/lib/auth/founder'
import {
  STATUS_TABS,
  fetchPostsByStatus,
  fetchStatusCounts,
  isSocialPostStatus,
  type SocialPostStatus,
} from '@/lib/admin/social-posts'
import { PostCard } from './PostCard'

// Fila de aprovação de conteúdo (Instagram). v1 funcional — Migration 0045.
// Substitui o mockup estático (o rewrite em next.config.ts foi removido).

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ status?: string }>

export default async function PainelConteudoPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  // Defense-in-depth founder gate (middleware + layout já bloqueiam).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isFounderEmail(user.email)) {
    notFound()
  }

  const sp = await searchParams
  const active: SocialPostStatus = isSocialPostStatus(sp.status)
    ? sp.status
    : 'pendente'

  const [counts, posts] = await Promise.all([
    fetchStatusCounts(),
    fetchPostsByStatus(active),
  ])

  return (
    <div className="space-y-7">
      {/* topline */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 text-[0.64rem] font-bold uppercase tracking-[0.25em] text-[#1E6B61]">
            Marketing · Instagram
          </div>
          <h1
            className="text-4xl leading-none text-foreground"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 400 }}
          >
            Conteúdo
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            O time monta os posts. Você aprova. (Fase 2: aprovou → publica no Instagram.)
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Auto-geração do time — Fase 2"
          className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-sm border border-transparent bg-[#3D9B8C]/40 px-4 py-3 text-sm font-semibold text-[#042019]/70"
        >
          <Sparkles className="h-4 w-4" /> Pedir novos posts ao time
        </button>
      </div>

      {/* faixa de estratégia */}
      <div className="flex flex-col overflow-hidden rounded-md border border-[#E7E1D5] bg-card sm:flex-row sm:items-center">
        <StripSeg k="Pilar da semana" v="Conduzir a devolutiva" teal />
        <StripSeg k="Público" v="Terapeutas · B2B" />
        <StripSeg k="Cadência" v="3 posts / semana" />
        <div className="px-4 py-3 sm:ml-auto">
          <span className="inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-[#1E6B61]">
            Estratégia: o norte da Nefertiti <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>

      {/* abas por status */}
      <div className="flex gap-1 overflow-x-auto border-b border-[#E7E1D5]">
        {STATUS_TABS.map((t) => {
          const on = t.status === active
          return (
            <Link
              key={t.status}
              href={`/admin/painel?status=${t.status}`}
              className={`-mb-px flex flex-none items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                on
                  ? 'border-[#3D9B8C] text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              <span
                className={`rounded-sm px-1.5 py-0.5 text-[0.66rem] font-bold ${
                  on ? 'bg-[#3D9B8C] text-[#042019]' : 'bg-[#F2EDE4] text-foreground'
                }`}
              >
                {counts[t.status]}
              </span>
            </Link>
          )
        })}
      </div>

      {/* feed */}
      {posts.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#D8D0BF] bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Nada em <b className="text-foreground">{statusLabel(active)}</b> por aqui.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  )
}

function StripSeg({ k, v, teal }: { k: string; v: string; teal?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-[#E7E1D5] px-4 py-3 sm:border-b-0 sm:border-r">
      <span className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {k}
      </span>
      <span className={`text-sm font-semibold ${teal ? 'text-[#1E6B61]' : 'text-foreground'}`}>
        {v}
      </span>
    </div>
  )
}

function statusLabel(s: SocialPostStatus): string {
  return STATUS_TABS.find((t) => t.status === s)?.label ?? s
}
