import Link from 'next/link'
import { Users, CreditCard } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SummaryCardsProps {
  clientsCount: number
  creditsRemaining: number
}

export function SummaryCards({ clientsCount, creditsRemaining }: SummaryCardsProps) {
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
        aria-label={`Créditos — ver saldo (${creditsRemaining})`}
        className="rounded-md outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Créditos</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1">
            <div
              className={`text-2xl font-semibold ${creditsRemaining === 0 ? 'text-destructive' : ''}`}
            >
              {creditsRemaining}{' '}
              {creditsRemaining === 1 ? 'leitura disponível' : 'leituras disponíveis'}
            </div>
            <div className="text-sm text-muted-foreground">
              {creditsRemaining === 0 ? 'Compre créditos para gerar' : 'Toque para ver saldo'}
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}
