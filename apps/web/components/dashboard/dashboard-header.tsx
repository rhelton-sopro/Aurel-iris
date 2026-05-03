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
    <header className="h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] border-b flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>
      <div className="flex items-center gap-3">
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
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                {initial}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
