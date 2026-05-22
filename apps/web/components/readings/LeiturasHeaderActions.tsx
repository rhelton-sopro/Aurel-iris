'use client'

import { useState } from 'react'
import { Link as LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InviteLinkDialog } from '@/components/clientes/InviteLinkDialog'

interface LeiturasHeaderActionsProps {
  availableClients: Array<{ id: string; full_name: string }>
}

/**
 * Botão "Convidar" no header de /leituras — espelha ClientesHeaderActions.
 * Founder UAT 2026-05-22: convite faz sentido em /leituras também (não só
 * em /clientes), porque o terapeuta pensa em "criar uma leitura" quando
 * convida um cliente novo.
 */
export function LeiturasHeaderActions({ availableClients }: LeiturasHeaderActionsProps) {
  const [inviteOpen, setInviteOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setInviteOpen(true)}>
        <LinkIcon className="mr-2 h-4 w-4" />
        Convidar
      </Button>
      <InviteLinkDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        availableClients={availableClients}
      />
    </>
  )
}
