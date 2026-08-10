import { SEQUENCE, EYE_LABEL } from '@/lib/capture/sequence'

/**
 * Aviso da ordem dos olhos na landing do convite — o TERCEIRO lugar onde ela é
 * dita (founder 2026-08-10). Os outros dois: a mensagem que o terapeuta manda
 * no WhatsApp (lib/invite/mensagem-cliente.ts) e o rótulo do app a cada foto.
 * Mesmo assim tinha cliente começando pelo olho direito — e aí a leitura sai
 * com os dois lados trocados. Aqui ele está com o celular na mão, prestes a
 * fotografar: é o último momento em que o aviso ainda muda o que ele faz.
 *
 * O texto é DERIVADO de SEQUENCE, não escrito à mão: se a ordem de captura
 * mudar, esta caixa acompanha sozinha em vez de virar instrução errada.
 */
export function OrdemDosOlhos() {
  const trocaEm = SEQUENCE.findIndex((s) => s.eye !== SEQUENCE[0].eye)

  // Sem dois blocos de olho distintos não há ordem a explicar — melhor não
  // dizer nada do que inventar uma instrução que a captura não segue.
  if (trocaEm < 1) return null

  const ordinais = SEQUENCE.map((_, i) => `${i + 1}ª`)
  const listar = (xs: string[]) =>
    xs.length > 1 ? `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}` : xs[0]

  const primeiroOlho = EYE_LABEL[SEQUENCE[0].eye].toUpperCase()
  const segundoOlho = EYE_LABEL[SEQUENCE[SEQUENCE.length - 1].eye].toUpperCase()

  return (
    <div className="rounded-md border-2 border-teal bg-teal/5 p-3 space-y-2 text-sm">
      <p className="font-semibold uppercase tracking-wide">A ordem dos olhos importa</p>
      <ul className="space-y-1">
        <li>
          <strong>{listar(ordinais.slice(0, trocaEm))} fotos</strong> — olho{' '}
          <strong>{primeiroOlho}</strong>
        </li>
        <li>
          <strong>{listar(ordinais.slice(trocaEm))} fotos</strong> — olho{' '}
          <strong>{segundoOlho}</strong>
        </li>
      </ul>
      <p className="text-foreground/80">
        Comece pelo olho <strong>{primeiroOlho.toLowerCase()}</strong>. O app mostra em
        cada foto qual é o olho da vez — confira antes de fotografar. Se a ordem
        trocar, a leitura sai trocada.
      </p>
    </div>
  )
}
