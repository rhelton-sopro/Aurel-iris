'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Link as LinkIcon } from 'lucide-react'

import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { InviteLinkDialog } from '@/components/clientes/InviteLinkDialog'

/**
 * Ações do estado "fotos apagadas" (leitura cujas imagens foram purgadas pelo
 * TTL 24h antes de gerar o relatório). O caminho de refazer DEPENDE de como a
 * captura original foi feita:
 *
 *  - Cliente remoto (link de convite, caso comum): a ação certa é GERAR UM NOVO
 *    LINK pra ele tirar as fotos de novo no próprio celular. Reusa o
 *    InviteLinkDialog (link já vinculado ao cliente + mensagem pronta pro zap).
 *  - Captura presencial: refazer pelo fluxo /leituras/nova (consultório).
 *
 * Como não distinguimos os dois modos com 100% de certeza no servidor (ambos são
 * capture_method='mobile_camera'), oferecemos os dois — link em destaque (cobre o
 * caso remoto da Lidia), presencial como secundário.
 */
export function ExpiredReadingActions({
  client,
}: {
  client: { id: string; full_name: string }
}) {
  const [inviteOpen, setInviteOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Button onClick={() => setInviteOpen(true)}>
        <LinkIcon className="mr-2 h-4 w-4" />
        Gerar novo link
      </Button>

      <Link
        href={`/leituras/nova?cliente=${client.id}`}
        className={cn(buttonVariants({ variant: 'outline' }))}
      >
        Refazer no consultório
      </Link>

      <InviteLinkDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        client={client}
      />
    </div>
  )
}
