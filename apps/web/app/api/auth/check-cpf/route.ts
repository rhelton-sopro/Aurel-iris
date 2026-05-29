/**
 * POST /api/auth/check-cpf  →  { exists: boolean }
 *
 * Pre-check de CPF ANTES do signInWithOtp no cadastro de terapeuta.
 *
 * Porquê: handle_new_user (migration 0039) insere profiles.cpf com índice
 * UNIQUE, mas a colisão estoura no trigger e o Supabase Auth mascara como o
 * genérico "Database error saving new user" — que NÃO contém 'cpf', então o
 * branch de mensagem amigável no signup nunca casava. Checar aqui, antes do
 * OTP, dá "CPF já cadastrado" claro e não queima um e-mail de código.
 *
 * Público (sem sessão — é pré-cadastro). Service-role pra ler profiles de
 * outros usuários (RLS bloquearia o anon). Fail-open: erro de checagem NÃO
 * bloqueia o cadastro (o trigger ainda garante a integridade).
 *
 * Nota de privacidade: revela existência de um CPF (enumeration). Risco baixo
 * pra ferramenta B2B; rate-limit pode ser adicionado depois se necessário.
 */
import { NextResponse, type NextRequest } from 'next/server'

import { createServiceClient } from '@/lib/supabase/service'
import { isValidCpf, cpfDigits } from '@/lib/auth/cpf'

export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => null)
  const raw =
    body && typeof (body as { cpf?: unknown }).cpf === 'string'
      ? (body as { cpf: string }).cpf
      : ''

  // CPF inválido no formato: o form já valida antes; não vaza nada.
  if (!isValidCpf(raw)) {
    return NextResponse.json({ exists: false })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('profiles')
    .select('id')
    .eq('cpf', cpfDigits(raw))
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[check-cpf]', error.message)
    // Fail-open: não trava cadastro legítimo por glitch de checagem.
    return NextResponse.json({ exists: false })
  }

  return NextResponse.json({ exists: Boolean(data) })
}
