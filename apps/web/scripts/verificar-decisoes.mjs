/**
 * Confere se as decisões declaradas em `docs/DECISOES.md` estão REALMENTE no código.
 *
 * Existe por causa de 2026-07-31: uma decisão sobre o modelo do Stage 1 se perdeu entre
 * sessões, e ninguém sabia dizer se o que estava no ar era o que tinha sido decidido.
 * Registrar não basta — o elo que faltava era verificar que a decisão CHEGOU ao código.
 *
 * Uso: node scripts/verificar-decisoes.mjs   (de apps/web)
 * Sai com código 1 se algo divergir — dá pra plugar em hook/CI.
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const RAIZ = process.cwd()
const DOC = path.resolve(RAIZ, '../../docs/DECISOES.md')

const ler = (p) => (existsSync(path.resolve(RAIZ, p)) ? readFileSync(path.resolve(RAIZ, p), 'utf8') : null)

/**
 * Cada checagem diz: o que a decisão manda, e como isso se prova no código.
 * `esperado` é lido do DECISOES.md para o doc ser a fonte — não uma segunda cópia aqui.
 */
const CHECAGENS = [
  {
    nome: 'Modelo do Stage 1 (ler a íris)',
    linhaDoDoc: 'Modelo do **Stage 1**',
    achar: () => {
      const src = ler('lib/anthropic/client.ts')
      return /export const MODEL = process\.env\.ANTHROPIC_MODEL \?\? '([^']+)'/.exec(src ?? '')?.[1]
    },
    nota: 'pode ser sobrescrito pela env ANTHROPIC_MODEL na Vercel — conferir lá também',
  },
  {
    nome: 'Modelo da localização da pupila',
    linhaDoDoc: 'localização da pupila',
    achar: () => {
      const src = ler('lib/canonicalize/pupil-center.ts')
      return /'(claude-[a-z0-9-.]+)'/.exec(src ?? '')?.[1]
    },
  },
  {
    nome: 'Modelo do Stage 2 — Mapa do Ser',
    linhaDoDoc: 'Mapa do Ser** |',
    achar: () => {
      const src = ler('lib/emocional/gerar.ts')
      return /const MODEL = '([^']+)'/.exec(src ?? '')?.[1]
    },
  },
]

if (!existsSync(DOC)) {
  console.error(`✗ docs/DECISOES.md não encontrado em ${DOC}`)
  process.exit(1)
}
const doc = readFileSync(DOC, 'utf8')

/** Extrai o valor entre crases da linha da tabela que contém `marca`. */
function declarado(marca) {
  const linha = doc.split('\n').find((l) => l.includes(marca) && l.startsWith('|'))
  if (!linha) return null
  return /`([^`]+)`/.exec(linha)?.[1] ?? null
}

let falhas = 0
console.log('Conferindo docs/DECISOES.md contra o código…\n')
for (const c of CHECAGENS) {
  const esperado = declarado(c.linhaDoDoc)
  const real = c.achar()
  if (!esperado) {
    console.log(`? ${c.nome}\n    não achei a linha no DECISOES.md (marca: "${c.linhaDoDoc}")`)
    falhas++
    continue
  }
  if (esperado === real) {
    console.log(`✓ ${c.nome}: ${real}${c.nota ? `\n    (${c.nota})` : ''}`)
  } else {
    console.log(`✗ ${c.nome}\n    DECISOES.md diz: ${esperado}\n    código está em : ${real ?? '(não encontrado)'}`)
    falhas++
  }
}

// ===== A TOPOGRAFIA (Jensen) continua no ar? =====
// O founder gastou dias em cima dos livros mapeando hora/anel/olho de cada campo, e o
// Stage 1 já teve o fígado na zona errada (5-7h, que é quadril/coxa/joelho). Se esse
// trabalho sumir do glossário ou parar de chegar ao prompt, o Stage 1 volta a errar em
// silêncio — o modelo continua respondendo, só que sem topografia. Isso se confere, não
// se lembra.
{
  const gloss = ler('lib/anthropic/stage1-glossary.ts') ?? ''
  const prompt = ler('prompts/stage1-scan.md') ?? ''
  const comZona = new Set([...gloss.matchAll(/campo:\s*'([a-z_]+)'[\s\S]{0,600}?zona:\s*'([^']{10,})'/g)].map((m) => m[1]))
  const campos = new Set([...gloss.matchAll(/campo:\s*'([a-z_]+)'/g)].map((m) => m[1]))
  const figado = /figado_vesicula'[\s\S]{0,600}?zona:\s*'([^']+)'/.exec(gloss)?.[1] ?? ''

  console.log('\nTopografia (auditoria Jensen, 4d6a82a):')
  const okCobertura = comZona.size >= 38
  console.log(`${okCobertura ? '✓' : '✗'} ${comZona.size} de ${campos.size} campos com zona definida no glossário`)
  if (!okCobertura) falhas++

  // O fígado é o canário: é lateralizado (só OD) e foi o erro histórico.
  const okFigado = /7:30/.test(figado) && /\bOD\b|DIREITA/.test(figado)
  console.log(`${okFigado ? '✓' : '✗'} fígado em ~7:30-8:15h na íris DIREITA${okFigado ? '' : ` — está como: "${figado.slice(0, 80)}"`}`)
  if (!okFigado) falhas++

  // Tabela no glossário não basta: o modelo só obedece ao que chega no PROMPT.
  const okPrompt = /7:30/.test(prompt) && /anel/i.test(prompt)
  console.log(`${okPrompt ? '✓' : '✗'} a topografia chega ao prompt que o modelo lê`)
  if (!okPrompt) falhas++
}

// O furo que contaminou o estudo de 26/07: harness com enum próprio, defasado do de produção.
const harnesses = ['_audit-3x-anthropic.mjs', '_audit-stage1-4way.mjs', '_audit-stage1-500s5.mjs']
  .filter((f) => existsSync(path.resolve(RAIZ, f)))
if (harnesses.length) {
  console.log('\nHarnesses de estudo com lista de campos HARDCODED (risco de medir com régua errada):')
  for (const h of harnesses) {
    const n = (/const CAMPO_ENUM = \[([^\]]+)\]/.exec(ler(h) ?? '')?.[1] ?? '').split(',').filter(Boolean).length
    if (n) console.log(`   ⚠ ${h}: ${n} campos próprios — produção usa KNOWN_CAMPOS_LIST. Comparar antes de confiar no resultado.`)
  }
}

console.log(falhas === 0 ? '\n✓ tudo conforme o registrado.' : `\n✗ ${falhas} divergência(s).`)
process.exit(falhas === 0 ? 0 : 1)
