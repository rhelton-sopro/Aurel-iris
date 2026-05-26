import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { TherapistInviteSignupForm } from './TherapistInviteSignupForm'

export default async function ConviteTerapeutaPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  // Validate UUID format (defensa contra paths arbitrários antes do DB query).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    notFound()
  }

  const service = createServiceClient()
  const { data: invite, error } = await service
    .from('therapist_invites')
    .select('token, email, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  // Colapsa todos os estados inválidos em 404 para não vazar informação sobre
  // tokens históricos (security: não distinguir "usado" vs "expirado" vs "inexistente").
  if (error || !invite || invite.used_at || new Date(invite.expires_at) < new Date()) {
    notFound()
  }

  return <TherapistInviteSignupForm tokenEmail={invite.email} tokenId={invite.token} />
}
