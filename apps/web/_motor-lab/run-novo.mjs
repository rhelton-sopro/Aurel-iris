#!/usr/bin/env node
// RUNNER do relatório NOVO (Stage 2 doc-do-cliente, híbrido). OFF-PROD, standalone.
// system = prompts/stage2-relatorio-novo-DRAFT.md · user = A(Stage1) + B+C(serialize.mjs).
// Roda a partir da RAIZ do repo (paths do motor-calc são repo-root).
// uso: node apps/web/_motor-lab/run-novo.mjs [self|daniel|miguel] [modelo]
import { readFileSync, writeFileSync } from 'node:fs'
import Anthropic from '@anthropic-ai/sdk'
import { serialize } from './serialize.mjs'
import { EXAM } from './motor-calc.mjs'

function loadEnv(p) { const o = {}; for (const l of readFileSync(p, 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue; let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); o[m[1]] = v } return o }
const env = loadEnv('apps/web/.env.local')
const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

const name = process.argv[2] || 'self'
const model = process.argv[3] || 'claude-sonnet-5'
const NOME = { self: 'Rhelton', daniel: 'Daniel', miguel: 'Miguel' }[name] || name

const SYSTEM = readFileSync('apps/web/_motor-lab/prompts/stage2-relatorio-novo-DRAFT.md', 'utf8')
const exame = JSON.parse(readFileSync(EXAM(name), 'utf8'))
const blocosBC = serialize(name)

const userContent = [
  { type: 'text', text: `<contexto_cliente>\nNome: ${NOME}\n</contexto_cliente>` },
  { type: 'text', text: `# BLOCO A — STAGE 1 (bruto)\n\`\`\`json\n${JSON.stringify(exame, null, 2)}\n\`\`\`` },
  { type: 'text', text: blocosBC },
  { type: 'text', text: 'Gere agora o Documento do Cliente completo (os 6 blocos, na voz do cliente). Só o documento — sem preâmbulo, sem JSON, sem encerramento.' },
]

const short = model.replace('claude-', '')
const t0 = Date.now()
console.log(`rodando ${name} [${short}]… (system ${SYSTEM.length} chars · B+C ${blocosBC.length} chars)`)
try {
  const msg = await client.messages.stream({ // streaming: exigido pra outputs longos (>10min possíveis)
    model, max_tokens: 24000,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userContent }],
  }).finalMessage()
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  const out = `apps/web/_motor-lab/out/novo-${name}--${short}.md`
  writeFileSync(out, text)
  const words = text.trim().split(/\s+/).length
  console.log(`✓ ${name} [${short}] — ${words} palavras · in ${msg.usage.input_tokens}tok / out ${msg.usage.output_tokens}tok · ${Date.now() - t0}ms`)
  console.log(`→ ${out}`)
} catch (e) {
  console.log(`✗ ${name} [${short}] — ${e.status || ''} ${e.message}`)
  process.exit(1)
}
