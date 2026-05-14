import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Iris Codex',
    short_name: 'Iris Codex',
    description: 'Plataforma clínica de relatórios iridológicos funcionais adaptativos.',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#000000',
    background_color: '#ffffff',
    lang: 'pt-BR',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
