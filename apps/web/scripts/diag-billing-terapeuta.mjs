// Por que um terapeuta aparece com N leituras e nenhuma compra?
// Mostra o quadro inteiro do billing dele: trial, créditos, ledger e o que cada
// leitura consumiu (ou não).
//
// uso: node scripts/diag-billing-terapeuta.mjs [trecho-do-nome]
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const env = Object.fromEntries(readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const ALVO = process.argv[2] ?? 'carol'
const { data: profs } = await sb.from('profiles').select('*').ilike('full_name', `%${ALVO}%`)

for (const p of profs ?? []) {
  const { data: au } = await sb.auth.admin.getUserById(p.id)
  console.log(`\n${'='.repeat(76)}`)
  console.log(`${p.full_name}  <${au?.user?.email ?? '?'}>`)
  console.log(`cadastro: ${p.created_at?.slice(0, 10)} | internal_use: ${p.internal_use} | subscription_status: ${p.subscription_status}`)
  console.log('='.repeat(76))

  // Trial
  const { data: tr } = await sb.from('trial_status').select('*').eq('user_id', p.id).maybeSingle()
  console.log(tr
    ? `TRIAL: ${tr.trial_readings_used}/${tr.trial_readings_max} usadas | expira ${tr.trial_expires_at?.slice(0, 10)} | encerrada: ${tr.ended_at?.slice(0, 10) ?? 'não'} ${tr.ended_reason ?? ''}`
    : 'TRIAL: nenhuma')

  // Créditos comprados
  const { data: cc } = await sb.from('customer_credits').select('*, credit_packages(name, price_brl)').eq('user_id', p.id).order('purchase_date')
  console.log(`\nCOMPRAS (customer_credits): ${(cc ?? []).length}`)
  for (const c of cc ?? []) {
    const pkg = Array.isArray(c.credit_packages) ? c.credit_packages[0] : c.credit_packages
    console.log(`  ${c.purchase_date?.slice(0, 10)} | ${pkg?.name ?? '?'} R$${pkg?.price_brl ?? '?'} | status=${c.status} | compradas=${c.leituras_purchased} restantes=${c.leituras_remaining} reservadas=${c.leituras_reserved} | pgto=${c.asaas_payment_id ?? '—'}`)
  }

  // Ledger
  const { data: tx } = await sb.from('credit_transactions').select('*').eq('user_id', p.id).order('created_at')
  console.log(`\nLEDGER (credit_transactions): ${(tx ?? []).length}`)
  for (const t of tx ?? []) {
    console.log(`  ${t.created_at?.slice(0, 16)} | ${String(t.type).padEnd(10)} | ${String(t.amount).padStart(3)} | reading=${t.reading_id ? t.reading_id.slice(0, 8) : '—'} | ${t.notes ?? ''}`)
  }

  // Leituras e o que cada uma consumiu
  const { data: rs } = await sb.from('readings')
    .select('id, created_at, status, report_generated, report_emocional')
    .eq('therapist_id', p.id).order('created_at')
  console.log(`\nLEITURAS: ${(rs ?? []).length}`)
  for (const r of rs ?? []) {
    const gerou = r.report_generated || r.report_emocional
    const consumo = (tx ?? []).filter((t) => t.reading_id === r.id)
    console.log(`  ${r.created_at.slice(0, 10)} | ${String(r.status).padEnd(8)} | relatório: ${gerou ? 'SIM' : 'não'} | cobrança: ${consumo.length ? consumo.map((c) => c.type + ' ' + c.amount).join(', ') : 'NENHUMA'}`)
  }

  const geradas = (rs ?? []).filter((r) => r.report_generated || r.report_emocional).length
  const cobradas = (tx ?? []).filter((t) => t.type === 'consume').length
  const trialUsadas = tr?.trial_readings_used ?? 0
  console.log(`\n  → relatórios gerados: ${geradas} | debitados do ledger: ${cobradas} | trial: ${trialUsadas}`)
  const naoExplicadas = geradas - cobradas - trialUsadas
  if (naoExplicadas > 0 && !p.internal_use) {
    console.log(`  ⚠️  ${naoExplicadas} relatório(s) SEM origem de pagamento (nem trial, nem crédito)`)
  }
}
