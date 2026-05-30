'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, UserPen, CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { DisclaimerCopy } from '@/components/legal/DisclaimerCopy'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface DashboardHeaderProps {
  fullName: string
}

export function DashboardHeader({ fullName }: DashboardHeaderProps) {
  const router = useRouter()
  const initial = fullName ? fullName.charAt(0).toUpperCase() : 'T'

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-10 flex h-[calc(4rem+env(safe-area-inset-top))] items-center justify-between border-b border-[#EAEAEA] bg-white px-6 pt-[env(safe-area-inset-top)]">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="size-9 hover:bg-transparent hover:text-teal" />
        {/* Surface 3 (LGPD-05) — reforço ATIVO (não rola pra ver). Oculto no
            mobile pra não competir com o trigger no header de 4rem. */}
        <div className="hidden min-w-0 truncate md:block">
          <DisclaimerCopy variant="compact" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="cursor-pointer rounded-full"
            aria-label={`${fullName} — menu da conta`}
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-teal-dark text-white text-xs font-normal tracking-label">
                {initial}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44 rounded-none border border-ink p-0 shadow-none">
            <DropdownMenuItem
              className="cursor-pointer rounded-none px-3.5 py-3 text-[11px] font-normal uppercase tracking-label focus:bg-ivory"
              render={<Link href="/perfil/editar" />}
            >
              <UserPen className="mr-2 h-4 w-4" />
              Editar perfil
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer rounded-none px-3.5 py-3 text-[11px] font-normal uppercase tracking-label focus:bg-ivory"
              render={<Link href="/assinatura" />}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Pagamento
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer rounded-none px-3.5 py-3 text-[11px] font-normal uppercase tracking-label focus:bg-ivory"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
