'use client'

// Formulário de composição (escrever / responder / encaminhar) — modal sobre a
// inbox. Editor com formatação básica (negrito/itálico/sublinhado/link) via
// contenteditable; envia html + text (fallback) por SMTP.
//
// Dois modos de envio, escolhidos pelo que está preenchido:
//  · um destinatário só            -> envio único (mantém o encadeamento da resposta)
//  · terapeutas na caixinha, ou    -> UM e-mail separado por pessoa, com {nome}
//    vários endereços no "Para"

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { sendEmailAction, sendBulkEmailAction, type TherapistRecipient } from './actions'
import { parseEnderecos } from '@/lib/email/enderecos'
import { RecipientPicker } from './RecipientPicker'

export interface ComposeInitial {
  title: string // "Escrever" | "Responder" | "Encaminhar"
  to: string
  subject: string
  text: string
  inReplyTo?: string | null
  references?: string | null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
function textToHtml(s: string): string {
  return escapeHtml(s).replace(/\n/g, '<br>')
}

// ⚠️ Tem que casar com `personalize()` no smtp-client. Se uma mudar e a outra
// não, o aviso da tela deixa de valer e o {nome} sai vazio no e-mail de verdade.
// Coberto por ComposeForm.test.tsx.
const MARCA_NOME = /\{\{?\s*nome\s*\}?\}/i

export function ComposeForm({
  initial,
  onClose,
}: {
  initial: ComposeInitial
  onClose: () => void
}) {
  const router = useRouter()
  const [to, setTo] = useState(initial.to)
  const [subject, setSubject] = useState(initial.subject)
  const editorRef = useRef<HTMLDivElement>(null)
  const [isPending, start] = useTransition()
  const [escolhidos, setEscolhidos] = useState<TherapistRecipient[]>([])
  const [pickerAberto, setPickerAberto] = useState(false)
  const semNome = escolhidos.filter((t) => !t.name.trim())
  // O campo "Para" aceita VÁRIOS endereços separados por ; ou , (25/08). A
  // mesma função decide o aviso da tela e o envio no servidor.
  const avulsos = useMemo(() => parseEnderecos(to), [to])
  const totalDestinatarios = escolhidos.length + avulsos.validos.length
  // Endereço avulso não tem cadastro, logo não tem nome: com {nome} no texto,
  // sairia "Olá, ." para essa pessoa.
  const semNomeTotal = semNome.length + avulsos.validos.length
  const emMassa = escolhidos.length > 0 || avulsos.validos.length > 1

  // ⛔⛔ NÃO devolver `dangerouslySetInnerHTML` para o editor. (bug de 24/08: a
  // mensagem que o founder digitava sumia sozinha "ao clicar em outro lugar")
  //
  // No React 19 o diff de props compara `{__html: …}` por IDENTIDADE de objeto
  // (`next === prev` em `updateProperties`) e, quando difere, executa
  // `domElement.innerHTML = value.__html` SEM comparar a string. O objeto
  // literal nasce novo a cada render, então TODO re-render reescrevia o editor
  // com o texto inicial e apagava o rascunho. Gatilhos reais: digitar em
  // "Para"/"Assunto" e a auto-atualização de 60s da inbox — daí o "às vezes".
  //
  // Agora o conteúdo é sempre do DOM: semeamos na montagem e só voltamos a
  // mexer se chegar um texto inicial DIFERENTE (responder/encaminhar outro
  // e-mail). Re-render, refresh e objeto novo com o mesmo texto não tocam nada.
  // Coberto por ComposeForm.test.tsx.
  const semeado = useRef<string | null>(null)
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const html = textToHtml(initial.text)
    if (semeado.current === html) return
    semeado.current = html
    el.innerHTML = html
  }, [initial.text])

  function exec(cmd: string, value?: string) {
    document.execCommand(cmd, false, value)
    editorRef.current?.focus()
  }
  function addLink() {
    const url = window.prompt('URL do link:')
    if (url) exec('createLink', url)
  }

  function send() {
    const html = editorRef.current?.innerHTML ?? ''
    const text = editorRef.current?.innerText ?? ''

    // Endereço mal digitado barra ANTES de sair qualquer mensagem — o disparo
    // inteiro não pode morrer no servidor por causa de uma vírgula solta.
    if (avulsos.invalidos.length) {
      toast.error(
        `Isto não é um endereço: ${avulsos.invalidos.join(', ')}. Separe os endereços por ponto e vírgula.`,
      )
      return
    }

    // ⚠️ Trava do {nome} sem nome: um "Olá, ." saindo para dezenas de pessoas
    // não tem desfazer. Só bloqueia quando as duas coisas se encontram.
    const usaMarcaDeNome = MARCA_NOME.test(text) || MARCA_NOME.test(subject)
    if (emMassa && usaMarcaDeNome && semNomeTotal) {
      toast.error(
        `${semNomeTotal} destinatário(s) sem nome cadastrado — o {nome} sairia vazio. Tire essas pessoas ou o {nome} do texto.`,
      )
      return
    }

    start(async () => {
      if (emMassa) {
        const r = await sendBulkEmailAction({
          therapistIds: escolhidos.map((t) => t.id),
          extraTo: to,
          subject,
          text,
          html,
        })
        if (r.sent > 0) {
          // Sucesso PARCIAL não pode passar por sucesso: quem falhou aparece
          // nomeado, e o formulário fica aberto para reenviar só a esses.
          if (r.failed.length) {
            toast.error(
              `Enviado para ${r.sent}, mas falhou para ${r.failed.length}: ${r.failed
                .map((f) => f.email)
                .join(', ')}`,
              { duration: 15000 },
            )
            return
          }
          toast.success(`Enviado para ${r.sent} pessoa(s), uma mensagem para cada.`)
          onClose()
          router.refresh()
        } else {
          toast.error(r.error ?? 'Falha ao enviar.')
        }
        return
      }

      const r = await sendEmailAction({
        to,
        subject,
        text,
        html,
        inReplyTo: initial.inReplyTo,
        references: initial.references,
      })
      if (r.ok) {
        toast.success('Email enviado.')
        onClose()
        router.refresh()
      } else {
        toast.error(r.error ?? 'Falha ao enviar.')
      }
    })
  }

  const inputCls =
    'w-full rounded-[2px] border border-border bg-card px-2 py-1.5 text-sm focus:border-teal-dark focus:outline-none'
  const toolBtn =
    'rounded-[2px] border border-border px-2 py-0.5 text-xs hover:bg-muted/40'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-[2px] border border-border bg-background p-5">
        <h3 className="text-lg font-semibold text-ink">{initial.title}</h3>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">
            Para (endereços avulsos — separe por ponto e vírgula)
          </label>
          <input
            type="text"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={isPending}
            placeholder="fulana@email.com; beltrano@email.com"
            className={inputCls}
          />
          {avulsos.invalidos.length ? (
            <p className="text-[11px] text-[#B23A2B]">
              ⚠️ isto não é um endereço: {avulsos.invalidos.join(', ')}
            </p>
          ) : null}
          {avulsos.validos.length > 1 ? (
            <p className="text-[11px] text-muted-foreground">
              {avulsos.validos.length} endereços — cada um recebe um e-mail separado.
            </p>
          ) : null}
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Terapeutas</label>
            <button
              type="button"
              onClick={() => setPickerAberto(true)}
              disabled={isPending}
              className="text-xs text-teal-dark underline hover:text-teal-dark/80 disabled:opacity-50"
            >
              👥 Escolher terapeutas
            </button>
          </div>
          {escolhidos.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum escolhido — vai só para o endereço acima.
            </p>
          ) : (
            <>
              <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                {escolhidos.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 rounded-[2px] border border-border bg-muted/40 px-1.5 py-0.5 text-xs"
                  >
                    {t.name || t.email}
                    <button
                      type="button"
                      onClick={() => setEscolhidos((prev) => prev.filter((x) => x.id !== t.id))}
                      disabled={isPending}
                      aria-label={`remover ${t.name || t.email}`}
                      className="text-muted-foreground hover:text-[#B23A2B] disabled:opacity-50"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                <b>{escolhidos.length} pessoa(s)</b> — cada uma recebe um e-mail separado.
                Escreva <code className="rounded-[2px] bg-muted/60 px-1">{'{nome}'}</code> para
                usar o primeiro nome de cada uma.
              </p>
              {semNome.length ? (
                <p className="text-[11px] text-[#B23A2B]">
                  ⚠️ {semNome.length} sem nome cadastrado — com {'{nome}'} no texto, o envio é
                  bloqueado.
                </p>
              ) : null}
            </>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Assunto</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={isPending}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Mensagem</label>
          <div className="flex gap-1">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')} className={`${toolBtn} font-bold`}>B</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')} className={`${toolBtn} italic`}>I</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('underline')} className={`${toolBtn} underline`}>U</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={addLink} className={toolBtn}>🔗 link</button>
          </div>
          <div
            ref={editorRef}
            contentEditable={!isPending}
            suppressContentEditableWarning
            className="min-h-40 max-h-80 overflow-y-auto rounded-[2px] border border-border bg-card px-2 py-1.5 text-sm focus:border-teal-dark focus:outline-none [&_a]:text-teal-dark [&_a]:underline"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Enviado de suporte@iriscodex.com ·{' '}
          {emMassa ? 'uma cópia do disparo fica em Enviados.' : 'cópia salva em Enviados.'}
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={send}
            disabled={isPending}
            aria-busy={isPending}
            className="bg-teal-dark text-white hover:bg-teal-dark/90"
          >
            {isPending
              ? 'Enviando…'
              : emMassa
                ? `Enviar para ${totalDestinatarios}`
                : 'Enviar'}
          </Button>
        </div>
      </div>
      {pickerAberto ? (
        <RecipientPicker
          jaEscolhidos={escolhidos}
          onConfirm={(lista) => {
            setEscolhidos(lista)
            setPickerAberto(false)
          }}
          onClose={() => setPickerAberto(false)}
        />
      ) : null}
    </div>
  )
}
