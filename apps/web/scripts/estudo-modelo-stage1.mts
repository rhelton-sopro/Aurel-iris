/**
 * TEMP (não commitar) — Stage 1 PÓS-FIX de topografia: Sonnet 4.6 × Sonnet 5.
 *
 * Por que refazer (2026-07-31): o estudo de 26/07 (_audit-3x-anthropic.mjs) mediu o 4.6
 * ANTES do conserto de topografia (4d6a82a+534cfc2) — e era justamente o falso positivo
 * do fígado que decidia o comparativo. Além disso aquele harness oferecia 45 campos ao
 * modelo, incluindo 5 CONSTITUCIONAIS (trama_fibras, vascularizacao_escleral, pupila,
 * bordas_pupilares, cor_predominante) que produção NÃO aceita como achado: o 4.6 gastava
 * vagas com eles (3/3 e 2/3 no voto), o que contaminava o Jaccard.
 *
 * Aqui o enum vem de KNOWN_CAMPOS_LIST (a MESMA fonte de produção) e o prompt é lido do
 * disco — nada hardcoded que possa derivar.
 *
 * Uso: cd apps/web && npx tsx scripts/estudo-modelo-stage1.mts [amostras]
 */
import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { KNOWN_CAMPOS_LIST } from './lib/anthropic/stage1-glossary'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf-8')
    .split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')] }),
)
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

const PHOTO_DIR = '_audit-500-s5'   // as MESMAS 6 canônicas do estudo de 26/07
const OUT = '_audit-posfix'
const CLIENT_NAME = 'Rhelton'
const CLIENT_AGE = 42
const AMOSTRAS = Number(process.argv[2] ?? 3)
const MODELS = ['claude-sonnet-4-6', 'claude-sonnet-5'] as const

const CAMPO_ENUM = [...KNOWN_CAMPOS_LIST]
const NATUREZA = ['cronica_sustentada','aguda_recente','em_reorganizacao_ativa','herdada_constitucional','indeterminada']
const LAT = ['bilateral_simetrico','bilateral_assimetrico','unilateral_OE','unilateral_OD']
const POL = ['vital_ativo','neutro']
const STAT = ['a_resolver','em_processo','resolvido']
const COR = ['castanho_escuro','castanho_claro','verde_acinzentado','azul','azul_acinzentado','misto']
const TRAMA = ['compacta_densa','media','aberta','irregular']
const PUP = ['centrada_regular','descentrada','deformada','miose','midriase']
const BORD = ['regulares','achatamentos','descentralizacoes','irregulares']
const MOT = ['obscurecimento_estrutural','limitacao_tecnica']

const TOOL = { name:'registrar_exame_iridologico', description:'Registra a observação estruturada da íris após varredura visual das 6 fotos. Use UMA única vez por chamada.', input_schema:{ type:'object', required:['assinatura_visual_caracteristica','achados_de_atencao','sistemas_preservados','correlacoes_observadas','linha_temporal','constituicao_base'], properties:{
  assinatura_visual_caracteristica:{type:'string',minLength:40},
  achados_de_atencao:{type:'array',items:{type:'object',required:['campo','intensidade','natureza_da_carga','lateralidade','descricao_visual','observacao_qualifying'],properties:{campo:{type:'string',enum:CAMPO_ENUM},intensidade:{type:'integer',minimum:1,maximum:5},natureza_da_carga:{type:'string',enum:NATUREZA},lateralidade:{type:'string',enum:LAT},descricao_visual:{type:'string',minLength:15},observacao_qualifying:{type:['string','null']},motivo_indeterminacao:{type:['string','null'],enum:[...MOT,null]}}}},
  sistemas_preservados:{type:'array',items:{type:'object',required:['campo','polaridade_funcional','sinal_visual_positivo','implicacao_funcional','observacao_qualifying'],properties:{campo:{type:'string',enum:CAMPO_ENUM},polaridade_funcional:{type:'string',enum:POL},sinal_visual_positivo:{type:'string',minLength:15},implicacao_funcional:{type:'string',minLength:15},observacao_qualifying:{type:['string','null']}}}},
  correlacoes_observadas:{type:'array',maxItems:4,items:{type:'object',required:['campos','natureza','ancora_visual'],properties:{campos:{type:'array',items:{type:'string',enum:CAMPO_ENUM},minItems:2,maxItems:2},natureza:{type:'string',minLength:20},ancora_visual:{type:'string',minLength:20}}}},
  linha_temporal:{type:'array',items:{type:'object',required:['idade_aproximada','marca_visivel','tipo_provavel','status'],properties:{idade_aproximada:{type:'string',minLength:3},marca_visivel:{type:'string',minLength:15},tipo_provavel:{type:'string',minLength:10},status:{type:'string',enum:STAT}}}},
  constituicao_base:{type:'object',required:['cor_predominante','trama_fibras','pupila','bordas_pupilares','outros_sinais_globais'],properties:{cor_predominante:{type:'string',enum:COR},trama_fibras:{type:'string',enum:TRAMA},pupila:{type:'string',enum:PUP},bordas_pupilares:{type:'string',enum:BORD},outros_sinais_globais:{type:'array',items:{type:'string'}}}},
}}} as const

const files = readdirSync(PHOTO_DIR).filter((f) => f.startsWith('canonical__')).sort()
const imgs = await Promise.all(files.map(async (f) => {
  const buf = await sharp(path.join(PHOTO_DIR, f)).resize(1280, 1280, { fit: 'inside' }).jpeg({ quality: 90 }).toBuffer()
  const [eye, angle] = f.replace('canonical__', '').replace('.jpg', '').split('_')
  return { eye, angle, b64: buf.toString('base64') }
}))
const userContent: any[] = [
  { type: 'text', text: `<client_context>\nNome: ${CLIENT_NAME}\nIdade: ${CLIENT_AGE}\n</client_context>\n\nAbaixo estão as 6 fotografias da íris desta pessoa. Faça a varredura visual estruturada conforme o prompt e registre o exame via UMA chamada da tool registrar_exame_iridologico.` },
  ...imgs.flatMap((i) => [
    { type: 'text', text: `Foto: olho ${i.eye}, ângulo ${i.angle}` },
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: i.b64 } },
  ]),
]
const systemPrompt = readFileSync(path.join('prompts', 'stage1-scan.md'), 'utf-8')
console.log(`prompt ${systemPrompt.length} chars · ${CAMPO_ENUM.length} campos (fonte: KNOWN_CAMPOS_LIST) · ${imgs.length} imagens`)
console.log(`${AMOSTRAS} amostras × ${MODELS.length} modelos\n`)

async function runStage1(model: string) {
  const t0 = Date.now()
  const params: any = { model, max_tokens: 16000, system: [{ type: 'text', text: systemPrompt }], tools: [TOOL], tool_choice: { type: 'tool', name: TOOL.name }, messages: [{ role: 'user', content: userContent }] }
  if (model === 'claude-sonnet-4-6') params.temperature = 0.0  // S5 rejeita temperature (400)
  const resp = await anthropic.messages.create(params)
  const tb: any = resp.content.find((b: any) => b.type === 'tool_use' && b.name === TOOL.name)
  if (!tb) throw new Error('sem tool_use · stop=' + resp.stop_reason)
  return { exame: tb.input, tin: resp.usage.input_tokens, tout: resp.usage.output_tokens, ms: Date.now() - t0 }
}

mkdirSync(OUT, { recursive: true })
let custo = 0
for (const m of MODELS) {
  for (let s = 1; s <= AMOSTRAS; s++) {
    process.stdout.write(`${m} amostra ${s} … `)
    try {
      const r = await runStage1(m)
      writeFileSync(`${OUT}/exame-${m}-s${s}.json`, JSON.stringify(r.exame, null, 2))
      const c = (r.tin * 3 + r.tout * 15) / 1e6
      custo += c
      const ach = (r.exame.achados_de_atencao ?? []).map((a: any) => `${a.campo}(${a.intensidade})`)
      console.log(`ok ${Math.round(r.ms / 1000)}s $${c.toFixed(4)} · ${ach.length} achados`)
      console.log(`   ${ach.join(', ')}`)
    } catch (e: any) {
      console.log('FALHOU:', e.message)
    }
  }
}
console.log(`\ncusto total: $${custo.toFixed(4)}`)
