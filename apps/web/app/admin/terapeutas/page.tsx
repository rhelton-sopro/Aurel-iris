import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isFounderEmail } from '@/lib/auth/founder'
import { DeleteTherapistDialog } from './DeleteTherapistDialog'
import { InviteTherapistForm } from './InviteTherapistForm'

// Cache off — listagem reflete deletes imediatamente após revalidatePath.
export const dynamic = 'force-dynamic'

export default async function TerapeutasAdminPage() {
  // Defense-in-depth founder gate (matches admin/layout.tsx).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isFounderEmail(user.email)) {
    notFound()
  }

  const service = createServiceClient()

  // Fetch tudo em paralelo: profiles (custom data), auth users (email), e
  // contagens de clients+readings (group em JS — N pequena no beta).
  const [profilesRes, usersRes, clientsRes, readingsRes] = await Promise.all([
    service
      .from('profiles')
      .select('id, full_name, phone, specialties, created_at'),
    service.auth.admin.listUsers({ perPage: 200 }),
    service.from('clients').select('therapist_id'),
    service.from('readings').select('therapist_id'),
  ])

  const profiles = profilesRes.data ?? []
  const users = usersRes.data?.users ?? []
  const clientCounts = countByKey(
    (clientsRes.data ?? []) as Array<{ therapist_id: string | null }>,
    (c) => c.therapist_id,
  )
  const readingCounts = countByKey(
    (readingsRes.data ?? []) as Array<{ therapist_id: string | null }>,
    (r) => r.therapist_id,
  )

  const rows = profiles
    .map((p) => {
      const u = users.find((x) => x.id === p.id)
      return {
        id: p.id,
        email: u?.email ?? '(sem email)',
        full_name: (p.full_name as string | null) ?? '(sem nome)',
        phone: (p.phone as string | null) ?? '',
        specialties: ((p.specialties as string[] | null) ?? []) as string[],
        created_at: p.created_at as string | null,
        is_founder: isFounderEmail(u?.email ?? null),
        clients_count: clientCounts.get(p.id) ?? 0,
        readings_count: readingCounts.get(p.id) ?? 0,
      }
    })
    .filter((r) => !r.is_founder)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Terapeutas</h2>
          <p className="text-sm text-muted-foreground">
            {rows.length} terapeuta{rows.length === 1 ? '' : 's'} cadastrado
            {rows.length === 1 ? '' : 's'}.
          </p>
        </div>
        <Link
          href="/admin/calibration"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          /admin/calibration →
        </Link>
      </div>

      <InviteTherapistForm />

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum terapeuta cadastrado ainda.
        </p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Nome</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Cadastro</th>
                <th className="px-3 py-2 font-medium text-right">Clientes</th>
                <th className="px-3 py-2 font-medium text-right">Leituras</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.full_name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.email}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {r.created_at
                      ? new Date(r.created_at).toLocaleDateString('pt-BR')
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.clients_count}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.readings_count}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <DeleteTherapistDialog
                      therapistId={r.id}
                      email={r.email}
                      fullName={r.full_name}
                      clientsCount={r.clients_count}
                      readingsCount={r.readings_count}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function countByKey<T>(
  items: T[],
  key: (item: T) => string | null | undefined,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const item of items) {
    const k = key(item)
    if (!k) continue
    out.set(k, (out.get(k) ?? 0) + 1)
  }
  return out
}
