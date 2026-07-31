/**
 * Rasteriza as páginas de um PDF em PNG, para eu PODER OLHAR o resultado.
 *
 * Existe porque o founder foi direto: "dá um jeito de visualizar. Você gerou o PDF e
 * encontra caminho." Sem Docker e sem poppler/ImageMagick, o caminho é o próprio Chrome:
 * o visualizador embutido (PDFium) renderiza o PDF, e o CDP captura a tela.
 *
 * Uso: node scripts/pdf-paginas.mjs [caminho.pdf] [pagina-inicial] [quantas]
 *      node scripts/pdf-paginas.mjs _pdf-local/mapa-do-ser.pdf 6 4
 */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const PDF = path.resolve(process.argv[2] ?? '_pdf-local/mapa-do-ser.pdf')
const INI = Number(process.argv[3] ?? 1)
const QTD = Number(process.argv[4] ?? 3)
const SAIDA = '_pdf-local/paginas'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORTA = 9334

function ws(url) {
  return new Promise((res) => { const s = new WebSocket(url); s.onopen = () => res(s) })
}
let _id = 0
function cmd(sock, method, params = {}, sessionId) {
  const id = ++_id
  return new Promise((res, rej) => {
    const h = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id === id) { sock.removeEventListener('message', h); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result) }
    }
    sock.addEventListener('message', h)
    sock.send(JSON.stringify({ id, method, params, sessionId }))
    setTimeout(() => rej(new Error('timeout ' + method)), 60000)
  })
}

mkdirSync(SAIDA, { recursive: true })
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORTA}`, '--disable-gpu', '--no-first-run',
  '--window-size=1100,1500',
  '--user-data-dir=' + path.resolve('_pdf-local/_perfil-png'),
  'about:blank',
], { stdio: 'ignore' })

for (let i = 0; i < 50; i++) {
  try { await fetch(`http://127.0.0.1:${PORTA}/json/version`); break } catch { await new Promise(r => setTimeout(r, 400)) }
}
const alvos = await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json()
const sock = await ws(alvos.find(t => t.type === 'page').webSocketDebuggerUrl)

const salvas = []
for (let p = INI; p < INI + QTD; p++) {
  const url = 'file:///' + PDF.replace(/\\/g, '/') + '#page=' + p + '&zoom=100'
  // ⚠️ trocar só o #hash NÃO recarrega — o PDFium fica na página anterior e a captura sai
  // repetida. Passar por about:blank força o viewer a reabrir no #page pedido.
  await cmd(sock, 'Page.navigate', { url: 'about:blank' })
  await new Promise(r => setTimeout(r, 300))
  await cmd(sock, 'Page.navigate', { url })
  await new Promise(r => setTimeout(r, 3500))   // PDFium precisa de tempo
  const { data } = await cmd(sock, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const arq = path.join(SAIDA, `pag-${String(p).padStart(2, '0')}.png`)
  writeFileSync(arq, Buffer.from(data, 'base64'))
  salvas.push(arq)
  console.log('✓', arq)
}
chrome.kill()
console.log('\n' + salvas.length + ' página(s) rasterizada(s) em ' + SAIDA)
