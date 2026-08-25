/**
 * Esqueleto de carregamento das telas do painel.
 *
 * ⚠️ Nenhuma tela do app tinha indicação de carregamento. Dashboard, Leituras,
 * Clientes e a leitura consultam o banco a cada abertura (e o portão de cadastro
 * consulta mais uma vez, antes), então entre o clique e o desenho a tela ANTERIOR
 * ficava parada, sem nada acontecendo. Em conexão ruim o terapeuta clicava de
 * novo achando que não tinha pegado.
 *
 * Não muda o tempo de resposta — muda o que ele vê enquanto espera, que é o que
 * decide se a espera parece o sistema trabalhando ou o sistema travado.
 *
 * `aria-hidden` + `role="status"` no contêiner: o leitor de tela anuncia
 * "carregando" uma vez, em vez de ler dezenas de blocos vazios.
 */
export function SkeletonPage({
  titulo = true,
  linhas = 5,
}: {
  /** Reserva a faixa do título da tela. */
  titulo?: boolean
  /** Quantos blocos de conteúdo desenhar. */
  linhas?: number
}) {
  return (
    <div role="status" aria-label="Carregando" className="space-y-6">
      {titulo && (
        <div className="flex items-center justify-between gap-4">
          <div
            aria-hidden
            className="h-7 w-44 rounded-[2px] bg-ink/10 motion-safe:animate-pulse"
          />
          <div
            aria-hidden
            className="h-9 w-32 rounded-[2px] bg-ink/10 motion-safe:animate-pulse"
          />
        </div>
      )}
      <div aria-hidden className="space-y-3">
        {Array.from({ length: linhas }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-[2px] border border-ink/10 bg-ink/[0.04] motion-safe:animate-pulse"
            // Escalona o pulso pra não piscar tudo em bloco, que lê como
            // "travou" em vez de "carregando".
            style={{ animationDelay: `${i * 90}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
