'use client'

// Tabela de terapeutas com FICHA por pessoa (24/08).
//
// Pedido do founder: "onde eu vejo o telefone, vejo a profissão, o que ele
// marcou, que área terapêutica que ele é". O telefone e as especialidades já
// vinham do banco para esta tela desde sempre — e não eram mostrados em lugar
// nenhum. Agora a linha abre uma ficha, no mesmo gesto da caixa de e-mail.
//
// ⚠️ A ficha mostra CPF e endereço. Estão aqui porque são o que a NF-e exige na
// cobrança, e a tela inteira é founder-only. Não levar estes campos para
// nenhuma tela que não seja /admin.

import { Fragment, useMemo, useState } from 'react'

import { cn } from '@/lib/utils'
import { DeleteTherapistDialog } from './DeleteTherapistDialog'
import { GrantCreditsDialog } from './GrantCreditsDialog'

export interface TherapistRow {
  id: string
  email: string
  full_name: string
  phone: string
  specialties: string[]
  city: string
  state: string
  cpf: string
  address: string
  address_number: string
  address_complement: string
  district: string
  cep: string
  subscription_status: string
  trial_ends_at: string | null
  is_paying: boolean
  tos_accepted_at: string | null
  tos_version: string
  created_at: string | null
  clients_count: number
  readings_count: number
  bought_month: number
  used_month: number
  balance: number
  last_reading_at: string | null
}

export interface CreditPackage {
  sku: string
  name: string
  leituras_count: number
  price_brl: number
}

function data(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'
}

/** Só dígitos + 55. Os 37 telefones do banco têm todos 11 dígitos (DDD + 9). */
function whatsapp(phone: string): string | null {
  const d = phone.replace(/\D/g, '')
  if (d.length !== 10 && d.length !== 11) return null
  return `https://wa.me/55${d}`
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </dt>
      <dd className="text-sm text-foreground">{children || '—'}</dd>
    </div>
  )
}

export function TherapistTable({
  rows,
  packages,
}: {
  rows: TherapistRow[]
  packages: CreditPackage[]
}) {
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState<string | null>(null)

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [r.full_name, r.email, r.phone, r.city, r.state, ...r.specialties]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [rows, busca])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, e-mail, telefone, cidade ou área…"
          className="w-full max-w-sm rounded-[2px] border border-border bg-card px-2 py-1.5 text-sm focus:border-teal-dark focus:outline-none"
        />
        <span className="text-xs text-muted-foreground">
          {visiveis.length === rows.length
            ? `${rows.length} terapeutas`
            : `${visiveis.length} de ${rows.length}`}
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Nome</th>
              <th className="px-3 py-2 font-medium">Telefone</th>
              <th className="px-3 py-2 font-medium">Áreas</th>
              <th className="px-3 py-2 font-medium">Cadastro</th>
              <th className="px-3 py-2 text-right font-medium">Clientes</th>
              <th className="px-3 py-2 text-right font-medium">Leituras</th>
              <th className="px-3 py-2 text-right font-medium">Saldo</th>
              <th className="px-3 py-2 font-medium">Última leitura</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-sm text-muted-foreground">
                  Nenhum terapeuta encontrado para essa busca.
                </td>
              </tr>
            ) : null}
            {visiveis.map((r) => {
              const open = aberto === r.id
              return (
                <Fragment key={r.id}>
                  <tr
                    onClick={() => setAberto(open ? null : r.id)}
                    className={cn(
                      'cursor-pointer border-t hover:bg-muted/40',
                      open && 'bg-muted/40',
                    )}
                  >
                    <td className="px-3 py-2">
                      <span className="mr-1 inline-block text-[10px] text-muted-foreground">
                        {open ? '▾' : '▸'}
                      </span>
                      {r.full_name}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{r.phone || '—'}</td>
                    <td className="max-w-[220px] px-3 py-2 text-xs text-muted-foreground">
                      {r.specialties.length ? (
                        <span className="line-clamp-1">{r.specialties.join(' · ')}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {data(r.created_at)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.clients_count}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.readings_count}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{r.balance}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {data(r.last_reading_at)}
                    </td>
                    {/* os botões de crédito/excluir não podem abrir a ficha junto */}
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <GrantCreditsDialog
                          therapistId={r.id}
                          email={r.email}
                          fullName={r.full_name}
                          packages={packages}
                        />
                        <DeleteTherapistDialog
                          therapistId={r.id}
                          email={r.email}
                          fullName={r.full_name}
                          clientsCount={r.clients_count}
                          readingsCount={r.readings_count}
                        />
                      </div>
                    </td>
                  </tr>

                  {open ? (
                    <tr className="border-t bg-muted/20">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="space-y-4">
                          <section>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink">
                              Contato
                            </h4>
                            <dl className="grid gap-3 sm:grid-cols-3">
                              <Campo rotulo="E-mail">
                                <a href={`mailto:${r.email}`} className="underline">
                                  {r.email}
                                </a>
                              </Campo>
                              <Campo rotulo="Telefone">
                                {r.phone ? (
                                  whatsapp(r.phone) ? (
                                    <a
                                      href={whatsapp(r.phone) as string}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="underline"
                                    >
                                      {r.phone} <span className="text-xs">· WhatsApp</span>
                                    </a>
                                  ) : (
                                    r.phone
                                  )
                                ) : null}
                              </Campo>
                              <Campo rotulo="Cidade / UF">
                                {[r.city, r.state].filter(Boolean).join(' / ')}
                              </Campo>
                            </dl>
                          </section>

                          <section>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink">
                              Áreas que ele marcou
                            </h4>
                            {r.specialties.length ? (
                              <div className="flex flex-wrap gap-1">
                                {r.specialties.map((s) => (
                                  <span
                                    key={s}
                                    className="rounded-[2px] border border-border bg-card px-1.5 py-0.5 text-xs"
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                Não marcou nenhuma área no cadastro.
                              </p>
                            )}
                          </section>

                          <section>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink">
                              Uso e conta
                            </h4>
                            <dl className="grid gap-3 sm:grid-cols-4">
                              <Campo rotulo="Situação">
                                {r.is_paying ? 'Pagante' : r.subscription_status}
                              </Campo>
                              <Campo rotulo="Trial até">{data(r.trial_ends_at)}</Campo>
                              <Campo rotulo="Comprados no mês">{r.bought_month}</Campo>
                              <Campo rotulo="Usados no mês">{r.used_month}</Campo>
                            </dl>
                          </section>

                          <section>
                            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink">
                              Cadastro e cobrança
                            </h4>
                            <dl className="grid gap-3 sm:grid-cols-3">
                              <Campo rotulo="CPF">{r.cpf}</Campo>
                              <Campo rotulo="Endereço">
                                {[
                                  [r.address, r.address_number].filter(Boolean).join(', '),
                                  r.address_complement,
                                  r.district,
                                  r.cep,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </Campo>
                              <Campo rotulo="Termos aceitos">
                                {r.tos_accepted_at
                                  ? `${data(r.tos_accepted_at)} (${r.tos_version})`
                                  : ''}
                              </Campo>
                            </dl>
                          </section>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
