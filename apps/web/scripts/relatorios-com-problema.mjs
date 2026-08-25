/**
 * "Ficou algum relatório pendurado?" — rode no INÍCIO DA SESSÃO e avise o founder.
 *
 * Pedido dele em 23/08: além do e-mail na hora, *"deixo um aviso para quando a gente
 * começar a sessão aqui, você me falar"*. Este script é esse aviso.
 *
 * Lista, dos últimos 30 dias:
 *   🔴 INCOMPLETO — saiu com menos de 7 blocos, foi DESCARTADO, a terapeuta NÃO foi
 *      cobrada e está esperando o founder regerar por /admin/regenerar.
 *   🟡 CARO — saiu inteiro e foi entregue, mas passou do limiar de alerta (30.000).
 *
 * Rodar de dentro de apps/web:  node scripts/relatorios-com-problema.mjs
 * Só LÊ o banco — não gera nada, não gasta API, não escreve.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const ALERTA_TOKENS = 30000
const BLOCOS_ESPERADOS = 7
const DIAS = 30

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const desde = new Date(Date.now() - DIAS * 864e5).toISOString()

// INCOMPLETOS: o ramo de descarte grava metadata SEM report_emocional_generated_at.
// É por isso que a busca é por metadata, não por data de geração — a leitura descartada
// não tem data de geração, de propósito (é a prova de sucesso que segura o débito).
const { data: todas, error } = await sb
  .from('readings')
  .select('id, created_at, therapist_id, client_id, report_emocional_generated_at, report_emocional_metadata')
  .gte('created_at', desde)
  .not('report_emocional_metadata', 'is', null)
  .order('created_at', { ascending: false })
if (error) {
  console.error(error.message)
  process.exit(1)
}

const nomes = new Map()
async function nome(tabela, id) {
  if (!id) return '(sem nome)'
  const k = tabela + id
  if (nomes.has(k)) return nomes.get(k)
  const { data } = await sb.from(tabela).select('full_name').eq('id', id).maybeSingle()
  const n = data?.full_name || '(sem nome)'
  nomes.set(k, n)
  return n
}

const incompletos = []
const caros = []
for (const r of todas || []) {
  const m = r.report_emocional_metadata || {}
  if (m.incompleto || (m.blocos != null && m.blocos < BLOCOS_ESPERADOS)) incompletos.push(r)
  else if ((m.tokens_out || 0) > ALERTA_TOKENS) caros.push(r)
}

// ---------- MUDANÇA DE PROMPT EM OBSERVAÇÃO ----------
// O founder escolheu NÃO pagar teste e conferir na primeira leitura real: *"vamos para o
// primeiro terapeuta que rodar, você traz e a gente olha"* (24/08). Enquanto houver uma
// linha aqui, este script MOSTRA o primeiro relatório gerado depois da mudança e mede o
// que ela deveria ter consertado. ⛔ Apagar a entrada depois de conferir com ele.
const EM_OBSERVACAO = [
  {
    desde: '2026-08-25',
    o_que: 'o MECANISMO DA GAVETA nas perguntas do bloco 7 (troca de 24/08, commit c523201)',
    // Os 5 tempos: nomeia · abre a gaveta · entra na cena · o corpo chama · a atenção.
    // Na medição do founder em 24/08: tempos 1-4 saíram em 10/10, o tempo 5 em 7/10.
    // ⛔ Aqui a gente mede o que FALTOU, não o que veio: cada linha é um defeito.
    medir: (md) => {
      const b7 = md.slice(md.indexOf('# Perguntas para a sua sessão'))
      const qs = [...b7.matchAll(/^\s*\d+\.[ \t]+(.*)$/gm)].map((m) => m[1])
      if (!qs.length) return ['bloco 7 sem perguntas numeradas']
      const falta = (rot, re) => {
        const n = qs.filter((q) => re.test(q)).length
        return n >= 7 ? null : `${rot}: só ${n} de ${qs.length}`
      }
      const furo = (rot, re) => {
        const n = qs.filter((q) => re.test(q)).length
        return n ? `⛔ ${rot}: ${n}` : null
      }
      return [
        falta('abre a gaveta', /lembra|última vez|alguma (situação|cena|vez)|vem alguma/i),
        falta('entra na cena', /volta pra|volta para|entra ness|fica ness|como se estivesse|por um instante/i),
        falta('o corpo chama', /alguma parte do corpo|alguma parte que|algum lugar que|chama a (sua )?atenção|pede atenção/i),
        falta('a atenção', /coloca a atenção|põe a atenção|presta atenção|fica com (isso|ela|essa)|ficar mais alguns/i),
        furo('LUGAR na pergunta', /no peito|na garganta|no estômago|nos ombros|esse aperto no/i),
        furo('respiração', /respir|leva o ar/i),
        furo('"lendo isto"', /lendo (isso|isto)|ao ler|enquanto (você )?l[êe]/i),
        furo('ancorada em força', /capacidade de|sua força|facilidade de/i),
      ].filter(Boolean)
    },
  },
]

for (const obs of EM_OBSERVACAO) {
  const novos = (todas || [])
    .filter((r) => r.report_emocional_generated_at && r.report_emocional_generated_at >= obs.desde && r.report_emocional)
    .sort((a, b) => a.report_emocional_generated_at.localeCompare(b.report_emocional_generated_at))
  console.log(`\n👀 EM OBSERVAÇÃO desde ${obs.desde} — ${obs.o_que}`)
  if (!novos.length) {
    console.log('   nenhuma terapeuta gerou ainda. Avisar o founder quando gerar.\n')
    continue
  }
  for (const r of novos) {
    const furos = obs.medir(r.report_emocional)
    console.log(`   ${r.report_emocional_generated_at.slice(0, 16)}  ${await nome('profiles', r.therapist_id)} / ${await nome('clients', r.client_id)}`)
    console.log(furos.length ? `      ⛔ ${furos.length} furo(s): ${furos.map((f) => JSON.stringify(f)).join(' · ')}` : '      ✅ nenhum furo')
  }
  console.log('   >> LEVAR ESTE RESULTADO AO FOUNDER — foi ele quem pediu pra olhar junto.\n')
}

if (!incompletos.length && !caros.length) {
  console.log(`✅ nada pendurado nos últimos ${DIAS} dias.`)
  process.exit(0)
}

if (incompletos.length) {
  console.log(`🔴 ${incompletos.length} RELATÓRIO(S) INCOMPLETO(S) — a terapeuta está esperando, e NÃO foi cobrada:\n`)
  for (const r of incompletos) {
    const m = r.report_emocional_metadata || {}
    console.log(`   ${r.created_at.slice(0, 10)}  ${await nome('profiles', r.therapist_id)} / ${await nome('clients', r.client_id)}`)
    console.log(`      ${m.blocos ?? '?'} de 7 blocos · ${m.tokens_out} tokens · ${m.stop_reason ?? '?'}`)
    console.log(`      >> gerar: https://iriscodex.com/admin/regenerar?reading=${r.id}\n`)
  }
}
if (caros.length) {
  console.log(`🟡 ${caros.length} relatório(s) acima de ${ALERTA_TOKENS.toLocaleString('pt-BR')} tokens (entregues, sem ação):\n`)
  for (const r of caros) {
    const m = r.report_emocional_metadata || {}
    console.log(`   ${r.created_at.slice(0, 10)}  ${await nome('profiles', r.therapist_id)} / ${await nome('clients', r.client_id)} · ${m.tokens_out} tokens · ~US$ ${((m.tokens_out / 1e6) * 10).toFixed(2)}`)
  }
}
