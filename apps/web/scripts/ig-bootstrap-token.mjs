/**
 * ig-bootstrap-token.mjs — Bootstrap ÚNICO da conexão Instagram (Fase 12 / IGPUB).
 *
 * Caminho: "Instagram API with Instagram Login" (graph.instagram.com), SEM Página
 * do Facebook, dev mode, SEM App Review. Roda UMA vez para semear o token de longa
 * duração (~60d) em `app_settings.instagram_token` e descobrir o IG Business Account ID.
 *
 * O QUE VOCÊ FAZ ANTES (só você consegue — conta/navegador):
 *   1. Converter o IG para Professional (Business/Creator).
 *   2. developers.facebook.com → criar app → produto "Instagram" (Instagram API with Instagram Login).
 *   3. App roles → Roles → Instagram Testers → convidar seu @username; aceitar em
 *      instagram.com → Settings → Apps and Websites → Tester Invites.
 *   4. No app: Instagram → API setup with Instagram login → anotar APP_ID + APP_SECRET,
 *      e em "OAuth redirect URIs" cadastrar uma URI (ex.: https://iriscodex.com/ ).
 *   5. Abrir no navegador (troque APP_ID e REDIRECT):
 *        https://www.instagram.com/oauth/authorize?client_id=APP_ID&redirect_uri=REDIRECT&response_type=code&scope=instagram_business_basic,instagram_business_content_publish
 *      Autorizar → o navegador redireciona pra REDIRECT?code=XXXXXX#_ . Copie o code
 *      (TUDO antes do "#", e sem o "#_" do final).
 *
 * DEPOIS rode (na pasta apps/web):
 *   node scripts/ig-bootstrap-token.mjs \
 *     --app-id=APP_ID --app-secret=APP_SECRET \
 *     --redirect=https://iriscodex.com/ --code=O_CODE_DO_NAVEGADOR
 *
 *   (ou exporte INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET / IG_REDIRECT_URI / IG_CODE)
 *
 * O script: troca code→token curto→token longo (~60d), pega o IG id, e faz upsert
 * em app_settings.instagram_token com o shape que lib/instagram/token.ts espera.
 * NUNCA imprime o access_token inteiro (só prefixo) nem o grava em log.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const TOKEN_KEY = 'instagram_token'

function arg(name, envName) {
  const cli = process.argv.find((a) => a.startsWith(`--${name}=`))
  if (cli) return cli.slice(name.length + 3)
  return envName ? process.env[envName] ?? null : null
}
function readEnvLocal(key) {
  try {
    const env = readFileSync('.env.local', 'utf8')
    const m = env.match(new RegExp(`^${key}=(.*)$`, 'm'))
    return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null
  } catch {
    return null
  }
}
const mask = (t) => (t ? `${t.slice(0, 6)}…(${t.length} chars)` : '(vazio)')

const APP_ID = arg('app-id', 'INSTAGRAM_APP_ID')
const APP_SECRET = arg('app-secret', 'INSTAGRAM_APP_SECRET')
const REDIRECT = arg('redirect', 'IG_REDIRECT_URI')
const CODE = (arg('code', 'IG_CODE') || '').replace(/#_?$/, '')

if (!APP_ID || !APP_SECRET || !REDIRECT || !CODE) {
  console.error('Faltam args. Necessário: --app-id, --app-secret, --redirect, --code')
  console.error('Veja o cabeçalho deste arquivo para os passos de navegador.')
  process.exit(1)
}

const SUPABASE_URL = readEnvLocal('SUPABASE_URL') || readEnvLocal('NEXT_PUBLIC_SUPABASE_URL')
const SERVICE_KEY = readEnvLocal('SUPABASE_SERVICE_ROLE_KEY')
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não encontrados em apps/web/.env.local')
  process.exit(1)
}

async function main() {
  // 1. code → token curto (~1h)
  console.log('1/4  Trocando code por token curto…')
  const form = new URLSearchParams({
    client_id: APP_ID,
    client_secret: APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT,
    code: CODE,
  })
  const r1 = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  const j1 = await r1.json()
  if (!r1.ok || !j1.access_token) {
    console.error('Falha no code→curto:', JSON.stringify(j1))
    console.error('Dicas: o code expira em minutos (gere de novo); o redirect_uri tem que ser IDÊNTICO ao cadastrado e ao usado no authorize.')
    process.exit(1)
  }
  const shortTok = j1.access_token
  console.log('     ok — token curto', mask(shortTok), '| user_id:', j1.user_id)

  // 2. curto → longo (~60d)
  console.log('2/4  Trocando curto por longo (~60d)…')
  const r2 = await fetch(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(APP_SECRET)}&access_token=${encodeURIComponent(shortTok)}`,
  )
  const j2 = await r2.json()
  if (!r2.ok || !j2.access_token) {
    console.error('Falha no curto→longo:', JSON.stringify(j2))
    process.exit(1)
  }
  const longTok = j2.access_token
  const expiresIn = Number(j2.expires_in || 5184000) // ~60d
  console.log('     ok — token longo', mask(longTok), '| expira em', Math.round(expiresIn / 86400), 'dias')

  // 3. /me → IG id
  console.log('3/4  Buscando o IG Business Account ID…')
  const r3 = await fetch(
    `https://graph.instagram.com/me?fields=id,username&access_token=${encodeURIComponent(longTok)}`,
  )
  const j3 = await r3.json()
  if (!r3.ok || !j3.id) {
    console.error('Falha no /me:', JSON.stringify(j3))
    process.exit(1)
  }
  console.log('     ok — IG id:', j3.id, '| @' + (j3.username || '?'))

  // 4. seed app_settings.instagram_token
  console.log('4/4  Gravando o token em app_settings.instagram_token…')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + expiresIn * 1000)
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const { error } = await supabase.from('app_settings').upsert(
    {
      key: TOKEN_KEY,
      value: {
        access_token: longTok,
        expires_at: expiresAt.toISOString(),
        obtained_at: now.toISOString(),
        last_refresh_at: null,
      },
      updated_at: now.toISOString(),
    },
    { onConflict: 'key' },
  )
  if (error) {
    console.error('Falha no upsert do app_settings:', error.message)
    process.exit(1)
  }
  console.log('     ok — token semeado (expira', expiresAt.toISOString(), ')')

  console.log('\n========================================================')
  console.log('PRONTO. Falta só setar a env no Vercel (PROD) e redeploy:')
  console.log('')
  console.log(`  echo "${j3.id}" | vercel env add INSTAGRAM_BUSINESS_ACCOUNT_ID production`)
  console.log(`  echo "${APP_ID}" | vercel env add INSTAGRAM_APP_ID production`)
  console.log('  # (INSTAGRAM_APP_SECRET é opcional no runtime — o refresh usa ig_refresh_token sem secret)')
  console.log('')
  console.log('Depois: redeploy (vercel deploy --prod) e teste "Publicar agora" no painel.')
  console.log('========================================================')
}

main().catch((e) => {
  console.error('Erro inesperado:', e?.message || e)
  process.exit(1)
})
