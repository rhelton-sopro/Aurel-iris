/**
 * Gera o PDF do Mapa do Ser LOCALMENTE, com os mesmos parâmetros do Gotenberg.
 *
 * Existe porque o founder estava sendo o único capaz de ver o PDF ("faz um Gotenberg aí
 * para você olhar essas coisas, para eu não ter que ficar vendo isso"). Sem Docker não dá
 * para subir o Gotenberg — mas ele é um wrapper de Chromium, e o Chrome está instalado.
 * Chamando Page.printToPDF pelo CDP com os MESMOS parâmetros da rota de produção, a
 * paginação sai fiel: mesmo motor, mesmo papel, mesmas margens, mesmo scale.
 *
 * Uso:  node scripts/pdf-local.mjs [reading_id] [saida.pdf]
 *       (sem argumentos usa a leitura de teste do founder)
 *
 * ⚠️ Espelha app/api/readings/[id]/emocional/pdf/route.ts — se os parâmetros mudarem lá,
 * mudar aqui, senão a verificação passa a mentir.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { renderEmocionalStandalone } from './_render-para-pdf.mjs'

const READING = process.argv[2] ?? 'c3841fbf-1c80-4496-aa7f-f2f36d08a796'
const SAIDA = process.argv[3] ?? '_pdf-local/mapa-do-ser.pdf'

// ---- os MESMOS parâmetros da rota de produção (bodyForm) ----
const PDF_OPTS = {
  paperWidth: 8.27,
  paperHeight: 11.69,
  marginTop: 1.2,
  marginBottom: 1.0,
  marginLeft: 0.551,
  marginRight: 0.551,
  printBackground: true,
  scale: 0.95,
  preferCSSPageSize: false,
}

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORTA = 9333

async function cdp(porta, metodo, params, sessionId) {
  const alvos = await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json()
  const alvo = alvos.find((t) => t.type === 'page')
  const ws = new WebSocket(alvo.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  const id = Math.floor(Math.random() * 1e6)
  const resposta = new Promise((res, rej) => {
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id === id) (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result))
    }
    setTimeout(() => rej(new Error('timeout no CDP')), 120000)
  })
  ws.send(JSON.stringify({ id, method: metodo, params, sessionId }))
  const r = await resposta
  ws.close()
  return r
}

const html = await renderEmocionalStandalone(READING)
mkdirSync(path.dirname(SAIDA), { recursive: true })
const htmlPath = path.resolve(path.dirname(SAIDA), '_para-pdf.html')
writeFileSync(htmlPath, html)
console.log(`HTML gerado (${html.length} chars) → ${htmlPath}`)

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORTA}`,
  '--disable-gpu',
  '--no-first-run',
  '--user-data-dir=' + path.resolve('_pdf-local/_perfil'),
  'file:///' + htmlPath.replace(/\\/g, '/'),
], { stdio: 'ignore' })

// espera o CDP responder
for (let i = 0; i < 40; i++) {
  try { await fetch(`http://127.0.0.1:${PORTA}/json/version`); break } catch { await new Promise(r => setTimeout(r, 400)) }
}
await new Promise((r) => setTimeout(r, 2500)) // fontes + layout

const { data } = await cdp(PORTA, 'Page.printToPDF', PDF_OPTS)
writeFileSync(SAIDA, Buffer.from(data, 'base64'))
chrome.kill()

const paginas = (Buffer.from(data, 'base64').toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
console.log(`✓ PDF gerado: ${SAIDA} · ${paginas} páginas`)
