'use client'

// Caixinha de destinatários (24/08): lista os TERAPEUTAS e o founder vai
// clicando para montar o disparo.
//
// ⛔ Só terapeutas. Os clientes dos terapeutas NÃO entram aqui — decisão do
// founder, por LGPD e pela relação dele com a base do terapeuta. Ver a nota no
// actions.ts antes de estender.

import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { listTherapistRecipients, type TherapistRecipient } from './actions'

export function RecipientPicker({
  jaEscolhidos,
  onConfirm,
  onClose,
}: {
  jaEscolhidos: TherapistRecipient[]
  onConfirm: (escolhidos: TherapistRecipient[]) => void
  onClose: () => void
}) {
  const [todos, setTodos] = useState<TherapistRecipient[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [marcados, setMarcados] = useState<Set<string>>(
    () => new Set(jaEscolhidos.map((t) => t.id)),
  )

  useEffect(() => {
    let vivo = true
    listTherapistRecipients().then((r) => {
      if (!vivo) return
      if (r.ok) setTodos(r.therapists)
      else setErro(r.error)
    })
    return () => {
      vivo = false
    }
  }, [])

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q || !todos) return todos ?? []
    return todos.filter(
      (t) => t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q),
    )
  }, [todos, busca])

  function alterna(id: string) {
    setMarcados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // "Todos" age sobre o que está VISÍVEL na busca, não sobre a base inteira —
  // marcar 39 pessoas sem ver quem são é o tipo de clique que não tem desfazer.
  function marcarVisiveis(marcar: boolean) {
    setMarcados((prev) => {
      const next = new Set(prev)
      for (const t of visiveis) {
        if (marcar) next.add(t.id)
        else next.delete(t.id)
      }
      return next
    })
  }

  function confirmar() {
    onConfirm((todos ?? []).filter((t) => marcados.has(t.id)))
  }

  const todosVisiveisMarcados =
    visiveis.length > 0 && visiveis.every((t) => marcados.has(t.id))

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col gap-3 rounded-[2px] border border-border bg-background p-5">
        <div>
          <h3 className="text-lg font-semibold text-ink">Escolher terapeutas</h3>
          <p className="text-xs text-muted-foreground">
            Cada pessoa recebe um e-mail separado. Ninguém vê o endereço de ninguém.
          </p>
        </div>

        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou e-mail…"
          className="w-full rounded-[2px] border border-border bg-card px-2 py-1.5 text-sm focus:border-teal-dark focus:outline-none"
        />

        {erro ? <p className="text-sm text-[#B23A2B]">{erro}</p> : null}
        {!todos && !erro ? (
          <p className="text-sm text-muted-foreground">Carregando terapeutas…</p>
        ) : null}

        {todos ? (
          <>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => marcarVisiveis(!todosVisiveisMarcados)}
                className="underline"
              >
                {todosVisiveisMarcados
                  ? `Desmarcar estes ${visiveis.length}`
                  : `Marcar estes ${visiveis.length}`}
              </button>
              <span className="text-muted-foreground">
                {marcados.size} selecionado(s)
              </span>
            </div>

            <ul className="flex-1 divide-y divide-border overflow-y-auto rounded-[2px] border border-border bg-card">
              {visiveis.length === 0 ? (
                <li className="px-3 py-3 text-sm text-muted-foreground">
                  Nenhum terapeuta encontrado.
                </li>
              ) : (
                visiveis.map((t) => (
                  <li key={t.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/40">
                      <input
                        type="checkbox"
                        checked={marcados.has(t.id)}
                        onChange={() => alterna(t.id)}
                        className="size-4 shrink-0 accent-teal-dark"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-foreground">
                          {t.name || <em className="text-muted-foreground">sem nome cadastrado</em>}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {t.email}
                        </span>
                      </span>
                    </label>
                  </li>
                ))
              )}
            </ul>
          </>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={confirmar}
            disabled={!todos}
            className="bg-teal-dark text-white hover:bg-teal-dark/90"
          >
            Usar {marcados.size} selecionado(s)
          </Button>
        </div>
      </div>
    </div>
  )
}
