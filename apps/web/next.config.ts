import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // A landing "O Espelho" foi promovida de /lp para a raiz "/" (2026-06-03).
  // Redirect permanente preserva links de campanha já compartilhados e consolida
  // a autoridade de SEO na raiz (308 = permanente, mantém o método HTTP).
  async redirects() {
    return [{ source: '/lp', destination: '/', permanent: true }]
  },
  // Deck de apresentação/devolutiva (estático em public/devolutiva/index.html).
  // Rewrite serve o HTML na URL limpa /devolutiva — sem o rewrite, a URL sem
  // extensão poderia não resolver pro index.html. Imagens usam caminho absoluto
  // (/devolutiva/img/...), então funcionam com ou sem barra final.
  async rewrites() {
    return [
      { source: '/devolutiva', destination: '/devolutiva/index.html' },
      // (O /admin/painel deixou de ser rewrite estático em 2026-06-12 — virou
      //  rota Next real: app/admin/painel/page.tsx, fila de aprovação funcional
      //  v1, migration 0045. Os assets img/*.png e o reel seguem em
      //  public/admin/painel/ e são servidos como estáticos normais.)
    ]
  },
  outputFileTracingIncludes: {
    // Pitfall 9 (07-RESEARCH.md): Next.js 15 não traça arquivos .md por
    // default no bundle de função. Sem isso, `vercel deploy` produz ENOENT
    // ao primeiro request porque prompts/system.md e feature-injection.md
    // não estão no .vercel/output/functions/<route>.func/.
    'app/api/readings/[id]/analyze/route': ['./prompts/**/*'],
    // ⚠️ A chave acima é INERTE (ver a explicação da CHAVE=ROTA logo abaixo) — o
    // system.md só chegava ao bundle porque o tracer analisa `fs` por conta própria.
    // Desde 2026-07-30 esta rota também gera o MAPA DO SER, então passou a depender
    // do prompt e da tabela-lastro do motor. Aqui a chave está no formato certo:
    '/api/readings/*/analyze': [
      './prompts/**/*',
      './_motor-lab/lastro/**/*.md',
      './_motor-lab/prompts/**/*.md',
      './_motor-lab/*.mjs',
    ],
    // A PÁGINA DA LEITURA passou a renderizar o Mapa do Ser inline (antes só
    // exibia o dossiê, que não usa o motor).
    '/leituras/*': [
      './_motor-lab/lastro/**/*.md',
      './_motor-lab/relatorio-novo/*.html',
      './_motor-lab/*.mjs',
    ],
    // Relatório emocional: o motor lê a tabela-lastro, o mapa de eixos, o prompt e os
    // dois HTML de design em runtime. Mesmo pitfall do system.md — sem isto, ENOENT no
    // primeiro request em produção.
    // O relatório emocional lê a tabela-lastro, o mapa de eixos, o prompt e os dois HTML
    // de design em runtime. Mesmo pitfall do system.md — sem isto, ENOENT no 1º request.
    // A rota de geração precisa do prompt; as que RENDERIZAM precisam dos HTML de design.
    // ⚠️ A CHAVE É A ROTA (URL), não o caminho do arquivo — picomatch contra o route
    // path, tipo `/api/hello`. As chaves originais (`app/api/.../route`) nunca casaram
    // com nada: as três entradas do emocional eram INERTES. A rota de geração só
    // funcionava porque o tracer analisa `fs` sozinho e puxou o lab por conta própria;
    // a página e o PDF não tiveram a mesma sorte e davam 500 no carregamento do módulo.
    // Dois detalhes que mordem: route group `(dashboard)` NÃO aparece na URL, e `[id]`
    // é classe de caractere no picomatch — por isso `*` no segmento dinâmico.
    '/api/readings/*/emocional': [
      './_motor-lab/lastro/**/*.md',
      './_motor-lab/prompts/**/*.md',
      './_motor-lab/*.mjs',
    ],
    '/api/readings/*/emocional/pdf': [
      './_motor-lab/lastro/**/*.md',
      './_motor-lab/relatorio-novo/*.html',
      './_motor-lab/*.mjs',
    ],
    '/leituras/*/emocional': [
      './_motor-lab/lastro/**/*.md',
      './_motor-lab/relatorio-novo/*.html',
      './_motor-lab/*.mjs',
    ],
  },
}

export default nextConfig
