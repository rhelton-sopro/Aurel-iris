// AUDITORIA DE COBERTURA DO STAGE 1
// Para cada campo do glossário: ele já foi reportado como ACHADO? como PRESERVADO?
// Campo que nunca aparece de um dos lados é ponto cego — o relatório nunca poderá
// falar daquilo, por melhor que seja a íris ou o motor.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const env = Object.fromEntries(readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// campos canônicos do glossário
const src = readFileSync('lib/anthropic/stage1-glossary.ts', 'utf8')
// group importa: 'sistema_orgao' é zona que DEVE poder dar achado e preservado.
// Marcadores e constitucionais vivem em constituicao_base / dentro do achado — não
// se espera que apareçam como campo próprio, e contá-los inflaria o problema.
const campos = [...src.matchAll(/group:\s*'([^']+)',\s*campo:\s*'([^']+)'/g)].map((m) => ({ grupo: m[1], campo: m[2] }))
const CONSTITUCIONAIS = new Set(['pupila','trama_fibras','bordas_pupilares','cor_predominante'])

const { data } = await sb.from('report_findings').select('exame_json').is('superseded_at', null).limit(60)
const ach = new Map(), pres = new Map()
let n = 0
for (const f of data ?? []) {
  const e = f.exame_json || {}
  n++
  for (const a of e.achados_de_atencao ?? []) { const c = String(a.campo ?? ''); if (c) ach.set(c, (ach.get(c) ?? 0) + 1) }
  for (const p of e.sistemas_preservados ?? []) { const c = String(p.campo ?? ''); if (c) pres.set(c, (pres.get(c) ?? 0) + 1) }
}

const linhas = campos
  .filter((x) => !CONSTITUCIONAIS.has(x.campo))
  .map((x) => ({ c: x.campo, grupo: x.grupo, a: ach.get(x.campo) ?? 0, p: pres.get(x.campo) ?? 0 }))
const cego = (x) => x.a === 0 && x.p === 0 ? '⛔ INVISÍVEL — nunca aparece'
  : x.a === 0 ? '⚠️ nunca dá ACHADO'
  : x.p === 0 ? '⚠️ nunca dá PRESERVADO'
  : '✅'

console.log(`${n} leituras · ${campos.length} campos no glossário\n`)
console.log('campo                             achado  preserv.  situação')
for (const x of linhas.sort((a, b) => (a.a + a.p) - (b.a + b.p))) {
  console.log(`  ${x.c.padEnd(32)} ${String(x.grupo).padEnd(18)} ${String(x.a).padStart(4)} ${String(x.p).padStart(8)}   ${cego(x)}`)
}
const inv = linhas.filter((x) => x.a === 0 && x.p === 0)
const semAch = linhas.filter((x) => x.a === 0 && x.p > 0)
const semPres = linhas.filter((x) => x.p === 0 && x.a > 0)
console.log(`\nRESUMO de ${campos.length} campos:`)
console.log(`  ⛔ invisíveis (nunca aparecem)   : ${inv.length}  ${inv.map(x=>x.c).join(', ')}`)
console.log(`  ⚠️ nunca dão ACHADO              : ${semAch.length}  ${semAch.map(x=>x.c).join(', ')}`)
console.log(`  ⚠️ nunca dão PRESERVADO          : ${semPres.length}`)
console.log(`  ✅ aparecem dos dois lados        : ${linhas.length - inv.length - semAch.length - semPres.length}`)
