import { isFounderEmail } from '@/lib/auth/founder'
import { updateSession } from '@/lib/supabase/middleware'
import { evaluateTherapistProfile } from '@/lib/gates/therapist-profile'
import { NextResponse, type NextRequest } from 'next/server'

// ATENÇÃO Next.js 15: arquivo se chama middleware.ts (não proxy.ts — isso é Next.js 16+)
// export function se chama middleware (não proxy)

const PROTECTED_PATHS = ['/dashboard', '/clientes', '/leituras', '/assinatura']
const ADMIN_PREFIX = '/admin'
// Path público de convite — terapeuta gera link, cliente abre sem sessão
// (faz cadastro + captura via token-auth). NÃO entra em PROTECTED_PATHS
// nem no profile gate. Auth real é validação do token (service-role) no
// path. Inclui /api/convite/* (uploads/finalize) e /api/capture/validate
// (Haiku gate aceita Authorization: Bearer <token> em vez de sessão).
const PUBLIC_INVITE_PREFIXES = ['/convite/', '/api/convite/', '/convite-terapeuta/']

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Bail-out cedo p/ rotas públicas de convite: nem corre updateSession
  // (não precisa Supabase auth) e definitivamente não entra no profile
  // gate. Sem isso, /convite/[token] em desktop sem cookie cairia em
  // /login (PROTECTED_PATHS não cobre, mas updateSession ainda criaria
  // overhead).
  if (PUBLIC_INVITE_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const { supabase, supabaseResponse, user } = await updateSession(request)

  // /admin/* — founder-only gate. Returns 404 (not 403) to avoid leaking
  // existence of admin routes to non-founders. Defense-in-depth: app/admin/layout.tsx
  // also calls notFound() if isFounderEmail fails (catches middleware misconfig).
  if (pathname.startsWith(ADMIN_PREFIX)) {
    if (!user || !isFounderEmail(user.email)) {
      return new NextResponse(null, { status: 404 })
    }
  }

  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // GATE de perfil incompleto (Cluster 2b). Só em rotas protegidas e só com
  // user logado. /perfil/completar NÃO está em PROTECTED_PATHS → não entra
  // aqui (sem loop). /admin é tratado acima e não é PROTECTED_PATH. Uma query
  // extra por request protegido (aceitável no beta).
  if (isProtected && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone, specialties, tos_accepted_at')
      .eq('id', user.id)
      .maybeSingle()

    const gate = evaluateTherapistProfile({
      phone: profile?.phone ?? null,
      specialties: profile?.specialties ?? null,
      tos_accepted_at: profile?.tos_accepted_at ?? null,
    })
    if (gate.status !== 'ok') {
      const url = request.nextUrl.clone()
      url.pathname = '/perfil/completar'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  // Usuário logado tentando acessar /login ou /signup → redireciona para /dashboard
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
