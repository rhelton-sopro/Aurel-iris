#!/usr/bin/env node
// Servidor estático do lab (out/) — porta 8899. Sem dependência, sem cache.
// uso: node apps/web/_motor-lab/serve.mjs
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('apps/web/_motor-lab/out')
const PORT = 8899
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.mp4': 'video/mp4' }

http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'
  const file = path.join(ROOT, rel)
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('nope'); return }
  fs.readFile(file, (err, buf) => {
    if (err) {
      // sem index? lista o diretório
      if (rel === 'index.html') {
        const ls = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).sort()
        res.writeHead(200, { 'content-type': MIME['.html'] })
        return res.end(`<meta charset=utf-8><title>lab</title><body style="font:15px system-ui;padding:30px">
          <h2>_motor-lab / out</h2><ul>${ls.map((f) => `<li><a href="/${f}">${f}</a></li>`).join('')}</ul>`)
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      return res.end(`404 — ${rel}\n\nDisponíveis:\n` + fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')).join('\n'))
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' })
    res.end(buf)
  })
}).listen(PORT, () => console.log(`lab servindo ${ROOT} em http://localhost:${PORT}/`))
