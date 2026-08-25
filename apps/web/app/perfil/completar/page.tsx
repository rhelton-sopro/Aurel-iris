import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { evaluateTherapistProfile, describeGaps } from '@/lib/gates/therapist-profile'
import { safeNextPath } from '@/lib/nav/safe-next'
import { CompleteProfileForm } from './complete-profile-form'

// GATE landing. NÃO está em PROTECTED_PATHS → o middleware não a bloqueia
// (evita loop). Se o perfil já está completo, manda pro dashboard (não
// mostra o gate a quem não precisa).
export default async function CompletarPerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; para?: string }>
}) {
  const { next, para } = await searchParams
  // 'compra'   — PORTÃO da compra: exige o endereço e, se já estiver completo,
  //              devolve a pessoa pro destino sem mostrar formulário nenhum.
  // 'endereco' — EDIÇÃO deliberada (o botão em /perfil/editar): exige o endereço
  //              e SEMPRE mostra o formulário, mesmo com tudo preenchido — senão
  //              "atualizar endereço" quicaria de volta sem deixar editar.
  // (vazio)    — portão de ACESSO: endereço opcional.
  // Ver a nota grande em lib/gates/therapist-profile.ts.
  const contexto =
    para === 'compra' || para === 'endereco'
      ? ('compra' as const)
      : ('acesso' as const)
  const ehEdicao = para === 'endereco'
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'phone, specialties, tos_accepted_at, cpf, cep, address, address_number, address_complement, district, city, state',
    )
    .eq('id', user.id)
    .maybeSingle()

  const gate = evaluateTherapistProfile(
    {
      phone: profile?.phone ?? null,
      specialties: profile?.specialties ?? null,
      tos_accepted_at: profile?.tos_accepted_at ?? null,
      cpf: profile?.cpf ?? null,
      cep: profile?.cep ?? null,
      address_number: profile?.address_number ?? null,
      city: profile?.city ?? null,
      state: profile?.state ?? null,
    },
    contexto,
  )
  if (gate.status === 'ok' && !ehEdicao) redirect(safeNextPath(next) ?? '/dashboard')

  // Prefill: quem já tem parte do cadastro (ex.: só falta endereço) não
  // re-digita tudo. specialties podem trazer texto livre ("Outro") — o form
  // mantém o que casa com a lista fixa e ignora o resto pro multi-select.
  const initial = {
    phone: profile?.phone ?? '',
    cpf: profile?.cpf ?? '',
    specialties: profile?.specialties ?? [],
    tosAccepted: Boolean(profile?.tos_accepted_at),
    cep: profile?.cep ?? '',
    address: profile?.address ?? '',
    addressNumber: profile?.address_number ?? '',
    complement: profile?.address_complement ?? '',
    district: profile?.district ?? '',
    city: profile?.city ?? '',
    state: profile?.state ?? '',
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1">
          <h1 className="text-[22px] font-light uppercase tracking-display text-ink">
            {ehEdicao
              ? 'Atualizar endereço'
              : contexto === 'compra'
                ? 'Dados para a nota fiscal'
                : 'Complete seu cadastro'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ehEdicao
              ? 'É o endereço que sai na sua nota fiscal e que a operadora do cartão confere na compra.'
              : contexto === 'compra'
                ? 'Precisamos do seu endereço para emitir a nota fiscal e para a verificação da operadora do cartão. É pedido uma vez só.'
                : 'Falta pouco para você começar a usar o Iris Codex.'}
          </p>
        </div>

        {/* ⭐ DIZ O QUE FALTA. Antes a tela só repetia "faltam alguns dados" e mostrava o
            formulário inteiro — quem devia um único campo era devolvido para cá a cada
            navegação sem descobrir qual. Caso real em 2026-08-03: duas contas paradas há
            dias, ambas devendo só o endereço. */}
        {gate.status === 'incomplete' && (
          <div className="border border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <b className="font-semibold">Falta {gate.missing.length === 1 ? 'só' : 'preencher'}: {describeGaps(gate.missing)}.</b>
            <span className="mt-1 block text-amber-900/90">
              O resto do seu cadastro já está salvo — é só completar {gate.missing.length === 1 ? 'esse campo' : 'esses campos'} e salvar.
            </span>
          </div>
        )}
        <CompleteProfileForm
          initial={initial}
          next={safeNextPath(next)}
          contexto={contexto}
        />
      </div>
    </main>
  )
}
