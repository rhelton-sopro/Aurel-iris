import Link from 'next/link'
import { Check, Circle, User, Users, FileText } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { dismissOnboardingAction } from '@/app/actions/onboarding'

// Wrapper void pra satisfazer o tipo de form action do React/Next.js
// (form action espera (formData: FormData) => void | Promise<void>)
async function handleDismiss(): Promise<void> {
  'use server'
  await dismissOnboardingAction()
}

// 'use server' file rule: este componente NÃO tem 'use client'.
// O <form action={dismissOnboardingAction}> funciona como Server Action via Next.js.
// Interface fica inline (sem export — sem RPC stub).
interface OnboardingWizardProps {
  step1Complete: boolean // Perfil completo (evaluateTherapistProfile === 'ok')
  step2Complete: boolean // ≥1 cliente cadastrado (incluindo is_self)
  step3Complete: boolean // ≥1 reading criada (qualquer status)
}

const STEPS = [
  {
    id: 1,
    title: 'Complete seu perfil',
    // ⚠️ Esta frase listava 3 campos e o portão exige 8 — quem clicava esperando
    // "telefone, especialidades e termos" encontrava CPF e endereço e concluía
    // que o cadastro não tinha salvo. A tela de destino diz exatamente o que
    // falta, nome por nome; aqui basta não prometer uma lista menor.
    desc: 'Contato, CPF, especialidades, endereço e aceite dos termos.',
    href: '/perfil/completar',
    Icon: User,
  },
  {
    id: 2,
    title: 'Cadastre o primeiro cliente',
    desc: 'Pode ser cliente real ou autoexame seu.',
    href: '/clientes/novo',
    Icon: Users,
  },
  {
    id: 3,
    title: 'Inicie a primeira leitura',
    desc: 'Suba 6 fotos da íris ou envie convite ao cliente.',
    href: '/leituras/nova',
    Icon: FileText,
  },
] as const

export function OnboardingWizard({
  step1Complete,
  step2Complete,
  step3Complete,
}: OnboardingWizardProps) {
  const states = [step1Complete, step2Complete, step3Complete]
  const completedCount = states.filter(Boolean).length

  // Short-circuit: já completou tudo, não renderiza.
  // Backward-compat: terapeutas existentes com 3 steps completos não veem o banner.
  if (completedCount === 3) return null

  return (
    <section
      data-testid="onboarding-wizard"
      className="rounded-md border-2 border-teal-700/20 bg-card p-6 space-y-4"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Vamos começar ({completedCount} de 3)
          </h2>
          <p className="text-sm text-muted-foreground">
            Três passos pra você gerar a primeira leitura iridológica.
          </p>
        </div>
        <form action={handleDismiss}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            data-testid="onboarding-dismiss-btn"
          >
            Pular
          </Button>
        </form>
      </header>

      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, idx) => {
          const done = states[idx]
          return (
            <li
              key={step.id}
              className={cn(
                'rounded-md border bg-background p-4 space-y-2',
                done && 'opacity-60',
              )}
              data-testid={`onboarding-step-${step.id}`}
            >
              <div className="flex items-center gap-2">
                {done ? (
                  <Check
                    className="h-4 w-4 text-teal-700"
                    aria-label="Concluído"
                  />
                ) : (
                  <Circle
                    className="h-4 w-4 text-muted-foreground"
                    aria-label="Pendente"
                  />
                )}
                <step.Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{step.title}</span>
              </div>
              <p className="text-xs text-muted-foreground">{step.desc}</p>
              {!done && (
                <Link
                  href={step.href}
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'w-full',
                  )}
                >
                  Começar
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
