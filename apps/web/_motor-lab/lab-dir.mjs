// Resolve o diretório do lab em RUNTIME — fonte única para todos os módulos do motor.
//
// ⚠️ POR QUE ISTO EXISTE (bug de 2026-07-28, relatório emocional dava 500 em produção):
// `import.meta.url` NÃO sobrevive ao bundle do Next. O webpack o substitui por uma
// string literal com o caminho absoluto da MÁQUINA DE BUILD:
//
//     path.dirname(fileURLToPath("file:///vercel/path0/apps/web/_motor-lab/motor-calc.mjs"))
//
// Esse caminho não existe no runtime da função (/var/task/...), então todo readFileSync
// do motor dava ENOENT no primeiro request. O `outputFileTracingIncludes` do next.config
// não ajudava: os arquivos ESTAVAM no bundle, mas o código olhava pra outra pasta.
//
// A intenção original (um motor só, servindo lab e app) estava certa — o mecanismo é que
// não aguentava o empacotamento. Aqui testamos os candidatos e ficamos com o que de fato
// existe, o que cobre os três modos de execução:
//   1. node direto (lab)      — import.meta.url é real
//   2. Next empacotado        — cai pro cwd, onde o tracing deposita `_motor-lab/`
//   3. lab a partir da raiz   — cwd=raiz do repo
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Sentinela: arquivo que SEMPRE acompanha o lab (as 3 rotas traçam `lastro/**/*.md`).
const SENTINELA = 'lastro/tabela-lastro-CANONICA.md'
const valido = (d) => !!d && existsSync(path.join(d, SENTINELA))

function resolver() {
  const candidatos = []
  // 1. o próprio módulo — correto quando NÃO foi empacotado (lab via node)
  try {
    candidatos.push(path.dirname(fileURLToPath(import.meta.url)))
  } catch {
    // import.meta.url indisponível em algum runtime — segue pros candidatos por cwd
  }
  // 2. Next: cwd é a raiz do app (a pasta que contém .next), e o tracing põe _motor-lab lá
  candidatos.push(path.join(process.cwd(), '_motor-lab'))
  // 3. lab rodando com cwd na raiz do monorepo
  candidatos.push(path.join(process.cwd(), 'apps/web/_motor-lab'))

  for (const c of candidatos) if (valido(c)) return c

  throw new Error(
    `_motor-lab não encontrado (sentinela: ${SENTINELA}). Tentados: ${candidatos.join(' | ')}`,
  )
}

export const LAB_DIR = resolver()
// Raiz do monorepo — só usada pelo modo lab (localizar os _exame-*.json).
export const REPO = path.resolve(LAB_DIR, '../../..')
