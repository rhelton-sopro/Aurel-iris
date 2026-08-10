// Linha do tempo real dos casos que o founder pediu: Melissa, Mariana Arrojo e
// Juliana. Mostra QUAL data o relógio das 24h usa (readings.created_at) contra a
// hora real da última foto — e se o relatório sai com todos os blocos.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderHTML } from '../_motor-lab/render-novo.mjs'

const env = Object.fromEntries(readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const H2_SUPORTE = 'O que vale olhar com quem te acompanha' // bloco 7
const H2_INTEG = 'Pequenas mudanças que cabem no seu dia' // bloco 8
const hhmm = (s) => (s ? String(s).slice(0, 16).replace('T', ' ') : '—')

const ALVOS = ['melissa', 'mariana', 'juliana']

for (const alvo of ALVOS) {
  const { data: cls } = await sb.from('clients').select('id, full_name, therapist_id').ilike('full_name', `%${alvo}%`)
  for (const c of cls ?? []) {
    const { data: tp } = await sb.from('profiles').select('full_name').eq('id', c.therapist_id).maybeSingle()
    const { data: rs } = await sb
      .from('readings')
      .select('id, created_at, status, report_emocional, images_purged_at, images_purge_reason')
      .eq('client_id', c.id)
      .order('created_at', { ascending: false })

    for (const r of rs ?? []) {
      const { data: imgs } = await sb
        .from('reading_images')
        .select('created_at')
        .eq('reading_id', r.id)
        .order('created_at', { ascending: false })
      const { data: tk } = await sb
        .from('client_invite_tokens')
        .select('created_at, used_at')
        .eq('client_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1)
      const { data: fnd } = await sb
        .from('report_findings')
        .select('exame_json, generated_at')
        .eq('reading_id', r.id)
        .is('superseded_at', null)
        .maybeSingle()

      console.log(`\n${'='.repeat(74)}`)
      console.log(`${c.full_name}  ·  terapeuta: ${tp?.full_name ?? '?'}  ·  ${r.id.slice(0, 8)}`)
      console.log('='.repeat(74))
      console.log(`  link gerado      : ${hhmm(tk?.[0]?.created_at)}`)
      console.log(`  leitura criada   : ${hhmm(r.created_at)}   <-- é ESTA data que o cron das 24h usa`)
      console.log(`  1ª foto          : ${hhmm(imgs?.[imgs.length - 1]?.created_at)}`)
      console.log(`  última foto      : ${hhmm(imgs?.[0]?.created_at)}   (${(imgs ?? []).length} fotos)`)
      console.log(`  exame (Stage 1)  : ${hhmm(fnd?.generated_at)}`)
      console.log(`  fotos apagadas   : ${hhmm(r.images_purged_at)} ${r.images_purge_reason ?? ''}`)

      if (imgs?.length && r.images_purged_at) {
        const h = (new Date(r.images_purged_at) - new Date(imgs[0].created_at)) / 36e5
        console.log(`  → janela real depois da ÚLTIMA foto: ${h.toFixed(1)}h ${h < 24 ? '(MENOS que 24h!)' : ''}`)
      }

      if (!r.report_emocional) {
        console.log('  RELATÓRIO: não gerado')
        continue
      }
      const exame = fnd?.exame_json ?? {}
      const comExame = renderHTML(r.report_emocional, exame, 'Teste').html
      const semExame = renderHTML(r.report_emocional, {}, 'Teste').html
      console.log(`  RELATÓRIO gerado — com o exame chegando:`)
      console.log(`     bloco 7 (Repertório de suporte)  : ${comExame.includes(H2_SUPORTE) ? 'SIM' : 'NÃO'}`)
      console.log(`     bloco 8 (Sugestões integrativas) : ${comExame.includes(H2_INTEG) ? 'SIM' : 'NÃO'}`)
      console.log(`  ANTES do fix (exame bloqueado pela RLS) seria:`)
      console.log(`     bloco 7 : ${semExame.includes(H2_SUPORTE) ? 'SIM' : 'NÃO  <-- o "item 7" que ela viu sumir'}`)
      console.log(`     bloco 8 : ${semExame.includes(H2_INTEG) ? 'SIM' : 'NÃO'}`)
    }
  }
}
