import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Cormorant_Garamond } from 'next/font/google'
import { DISCLAIMER_COMPACT } from '@/components/legal/DisclaimerCopy'
import { TopBar } from './TopBar'
import { RevealInit } from './RevealInit'

// ─────────────────────────────────────────────────────────────────────────────
// Landing /lp — "O ESPELHO". Porte da versão do Claude (claude.ai artifact) para
// Next.js, com: fotos macro REAIS (hero, fibras, marfim, olho), Cormorant Garamond
// no display (Georgia segue no relatório/PDF), tokens da marca, links reais e
// DisclaimerCopy. As 5 íris de cor e o mock de relatório ficam procedurais até as
// fotos reais existirem (#8 castanho/âmbar/mel/azul/verde + #6 print).
//
// ⚠️ Antes de abrir ao público: reverter pricing R$5→oficial e virar robots.index=true.
// ─────────────────────────────────────────────────────────────────────────────

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Iris Codex — A íris como espelho',
  description:
    'O Iris Codex transforma a foto da íris do seu cliente numa leitura terapêutica profunda e única — padrões emocionais, comportamentais e de estilo de vida. Para o terapeuta integrativo.',
  robots: { index: false, follow: false }, // ⚠️ founder vira pra true no GA (pós-revert de pricing)
  openGraph: {
    title: 'Seu cliente vai dizer: “é exatamente isso”.',
    description: 'A íris do seu cliente vira uma leitura terapêutica profunda e única.',
    type: 'website',
  },
}

const CORES = [
  { nome: 'castanho', cls: 'castanho' },
  { nome: 'âmbar', cls: 'ambar' },
  { nome: 'mel', cls: 'mel' },
  { nome: 'azul', cls: 'azul' },
  { nome: 'verde', cls: 'verde' },
] as const

const PACOTES = [
  { nome: 'Avulsa', preco: 'R$ 99,70', leituras: '1 leitura', selo: null },
  { nome: 'Pequeno', preco: 'R$ 298,50', leituras: '5 leituras', selo: null },
  { nome: 'Médio', preco: 'R$ 745,50', leituras: '15 leituras', selo: 'Mais escolhido' },
  { nome: 'Grande', preco: 'R$ 1.191,00', leituras: '30 leituras', selo: 'Melhor valor' },
] as const

const FAQ = [
  { q: 'É diagnóstico médico?', a: 'Não — é apoio à anamnese, com enfoque emocional e comportamental. Não substitui avaliação médica.', open: true },
  { q: 'É texto genérico?', a: 'Não — cada relatório é único, escrito para aquela pessoa. Sem horóscopo, sem texto-modelo.', open: false },
  { q: 'Meus dados são seguros?', a: 'Sim — você é o controlador dos dados, em conformidade com a LGPD. As imagens não treinam nenhuma IA.', open: false },
  { q: 'Preciso saber iridologia?', a: 'Não precisa. Uma IA própria, treinada na tradição iridológica, faz a leitura por você. Você revisa, conduz e dá a palavra final — a interpretação e a relação com o cliente são suas.', open: false },
] as const

export default function LandingEspelho() {
  return (
    <div id="top" className={`${cormorant.variable} lp-root`}>
      <LpStyle />
      <RevealInit />
      <TopBar />

      {/* ════════ HERO — escuro limpo, olho inteiro (sem corte) ════════ */}
      <section className="relative flex min-h-screen items-start overflow-hidden bg-black lg:items-center">
        <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-9 px-6 pb-20 pt-28 md:gap-14 md:px-10 md:pt-32 lg:grid-cols-[1.05fr_0.8fr] lg:gap-16">
          <div className="order-1">
            <p className="eyebrow lp-reveal" style={{ color: 'var(--teal-light)' }}>Para o terapeuta integrativo</p>
            <h1 className="display lp-reveal mt-6" data-d="1" style={{ fontSize: 'clamp(2.7rem,6vw,5rem)' }}>
              Em minutos, você lê a alma do seu cliente.<br />
              <em style={{ color: 'var(--teal-light)' }}>Sem saber ler uma íris.</em>
            </h1>
            <p className="body-copy lg lp-reveal mt-7" data-d="2" style={{ color: 'rgba(242,237,228,.82)' }}>
              O Iris Codex faz a leitura pela íris — a história que ele carrega e nunca soube nomear. Seu
              cliente se reconhece, se emociona, e enfim se sente entendido. A própria leitura já é um
              encontro terapêutico: você recebe as perguntas certas e o direcionamento da terapia.
            </p>
            <p className="eyebrow lp-reveal mt-5" data-d="2" style={{ color: 'var(--teal-light)', letterSpacing: '.22em' }}>
              Leitura assistida por IA · ancorada na tradição iridológica
            </p>
            <div className="lp-reveal mt-9 flex flex-wrap items-center gap-x-7 gap-y-4" data-d="3">
              <Link href="/signup" className="btn btn-primary">Começar grátis — 3 leituras</Link>
              <Link href="/login" className="link-quiet text-sm">Já tenho conta · Entrar</Link>
            </div>
            <p className="lp-reveal mt-8 text-xs leading-relaxed" data-d="3" style={{ color: 'rgba(242,237,228,.58)', letterSpacing: '.04em', maxWidth: '48ch' }}>
              Sem cartão · 3 leituras ou 15 dias · Apoio à anamnese, não substitui avaliação médica.
            </p>
          </div>
          <div className="order-2 flex justify-center lp-reveal" data-d="1">
            <div className="lp-hero-frame">
              <Image src="/lp/iris-hero.png" alt="Olho humano em macro — o detalhe que o Iris Codex lê" width={1024} height={1792} priority sizes="(max-width:1024px) 82vw, 400px" className="block h-auto w-full rounded-[2px]" />
            </div>
          </div>
        </div>
        <div className="eyebrow absolute bottom-7 left-1/2 -translate-x-1/2" style={{ color: 'rgba(242,237,228,.4)', fontSize: '.6rem' }}>Role</div>
      </section>

      {/* ════════ PROVA ════════ */}
      <section className="bg-ivory text-black">
        <div className="mx-auto max-w-[1100px] px-6 py-32 text-center md:px-10 md:py-44">
          <hr className="hairline lp-reveal mx-auto" style={{ width: 48, marginBottom: '2.5rem' }} />
          <p className="display lp-reveal" data-d="1" style={{ fontSize: 'clamp(2rem,4.6vw,3.5rem)', color: '#0d0d0d' }}>
            Tem gente que <em style={{ color: 'var(--teal-dark)' }}>chora</em> lendo a própria leitura.
          </p>
          <p className="body-copy lp-reveal mx-auto mt-7" data-d="2" style={{ color: 'var(--mist)', fontSize: '1.05rem' }}>
            Não é promessa de saúde — é o que se sente ao se reconhecer no texto.
          </p>
        </div>
      </section>

      {/* ════════ RELATÓRIO ════════ */}
      <section className="bg-ivory text-black">
        <div className="mx-auto grid max-w-[1280px] items-center gap-14 px-6 pb-32 md:px-10 md:pb-44 lg:grid-cols-2 lg:gap-20">
          <div className="lp-reveal">
            <p className="eyebrow" style={{ color: 'var(--teal-dark)' }}>O relatório</p>
            <h2 className="display mt-6" style={{ fontSize: 'clamp(2.2rem,4.4vw,3.6rem)', color: '#0d0d0d' }}>
              Isto é o que ele recebe <em>das suas mãos.</em>
            </h2>
            <p className="body-copy mt-7" style={{ color: '#3a3a3a', fontSize: '1.08rem' }}>
              Não um mapa com zonas marcadas. Uma leitura terapêutica escrita para aquela pessoa —
              pronta pra você revisar, assinar e entregar.
            </p>
          </div>
          {/* mock de relatório (placeholder até o print real #6) */}
          <div className="lp-reveal" data-d="1">
            <div className="paper relative p-9 md:p-11">
              <div className="flex items-center justify-between">
                <Image src="/logo/iris_codex_para_fundo_branco.png" alt="" width={1600} height={420} className="h-5 w-auto" />
                <span style={{ fontFamily: 'var(--font-geist-mono),monospace', fontSize: '.55rem', letterSpacing: '.2em', color: '#b6ab98', textTransform: 'uppercase' }}>print do relatório</span>
              </div>
              <hr className="rule mt-5 mb-7" />
              <p style={{ fontSize: '.62rem', letterSpacing: '.26em', textTransform: 'uppercase', color: 'var(--teal)', fontWeight: 400, fontFamily: 'var(--font-raleway),sans-serif' }}>Em poucas palavras</p>
              <p className="mt-4" style={{ fontStyle: 'italic', fontSize: '1.45rem', lineHeight: 1.4, color: '#15110b' }}>
                “Uma sensibilidade que sente tudo primeiro — e só depois encontra as palavras.”
              </p>
              <div className="mt-8 space-y-3">
                <div className="ln" style={{ width: '100%' }} /><div className="ln" style={{ width: '96%' }} /><div className="ln" style={{ width: '99%' }} /><div className="ln" style={{ width: '74%' }} />
              </div>
              <p className="mt-7" style={{ fontStyle: 'italic', fontSize: '1.1rem', color: 'var(--teal-dark)' }}>2. Mapa orgânico</p>
              <div className="mt-4 space-y-3">
                <div className="ln" style={{ width: '100%' }} /><div className="ln" style={{ width: '88%' }} /><div className="ln" style={{ width: '93%' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ A LEITURA JÁ É TERAPIA ════════ */}
      <section className="bg-white text-black">
        <div className="mx-auto max-w-[900px] px-6 py-32 text-center md:px-10 md:py-44">
          <p className="eyebrow lp-reveal" style={{ color: 'var(--teal-dark)' }}>O valor que passa despercebido</p>
          <h2 className="display lp-reveal mt-6" data-d="1" style={{ fontSize: 'clamp(2rem,4.6vw,3.6rem)', color: '#0d0d0d' }}>
            Ler o relatório já é <em style={{ color: 'var(--teal-dark)' }}>a primeira sessão.</em>
          </h2>
          <p className="body-copy lp-reveal mx-auto mt-7" data-d="2" style={{ color: '#3a3a3a', fontSize: '1.08rem' }}>
            Quando seu cliente se vê descrito com precisão — os padrões, a história, o que sente e nunca
            soube dizer — algo se move. O reconhecimento, por si só, já é cuidado. A leitura não prepara a
            terapia: ela já é terapia.
          </p>
        </div>
      </section>

      {/* ════════ PROBLEMA (full-bleed fibras) ════════ */}
      <section className="relative overflow-hidden bg-black">
        <Image src="/lp/fibras-wide.png" alt="" fill sizes="100vw" className="object-cover opacity-65" />
        <div className="vignette" aria-hidden="true" />
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.4)' }} aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-[900px] px-6 py-40 text-center md:px-10 md:py-56">
          <h2 className="display lp-reveal" style={{ fontSize: 'clamp(2rem,4.6vw,3.7rem)' }}>
            O difícil nunca foi a íris.<br /><em style={{ color: 'var(--teal-light)' }}>É chegar ao que o cliente não conta.</em>
          </h2>
          <p className="body-copy lp-reveal mx-auto mt-8" data-d="1" style={{ color: 'rgba(242,237,228,.82)', fontSize: '1.08rem' }}>
            Às vezes leva sessões até o cliente se abrir — e até você enxergar por onde conduzir. O Iris
            Codex encurta esse caminho: entrega a história emocional dele em minutos, com as perguntas
            certas pra fazer e a direção pra seguir. Você começa já vendo fundo.
          </p>
        </div>
      </section>

      {/* ════════ MECANISMO ════════ */}
      <section className="bg-ivory text-black">
        <div className="mx-auto grid max-w-[1280px] items-center gap-14 px-6 py-32 md:px-10 md:py-44 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div className="order-2 flex justify-center lg:order-1">
            <div className="lp-iris-photo lp-iris-photo--light lp-reveal" style={{ width: 'min(70vw,380px)' }}>
              <Image src="/lp/iris-marfim.png" alt="Íris humana detalhada sobre fundo claro" fill sizes="(max-width:1024px) 70vw, 380px" className="object-cover" />
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <p className="eyebrow lp-reveal" style={{ color: 'var(--teal-dark)' }}>O método</p>
            <h2 className="display lp-reveal mt-6" data-d="1" style={{ fontSize: 'clamp(2.1rem,4.4vw,3.5rem)', color: '#0d0d0d' }}>
              Tradição como base.<br /><em style={{ color: 'var(--teal-dark)' }}>Método como diferença.</em>
            </h2>
            <div className="mt-12 space-y-9">
              {[
                { n: '01', t: 'Sobre ombros sérios', d: 'Tradição clássica (Jensen, Johnson, Battello, Lindemann), não palpite.' },
                { n: '02', t: 'IA de ponta, com método', d: 'Uma IA própria, treinada na tradição iridológica, gera cada leitura única para aquela pessoa. Sem texto-modelo, sem horóscopo.' },
                { n: '03', t: 'O enfoque certo', d: 'Padrões emocionais, comportamentais e de estilo de vida — não laudo.' },
              ].map((m, i) => (
                <div key={m.n}>
                  {i > 0 && <hr className="mb-9" style={{ border: 0, borderTop: '1px solid #ddd2c0' }} />}
                  <div className="lp-reveal flex gap-6" data-d={String(i + 1)}>
                    <span className="display shrink-0" style={{ fontSize: '1.6rem', color: 'var(--teal)', width: '2.4rem' }}>{m.n}</span>
                    <div>
                      <h3 className="eyebrow" style={{ color: '#0d0d0d', letterSpacing: '.16em', fontSize: '.8rem' }}>{m.t}</h3>
                      <p className="body-copy mt-2" style={{ color: '#4a4a4a' }}>{m.d}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="display lp-reveal mt-12" data-d="3" style={{ fontStyle: 'italic', fontSize: '1.5rem', color: 'var(--teal-dark)' }}>
              Espiritualidade encarnada, com ciência e método.
            </p>
          </div>
        </div>
      </section>

      {/* ════════ COMO FUNCIONA ════════ */}
      <section className="bg-white text-black">
        <div className="mx-auto max-w-[1280px] px-6 py-32 md:px-10 md:py-44">
          <div className="lp-reveal text-center">
            <p className="eyebrow" style={{ color: 'var(--teal-dark)' }}>Como funciona</p>
            <h2 className="display mx-auto mt-6" style={{ fontSize: 'clamp(2.1rem,4.2vw,3.3rem)', color: '#0d0d0d', maxWidth: '18ch' }}>
              Três passos entre a foto e o <em>uau.</em>
            </h2>
          </div>
          <div className="mt-20 grid gap-px md:grid-cols-3" style={{ background: '#e8e0d2' }}>
            {[
              { n: '1', t: 'Capture a íris', d: 'A foto do olho do seu cliente, direto pelo app.' },
              { n: '2', t: 'Receba a leitura', d: 'Em minutos, o relatório completo chega pronto.' },
              { n: '3', t: 'Revise e entregue', d: 'Você ajusta, assina e entrega das suas mãos.' },
            ].map((s, i) => (
              <div key={s.n} className="lp-reveal bg-white p-10 md:p-12" data-d={String(i + 1)}>
                <span className="display" style={{ fontSize: '2rem', color: 'var(--teal)' }}>{s.n}</span>
                <h3 className="eyebrow mt-5" style={{ color: '#0d0d0d', letterSpacing: '.16em', fontSize: '.82rem' }}>{s.t}</h3>
                <p className="body-copy mt-3 text-sm" style={{ color: '#5a5a5a' }}>{s.d}</p>
              </div>
            ))}
          </div>
          <div className="lp-reveal mt-12 flex items-center justify-center gap-4 text-center" data-d="2">
            <hr className="hairline" style={{ width: 32 }} />
            <p className="body-copy" style={{ color: 'var(--teal-dark)', fontStyle: 'italic', fontFamily: 'var(--font-cormorant),serif', fontSize: '1.2rem' }}>
              Você no controle — a interpretação e a conduta são sempre suas.
            </p>
            <hr className="hairline" style={{ width: 32 }} />
          </div>
        </div>
      </section>

      {/* ════════ A SESSÃO DE APOIO (perguntas + direção) ════════ */}
      <section className="bg-ivory text-black">
        <div className="mx-auto max-w-[1080px] px-6 py-32 md:px-10 md:py-44">
          <div className="lp-reveal text-center">
            <p className="eyebrow" style={{ color: 'var(--teal-dark)' }}>Além do relatório</p>
            <h2 className="display mx-auto mt-6" style={{ fontSize: 'clamp(2.1rem,4.4vw,3.5rem)', color: '#0d0d0d', maxWidth: '20ch' }}>
              Você não recebe só um texto. <em style={{ color: 'var(--teal-dark)' }}>Recebe um caminho.</em>
            </h2>
          </div>
          <div className="mt-16 grid gap-px md:grid-cols-3" style={{ background: '#e8e0d2' }}>
            {[
              { n: '01', t: 'As perguntas certas', d: 'Os pontos exatos pra tocar na conversa — onde o seu cliente precisa ser ouvido.' },
              { n: '02', t: 'Onde focar', d: 'O que merece atenção primeiro, sem rodeios nem achismo.' },
              { n: '03', t: 'A direção da terapia', d: 'Pra onde conduzir o trabalho, sessão após sessão.' },
            ].map((c, i) => (
              <div key={c.t} className="lp-reveal bg-ivory p-10 md:p-12" data-d={String(i + 1)}>
                <span className="display" style={{ fontSize: '1.8rem', color: 'var(--teal)' }}>{c.n}</span>
                <h3 className="eyebrow mt-5" style={{ color: '#0d0d0d', letterSpacing: '.16em', fontSize: '.82rem' }}>{c.t}</h3>
                <p className="body-copy mt-3 text-sm" style={{ color: '#5a5a5a' }}>{c.d}</p>
              </div>
            ))}
          </div>
          <p className="body-copy lp-reveal mx-auto mt-12 text-center" data-d="2" style={{ color: 'var(--teal-dark)', fontStyle: 'italic', fontFamily: 'var(--font-cormorant),serif', fontSize: '1.3rem' }}>
            Você conduz com clareza desde o primeiro minuto.
          </p>
        </div>
      </section>

      {/* ════════ QUALQUER ÍRIS ════════ */}
      <section className="overflow-hidden bg-black">
        <div className="mx-auto max-w-[1280px] px-6 py-32 md:px-10 md:py-44">
          <div className="lp-reveal text-center">
            <p className="eyebrow" style={{ color: 'var(--teal-light)' }}>Qualquer íris</p>
            <h2 className="display mx-auto mt-6" style={{ fontSize: 'clamp(2.1rem,4.4vw,3.5rem)', maxWidth: '20ch' }}>
              Toda íris conta uma história.<br /><em style={{ color: 'var(--teal-light)' }}>O Iris Codex lê todas.</em>
            </h2>
          </div>
          <div className="mt-20 grid grid-cols-2 items-center justify-items-center gap-8 sm:grid-cols-3 md:gap-6 lg:grid-cols-5">
            {CORES.map((c, i) => (
              <figure key={c.cls} className={`iris ${c.cls} lp-reveal ${c.cls === 'verde' ? 'col-span-2 col-start-1 justify-self-center sm:col-auto' : ''}`} data-d={String((i % 3) + 1)} style={{ width: '100%', maxWidth: 180 }} role="img" aria-label={`Íris ${c.nome}`}>
                <span className="catch" />
                <span className="slot-tag">{c.nome}</span>
              </figure>
            ))}
          </div>
          <p className="body-copy lp-reveal mx-auto mt-16 text-center" data-d="2" style={{ color: 'rgba(242,237,228,.7)', fontSize: '1.05rem' }}>
            Castanho, âmbar, mel, azul, verde — a leitura nasce de qualquer olho. Como os clientes que
            chegam ao seu consultório.
          </p>
        </div>
      </section>

      {/* ════════ ALAVANCA (full-bleed olho) ════════ */}
      <section className="relative overflow-hidden bg-black">
        <Image src="/lp/olho-espelho.png" alt="" fill sizes="100vw" className="object-cover opacity-60" />
        <div className="vignette" aria-hidden="true" />
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.42)' }} aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-[920px] px-6 py-40 text-center md:px-10 md:py-56">
          <h2 className="display lp-reveal" style={{ fontSize: 'clamp(2.1rem,5vw,4rem)' }}>
            Seu cliente quer um espelho —<br /><em style={{ color: 'var(--teal-light)' }}>não um laudo.</em>
          </h2>
          <p className="body-copy lp-reveal mx-auto mt-8" data-d="1" style={{ color: 'rgba(242,237,228,.8)', fontSize: '1.08rem' }}>
            O que faz o cliente voltar e te indicar não é o dado técnico. É o reconhecimento. No instante
            em que ele lê e pensa “é exatamente isso”, o valor da sua sessão fica óbvio.
          </p>
        </div>
      </section>

      {/* ════════ OFERTA ════════ */}
      <section id="oferta" className="bg-ivory text-black">
        <div className="mx-auto max-w-[1080px] px-6 py-32 text-center md:px-10 md:py-44">
          <p className="eyebrow lp-reveal" style={{ color: 'var(--teal-dark)' }}>A oferta</p>
          <h2 className="display lp-reveal mx-auto mt-6" data-d="1" style={{ fontSize: 'clamp(2.2rem,4.8vw,3.8rem)', color: '#0d0d0d', maxWidth: '18ch' }}>
            Sinta o <em style={{ color: 'var(--teal-dark)' }}>uau</em> na sua própria íris. De graça.
          </h2>
          <p className="body-copy lp-reveal mx-auto mt-7" data-d="2" style={{ color: '#4a4a4a', fontSize: '1.08rem' }}>
            Crie sua conta e faça 3 leituras grátis (ou 15 dias) — sem cartão.
          </p>
          <div className="lp-reveal mt-10" data-d="2">
            <Link href="/signup" className="btn btn-primary">Quero minhas 3 leituras grátis</Link>
          </div>

          <div className="lp-reveal mx-auto mt-20 max-w-[760px]" data-d="2">
            <p className="eyebrow" style={{ color: 'var(--mist)', marginBottom: '1.5rem' }}>Pacotes, sem pressão</p>
            <div className="grid gap-px sm:grid-cols-2" style={{ background: '#ddd2c0', border: '1px solid #ddd2c0' }}>
              {PACOTES.map((p) => (
                <div key={p.nome} className="bg-ivory p-7 text-left" style={p.selo ? { boxShadow: `inset 3px 0 0 ${p.selo === 'Mais escolhido' ? 'var(--teal)' : 'var(--teal-dark)'}`, position: 'relative' } : undefined}>
                  {p.selo && <span className="eyebrow" style={{ position: 'absolute', top: '1.1rem', right: '1.1rem', color: 'var(--teal-dark)', fontSize: '.58rem' }}>{p.selo}</span>}
                  <p className="eyebrow" style={{ color: '#0d0d0d', fontSize: '.7rem', letterSpacing: '.14em' }}>{p.nome}</p>
                  <p className="display mt-3" style={{ fontSize: '1.9rem', color: '#0d0d0d' }}>{p.preco}</p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--mist)' }}>{p.leituras}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs" style={{ color: 'var(--mist)', letterSpacing: '.04em' }}>
              PIX ou cartão · créditos válidos por 12 meses · sem assinatura.
            </p>
          </div>
        </div>
      </section>

      {/* ════════ FAQ ════════ */}
      <section className="bg-white text-black">
        <div className="mx-auto max-w-[820px] px-6 py-32 md:px-10 md:py-44">
          <div className="lp-reveal mb-16 text-center">
            <p className="eyebrow" style={{ color: 'var(--teal-dark)' }}>Perguntas</p>
            <h2 className="display mt-6" style={{ fontSize: 'clamp(2rem,4vw,3rem)', color: '#0d0d0d' }}>Antes de começar.</h2>
          </div>
          <div style={{ borderTop: '1px solid #e8e0d2', borderBottom: '1px solid #e8e0d2' }}>
            {FAQ.map((item) => (
              <details key={item.q} name="faq" className="lp-faq lp-reveal" open={item.open || undefined} style={{ borderTop: '1px solid #e8e0d2' }}>
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-7">
                  <span className="display" style={{ fontSize: '1.5rem', color: '#0d0d0d' }}>{item.q}</span>
                  <span className="lp-faq-sign" aria-hidden="true">＋</span>
                </summary>
                <p className="body-copy pb-8" style={{ color: '#4a4a4a' }}>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ CTA FINAL (full-bleed) ════════ */}
      <section className="relative overflow-hidden bg-black">
        <Image src="/lp/iris-hero.png" alt="" fill sizes="100vw" className="object-cover opacity-30" />
        <div className="vignette" aria-hidden="true" />
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.55)' }} aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-[900px] px-6 py-40 text-center md:px-10 md:py-56">
          <h2 className="display lp-reveal" style={{ fontSize: 'clamp(2.3rem,5.2vw,4.2rem)' }}>
            Seu próximo cliente<br />merece <em style={{ color: 'var(--teal-light)' }}>se reconhecer.</em>
          </h2>
          <div className="lp-reveal mt-12" data-d="1">
            <Link href="/signup" className="btn btn-primary">Criar conta e começar grátis</Link>
          </div>
          <p className="lp-reveal mt-8 text-xs" data-d="1" style={{ color: 'var(--mist)', letterSpacing: '.06em' }}>
            Sem cartão · 3 leituras · cancele quando quiser.
          </p>
        </div>
      </section>

      {/* ════════ FOOTER ════════ */}
      <footer className="bg-black" style={{ borderTop: '1px solid rgba(242,237,228,.08)' }}>
        <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-6 py-16 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <Image src="/logo/iris_codex_para_fundo_preto.png" alt="Iris Codex" width={1600} height={420} className="h-6 w-auto opacity-90" />
            <p className="mt-5 text-xs leading-relaxed" style={{ color: 'var(--mist)', maxWidth: '52ch', letterSpacing: '.03em' }}>
              {DISCLAIMER_COMPACT}
            </p>
          </div>
          <div className="eyebrow flex items-center gap-8" style={{ fontSize: '.66rem' }}>
            <Link href="/privacidade" className="link-quiet">Privacidade</Link>
            <Link href="/termos" className="link-quiet">Termos</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function LpStyle() {
  const css = `
.lp-root {
  --black:#000; --ivory:#F2EDE4; --white:#fff;
  --teal:#3D9B8C; --teal-light:#5BBFB0; --teal-dark:#1E6B61; --mist:#7A7A7A;
  background:var(--black); color:var(--ivory);
  font-family: var(--font-raleway), ui-sans-serif, system-ui, sans-serif; font-weight:300;
  overflow-x:hidden;
}
.lp-root *{ -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }
html:has(.lp-root){ scroll-behavior:smooth; }

.display { font-family: var(--font-cormorant), Georgia, serif; font-weight:300; letter-spacing:-0.02em; line-height:1.04; text-wrap:balance; }
.display em { font-style:italic; font-weight:400; }
.eyebrow { font-family: var(--font-raleway), sans-serif; font-weight:400; font-size:.72rem; letter-spacing:.34em; text-transform:uppercase; }
.body-copy { font-weight:300; line-height:1.68; letter-spacing:.005em; max-width:68ch; }
.body-copy.lg { font-size:1.12rem; }

.btn { display:inline-flex; align-items:center; justify-content:center; gap:.6em; font-family:var(--font-raleway),sans-serif; font-weight:400; font-size:.78rem; letter-spacing:.18em; text-transform:uppercase; padding:1.15rem 2.1rem; border-radius:2px; cursor:pointer; border:1px solid transparent; min-height:48px; transition:background .2s ease,color .2s ease,border-color .2s ease,transform .12s ease; text-decoration:none; }
.btn-primary { background:var(--teal-dark); color:var(--ivory); }
.btn-primary:hover { background:var(--teal-light); color:#08110f; }
.btn-primary:active { transform:translateY(1px); }
.btn-outline { background:transparent; border-color:rgba(242,237,228,.32); color:var(--ivory); }
.btn-outline:hover { border-color:var(--teal-light); color:var(--teal-light); }

.link-quiet { color:var(--mist); text-decoration:none; border-bottom:1px solid transparent; transition:color .2s,border-color .2s; letter-spacing:.04em; }
.link-quiet:hover { color:var(--teal-light); border-color:var(--teal-light); }

.lp-root a:focus-visible, .lp-root button:focus-visible, .lp-root summary:focus-visible, .btn:focus-visible { outline:2px solid var(--teal-light); outline-offset:3px; border-radius:2px; }

.hairline { background:var(--teal); height:1px; border:0; }

/* foto de íris real — círculo (hero + marfim) */
.lp-iris-photo { position:relative; aspect-ratio:1; border-radius:50%; overflow:hidden; box-shadow:0 0 70px -10px rgba(91,191,176,.35), inset 0 0 0 1px rgba(91,191,176,.25); }
.lp-iris-photo--light { box-shadow:0 25px 70px -35px rgba(0,0,0,.45), inset 0 0 0 1px rgba(30,107,97,.22); }

/* hero — olho inteiro (sem corte) num frame com anel teal sutil */
.lp-hero-frame { width:min(66vw,340px); border-radius:2px; box-shadow:0 40px 100px -45px rgba(0,0,0,.85), 0 0 0 1px rgba(91,191,176,.18); }
@media (min-width:1024px){ .lp-hero-frame { width:min(34vw,400px); } }

/* íris procedural (5 cores + fallback) */
.iris { --c-core:#0e4d46; --c-mid:#1E6B61; --c-rim:#072420; --c-glow:#3D9B8C; --fiber:#5BBFB0; position:relative; aspect-ratio:1; border-radius:50%; isolation:isolate;
  background:
    repeating-conic-gradient(from 0deg, rgba(0,0,0,0) 0deg .5deg, color-mix(in srgb, var(--fiber) 55%, transparent) .5deg .95deg, rgba(0,0,0,0) .95deg 1.7deg),
    radial-gradient(circle at 50% 47%, var(--c-core) 0%, var(--c-mid) 30%, color-mix(in srgb, var(--c-mid) 60%, #000) 58%, var(--c-rim) 82%, #000 100%);
  box-shadow: inset 0 0 60px 10px rgba(0,0,0,.55), inset 0 0 0 1px color-mix(in srgb, var(--c-glow) 40%, transparent); }
.iris::before { content:""; position:absolute; inset:0; border-radius:50%; z-index:1; background:radial-gradient(circle at 50% 47%, transparent 10%, rgba(0,0,0,0) 24%, rgba(0,0,0,.28) 55%, rgba(0,0,0,.62) 100%); }
.iris::after { content:""; position:absolute; z-index:2; width:30%; height:30%; left:50%; top:47%; transform:translate(-50%,-50%); border-radius:50%; background:#000; box-shadow:0 0 22px 6px rgba(0,0,0,.7), inset 0 0 0 1px rgba(91,191,176,.16); }
.iris .catch { position:absolute; z-index:3; width:7%; height:7%; left:43%; top:40%; border-radius:50%; background:radial-gradient(circle, rgba(255,255,255,.92), rgba(255,255,255,0) 70%); filter:blur(.5px); }
.iris .slot-tag { position:absolute; z-index:4; bottom:7%; left:50%; transform:translateX(-50%); font-family:var(--font-geist-mono),ui-monospace,monospace; font-size:.58rem; letter-spacing:.22em; text-transform:uppercase; color:rgba(242,237,228,.42); white-space:nowrap; }
.iris.castanho { --c-core:#5a3415; --c-mid:#7a4a1f; --c-rim:#1d0f05; --c-glow:#a86a32; --fiber:#caa06a; }
.iris.ambar { --c-core:#7a4a08; --c-mid:#a86c10; --c-rim:#2a1804; --c-glow:#d39b2c; --fiber:#e7c878; }
.iris.mel { --c-core:#8a6a16; --c-mid:#b08a1f; --c-rim:#2e2206; --c-glow:#d7b13e; --fiber:#ecd98a; }
.iris.azul { --c-core:#13405f; --c-mid:#1d5d86; --c-rim:#05141f; --c-glow:#3f8fc0; --fiber:#86c2e6; }
.iris.verde { --c-core:#244f1c; --c-mid:#356f29; --c-rim:#0a1c06; --c-glow:#5a9a3f; --fiber:#9ac878; }

.vignette { position:absolute; inset:0; z-index:1; pointer-events:none; background:radial-gradient(circle at 50% 45%, transparent 30%, rgba(0,0,0,.55) 78%, rgba(0,0,0,.85) 100%); }

.paper { background:var(--white); color:#1a1a1a; border-radius:2px; border:1px solid #e6ddcf; box-shadow:0 30px 80px -40px rgba(0,0,0,.55); font-family:var(--font-cormorant),Georgia,serif; }
.paper .rule { border:0; border-top:1.5px solid var(--teal); }
.paper .ln { height:9px; border-radius:1px; background:#ece6da; }

/* reveal — visível por padrão; só esconde quando JS arma (html.lp-anim) */
.lp-reveal { transition:opacity .9s cubic-bezier(.16,1,.3,1), transform .9s cubic-bezier(.16,1,.3,1); }
html.lp-anim .lp-reveal:not(.in) { opacity:0; transform:translateY(22px); }
.lp-reveal[data-d="1"] { transition-delay:.1s; } .lp-reveal[data-d="2"] { transition-delay:.2s; } .lp-reveal[data-d="3"] { transition-delay:.3s; }

/* nav */
.lp-topbar { position:fixed; top:0; left:0; right:0; z-index:50; border-bottom:1px solid transparent; transition:background .4s ease,border-color .4s ease,backdrop-filter .4s ease; }
.lp-topbar.solid { background:rgba(0,0,0,.82); border-color:rgba(242,237,228,.08); backdrop-filter:blur(8px); }

/* faq */
.lp-faq summary::-webkit-details-marker { display:none; }
.lp-faq-sign { font-family:var(--font-cormorant),serif; font-size:1.4rem; color:var(--teal); line-height:1; padding-top:.2rem; transition:transform .2s; }
.lp-faq[open] .lp-faq-sign { transform:rotate(45deg); }
.lp-faq[open] summary .display { color:var(--teal-dark) !important; }

.lp-root ::selection { background:var(--teal-dark); color:var(--ivory); }

@media (prefers-reduced-motion: reduce) { html:has(.lp-root){scroll-behavior:auto} .lp-reveal{opacity:1 !important;transform:none !important;transition:none !important} }
`
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
