import { SkeletonPage } from '@/components/ui/skeleton-page'

// A tela da leitura é a mais pesada do painel: além das queries, ela monta o
// documento inteiro. É onde a espera sem sinal mais parece travamento.
export default function Loading() {
  return <SkeletonPage linhas={8} />
}
