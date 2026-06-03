import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // A landing "O Espelho" foi promovida de /lp para a raiz "/" (2026-06-03).
  // Redirect permanente preserva links de campanha já compartilhados e consolida
  // a autoridade de SEO na raiz (308 = permanente, mantém o método HTTP).
  async redirects() {
    return [{ source: '/lp', destination: '/', permanent: true }]
  },
  outputFileTracingIncludes: {
    // Pitfall 9 (07-RESEARCH.md): Next.js 15 não traça arquivos .md por
    // default no bundle de função. Sem isso, `vercel deploy` produz ENOENT
    // ao primeiro request porque prompts/system.md e feature-injection.md
    // não estão no .vercel/output/functions/<route>.func/.
    'app/api/readings/[id]/analyze/route': ['./prompts/**/*'],
  },
}

export default nextConfig
