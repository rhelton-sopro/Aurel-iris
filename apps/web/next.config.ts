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
    // Relatório emocional: o motor lê a tabela-lastro, o mapa de eixos, o prompt e os
    // dois HTML de design em runtime. Mesmo pitfall do system.md — sem isto, ENOENT no
    // primeiro request em produção.
    // O relatório emocional lê a tabela-lastro, o mapa de eixos, o prompt e os dois HTML
    // de design em runtime. Mesmo pitfall do system.md — sem isto, ENOENT no 1º request.
    // A rota de geração precisa do prompt; as que RENDERIZAM precisam dos HTML de design.
    'app/api/readings/[id]/emocional/route': [
      './_motor-lab/lastro/**/*.md',
      './_motor-lab/prompts/**/*.md',
      './_motor-lab/*.mjs',
    ],
    'app/api/readings/[id]/emocional/pdf/route': [
      './_motor-lab/lastro/**/*.md',
      './_motor-lab/relatorio-novo/*.html',
      './_motor-lab/*.mjs',
    ],
    'app/(dashboard)/leituras/[id]/emocional/page': [
      './_motor-lab/lastro/**/*.md',
      './_motor-lab/relatorio-novo/*.html',
      './_motor-lab/*.mjs',
    ],
  },
}

export default nextConfig
