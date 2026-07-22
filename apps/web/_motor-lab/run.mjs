// Bancada do MOTOR (Stage 2 alternativo). OFF-PROD, standalone.
// NÃO toca system.md / analyze-direct.ts / billing. Só gera arquivos em _motor-lab/out.
// Uso: node _motor-lab/run.mjs --exame=_exame-self.json --name=Rhelton [--only=A|Bc|Bd] [--model=...]
import { readFileSync, writeFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'

function loadEnv(p){const o={};for(const l of readFileSync(p,'utf8').split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(!m)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);o[m[1]]=v;}return o;}
const env=loadEnv('.env.local')
const client=new Anthropic({apiKey:env.ANTHROPIC_API_KEY})

const arg=n=>{const f=process.argv.find(a=>a.startsWith(`--${n}=`));return f?f.split('=').slice(1).join('='):undefined}
const exameFile=arg('exame')||'_exame-self.json'
const name=arg('name')||'(cliente)'
const only=arg('only')            // A | Bc | Bd
const modelArg=arg('model')       // se setado, roda só esse modelo
const slug=exameFile.replace(/^_exame-/,'').replace(/\.json$/,'')

const GUARD=readFileSync('_motor-lab/prompts/_guardrails.md','utf8')
const buildPrompt=file=>readFileSync(`_motor-lab/prompts/${file}`,'utf8').replace('[GUARDRAILS]',GUARD)
const exame=JSON.parse(readFileSync(exameFile,'utf8'))

const MODELS=modelArg?[modelArg]:['claude-sonnet-5','claude-sonnet-4-6']
const MOTORS=[
  {key:'A',  file:'motor-A-unico.md',   task:'Gere agora o Relatório Único (Zona 1 + Zona 2 + bloco de dados). Só o relatório.'},
  {key:'Bc', file:'motor-B-cliente.md', task:'Gere agora o Documento do Cliente. Só o documento.'},
  {key:'Bd', file:'motor-B-dossie.md',  task:'Gere agora o Dossiê do Terapeuta (+ bloco de dados). Só o dossiê.'},
].filter(m=>!only||m.key===only)

const short=m=>m.replace('claude-','').replace('-2026','')

for(const motor of MOTORS){
  const system=buildPrompt(motor.file)
  for(const model of MODELS){
    const userContent=[
      {type:'text',text:`<client_context>\nNome: ${name}\n</client_context>`},
      {type:'text',text:`<exame_iridologico_da_etapa_1>\n${JSON.stringify(exame,null,2)}\n</exame_iridologico_da_etapa_1>`},
      {type:'text',text:motor.task},
    ]
    const t0=Date.now()
    try{
      const msg=await client.messages.create({
        model, max_tokens:8000,
        system:[{type:'text',text:system,cache_control:{type:'ephemeral'}}],
        messages:[{role:'user',content:userContent}],
      },{maxRetries:1})
      const text=msg.content.filter(b=>b.type==='text').map(b=>b.text).join('')
      const words=text.trim().split(/\s+/).length
      const out=`_motor-lab/out/${slug}--${motor.key}--${short(model)}.md`
      writeFileSync(out,text)
      console.log(`✓ ${slug} ${motor.key} [${short(model)}] — ${words}p, ${Date.now()-t0}ms → ${out}`)
    }catch(e){
      console.log(`✗ ${slug} ${motor.key} [${short(model)}] — ${e.status||''} ${e.message}`)
    }
  }
}
console.log('done.')
