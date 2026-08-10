// Confere se o Stage 1 AUTOMÁTICO funcionou numa captura recém-feita.
//
// A pergunta que ele responde: o exame nasceu sozinho no fim da captura, ou só
// apareceu porque alguém clicou em "Gerar análise"? O que separa os dois casos é
// (a) a distância entre a última foto e a gravação do exame e (b) a ausência de
// qualquer geração de relatório registrada.
//
// uso: node scripts/diag-teste-stage1.mjs [trecho-do-nome-do-terapeuta]
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const env = Object.fromEntries(readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const ALVO = process.argv[2] ?? 'rhelton'
const { data: profs } = await sb.from('profiles').select('id, full_name').ilike('full_name', `%${ALVO}%`)
if (!profs?.length) { console.log(`nenhum terapeuta com "${ALVO}"`); process.exit(1) }

for (const p of profs) {
  const { data: rs } = await sb
    .from('readings')
    .select('id, created_at, status, report_generated, report_emocional, report_v2, analysis_started_at')
    .eq('therapist_id', p.id)
    .order('created_at', { ascending: false })
    .limit(1)
  const r = rs?.[0]
  if (!r) { console.log(`${p.full_name}: nenhuma leitura`); continue }

  const { data: cli } = await sb.from('clients').select('full_name').eq('id', r.client_id ?? '').maybeSingle()
  const { data: imgs } = await sb.from('reading_images').select('created_at').eq('reading_id', r.id).order('created_at', { ascending: false })
  const { data: fnd } = await sb.from('report_findings').select('generated_at, cost_usd, validation_status').eq('reading_id', r.id).is('superseded_at', null).maybeSingle()
  const { data: gens } = await sb.from('report_generations').select('created_at, method').eq('reading_id', r.id)

  console.log(`\n===== ${p.full_name} · leitura ${r.id.slice(0, 8)} · ${r.created_at.slice(0, 16)} =====`)
  console.log(`  cliente: ${cli?.full_name ?? '—'} | status: ${r.status} | fotos: ${(imgs ?? []).length}`)

  const ultimaFoto = imgs?.[0]?.created_at
  console.log(`  última foto : ${ultimaFoto?.slice(0, 19) ?? '—'}`)
  console.log(`  exame salvo : ${fnd?.generated_at?.slice(0, 19) ?? 'AINDA NÃO'}`)

  if (fnd?.generated_at && ultimaFoto) {
    const seg = Math.round((new Date(fnd.generated_at) - new Date(ultimaFoto)) / 1000)
    console.log(`  distância   : ${seg}s depois da última foto`)
    console.log(`  custo       : US$ ${Number(fnd.cost_usd ?? 0).toFixed(4)} | validação: ${fnd.validation_status}`)
    const gerou = (gens ?? []).length > 0 || r.report_generated || r.report_emocional || r.report_v2
    console.log(`  gerou relatório? ${gerou ? 'SIM — o teste não distingue, o exame pode ter vindo daí' : 'NÃO'}`)
    console.log(
      !gerou && seg < 600
        ? '\n  ✅ CONFIRMADO: o exame nasceu sozinho, sem ninguém clicar em gerar.'
        : gerou
          ? '\n  ⚠️  Inconclusivo: houve geração de relatório nesta leitura.'
          : '\n  ⚠️  Exame existe mas demorou — vale olhar os logs da Vercel.',
    )
  } else if (!fnd) {
    console.log(
      (imgs ?? []).length < 6
        ? '\n  ⏳ Captura ainda incompleta — o Stage 1 só dispara nas 6 fotos.'
        : '\n  ❌ 6 fotos e nenhum exame: o after() não rodou. Ver logs da Vercel (procurar "[auto-stage1]").',
    )
  }
}
