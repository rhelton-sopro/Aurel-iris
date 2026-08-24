import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { serialize } from './_motor-lab/serialize.mjs'
const LAB=path.join(process.cwd(),'_motor-lab')
// ⚠️ ESPELHA lib/emocional/gerar.ts — se o teto mudar lá, muda aqui, senão o laboratório
// mede com régua mais curta que a produção e "reprova" o que produção entregaria inteiro.
// 32.000 → 40.000 em 2026-08-23 (decisão do founder; ver docs/DECISOES.md).
const MODEL='claude-sonnet-5', MAX_TOKENS=40000
let _sys=null
const sysPrompt=()=>(_sys ??= readFileSync(path.join(LAB,'prompts/stage2-relatorio-novo-DRAFT.md'),'utf8'))
export async function gerar(exame,nome){
  const client=new Anthropic()
  const msg=await client.messages.stream({
    model:MODEL, max_tokens:MAX_TOKENS,
    system:[{type:'text',text:sysPrompt(),cache_control:{type:'ephemeral'}}],
    messages:[{role:'user',content:[
      {type:'text',text:`<contexto_cliente>\nNome: ${nome}\n</contexto_cliente>`},
      {type:'text',text:`# BLOCO A — STAGE 1 (bruto)\n\`\`\`json\n${JSON.stringify(exame,null,2)}\n\`\`\``},
      {type:'text',text:serialize(exame,nome)},
      {type:'text',text:'Gere agora o Documento do Cliente completo, na voz do cliente. Só o documento — sem preâmbulo, sem JSON, sem encerramento.'},
    ]}],
  }).finalMessage()
  return {markdown:msg.content.filter(b=>b.type==='text').map(b=>b.text).join(''),
          uso:{in:msg.usage.input_tokens,out:msg.usage.output_tokens,stop:msg.stop_reason}}
}
