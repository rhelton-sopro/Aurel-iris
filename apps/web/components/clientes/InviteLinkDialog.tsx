'use client'

import { useState, useTransition } from 'react'
import { Copy, Check, Loader2, Link as LinkIcon } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createInviteTokenAction } from '@/app/actions/invites'
import { cn } from '@/lib/utils'

interface InviteLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Cliente alvo. Quando fornecido, o dialog gera direto convite vinculado
   * (modo "leitura nova de cliente existente" — skip cadastro inline na
   * captura). Quando undefined, o dialog mostra 2 opções: cliente novo
   * ou selecionar um existente.
   */
  client?: { id: string; full_name: string }
  /** Lista de clientes do terapeuta — usado quando client undefined. */
  availableClients?: Array<{ id: string; full_name: string }>
}

type Mode = 'new' | 'existing'

export function InviteLinkDialog({
  open,
  onOpenChange,
  client,
  availableClients = [],
}: InviteLinkDialogProps) {
  // Se client é fornecido, vai direto modo 'existing' com cliente pré-selecionado.
  const initialMode: Mode = client ? 'existing' : 'new'
  const [mode, setMode] = useState<Mode>(initialMode)
  const [selectedClientId, setSelectedClientId] = useState<string>(client?.id ?? '')
  const [generated, setGenerated] = useState<{ url: string; expires_at: string } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  // v2.9.0: toggle "avisar por email quando cliente terminar as fotos".
  // Default true (comportamento prévio). Persistido por TOKEN no banco
  // (migration 0034 — notify_on_capture_complete).
  const [notifyOnCapture, setNotifyOnCapture] = useState(true)

  function handleClose() {
    if (isPending) return
    setGenerated(null)
    setErrorMsg(null)
    setCopied(false)
    setMode(initialMode)
    setSelectedClientId(client?.id ?? '')
    setNotifyOnCapture(true)
    onOpenChange(false)
  }

  function handleGenerate() {
    setErrorMsg(null)
    const targetClientId =
      mode === 'existing' ? selectedClientId || null : null
    if (mode === 'existing' && !targetClientId) {
      setErrorMsg('Selecione um cliente.')
      return
    }
    startTransition(async () => {
      const res = await createInviteTokenAction(targetClientId, notifyOnCapture)
      if (res.error || !res.url) {
        setErrorMsg(res.error ?? 'Falha ao gerar convite.')
        return
      }
      setGenerated({ url: res.url, expires_at: res.expires_at ?? '' })
    })
  }

  async function handleCopy() {
    if (!generated) return
    try {
      await navigator.clipboard.writeText(generated.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // navigator.clipboard pode falhar em HTTP / sem permissão.
      // Fallback: input já está com select-all readonly, usuário copia manual.
    }
  }

  const expiresLabel = generated?.expires_at
    ? new Date(generated.expires_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convite para o cliente</DialogTitle>
          <DialogDescription>
            Link único que o cliente abre no próprio celular para fazer a
            leitura. A leitura é enviada para você. O link é de uso único e
            expira em 7 dias.
          </DialogDescription>
        </DialogHeader>

        {!generated ? (
          <div className="space-y-4">
            {!client && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de convite</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('new')}
                    className={cn(
                      'rounded-md border px-3 py-2 text-sm text-left transition-colors',
                      mode === 'new'
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-card hover:bg-muted/40',
                    )}
                  >
                    <div className="font-medium">Cliente novo</div>
                    <div className="text-xs opacity-80">
                      Cliente faz cadastro inline antes de fotografar.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('existing')}
                    className={cn(
                      'rounded-md border px-3 py-2 text-sm text-left transition-colors',
                      mode === 'existing'
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-card hover:bg-muted/40',
                    )}
                  >
                    <div className="font-medium">Cliente existente</div>
                    <div className="text-xs opacity-80">
                      Pula cadastro, vai direto fotografar.
                    </div>
                  </button>
                </div>
              </div>
            )}

            {mode === 'existing' && (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="invite-client-select">
                  Selecione o cliente
                </label>
                {client ? (
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm font-medium">
                    {client.full_name}
                  </div>
                ) : (
                  <select
                    id="invite-client-select"
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                  >
                    <option value="">— escolha um cliente —</option>
                    {availableClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="space-y-2 rounded-md border border-border bg-muted/20 px-3 py-2.5">
              <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={notifyOnCapture}
                  onChange={(e) => setNotifyOnCapture(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-teal-dark"
                  data-testid="invite-notify-on-capture"
                />
                <span className="font-medium leading-snug">
                  Avisar por e-mail quando o cliente terminar as 6 fotos
                </span>
              </label>
              <p className="pl-6.5 text-xs leading-relaxed text-muted-foreground">
                {notifyOnCapture
                  ? 'Você receberá um e-mail quando a captura chegar. Útil quando o cliente vai fotografar em outro momento — você fica sabendo na hora e pode acompanhar o relatório sendo gerado.'
                  : 'Sem aviso por e-mail. Boa opção quando a captura é feita em consultório presente, ou quando você prefere conferir no app sem notificações.'}
              </p>
            </div>

            {errorMsg && (
              <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMsg}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Link do convite
              </label>
              <div className="mt-1 flex gap-2">
                <Input
                  readOnly
                  value={generated.url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  aria-label="Copiar link"
                  title="Copiar link"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            {expiresLabel && (
              <p className="text-xs text-muted-foreground">
                Expira em <strong>{expiresLabel}</strong>. Uso único — após o
                cliente concluir a captura, o link deixa de funcionar.
              </p>
            )}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Olá! Aqui está o link para sua leitura iridológica: ${generated.url}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full')}
            >
              Compartilhar no WhatsApp
            </a>
          </div>
        )}

        <DialogFooter>
          {!generated ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button onClick={handleGenerate} disabled={isPending} aria-busy={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    Gerar link
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
