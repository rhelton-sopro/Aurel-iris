'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Trash2, Link as LinkIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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

interface PendingDelete {
  ids: string[]
  /** Quando ids.length === 1, mostra o nome no dialog. */
  singleName?: string
}

export function ClientsTable({ clients }: ClientsTableProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [invitingClient, setInvitingClient] = useState<Client | null>(null)

  // Busca client-side case-insensitive (sem debounce para MVP)
  const filtered = clients.filter(c =>
    c.full_name.toLowerCase().includes(query.toLowerCase())
  )

  const filteredIds = useMemo(() => filtered.map(c => c.id), [filtered])
  const allSelected = selected.size > 0 && filteredIds.every(id => selected.has(id))
  const someSelected = selected.size > 0 && !allSelected

  function toggle(id: string, checked: boolean) {
    setSelected(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(filteredIds) : new Set())
  }

  function handleDeleted() {
    setSelected(new Set())
    router.refresh()
  }

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
          {selected.size > 0 && (
            <div className="flex flex-col gap-2 rounded-none border bg-muted/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium">
                {selected.size} selecionado{selected.size > 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                >
                  Limpar seleção
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setPendingDelete({ ids: [...selected] })}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir selecionados
                </Button>
              </div>
            </div>
          )}

          {/* Desktop table (≥md) */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Selecionar todos"
                      checked={allSelected}
                      indeterminate={someSelected}
                      onCheckedChange={(checked) => toggleAll(checked === true)}
                    />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Nascimento</TableHead>
                  <TableHead>Última leitura</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(client => {
                  const gate = evaluateProfileCompleteness(client)
                  const isSelected = selected.has(client.id)
                  return (
                  <TableRow key={client.id} data-state={isSelected ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        aria-label={`Selecionar ${client.full_name}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => toggle(client.id, checked === true)}
                      />
                    </TableCell>
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
                          onClick={() =>
                            setPendingDelete({ ids: [client.id], singleName: client.full_name })
                          }
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
              const isSelected = selected.has(client.id)
              return (
                <li
                  key={client.id}
                  className={cn(
                    'rounded-md border border-border bg-card p-3 space-y-2',
                    isSelected && 'ring-2 ring-primary',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <Checkbox
                        aria-label={`Selecionar ${client.full_name}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => toggle(client.id, checked === true)}
                        className="mt-0.5"
                      />
                      <Link
                        href={`/clientes/${client.id}`}
                        className="font-medium hover:underline focus-visible:underline outline-none min-w-0 flex-1 truncate"
                      >
                        {client.full_name}
                      </Link>
                    </div>
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
                        onClick={() =>
                          setPendingDelete({ ids: [client.id], singleName: client.full_name })
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground pl-7">
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

      {pendingDelete && pendingDelete.ids.length > 0 && (
        <DeleteClientDialog
          clientIds={pendingDelete.ids}
          singleClientName={pendingDelete.singleName}
          open={pendingDelete.ids.length > 0}
          onOpenChange={(open) => { if (!open) setPendingDelete(null) }}
          onDeleted={handleDeleted}
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
