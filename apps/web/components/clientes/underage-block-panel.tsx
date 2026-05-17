'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { DeleteClientDialog } from './delete-client-dialog'

interface UnderageBlockPanelProps {
  clientId: string
  fullName: string
  birthDate: string
}

export function UnderageBlockPanel({
  clientId,
  fullName,
  birthDate,
}: UnderageBlockPanelProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const formattedBirth = format(new Date(birthDate + 'T00:00:00'), 'dd/MM/yyyy')

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">{fullName}</h1>
      <div className="bg-destructive/10 border border-destructive rounded px-4 py-4 space-y-4">
        <p className="text-sm text-destructive">
          O Iris Codex agora atende apenas pessoas com 18+ anos. O cadastro de{' '}
          <strong>{fullName}</strong> (nascimento {formattedBirth}) não pode ser
          utilizado. Você pode apagá-lo com segurança — remove dados e fotos
          conforme a LGPD.
        </p>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Apagar cadastro
        </Button>
      </div>

      <DeleteClientDialog
        client={{ id: clientId, full_name: fullName }}
        open={open}
        onOpenChange={setOpen}
        onDeleted={() => router.push('/clientes')}
      />
    </div>
  )
}
