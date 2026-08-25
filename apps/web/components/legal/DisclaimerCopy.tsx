// audit-vocabulary:allowlist — copy legal cita vocab clínico (diagnóstico,
// tratamento) APENAS para NEGAR (LGPD-05 / posicionamento não-médico).
//
// Copy obrigatória LGPD-05 + diretriz governante project_governing_enfoque_emocional_comportamental:
// Iris Codex NÃO é ferramenta médica. Achado iridológico é LASTRO; produto é
// leitura terapêutica emocional/comportamental + estilo de vida.
//
// Verbatim — NÃO editar sem revisar memory project_iris_codex_quality_bar.
// Single source of truth: o texto longo e o compacto são consumidos também pelo
// rodapé do PDF (lib/pdf/report-print-document via route handler) e pelas páginas
// legais /privacidade + /termos.

import Link from 'next/link'

/**
 * Copy obrigatória completa (LGPD-05). Reforça enquadramento não-médico:
 * apoio à anamnese terapêutica integrativa, não substitui avaliação médica.
 */
export const DISCLAIMER_TEXT =
  'O Iris Codex é uma ferramenta de apoio à anamnese terapêutica integrativa, ' +
  'com enfoque em padrões emocionais, comportamentais e de estilo de vida. ' +
  'NÃO substitui avaliação médica nem constitui diagnóstico clínico ou ' +
  'prescrição de tratamento. As leituras geradas são de natureza simbólica e ' +
  'funcional, voltadas a apoiar o trabalho do terapeuta integrativo — não devem ' +
  'ser usadas para substituir acompanhamento de profissionais de saúde.'

/**
 * Versão condensada (1 linha) — rodapé global de páginas autenticadas e
 * rodapé do PDF. Mantida em sincronia com o layout (dashboard) e o route handler.
 */
export const DISCLAIMER_COMPACT =
  'Ferramenta de apoio à anamnese terapêutica integrativa, não substitui avaliação médica.'

type DisclaimerVariant = 'footer' | 'inline' | 'compact'

/**
 * E-mail de suporte — MESMA fonte de /termos e /privacidade.
 *
 * ⚠️ Duas telas mandam "entre em contato com o suporte" (editar perfil, e o
 * pedido de reembolso) e não existia onde clicar: o endereço só aparecia
 * enterrado dentro das páginas legais, que o rodapé das telas logadas nem
 * linkava. Mandar procurar suporte sem dar o suporte é um beco.
 */
const OPERATOR_EMAIL =
  process.env.NEXT_PUBLIC_OPERATOR_EMAIL ?? 'suporte@iriscodex.com'

/**
 * Componente reusável da copy obrigatória LGPD-05.
 * - `compact`: 1 linha discreta (header/rodapé minimal).
 * - `inline`: parágrafo completo (dentro de páginas legais).
 * - `footer`: bloco de rodapé com links legais (privacidade / termos / exclusão).
 *
 * RSC por padrão (sem 'use client') — importável em qualquer superfície.
 * Usa tokens semânticos do projeto (text-ink / text-mist / tracking-label),
 * NÃO classes prose-* (inertes — Tailwind v4 sem typography plugin).
 */
export function DisclaimerCopy({
  variant = 'footer',
}: {
  variant?: DisclaimerVariant
}) {
  // `compact` agora leva os links junto: é o rodapé das telas logadas, e era o
  // único lugar do app autenticado onde Privacidade, Termos e Suporte cabiam.
  if (variant === 'compact') {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-[10.5px] uppercase tracking-label text-mist">
          {DISCLAIMER_COMPACT}
        </p>
        <p className="text-[10.5px] uppercase tracking-label text-mist">
          <Link href="/privacidade" className="underline">
            Privacidade
          </Link>
          {' · '}
          <Link href="/termos" className="underline">
            Termos
          </Link>
          {' · '}
          <a href={`mailto:${OPERATOR_EMAIL}`} className="underline">
            Suporte
          </a>
        </p>
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <p className="text-sm leading-relaxed text-mist">{DISCLAIMER_TEXT}</p>
    )
  }

  // footer
  return (
    <footer className="border-t border-ink/15 bg-ivory/40 px-6 py-6 text-center">
      <p className="mx-auto max-w-3xl text-xs leading-relaxed text-mist">
        {DISCLAIMER_TEXT}
      </p>
      <p className="mt-3 text-[10.5px] uppercase tracking-label text-mist">
        <Link href="/privacidade" className="underline">
          Privacidade
        </Link>
        {' · '}
        <Link href="/termos" className="underline">
          Termos
        </Link>
        {' · '}
        <Link href="/privacidade#deletar-dados" className="underline">
          Solicitar exclusão
        </Link>
        {' · '}
        <a href={`mailto:${OPERATOR_EMAIL}`} className="underline">
          Suporte
        </a>
      </p>
    </footer>
  )
}
