'use client'

import * as React from 'react'
import { useTransition } from 'react'
import {
  Check,
  Pencil,
  MessageSquare,
  X,
  Undo2,
  CalendarClock,
  CheckCircle2,
  Clock,
  Layers,
  Play,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import type { SocialPost, ActionResult } from '@/lib/admin/social-posts'
import {
  approvePostAction,
  rejectPostAction,
  backToPendingAction,
  schedulePostAction,
  editCaptionAction,
  commentPostAction,
} from './actions'

type Mode = null | 'edit' | 'comment' | 'schedule'

export function PostCard({ post }: { post: SocialPost }) {
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = React.useState<Mode>(null)
  const [caption, setCaption] = React.useState(post.caption)
  const [comment, setComment] = React.useState(post.comment ?? '')
  const [when, setWhen] = React.useState('')

  function run(fn: () => Promise<ActionResult>, okMsg: string) {
    startTransition(async () => {
      const res = await fn()
      if (res.ok) {
        toast.success(okMsg)
        setMode(null)
      } else {
        toast.error(res.error ?? 'Falha na ação.')
      }
    })
  }

  const approved = post.status === 'aprovado'

  return (
    <article
      className={`grid overflow-hidden rounded-md border bg-card sm:grid-cols-[300px_1fr] ${
        approved ? 'border-[#3D9B8C]' : 'border-[#E7E1D5]'
      }`}
    >
      <Media post={post} />

      <div className="flex flex-col p-5">
        {/* meta */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {post.pilar && (
            <span className="rounded-sm border border-[#3D9B8C] bg-[#3D9B8C]/[0.06] px-2 py-1 text-[0.66rem] font-semibold text-[#1E6B61]">
              {post.pilar}
            </span>
          )}
          {post.tags.map((t) => (
            <span
              key={t}
              className="rounded-sm border border-[#D8D0BF] px-2 py-1 text-[0.66rem] font-semibold text-foreground"
            >
              {t}
            </span>
          ))}
          {post.suggested_slot && post.status === 'pendente' && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-[0.74rem] text-muted-foreground">
              <Clock className="h-3 w-3" /> sugerido: {post.suggested_slot}
            </span>
          )}
        </div>

        {/* legenda */}
        {mode === 'edit' ? (
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={6}
            className="w-full resize-y rounded-sm border border-[#D8D0BF] bg-background p-3 text-sm leading-relaxed outline-none focus:border-[#3D9B8C]"
          />
        ) : (
          <p className="whitespace-pre-line text-[0.99rem] leading-relaxed text-[#26241f]">
            {post.caption}
          </p>
        )}

        {/* por que este post */}
        {post.why && mode !== 'edit' && (
          <div className="mt-4 rounded-r-sm border-l-2 border-[#3D9B8C] bg-[#3D9B8C]/[0.045] px-3.5 py-2.5">
            <div className="mb-1 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[#1E6B61]">
              Por que este post
            </div>
            <p className="text-[0.82rem] leading-relaxed text-[#4a4740]">{post.why}</p>
          </div>
        )}

        {/* gerado por */}
        {post.generated_by.length > 0 && mode !== 'edit' && (
          <div className="mt-4 flex items-center gap-2 text-[0.72rem] text-muted-foreground">
            Gerado por
            <span className="flex gap-1">
              {post.generated_by.map((g) => (
                <span
                  key={g}
                  className="rounded-sm bg-[#F2EDE4] px-1.5 py-0.5 text-[0.66rem] font-semibold text-[#5a5650]"
                >
                  {g}
                </span>
              ))}
            </span>
          </div>
        )}

        {/* nota do founder */}
        {post.comment && mode === null && (
          <div className="mt-3 flex items-start gap-2 text-[0.78rem] text-muted-foreground">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 flex-none" />
            <span>
              <b className="text-foreground">Você:</b> {post.comment}
            </span>
          </div>
        )}

        {/* editor de comentário */}
        {mode === 'comment' && (
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Sua nota pro time…"
            className="mt-3 w-full resize-y rounded-sm border border-[#D8D0BF] bg-background p-3 text-sm outline-none focus:border-[#3D9B8C]"
          />
        )}

        {/* agendador */}
        {mode === 'schedule' && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="rounded-sm border border-[#D8D0BF] bg-background px-3 py-2 text-sm outline-none focus:border-[#3D9B8C]"
            />
          </div>
        )}

        {/* ações */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#E7E1D5] pt-4">
          <Actions
            post={post}
            mode={mode}
            setMode={setMode}
            isPending={isPending}
            onApprove={() => run(() => approvePostAction(post.id), 'Post aprovado.')}
            onReject={() => run(() => rejectPostAction(post.id), 'Post reprovado.')}
            onBack={() => run(() => backToPendingAction(post.id), 'Voltou pra pendentes.')}
            onSaveCaption={() =>
              run(() => editCaptionAction(post.id, caption), 'Legenda salva.')
            }
            onSaveComment={() =>
              run(() => commentPostAction(post.id, comment), 'Comentário salvo.')
            }
            onSaveSchedule={() => {
              if (!when) {
                toast.error('Escolha data e hora.')
                return
              }
              run(
                () => schedulePostAction(post.id, new Date(when).toISOString()),
                'Post agendado.',
              )
            }}
          />
        </div>
      </div>
    </article>
  )
}

/* ── mídia (carrossel / reel / post) ── */
function Media({ post }: { post: SocialPost }) {
  const m = post.media
  const [idx, setIdx] = React.useState(0)

  if (m && 'kind' in m && m.kind === 'carrossel' && m.slides.length > 0) {
    const n = m.slides.length
    return (
      <div className="relative border-b border-[#E7E1D5] bg-black sm:border-b-0 sm:border-r">
        <div className="relative aspect-square overflow-hidden sm:aspect-[4/5]">
          <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-sm bg-black/60 px-2 py-1 text-[0.66rem] font-semibold text-white backdrop-blur">
            <Layers className="h-3 w-3" /> Carrossel · {n}
          </span>
          <span className="absolute right-3 top-3 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[0.66rem] font-semibold text-white">
            {idx + 1}/{n}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.slides[idx]}
            alt={`slide ${idx + 1}`}
            className="h-full w-full object-cover"
          />
          {n > 1 && (
            <>
              <button
                type="button"
                aria-label="anterior"
                onClick={() => setIdx((i) => (i - 1 + n) % n)}
                className="absolute left-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/70"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="próximo"
                onClick={() => setIdx((i) => (i + 1) % n)}
                className="absolute right-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/70"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="absolute bottom-3 right-3 z-10 flex gap-1">
                {m.slides.map((_, k) => (
                  <span
                    key={k}
                    className={`h-1.5 w-1.5 rounded-full ${
                      k === idx ? 'bg-white' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  if (m && 'kind' in m && m.kind === 'reel') {
    return (
      <div className="relative border-b border-[#E7E1D5] bg-black sm:border-b-0 sm:border-r">
        <div className="relative aspect-square overflow-hidden sm:aspect-[4/5]">
          <span className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-sm bg-black/60 px-2 py-1 text-[0.66rem] font-semibold text-white backdrop-blur">
            <Play className="h-3 w-3" /> Reel{m.duration ? ` · ${m.duration}` : ''}
          </span>
          {m.video ? (
            <video
              src={m.video}
              poster={m.poster}
              controls
              preload="metadata"
              playsInline
              className="h-full w-full bg-black object-contain"
            />
          ) : (
            <>
              {m.poster && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.poster} alt="prévia do reel" className="h-full w-full object-cover" />
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/80 bg-black/40 backdrop-blur">
                  <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // post simples / sem mídia
  const single = m && 'kind' in m && m.kind === 'post' ? m.image : null
  return (
    <div className="relative flex aspect-square items-center justify-center border-b border-[#E7E1D5] bg-[#F2EDE4] text-xs text-muted-foreground sm:aspect-[4/5] sm:border-b-0 sm:border-r">
      {single ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={single} alt="post" className="h-full w-full object-cover" />
      ) : (
        'sem mídia'
      )}
    </div>
  )
}

/* ── ações por status ── */
function Actions({
  post,
  mode,
  setMode,
  isPending,
  onApprove,
  onReject,
  onBack,
  onSaveCaption,
  onSaveComment,
  onSaveSchedule,
}: {
  post: SocialPost
  mode: Mode
  setMode: (m: Mode) => void
  isPending: boolean
  onApprove: () => void
  onReject: () => void
  onBack: () => void
  onSaveCaption: () => void
  onSaveComment: () => void
  onSaveSchedule: () => void
}) {
  const spin = isPending && <Loader2 className="h-4 w-4 animate-spin" />

  // modo de edição inline → salvar/cancelar (vale pra qualquer status)
  if (mode === 'edit' || mode === 'comment' || mode === 'schedule') {
    const save =
      mode === 'edit' ? onSaveCaption : mode === 'comment' ? onSaveComment : onSaveSchedule
    return (
      <>
        <Btn primary onClick={save} disabled={isPending}>
          {spin || <Send className="h-4 w-4" />} Salvar
        </Btn>
        <Btn onClick={() => setMode(null)} disabled={isPending}>
          Cancelar
        </Btn>
      </>
    )
  }

  if (post.status === 'pendente') {
    return (
      <>
        <Btn approve onClick={onApprove} disabled={isPending}>
          {spin || <Check className="h-4 w-4" />} Aprovar
        </Btn>
        <Btn onClick={() => setMode('edit')} disabled={isPending}>
          <Pencil className="h-4 w-4" /> Editar
        </Btn>
        <Btn onClick={() => setMode('comment')} disabled={isPending}>
          <MessageSquare className="h-4 w-4" /> Comentar
        </Btn>
        <span className="ml-auto" />
        <Btn reject onClick={onReject} disabled={isPending}>
          <X className="h-4 w-4" /> Reprovar
        </Btn>
      </>
    )
  }

  if (post.status === 'aprovado') {
    return (
      <>
        <StatusBar icon={<CheckCircle2 className="h-4 w-4" />}>Aprovado</StatusBar>
        <span className="ml-auto" />
        <Btn onClick={() => setMode('schedule')} disabled={isPending}>
          <CalendarClock className="h-4 w-4" /> Agendar
        </Btn>
        <Btn onClick={() => setMode('edit')} disabled={isPending}>
          <Pencil className="h-4 w-4" /> Editar
        </Btn>
        <Btn onClick={onBack} disabled={isPending}>
          {spin || <Undo2 className="h-4 w-4" />} Voltar p/ pendente
        </Btn>
      </>
    )
  }

  if (post.status === 'agendado') {
    return (
      <>
        <StatusBar icon={<CalendarClock className="h-4 w-4" />}>
          Agendado
          {post.scheduled_at && (
            <span className="ml-1 font-medium text-muted-foreground">
              · {formatWhen(post.scheduled_at)}
            </span>
          )}
        </StatusBar>
        <span className="ml-auto" />
        <Btn onClick={onBack} disabled={isPending}>
          {spin || <Undo2 className="h-4 w-4" />} Voltar p/ pendente
        </Btn>
      </>
    )
  }

  if (post.status === 'publicado') {
    return (
      <StatusBar icon={<CheckCircle2 className="h-4 w-4" />}>Publicado</StatusBar>
    )
  }

  // reprovado
  return (
    <>
      <StatusBar icon={<X className="h-4 w-4" />}>Reprovado</StatusBar>
      <span className="ml-auto" />
      <Btn onClick={onBack} disabled={isPending}>
        {spin || <Undo2 className="h-4 w-4" />} Voltar p/ pendente
      </Btn>
    </>
  )
}

function Btn({
  children,
  onClick,
  disabled,
  primary,
  approve,
  reject,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  approve?: boolean
  reject?: boolean
}) {
  const base =
    'inline-flex items-center gap-2 rounded-sm border px-3.5 py-2.5 text-[0.88rem] font-semibold transition-colors disabled:opacity-50'
  const variant =
    approve || primary
      ? 'border-[#3D9B8C] bg-[#3D9B8C] text-[#042019] hover:bg-[#5BBFB0]'
      : reject
        ? 'border-[#D8D0BF] bg-white text-foreground hover:border-[#8C3B34] hover:text-[#8C3B34]'
        : 'border-[#D8D0BF] bg-white text-foreground hover:border-foreground'
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${variant}`}>
      {children}
    </button>
  )
}

function StatusBar({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[0.8rem] font-semibold text-[#1E6B61]">
      {icon}
      {children}
    </span>
  )
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
