import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Redirect para /dashboard após auth bem-sucedida (per D-04, D-05)
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // Falha na troca → retorna para login com indicação de erro
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
