import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isFounderEmail } from '@/lib/auth/founder'
import { InviteTherapistForm } from './InviteTherapistForm'
import { TherapistTable } from './TherapistTable'

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

  // Início do mês corrente (00:00 local) — janela das colunas "no mês".
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Fetch tudo em paralelo: profiles (custom data), auth users (email),
  // contagens de clients+readings, ledger de créditos do mês e saldo ativo
  // (group em JS — N pequena no beta).
  const [
    profilesRes,
    usersRes,
    clientsRes,
    readingsRes,
    txRes,
    activeCreditsRes,
    packagesRes,
  ] = await Promise.all([
    service
      .from('profiles')
      .select(
        // 24/08: telefone e specialties já vinham aqui e não apareciam em tela
        // nenhuma. O resto entrou junto para a ficha por terapeuta.
        'id, full_name, phone, specialties, created_at, city, state, cpf, cep, address, address_number, address_complement, district, subscription_status, trial_ends_at, asaas_customer_id, tos_accepted_at, tos_version',
      ),
    service.auth.admin.listUsers({ perPage: 200 }),
    service.from('clients').select('therapist_id'),
    service.from('readings').select('therapist_id, created_at'),
    service
      .from('credit_transactions')
      .select('user_id, type, amount')
      .gte('created_at', monthStart),
    service
      .from('customer_credits')
      .select('user_id, leituras_remaining')
      .eq('status', 'active'),
    service
      .from('credit_packages')
      .select('sku, name, leituras_count, price_brl')
      .eq('active', true)
      .order('leituras_count', { ascending: true }),
  ])

  const profiles = profilesRes.data ?? []
  const packages = (packagesRes.data ?? []) as Array<{
    sku: string
    name: string
    leituras_count: number
    price_brl: number
  }>

  const users = usersRes.data?.users ?? []
  const clientCounts = countByKey(
    (clientsRes.data ?? []) as Array<{ therapist_id: string | null }>,
    (c) => c.therapist_id,
  )
  const readingRows = (readingsRes.data ?? []) as Array<{
    therapist_id: string | null
    created_at: string | null
  }>
  const readingCounts = countByKey(readingRows, (r) => r.therapist_id)
  // Última leitura por terapeuta — sinal de "como/se está usando".
  const lastReadingAt = new Map<string, string>()
  for (const r of readingRows) {
    if (!r.therapist_id || !r.created_at) continue
    const cur = lastReadingAt.get(r.therapist_id)
    if (!cur || r.created_at > cur) lastReadingAt.set(r.therapist_id, r.created_at)
  }

  // Créditos comprados/usados no mês (ledger) + saldo ativo, por terapeuta.
  const boughtMonth = new Map<string, number>()
  const usedMonth = new Map<string, number>()
  for (const t of (txRes.data ?? []) as Array<{
    user_id: string | null
    type: string
    amount: number
  }>) {
    if (!t.user_id) continue
    if (t.type === 'purchase') {
      boughtMonth.set(t.user_id, (boughtMonth.get(t.user_id) ?? 0) + t.amount)
    } else if (t.type === 'consume') {
      usedMonth.set(t.user_id, (usedMonth.get(t.user_id) ?? 0) + Math.abs(t.amount))
    }
  }
  const balance = new Map<string, number>()
  for (const c of (activeCreditsRes.data ?? []) as Array<{
    user_id: string | null
    leituras_remaining: number
  }>) {
    if (!c.user_id) continue
    balance.set(c.user_id, (balance.get(c.user_id) ?? 0) + c.leituras_remaining)
  }

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
        city: (p.city as string | null) ?? '',
        state: (p.state as string | null) ?? '',
        cpf: (p.cpf as string | null) ?? '',
        cep: (p.cep as string | null) ?? '',
        address: (p.address as string | null) ?? '',
        address_number: (p.address_number as string | null) ?? '',
        address_complement: (p.address_complement as string | null) ?? '',
        district: (p.district as string | null) ?? '',
        subscription_status: (p.subscription_status as string | null) ?? '—',
        trial_ends_at: (p.trial_ends_at as string | null) ?? null,
        // Quem tem cadastro no Asaas já passou por cobrança de verdade — é o
        // sinal mais honesto de "pagante" que existe hoje, porque o
        // subscription_status está em `trial` para todos os 39.
        is_paying: !!(p.asaas_customer_id as string | null),
        tos_accepted_at: (p.tos_accepted_at as string | null) ?? null,
        tos_version: (p.tos_version as string | null) ?? '',
        is_founder: isFounderEmail(u?.email ?? null),
        clients_count: clientCounts.get(p.id) ?? 0,
        readings_count: readingCounts.get(p.id) ?? 0,
        bought_month: boughtMonth.get(p.id) ?? 0,
        used_month: usedMonth.get(p.id) ?? 0,
        balance: balance.get(p.id) ?? 0,
        last_reading_at: lastReadingAt.get(p.id) ?? null,
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
      </div>

      <InviteTherapistForm />

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum terapeuta cadastrado ainda.
        </p>
      ) : (
        <TherapistTable rows={rows} packages={packages} />
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
