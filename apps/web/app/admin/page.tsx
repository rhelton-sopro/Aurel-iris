import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { isFounderEmail } from '@/lib/auth/founder'
import { getAdminNotifications } from '@/lib/admin/notifications-summary'

// IMAP (caixa de suporte) abre TCP — precisa do runtime nodejs.
export const runtime = 'nodejs'

// Portal index do /admin. Para adicionar uma nova seção: appende uma entry
// neste array, nada mais.
const SECTIONS: Array<{
  href: string
  title: string
  description: string
  destructive?: boolean
  // external: href é arquivo estático (rewrite), não rota Next → usa <a> com
  // hard-nav em vez de <Link> (senão o roteamento client tenta resolver e 404).
  external?: boolean
}> = [
  {
    href: '/admin/terapeutas',
    title: 'Terapeutas',
    description:
      'Listar terapeutas cadastrados e excluir contas (apaga conta, perfil, clientes, leituras e fotos — irreversível).',
    destructive: true,
  },
  {
    href: '/admin/relatorios',
    title: 'Relatórios',
    description:
      'Métricas gerenciais do beta: funil de leituras, qualidade das fotos (aproveitamento da captura), custo AI e throughput por terapeuta. Filtro por data.',
  },
  {
    href: '/admin/suporte',
    title: 'Caixa de suporte',
    description:
      'Emails recebidos em suporte@iriscodex.com (Hostinger) — inclui as solicitações de reembolso parcial. Leia sem sair do painel; o estorno é manual no Mercado Pago.',
  },
  {
    href: '/admin/regenerar',
    title: 'Regeneração',
    description:
      'Relatórios que o gate de auditoria marcou como incompletos (seções faltando). Foto da íris retida até 24h pra resgate — abra a leitura pra regenerar. Relatórios completos têm a foto apagada na geração.',
  },
  {
    href: '/admin/painel',
    title: 'Conteúdo (marketing)',
    description:
      'Fila de aprovação de conteúdo de marketing: posts montados pelo time (carrossel/reel + legenda + estratégia) pra aprovar, editar, agendar, comentar ou reprovar. Funcional (v1) — auto-geração e publish no Instagram vêm nas próximas fases.',
  },
]

export default async function AdminPortalPage() {
  // Defense-in-depth founder gate (matches admin/layout.tsx).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isFounderEmail(user.email)) {
    notFound()
  }

  const notif = await getAdminNotifications()
  const cards: Array<{
    label: string
    count: number
    href: string
    alert: boolean
  }> = [
    { label: 'Emails não lidos', count: notif.unreadEmails, href: '/admin/suporte', alert: notif.unreadEmails > 0 },
    { label: 'Reembolsos pendentes', count: notif.pendingRefunds, href: '/admin/suporte', alert: notif.pendingRefunds > 0 },
    { label: 'Compras hoje', count: notif.purchasesToday, href: '/admin/relatorios', alert: false },
    { label: 'Falhas', count: notif.failures, href: '/admin/relatorios', alert: notif.failures > 0 },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Portal admin</h2>
        <p className="text-sm text-muted-foreground">
          Ferramentas de administração restritas ao founder.
        </p>
      </div>

      {/* Central de notificações: "o que chegou de importante". */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`rounded-md border px-4 py-3 transition-colors hover:bg-muted/40 ${
              c.alert ? 'border-teal-dark/50 bg-teal-dark/5' : 'border-border bg-card'
            }`}
          >
            <p className={`text-2xl font-bold ${c.alert ? 'text-teal-dark' : 'text-foreground'}`}>
              {c.count}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{c.label}</p>
          </Link>
        ))}
      </div>

      <ul className="space-y-3">
        {SECTIONS.map((s) => {
          const cardClass =
            'block rounded-md border bg-card px-4 py-3 hover:bg-muted/40 transition-colors'
          const inner = (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  {s.title}
                </span>
                {s.destructive && (
                  <Badge
                    variant="outline"
                    className="text-xs border-destructive/40 text-destructive"
                  >
                    destrutivo
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.description}
              </p>
              <p className="mt-2 font-mono text-xs text-muted-foreground/70">
                {s.href}
              </p>
            </>
          )
          return (
            <li key={s.href}>
              {s.external ? (
                <a href={s.href} className={cardClass}>
                  {inner}
                </a>
              ) : (
                <Link href={s.href} className={cardClass}>
                  {inner}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
