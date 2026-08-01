/**
 * Detecta PÁGINAS EM BRANCO (ou quase) num PDF, medindo a TINTA de cada página.
 *
 * Existe porque o founder pegou uma folha totalmente em branco entre a linha do tempo e
 * as Heranças transgeracionais que eu não vi olhando página a página — conferir 34 páginas
 * no olho não escala e falha. Isto mede, não confia no meu olho.
 *
 * Método: rasteriza cada página pelo visualizador do Chrome (PDFium), recorta a área útil
 * da folha e conta os pixels que não são papel. Página em branco fica ordens de grandeza
 * abaixo das demais.
 *
 * Uso: node scripts/pdf-paginas-vazias.mjs [caminho.pdf]
 */
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const PDF = path.resolve(process.argv[2] ?? '_pdf-local/mapa-do-ser.pdf')
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORTA = 9338
const LIMIAR = 0.004 // fração de pixels com tinta abaixo da qual a página é "vazia"

const ws = (url) => new Promise((res) => { const s = new WebSocket(url); s.onopen = () => res(s) })
let _id = 0
function cmd(sock, method, params = {}) {
  const id = ++_id
  return new Promise((res, rej) => {
    const h = (ev) => { const m = JSON.parse(ev.data); if (m.id === id) { sock.removeEventListener('message', h); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result) } }
    sock.addEventListener('message', h)
    sock.send(JSON.stringify({ id, method, params }))
    setTimeout(() => rej(new Error('timeout ' + method)), 60000)
  })
}

mkdirSync('_pdf-local', { recursive: true })
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORTA}`, '--disable-gpu',
  '--no-first-run', '--window-size=1000,1400',
  '--user-data-dir=' + path.resolve('_pdf-local/_perfil-vazias'), 'about:blank'], { stdio: 'ignore' })
for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${PORTA}/json/version`); break } catch { await new Promise(r => setTimeout(r, 400)) } }
const alvos = await (await fetch(`http://127.0.0.1:${PORTA}/json/list`)).json()
const sock = await ws(alvos.find((t) => t.type === 'page').webSocketDebuggerUrl)

// quantas páginas tem: abre uma vez e lê o contador do visualizador
await cmd(sock, 'Page.navigate', { url: 'file:///' + PDF.replace(/\\/g, '/') + '#navpanes=0' })
await new Promise((r) => setTimeout(r, 4000))
const TOTAL = Number(process.argv[3] ?? 0) || 34

const medidas = []
for (let p = 1; p <= TOTAL; p++) {
  // ⚠️ trocar só o #hash NÃO recarrega o PDFium — passar por about:blank (mesma
  // armadilha documentada em pdf-paginas.mjs; sem isso a medição sai repetida).
  await cmd(sock, 'Page.navigate', { url: 'about:blank' })
  await new Promise((r) => setTimeout(r, 200))
  await cmd(sock, 'Page.navigate', { url: 'file:///' + PDF.replace(/\\/g, '/') + `#page=${p}&zoom=100&navpanes=0` })
  await new Promise((r) => setTimeout(r, 2600))
  const { data } = await cmd(sock, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const buf = Buffer.from(data, 'base64')
  // recorta a área útil da folha (evita barra do visualizador e as bordas cinza)
  const img = sharp(buf).extract({ left: 130, top: 90, width: 700, height: 1020 }).greyscale()
  const { data: px, info } = await img.raw().toBuffer({ resolveWithObject: true })
  let tinta = 0
  for (let i = 0; i < px.length; i++) if (px[i] < 235) tinta++
  medidas.push({ p, frac: tinta / (info.width * info.height) })
}
chrome.kill()

const vazias = medidas.filter((m) => m.frac < LIMIAR)
for (const m of medidas) {
  const barra = '█'.repeat(Math.max(0, Math.round(m.frac * 200)))
  console.log(`${String(m.p).padStart(3)}  ${(m.frac * 100).toFixed(2).padStart(6)}%  ${barra}${m.frac < LIMIAR ? '   ⛔ VAZIA' : ''}`)
}
console.log(vazias.length ? `\n⛔ ${vazias.length} página(s) em branco: ${vazias.map((m) => m.p).join(', ')}` : '\n✓ nenhuma página em branco')
