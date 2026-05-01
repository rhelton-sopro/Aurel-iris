import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const { count, error } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, clients_count: count })
}
