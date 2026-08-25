import { SkeletonPage } from '@/components/ui/skeleton-page'

// Ver components/ui/skeleton-page.tsx: nenhuma tela do painel tinha indicação de
// carregamento, e todas consultam o banco a cada abertura.
export default function Loading() {
  return <SkeletonPage />
}
