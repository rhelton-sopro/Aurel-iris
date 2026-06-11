// Gera narração (text-to-speech) via OpenAI Audio API e salva em mp3.
// Uso:  node gen-tts.mjs "<texto>" <saida.mp3> [voz] [modelo]
//   voz:    alloy | echo | fable | onyx | nova | shimmer | ash | sage | coral (padrão: onyx)
//   modelo: gpt-4o-mini-tts (padrão) | tts-1 | tts-1-hd
// Chave lida de OPENAI_API_KEY (env ou .env.local na raiz/apresentacao).

import { writeFileSync } from 'node:fs'
import { env } from './load-env.mjs'

const [, , text, outName, voice = 'onyx', model = 'gpt-4o-mini-tts'] = process.argv
if (!text || !outName) {
  console.error('Uso: node gen-tts.mjs "<texto>" <saida.mp3> [voz] [modelo]')
  process.exit(1)
}
const key = env('OPENAI_API_KEY', { required: true })

console.log(`Gerando narração "${outName}" (${model}, voz ${voice})...`)
const res = await fetch('https://api.openai.com/v1/audio/speech', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model, voice, input: text, response_format: 'mp3' }),
})
if (!res.ok) {
  console.error('ERRO', res.status, await res.text())
  process.exit(1)
}
const buf = Buffer.from(await res.arrayBuffer())
writeFileSync(outName, buf)
console.log(`OK -> ${outName} (${buf.length} bytes)`)
