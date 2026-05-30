import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { DisclaimerCopy } from '@/components/legal/DisclaimerCopy'
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

  const { data: packages } = await supabase
    .from('credit_packages')
    .select('id, sku, name, leituras_count, price_brl, badge, display_order')
    .eq('active', true)
    .order('display_order')

  const list = (packages ?? []) as CreditPackage[]

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <Link
        href="/assinatura"
        className="text-sm text-muted-foreground underline underline-offset-2 hover:text-ink"
      >
        ← Voltar
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
          <li>Pagamento via PIX, cartão de crédito ou boleto (checkout Asaas).</li>
          <li>Validade: 12 meses a partir da confirmação do pagamento.</li>
          <li>
            Direito de arrependimento: 7 dias (reembolso integral se nenhuma
            leitura foi usada). Detalhes em{' '}
            <Link href="/termos#arrependimento" className="underline">
              Termos de Uso
            </Link>
            .
          </li>
          <li>Nota fiscal emitida automaticamente após a confirmação.</li>
        </ul>
      </section>

      <DisclaimerCopy variant="footer" />
    </div>
  )
}
