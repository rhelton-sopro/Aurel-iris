'use client'

import { useState } from 'react'
import { Link as LinkIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { InviteLinkDialog } from './InviteLinkDialog'

/**
 * Botão "Convidar" da FICHA do cliente.
 *
 * ⚠️ O convite existia no header de /clientes e no de /leituras, e sumia
 * justamente aqui — na tela em que o terapeuta está olhando ESTE cliente e
 * decidindo o que fazer com ele. Para convidar, tinha que voltar pra lista e
 * procurar a linha de novo.
 *
 * Como o cliente já é conhecido, o dialog abre no modo vinculado: pula a
 * escolha "cliente novo / existente" e gera o link direto pra ele.
 */
export function FichaClienteActions({
  client,
}: {
  client: { id: string; full_name: string }
}) {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setAberto(true)}>
        <LinkIcon className="mr-2 h-4 w-4" />
        Convidar
      </Button>
      <InviteLinkDialog open={aberto} onOpenChange={setAberto} client={client} />
    </>
  )
}
