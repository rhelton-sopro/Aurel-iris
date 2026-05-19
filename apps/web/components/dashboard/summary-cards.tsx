import { Users, Sparkles } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BETA_READING_CAP } from '@/lib/beta/config'

interface SummaryCardsProps {
  clientsCount: number
  trialEndsAt: string | null
  subscriptionStatus: string | null
  betaReadingsUsed: number
}

export function SummaryCards({
  clientsCount,
  trialEndsAt,
  subscriptionStatus,
  betaReadingsUsed,
}: SummaryCardsProps) {
  const daysLeft = trialEndsAt
    ? differenceInDays(new Date(trialEndsAt), new Date())
    : null

  const trialLabel =
    subscriptionStatus === 'trial' && daysLeft !== null
      ? daysLeft > 0
        ? `Trial ativo — ${daysLeft} dias restantes`
        : 'Trial encerrado'
      : subscriptionStatus ?? 'Sem assinatura'

  const capReached = betaReadingsUsed >= BETA_READING_CAP

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
          <CardTitle className="text-sm font-medium">Plano beta</CardTitle>
          <Sparkles className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-1">
          <div
            className={`text-2xl font-semibold ${capReached ? 'text-destructive' : ''}`}
          >
            {betaReadingsUsed} de {BETA_READING_CAP} leituras realizadas
          </div>
          <div className="text-sm text-muted-foreground">{trialLabel}</div>
        </CardContent>
      </Card>
    </div>
  )
}
