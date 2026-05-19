import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AutoexameForm } from './autoexame-form'

export default async function AutoexamePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone')
    .eq('id', user.id)
    .maybeSingle()

  const { data: self } = await supabase
    .from('clients')
    .select('birth_date, biological_sex')
    .eq('therapist_id', user.id)
    .eq('is_self', true)
    .maybeSingle()

  const sex = self?.biological_sex
  const biologicalSex = sex === 'feminino' || sex === 'masculino' ? sex : ''

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-semibold">Meu exame</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sua leitura usa seu cadastro. Confirme os dados clínicos para
          continuar.
        </p>
      </div>
      <AutoexameForm
        fullName={profile?.full_name ?? ''}
        email={user.email ?? ''}
        phone={profile?.phone ?? ''}
        birthDate={self?.birth_date ?? ''}
        biologicalSex={biologicalSex}
      />
    </div>
  )
}
