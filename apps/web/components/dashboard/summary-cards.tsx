import { Users, FileText, CreditCard } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SummaryCardsProps {
  clientsCount: number
  trialEndsAt: string | null
  subscriptionStatus: string | null
}

export function SummaryCards({ clientsCount, trialEndsAt, subscriptionStatus }: SummaryCardsProps) {
  const daysLeft = trialEndsAt
    ? differenceInDays(new Date(trialEndsAt), new Date())
    : null

  const subscriptionLabel =
    subscriptionStatus === 'trial' && daysLeft !== null
      ? daysLeft > 0
        ? `Trial ativo — ${daysLeft} dias restantes`
        : 'Trial encerrado — assine para continuar'
      : subscriptionStatus ?? 'Sem assinatura'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Clientes</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{clientsCount}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Leituras esta semana</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold text-muted-foreground">0</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Assinatura</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-sm font-medium">{subscriptionLabel}</div>
        </CardContent>
      </Card>
    </div>
  )
}
