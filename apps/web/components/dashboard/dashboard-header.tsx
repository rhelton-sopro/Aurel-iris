'use client'

import { useRouter } from 'next/navigation'
import { differenceInDays } from 'date-fns'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface DashboardHeaderProps {
  fullName: string
  trialEndsAt: string | null
  subscriptionStatus: string | null
}

export function DashboardHeader({ fullName, trialEndsAt, subscriptionStatus }: DashboardHeaderProps) {
  const router = useRouter()
  const initial = fullName ? fullName.charAt(0).toUpperCase() : 'T'

  const daysLeft = trialEndsAt
    ? differenceInDays(new Date(trialEndsAt), new Date())
    : null

  const isTrial = subscriptionStatus === 'trial'
  const isTrialUrgent = daysLeft !== null && daysLeft <= 3

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-10 flex h-[calc(4rem+env(safe-area-inset-top))] items-center justify-between border-b border-[#EAEAEA] bg-white px-6 pt-[env(safe-area-inset-top)]">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="size-9 hover:bg-transparent hover:text-teal" />
      </div>
      <div className="flex items-center gap-4">
        {isTrial && daysLeft !== null && (
          <Badge variant={isTrialUrgent ? 'destructive' : 'outline'}>
            Trial: {daysLeft} dias
          </Badge>
        )}
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
          <DropdownMenuContent align="end" className="min-w-40 rounded-none border border-ink p-0 shadow-none">
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
