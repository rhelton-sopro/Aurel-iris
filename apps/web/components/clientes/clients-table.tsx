'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { Input } from '@/components/ui/input'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { DeleteClientDialog } from './delete-client-dialog'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

type Client = Database['public']['Tables']['clients']['Row']

interface ClientsTableProps {
  clients: Client[]
}

export function ClientsTable({ clients }: ClientsTableProps) {
  const [query, setQuery] = useState('')
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)

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
            {filtered.map(client => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">{client.full_name}</TableCell>
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
                    <Link
                      href={`/clientes/${client.id}`}
                      title="Ver cliente"
                      aria-label="Ver cliente"
                      className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
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
            ))}
          </TableBody>
        </Table>
      )}

      {deletingClient && (
        <DeleteClientDialog
          client={deletingClient}
          open={!!deletingClient}
          onOpenChange={(open) => { if (!open) setDeletingClient(null) }}
        />
      )}
    </div>
  )
}
