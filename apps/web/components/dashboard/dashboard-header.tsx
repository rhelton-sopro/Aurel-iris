'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, UserPen, CreditCard } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface DashboardHeaderProps {
  fullName: string
  creditsRemaining: number
  /** Leituras de trial restantes (0 quando trial inativa/esgotada). */
  trialReadingsRemaining: number
  /**
   * Vencimento da avaliação (ISO). O prazo de 15 dias existe e era invisível:
   * o selo dizia só "1 grátis", e quem voltava depois do vencimento encontrava
   * o selo sumido sem uma palavra de explicação.
   */
  trialExpiresAt?: string | null
}

export function DashboardHeader({
  fullName,
  creditsRemaining,
  trialReadingsRemaining,
  trialExpiresAt,
}: DashboardHeaderProps) {
  const router = useRouter()
  const initial = fullName ? fullName.charAt(0).toUpperCase() : 'T'

  // Dois saldos SEPARADOS (founder 2026-05-31). Selo "grátis" some quando a
  // trial acaba; selo de créditos some durante a trial se ainda não comprou
  // nada (sem "0 créditos" vermelho enquanto a trial cobre as leituras).
  const showTrial = trialReadingsRemaining > 0
  const validadeTrial = trialExpiresAt
    ? new Date(trialExpiresAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      })
    : null
  const showCredits = creditsRemaining > 0 || trialReadingsRemaining === 0

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-10 flex h-[calc(4rem+env(safe-area-inset-top))] items-center justify-between border-b border-[#EAEAEA] bg-white px-6 pt-[env(safe-area-inset-top)]">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="size-9 hover:bg-transparent hover:text-teal" />
        {/* ⛔ O aviso da LGPD-05 SAIU daqui (2026-08-25). Ele já está no rodapé de
            toda tela logada — a mesma frase, na mesma tela, duas vezes. Repetir
            não aumenta a proteção: treina a pessoa a não ler o aviso. O rodapé
            ganhou em troca os links legais e o suporte, que não existiam em
            lugar nenhum dentro do app. */}
      </div>
      <div className="flex items-center gap-2.5">
        {/* Selo da TRIAL — leituras grátis (teal, positivo). Clicável →
            /assinatura pra ver o saldo. Some quando a trial acaba. */}
        {showTrial && (
          <Link
            href="/assinatura"
            aria-label={
              validadeTrial
                ? `${trialReadingsRemaining} leituras grátis da avaliação, válidas até ${validadeTrial}`
                : `${trialReadingsRemaining} leituras grátis da avaliação`
            }
            className="rounded-[2px] border border-teal px-2.5 py-1 text-[11px] font-normal uppercase tracking-label text-teal transition-colors hover:bg-teal/5"
          >
            {trialReadingsRemaining} grátis
            {validadeTrial && (
              <span className="hidden opacity-70 sm:inline"> · até {validadeTrial}</span>
            )}
          </Link>
        )}
        {/* Selo de CRÉDITOS comprados (separado da trial). 0 créditos em
            vermelho só quando aparece (= trial já acabou). */}
        {showCredits && (
          <Link
            href="/assinatura"
            aria-label={`${creditsRemaining} créditos de análise — ver saldo`}
            className={`rounded-[2px] border px-2.5 py-1 text-[11px] font-normal uppercase tracking-label transition-colors ${
              creditsRemaining === 0
                ? 'border-destructive text-destructive hover:bg-destructive/5'
                : 'border-ink/30 text-ink hover:border-teal hover:text-teal'
            }`}
          >
            {creditsRemaining} {creditsRemaining === 1 ? 'crédito' : 'créditos'}
          </Link>
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
              Créditos
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
