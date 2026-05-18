import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    // Pitfall 9 (07-RESEARCH.md): Next.js 15 não traça arquivos .md por
    // default no bundle de função. Sem isso, `vercel deploy` produz ENOENT
    // ao primeiro request porque prompts/system.md e feature-injection.md
    // não estão no .vercel/output/functions/<route>.func/.
    'app/api/readings/[id]/analyze/route': ['./prompts/**/*'],
  },
}

export default nextConfig
