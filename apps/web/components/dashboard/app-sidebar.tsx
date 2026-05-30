'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Eye, CreditCard } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/leituras', label: 'Leituras', icon: Eye },
  { href: '/assinatura', label: 'Assinatura', icon: CreditCard },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  // Fecha o drawer mobile ao navegar (sem isso o Sheet fica aberto até
  // clicar fora). No desktop é no-op.
  useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-[#EAEAEA] px-[18px] py-5 pt-[calc(1.25rem+env(safe-area-inset-top))] group-data-[collapsible=icon]:px-3">
        <span className="text-sm font-light uppercase tracking-wordmark text-ink group-data-[collapsible=icon]:hidden">
          Iris Codex
        </span>
        <Image
          src="/logo/iris_codex_mark.png"
          alt="Iris Codex"
          width={24}
          height={24}
          className="mx-auto hidden size-6 group-data-[collapsible=icon]:block"
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="gap-0.5 px-2 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={isActive}
                  tooltip={item.label}
                  className="h-auto rounded-none border-l-2 border-l-transparent px-3 py-2.5 text-[11px] font-normal uppercase tracking-label text-mist transition-colors hover:bg-transparent hover:text-ink data-active:border-l-teal data-active:bg-transparent data-active:font-normal data-active:text-ink"
                  render={<Link href={item.href} />}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}
