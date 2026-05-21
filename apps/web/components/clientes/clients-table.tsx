'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Pencil, Trash2, Link as LinkIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { DeleteClientDialog } from './delete-client-dialog'
import { InviteLinkDialog } from './InviteLinkDialog'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'
import { evaluateProfileCompleteness } from '@/lib/gates/profile-completeness'

type Client = Database['public']['Tables']['clients']['Row']

interface ClientsTableProps {
  clients: Client[]
}

export function ClientsTable({ clients }: ClientsTableProps) {
  const [query, setQuery] = useState('')
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)
  const [invitingClient, setInvitingClient] = useState<Client | null>(null)

  // Busca client-side case-insensitive (sem debounce para MVP)
  const filtered = clients.filter(c =>
    c.full_name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <Input
        placeholder="Buscar por nome..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="max-w-sm"
      />

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <p className="text-lg font-medium">Nenhum cliente ainda</p>
          <p className="text-sm text-muted-foreground">Cadastre seu primeiro cliente para começar.</p>
          <Link href="/clientes/novo" className={cn(buttonVariants({ size: 'sm' }))}>
            Novo cliente
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
          <p className="text-lg font-medium">Nenhum resultado para &ldquo;{query}&rdquo;</p>
          <p className="text-sm text-muted-foreground">Tente outro nome.</p>
        </div>
      ) : (
        <>
          {/* Desktop table (≥md) */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Nascimento</TableHead>
                  <TableHead>Última leitura</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(client => {
                  const gate = evaluateProfileCompleteness(client)
                  return (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/clientes/${client.id}`}
                        className="hover:underline focus-visible:underline outline-none"
                      >
                        {client.full_name}
                      </Link>
                      {gate.status === 'incomplete' && (
                        <span className="ml-2 inline-block rounded bg-amber-100 text-amber-800 text-xs px-1.5 py-0.5 align-middle">
                          perfil incompleto
                        </span>
                      )}
                      {gate.status === 'blocked_underage' && (
                        <span className="ml-2 inline-block rounded bg-destructive/10 text-destructive text-xs px-1.5 py-0.5 align-middle">
                          menor — bloqueado
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {client.birth_date
                        ? format(new Date(client.birth_date + 'T00:00:00'), 'dd/MM/yyyy')
                        : <span className="text-muted-foreground">—</span>
                      }
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">—</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Convidar para leitura remota"
                          aria-label="Convidar para leitura remota"
                          onClick={() => setInvitingClient(client)}
                        >
                          <LinkIcon className="h-4 w-4" />
                        </Button>
                        <Link
                          href={`/clientes/${client.id}/editar`}
                          title="Editar cliente"
                          aria-label="Editar cliente"
                          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Excluir cliente"
                          aria-label="Excluir cliente"
                          onClick={() => setDeletingClient(client)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards (<md) — Gmail-style stack, sem scroll horizontal */}
          <ul className="block md:hidden space-y-2">
            {filtered.map(client => {
              const gate = evaluateProfileCompleteness(client)
              return (
                <li
                  key={client.id}
                  className="rounded-md border border-border bg-card p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/clientes/${client.id}`}
                      className="font-medium hover:underline focus-visible:underline outline-none min-w-0 flex-1 truncate"
                    >
                      {client.full_name}
                    </Link>
                    <div className="flex items-center gap-0.5 flex-shrink-0 -mr-1 -mt-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Convidar para leitura remota"
                        aria-label="Convidar para leitura remota"
                        onClick={() => setInvitingClient(client)}
                      >
                        <LinkIcon className="h-4 w-4" />
                      </Button>
                      <Link
                        href={`/clientes/${client.id}/editar`}
                        title="Editar cliente"
                        aria-label="Editar cliente"
                        className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Excluir cliente"
                        aria-label="Excluir cliente"
                        onClick={() => setDeletingClient(client)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                    {client.birth_date && (
                      <span>
                        Nascimento: {format(new Date(client.birth_date + 'T00:00:00'), 'dd/MM/yyyy')}
                      </span>
                    )}
                    {gate.status === 'incomplete' && (
                      <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.5">
                        perfil incompleto
                      </span>
                    )}
                    {gate.status === 'blocked_underage' && (
                      <span className="rounded bg-destructive/10 text-destructive px-1.5 py-0.5">
                        menor — bloqueado
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {deletingClient && (
        <DeleteClientDialog
          client={deletingClient}
          open={!!deletingClient}
          onOpenChange={(open) => { if (!open) setDeletingClient(null) }}
        />
      )}

      {invitingClient && (
        <InviteLinkDialog
          open={!!invitingClient}
          onOpenChange={(open) => { if (!open) setInvitingClient(null) }}
          client={{ id: invitingClient.id, full_name: invitingClient.full_name }}
        />
      )}
    </div>
  )
}
