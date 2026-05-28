/**
 * Render HTML do termo de consentimento biométrico para o Gotenberg
 * (/forms/chromium/convert/html). Espelha o padrão de
 * apps/web/lib/pdf/report-print-document.tsx — HTML/CSS server-side,
 * Gotenberg (Chromium em Render) faz a conversão pra PDF.
 *
 * Não usa renderer de markdown pesado — um mdToHtml mínimo cobre os
 * elementos do term-v1.md (headers #/##/###, parágrafos, listas, **bold**,
 * *italic*, blockquotes >). Reduz superfície de bug e dependências.
 *
 * O footer-audit grava IP + data/hora BRT + versão do termo + SHA-256 do
 * texto hidratado (T-08-08-01 reforço / RESEARCH §LGPD-01 D-17).
 */
import 'server-only'

export interface TermoPdfProps {
  hydratedMarkdown: string
  clienteNome: string
  clienteCpf?: string | null
  terapeutaNome: string
  terapeutaCnpjCpf?: string | null
  consentTimestampBR: string // "27/05/2026 14:35 BRT"
  consentIp: string | null
  consentUserAgent: string | null
  contentSha256: string // hash do termo hidratado, exibido no footer
  termVersion: string // "v1"
}

export function renderTermoHtml(p: TermoPdfProps): string {
  const bodyHtml = mdToHtml(p.hydratedMarkdown)
  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 18mm 16mm 24mm 16mm; }
  body { font-family: Georgia, 'Times New Roman', serif; font-size: 11.5pt; color: #1a1a1a; line-height: 1.55; }
  h1 { font-size: 16pt; margin: 0 0 12pt 0; border-bottom: 1.5px solid #1a1a1a; padding-bottom: 6pt; }
  h2 { font-size: 13pt; margin: 16pt 0 6pt 0; }
  h3 { font-size: 11.5pt; margin: 12pt 0 4pt 0; font-weight: bold; }
  p { margin: 6pt 0; }
  ul { margin: 4pt 0 8pt 18pt; }
  li { margin: 2pt 0; }
  blockquote { margin: 8pt 0; padding: 6pt 10pt; border-left: 3px solid #999; background: #f5f5f5; font-style: italic; }
  hr { border: none; border-top: 0.5px solid #ccc; margin: 12pt 0; }
  .footer-audit {
    position: fixed; bottom: 6mm; left: 16mm; right: 16mm;
    font-size: 7.5pt; color: #444; border-top: 0.5px solid #999; padding-top: 4pt;
    font-family: 'Courier New', monospace; word-break: break-all;
  }
</style>
</head>
<body>
${bodyHtml}
<div class="footer-audit">
  <strong>Registro de aceite eletrônico:</strong> ${escapeHtml(p.consentTimestampBR)} —
  IP ${escapeHtml(p.consentIp) || '—'} — Versão do termo ${escapeHtml(p.termVersion)} —
  SHA-256: ${escapeHtml(p.contentSha256)}<br/>
  <span>Titular: ${escapeHtml(p.clienteNome)}${p.clienteCpf ? ` (CPF ${escapeHtml(p.clienteCpf)})` : ''}.
  Responsável: ${escapeHtml(p.terapeutaNome)}${p.terapeutaCnpjCpf ? ` (CNPJ/CPF ${escapeHtml(p.terapeutaCnpjCpf)})` : ''}.</span>
</div>
</body></html>`
}

function escapeHtml(s: string | null | undefined): string {
  return (s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

/**
 * Markdown → HTML mínimo: headers (#, ##, ###), parágrafos, listas (- ),
 * blockquotes (> ), hr (---), **bold**, *italic*. Não é parser completo;
 * term-v1.md usa markdown simples.
 */
function mdToHtml(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inList = false
  const closeList = () => {
    if (inList) {
      out.push('</ul>')
      inList = false
    }
  }
  for (const line of lines) {
    const trimmed = line.trimEnd()
    if (trimmed === '---') {
      closeList()
      out.push('<hr/>')
      continue
    }
    if (trimmed.startsWith('### ')) {
      closeList()
      out.push(`<h3>${inline(trimmed.slice(4))}</h3>`)
      continue
    }
    if (trimmed.startsWith('## ')) {
      closeList()
      out.push(`<h2>${inline(trimmed.slice(3))}</h2>`)
      continue
    }
    if (trimmed.startsWith('# ')) {
      closeList()
      out.push(`<h1>${inline(trimmed.slice(2))}</h1>`)
      continue
    }
    if (trimmed.startsWith('> ')) {
      closeList()
      out.push(`<blockquote>${inline(trimmed.slice(2))}</blockquote>`)
      continue
    }
    if (trimmed.startsWith('- ')) {
      if (!inList) {
        out.push('<ul>')
        inList = true
      }
      out.push(`<li>${inline(trimmed.slice(2))}</li>`)
      continue
    }
    closeList()
    if (trimmed) out.push(`<p>${inline(trimmed)}</p>`)
    else out.push('')
  }
  closeList()
  return out.join('\n')
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}
