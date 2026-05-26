'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { Copy, Send, Loader2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { inviteTherapistAction } from '@/app/actions/admin-therapists'

interface InviteResult {
  actionLink: string
  userStatus: 'new_invited' | 'existing_magiclink'
  email: string
}

/**
 * Fase 11 plan 11-04 enabler. Founder gera link de cadastro pra copiar e
 * enviar via WhatsApp (hand-held protocol). Sistema NÃO envia e-mail
 * automático — controle total do founder sobre quando e como.
 */
export function InviteTherapistForm() {
  const [email, setEmail] = React.useState('')
  const [result, setResult] = React.useState<InviteResult | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    setCopied(false)
    startTransition(async () => {
      const res = await inviteTherapistAction(email)
      if (!res.ok || !res.actionLink || !res.userStatus || !res.email) {
        toast.error(res.error ?? 'Falha ao gerar link')
        return
      }
      setResult({
        actionLink: res.actionLink,
        userStatus: res.userStatus,
        email: res.email,
      })
      toast.success(
        res.userStatus === 'new_invited'
          ? 'Invite gerado — copie e envie'
          : 'Magic link gerado (e-mail já existe)',
      )
    })
  }

  function copyLink() {
    if (!result) return
    navigator.clipboard
      .writeText(result.actionLink)
      .then(() => {
        setCopied(true)
        toast.success('Link copiado')
        setTimeout(() => setCopied(false), 2500)
      })
      .catch(() => toast.error('Não consegui copiar — selecione manualmente'))
  }

  function clear() {
    setEmail('')
    setResult(null)
    setCopied(false)
  }

  return (
    <div className="rounded-md border bg-card p-4 space-y-3">
      <div>
        <h3 className="text-sm font-medium">Convidar terapeuta</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Gera link de cadastro pro terapeuta (ou magic link se o e-mail já
          existe). Sistema NÃO envia e-mail — você copia e envia via WhatsApp
          com mensagem pessoal.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="email@exemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          required
          className="max-w-xs flex-1"
        />
        <Button type="submit" disabled={pending || !email}>
          {pending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-1 h-4 w-4" />
          )}
          Gerar link
        </Button>
        {result && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            disabled={pending}
            aria-label="Limpar"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </form>

      {result && (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            {result.userStatus === 'new_invited' ? (
              <>
                ✅ Novo convite pra <span className="font-mono">{result.email}</span>{' '}
                — terapeuta clica, confirma e cria conta:
              </>
            ) : (
              <>
                ↻ <span className="font-mono">{result.email}</span> já existe —
                magic link de 1× uso pra re-entrada:
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              value={result.actionLink}
              readOnly
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="font-mono text-xs flex-1 min-w-0"
            />
            <Button type="button" variant="outline" size="sm" onClick={copyLink}>
              {copied ? (
                <Check className="mr-1 h-4 w-4" />
              ) : (
                <Copy className="mr-1 h-4 w-4" />
              )}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/80">
            Link expira em ~1h (padrão Supabase). Gere outro se precisar.
          </p>
        </div>
      )}
    </div>
  )
}
