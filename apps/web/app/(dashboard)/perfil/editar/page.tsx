import { redirect } from 'next/navigation'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { EditProfileForm } from './edit-profile-form'

// Edição de dados básicos do terapeuta (nome + telefone). Acessível pelo menu
// do avatar (dashboard-header). Diferente de /perfil/completar (gate one-time de
// onboarding): aqui é re-edição livre, sem gate de redirect.
export const dynamic = 'force-dynamic'

export default async function EditarPerfilPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'full_name, phone, cep, address, address_number, address_complement, district, city, state',
    )
    .eq('id', user.id)
    .maybeSingle()

  // ⚠️ O endereço era obrigatório pra ENTRAR e não podia ser corrigido depois:
  // esta tela só editava nome e telefone, e quem mudasse de endereço ficava com
  // a nota fiscal errada e nenhum caminho. Agora ele é opcional na entrada
  // (pedido na compra) — e editável aqui, reaproveitando o mesmo formulário com
  // busca de CEP em vez de duplicar sete campos e a validação junto.
  const enderecoLinhas = [
    profile?.address && profile?.address_number
      ? `${profile.address}, ${profile.address_number}`
      : profile?.address || null,
    profile?.address_complement || null,
    [profile?.district, profile?.city, profile?.state].filter(Boolean).join(' · ') ||
      null,
    profile?.cep || null,
  ].filter(Boolean) as string[]

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-[22px] font-light uppercase tracking-display text-ink">
          Editar perfil
        </h1>
        <p className="text-sm text-muted-foreground">
          Atualize seu nome, telefone e endereço. Para alterar CPF ou
          especialidades,{' '}
          {/* Mandar "falar com o suporte" sem dar onde falar é um beco: o
              endereço só existia enterrado nas páginas legais. */}
          <a
            href={`mailto:${process.env.NEXT_PUBLIC_OPERATOR_EMAIL ?? 'suporte@iriscodex.com'}`}
            className="underline"
          >
            escreva para o suporte
          </a>
          .
        </p>
      </div>

      <EditProfileForm
        initialFullName={profile?.full_name ?? ''}
        initialPhone={profile?.phone ?? ''}
      />

      <section className="space-y-2 border-t border-ink/15 pt-5">
        <h2 className="text-sm font-medium text-ink">
          Endereço{' '}
          <span className="font-normal text-mist">(nota fiscal e pagamento)</span>
        </h2>
        {enderecoLinhas.length > 0 ? (
          <address className="text-sm not-italic leading-relaxed text-muted-foreground">
            {enderecoLinhas.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
          </address>
        ) : (
          <p className="text-sm text-muted-foreground">
            Ainda não informado. Pedimos na hora de comprar créditos — você pode
            adiantar por aqui.
          </p>
        )}
        <Link
          href="/perfil/completar?para=endereco&next=%2Fperfil%2Feditar"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          {enderecoLinhas.length > 0 ? 'Atualizar endereço' : 'Informar endereço'}
        </Link>
      </section>
    </div>
  )
}
