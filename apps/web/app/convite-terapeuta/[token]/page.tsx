import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { TherapistInviteSignupForm } from './TherapistInviteSignupForm'
import { Card, CardHeader, CardDescription } from '@/components/ui/card'

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

  if (error || !invite) {
    notFound()
  }

  // Token usado → mensagem específica (não notFound() opaco).
  if (invite.used_at) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>
            Este convite já foi usado. Acesse{' '}
            <a href="/login" className="underline">
              /login
            </a>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (new Date(invite.expires_at) < new Date()) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>
            Convite expirado. Peça um novo ao administrador.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return <TherapistInviteSignupForm tokenEmail={invite.email} tokenId={invite.token} />
}
