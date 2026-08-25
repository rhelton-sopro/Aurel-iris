import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { evaluateTherapistProfile } from '@/lib/gates/therapist-profile'
import {
  PackageGrid,
  type CreditPackage,
} from '@/components/billing/PackageGrid'

export const metadata = { title: 'Comprar créditos — Iris Codex' }

export default async function ComprarPage({
  searchParams,
}: {
  searchParams: Promise<{ reading?: string }>
}) {
  // reading: quando a compra vem do banner "sem créditos" de uma leitura.
  // Propagado até o PackageCard → successUrl do checkout volta pra essa leitura.
  const { reading: readingId } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    const next = readingId
      ? `/assinatura/comprar?reading=${readingId}`
      : '/assinatura/comprar'
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  // ⭐ O endereço saiu do portão de ENTRADA e passou a ser cobrado AQUI — que é
  // onde ele serve pra alguma coisa (nota fiscal + antifraude da operadora do
  // cartão). Ver a nota grande em lib/gates/therapist-profile.ts.
  const { data: perfil } = await supabase
    .from('profiles')
    .select(
      'phone, specialties, tos_accepted_at, cpf, cep, address_number, city, state',
    )
    .eq('id', user.id)
    .maybeSingle()

  const gateCompra = evaluateTherapistProfile(
    {
      phone: perfil?.phone ?? null,
      specialties: perfil?.specialties ?? null,
      tos_accepted_at: perfil?.tos_accepted_at ?? null,
      cpf: perfil?.cpf ?? null,
      cep: perfil?.cep ?? null,
      address_number: perfil?.address_number ?? null,
      city: perfil?.city ?? null,
      state: perfil?.state ?? null,
    },
    'compra',
  )
  if (gateCompra.status !== 'ok') {
    const voltar = readingId
      ? `/assinatura/comprar?reading=${readingId}`
      : '/assinatura/comprar'
    redirect(
      `/perfil/completar?para=compra&next=${encodeURIComponent(voltar)}`,
    )
  }

  const { data: packages } = await supabase
    .from('credit_packages')
    .select('id, sku, name, leituras_count, price_brl, badge, display_order')
    .eq('active', true)
    .order('display_order')

  const list = (packages ?? []) as CreditPackage[]

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Link
        href="/assinatura"
        className="text-sm text-muted-foreground underline underline-offset-2 hover:text-ink"
      >
        ← Voltar para os créditos
      </Link>
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-bold text-ink">Comprar créditos</h1>
        <p className="text-sm text-muted-foreground">
          Pague apenas pelo que vai usar. Sem assinatura mensal. Créditos
          válidos por 12 meses.
        </p>
      </header>

      {list.length > 0 ? (
        <PackageGrid packages={list} readingId={readingId} />
      ) : (
        <p className="text-center text-muted-foreground">
          Pacotes em atualização. Tente novamente em alguns instantes.
        </p>
      )}

      <section className="mt-10 space-y-2 rounded-[2px] border border-border bg-muted/30 p-5 text-sm">
        <h3 className="font-semibold text-ink">Informações importantes</h3>
        <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
          {/* ⚠️ O provedor ATIVO é o Mercado Pago (o Asaas está dormente — ver
              lib/payments/index.ts). Dizer um nome e abrir outro, na tela onde a
              pessoa digita o cartão, é onde ela desiste. Se o provedor mudar,
              esta linha muda junto. */}
          <li>Pagamento via PIX ou cartão de crédito (checkout Mercado Pago).</li>
          <li>
            5% de desconto no PIX nos pacotes Médio e Grande. No cartão: Médio em
            até 2x e Grande em até 3x, sem juros.
          </li>
          <li>Validade: 12 meses a partir da confirmação do pagamento.</li>
          <li>
            Direito de arrependimento: 7 dias. Se nenhuma leitura do pacote foi
            usada, o <strong>reembolso é integral e imediato</strong>; se você já
            usou alguma, o reembolso é{' '}
            <strong>proporcional ao saldo restante</strong>, solicitado por aqui
            mesmo e processado pelo suporte. Detalhes em{' '}
            <Link href="/termos#arrependimento" className="underline">
              Termos de Uso
            </Link>
            .
          </li>
          <li>Nota fiscal emitida automaticamente após a confirmação.</li>
        </ul>
      </section>

    </div>
  )
}
