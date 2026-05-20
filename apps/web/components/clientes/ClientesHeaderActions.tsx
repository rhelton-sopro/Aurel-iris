'use client'

import { useState } from 'react'
import { Link as LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InviteLinkDialog } from './InviteLinkDialog'

interface ClientesHeaderActionsProps {
  availableClients: Array<{ id: string; full_name: string }>
}

/**
 * Wrapper de ações de header de /clientes que precisam de estado client-side
 * (dialog aberto/fechado). Mantém o page.tsx como RSC pure.
 */
export function ClientesHeaderActions({ availableClients }: ClientesHeaderActionsProps) {
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
