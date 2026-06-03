import { Lock } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Aviso de privacidade da foto — exibido nas telas de CAPTURA (cliente via
 * convite, terapeuta no consultório, autoexame). Comunica o ciclo de vida da
 * íris: apagada na geração / em no máximo 24h, não armazenada, não treina IA.
 *
 * Reflete a política real (cron photo-ttl + purga na geração) e o term-v2.
 * Copy travada (Bob, sob a Nefertiti — voz brand-book "luxo silencioso").
 */
export function PhotoPrivacyNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-md border border-border/60 bg-muted/40 px-3.5 py-3 text-sm text-muted-foreground',
        className,
      )}
    >
      <Lock className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
      <p>
        <span className="font-medium text-foreground">
          A foto fica só o tempo da leitura.
        </span>{' '}
        Some assim que o relatório fica pronto — no máximo em 24 horas — e nunca
        treina nenhuma IA.
      </p>
    </div>
  )
}
