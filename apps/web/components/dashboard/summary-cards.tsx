import Link from 'next/link'
import { Users, CreditCard } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SummaryCardsProps {
  clientsCount: number
  creditsRemaining: number
  /**
   * Leituras de cortesia restantes (0 quando a avaliação acabou).
   *
   * ⚠️ Sem isto o cartão contava SÓ o comprado e mostrava "0 leituras
   * disponíveis — compre créditos" em vermelho, ao mesmo tempo em que o selo do
   * topo dizia "1 grátis". Duas afirmações opostas sobre o mesmo saldo, na mesma
   * tela, para quem estava justamente decidindo se o produto valia a compra.
   */
  trialReadingsRemaining?: number
  /** Vencimento da avaliação (ISO) — mostrado junto do saldo de cortesia. */
  trialExpiresAt?: string | null
}

export function SummaryCards({
  clientsCount,
  creditsRemaining,
  trialReadingsRemaining = 0,
  trialExpiresAt,
}: SummaryCardsProps) {
  const emCortesia = trialReadingsRemaining > 0
  const totalDisponivel = creditsRemaining + trialReadingsRemaining
  const semNada = totalDisponivel === 0
  const validade = trialExpiresAt
    ? new Date(trialExpiresAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      })
    : null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <Link
        href="/clientes"
        aria-label={`Clientes — ver lista (${clientsCount})`}
        className="rounded-md outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{clientsCount}</div>
          </CardContent>
        </Card>
      </Link>

      <Link
        href="/assinatura"
        aria-label={`Créditos — ver saldo (${totalDisponivel})`}
        className="rounded-md outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Créditos</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div
              className={`text-2xl font-semibold ${semNada ? 'text-destructive' : ''}`}
            >
              {totalDisponivel}{' '}
              {totalDisponivel === 1 ? 'leitura disponível' : 'leituras disponíveis'}
            </div>
            <div className="text-sm text-muted-foreground">
              {semNada
                ? 'Compre créditos para gerar'
                : emCortesia && creditsRemaining === 0
                  ? `Cortesia da avaliação${validade ? ` — válida até ${validade}` : ''}`
                  : emCortesia
                    ? `${trialReadingsRemaining} de cortesia + ${creditsRemaining} ${creditsRemaining === 1 ? 'comprado' : 'comprados'}`
                    : 'Toque para ver saldo'}
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}
