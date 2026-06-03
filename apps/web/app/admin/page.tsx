import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { isFounderEmail } from '@/lib/auth/founder'

// Portal index do /admin. Para adicionar uma nova seção: appende uma entry
// neste array, nada mais.
const SECTIONS: Array<{
  href: string
  title: string
  description: string
  destructive?: boolean
}> = [
  {
    href: '/admin/terapeutas',
    title: 'Terapeutas',
    description:
      'Listar terapeutas cadastrados e excluir contas (apaga conta, perfil, clientes, leituras e fotos — irreversível).',
    destructive: true,
  },
  {
    href: '/admin/calibration',
    title: 'Calibração',
    description:
      'Revisar leituras de todos terapeutas e anotar para calibração (Sonnet/SAM/comparar/re-parsers).',
  },
  {
    href: '/admin/relatorios',
    title: 'Relatórios',
    description:
      'Métricas gerenciais do beta: funil de leituras, qualidade das fotos (aproveitamento da captura), custo AI e throughput por terapeuta. Filtro por data.',
  },
  {
    href: '/admin/regenerar',
    title: 'Regeneração',
    description:
      'Relatórios que o gate de auditoria marcou como incompletos (seções faltando). Foto da íris retida até 24h pra resgate — abra a leitura pra regenerar. Relatórios completos têm a foto apagada na geração.',
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Portal admin</h2>
        <p className="text-sm text-muted-foreground">
          Ferramentas de administração restritas ao founder.
        </p>
      </div>

      <ul className="space-y-3">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="block rounded-md border bg-card px-4 py-3 hover:bg-muted/40 transition-colors"
            >
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
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
