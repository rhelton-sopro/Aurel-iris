import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isFounderEmail } from '@/lib/auth/founder'
import { PITCHES } from '@/lib/admin/pitches'
import { PitchCard } from './PitchCard'

// Pitches de vendas (founder → terapeuta). Conteúdo estático (lib/admin/pitches.ts),
// pra ter na mão antes de uma ligação/live sem depender da máquina de casa.

export default async function PitchesPage() {
  // Defense-in-depth founder gate (middleware + layout já bloqueiam).
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isFounderEmail(user.email)) {
    notFound()
  }

  return (
    <div className="space-y-7">
      <div>
        <div className="mb-2 text-[0.64rem] font-bold uppercase tracking-[0.25em] text-[#1E6B61]">
          Marketing · Pitches
        </div>
        <h1
          className="text-4xl leading-none text-foreground"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 400 }}
        >
          Pitches de vendas
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Três durações, na sua voz, para o terapeuta. O botão copia só a fala — as etiquetas de
          condução ficam na tela. Só o de 5 minutos menciona preço; nos outros dois isso é
          proposital.
        </p>
      </div>

      <div className="space-y-6">
        {PITCHES.map((p) => (
          <PitchCard key={p.slug} pitch={p} />
        ))}
      </div>

      <p className="max-w-prose text-xs text-muted-foreground">
        Fonte editorial e registro da auditoria (sensorial + conversão):{' '}
        <code className="font-mono">Estatégia comercial e mkt/PITCH-DE-VENDAS.md</code>. Escopo
        travado no que está no ar hoje — nenhum pitch descreve o Mapa do Ser. A frase que nunca sai:
        cada achado é hipótese, quem valida é o cliente; apoio à anamnese, não diagnóstico.
      </p>
    </div>
  )
}
