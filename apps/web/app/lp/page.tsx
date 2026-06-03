import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Fraunces } from 'next/font/google'
import { DISCLAIMER_COMPACT } from '@/components/legal/DisclaimerCopy'
import { TopBar } from './TopBar'
import { RevealInit } from './RevealInit'
import { Camera, FileText, Check, Lock, CreditCard, Clock } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Landing /lp — "O ESPELHO". Porte da versão do Claude (claude.ai artifact) para
// Next.js, com: fotos macro REAIS (hero, fibras, marfim, olho), Cormorant Garamond
// no display (Georgia segue no relatório/PDF), tokens da marca, links reais e
// DisclaimerCopy. As 5 íris de cor e o mock de relatório ficam procedurais até as
// fotos reais existirem (#8 castanho/âmbar/mel/azul/verde + #6 print).
//
// ⚠️ Antes de abrir ao público: reverter pricing R$5→oficial e virar robots.index=true.
// ─────────────────────────────────────────────────────────────────────────────

// Display: Fraunces (serifa com alma, latin-ext pleno, acentos PT sólidos).
// Mantém a CSS var --font-cormorant pra não tocar nas ~20 referências existentes.
const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
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

const PACOTES = [
  { nome: 'Avulsa', porLeitura: 'R$ 99,70', total: 'R$ 99,70', leituras: '1 leitura', micro: 'Pra uma leitura pontual.', selo: 'Comece por aqui', tom: 'neutro' },
  { nome: 'Pequeno', porLeitura: 'R$ 59,70', total: 'R$ 298,50', leituras: '5 leituras', micro: 'Pros primeiros clientes.', selo: null, tom: null },
  { nome: 'Médio', porLeitura: 'R$ 49,70', total: 'R$ 745,50', leituras: '15 leituras', micro: 'Pra quem já atende com regularidade.', selo: 'Nossa recomendação', tom: 'destaque' },
  { nome: 'Grande', porLeitura: 'R$ 39,70', total: 'R$ 1.191,00', leituras: '30 leituras', micro: 'Pro consultório em volume.', selo: 'Melhor custo por leitura', tom: 'teal' },
] as const

const FAQ = [
  { q: 'É diagnóstico médico?', a: 'Não — é apoio à anamnese, com enfoque emocional e comportamental. Não substitui avaliação médica.', open: true },
  { q: 'É texto genérico?', a: 'Não — cada relatório é único, escrito para aquela pessoa. Sem texto-modelo.', open: false },
  { q: 'Meus dados são seguros?', a: 'Sim. A foto da íris é apagada assim que o relatório é gerado e conferido — e, em qualquer caso, em no máximo 24 horas. Você é o controlador dos dados, em conformidade com a LGPD, e as imagens nunca treinam nenhuma IA.', open: false },
  { q: 'Preciso saber iridologia?', a: 'Não precisa. Uma IA própria, treinada na tradição iridológica, faz a leitura por você. Você revisa, conduz e dá a palavra final — a interpretação e a relação com o cliente são suas.', open: false },
  { q: 'E se eu não souber conduzir a devolutiva?', a: 'A gente te orienta. Além da leitura pronta — que já vem com as perguntas certas — você recebe um guia de como conduzir a devolutiva, presencial ou online. Você nunca está sozinho diante do relatório.', open: false },
] as const

export default function LandingEspelho() {
  return (
    <div id="top" className={`${fraunces.variable} lp-root`}>
      <LpStyle />
      <RevealInit />
      <TopBar />

      {/* ════════ HERO — texto no topo + faixa horizontal do olho (mobile-safe) ════════ */}
      <section className="relative overflow-hidden bg-black pt-28 pb-12 md:pb-16 md:pt-28">
        <div className="mx-auto w-full max-w-[1280px] px-6 md:px-10">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="order-2 lg:order-1">
              <p className="eyebrow lp-reveal" style={{ color: 'var(--teal-light)' }}>Para o terapeuta integrativo</p>
              <h1 className="display lp-reveal mt-6" data-d="1" style={{ fontSize: 'clamp(2.2rem,4vw,3.6rem)' }}>
                Você vê o que seu cliente nunca soube dizer —{' '}
                <em style={{ color: 'var(--teal-light)' }}>e conduz a sessão mais profunda da vida dele.</em>
              </h1>
              <p className="body-copy lg lp-reveal mt-6" data-d="2" style={{ color: 'rgba(242,237,228,.82)' }}>
                Em minutos... O Iris Codex faz a leitura pela íris e libera um relatório completo — a história que
                seu cliente carrega e raramente põe em palavras. Ele se reconhece, se emociona, e enfim se sente
                entendido. Ler a análise com ele já é a primeira sessão: você recebe as perguntas certas e dá o
                melhor direcionamento da terapia.
              </p>
              <p className="eyebrow lp-reveal mt-5" data-d="2" style={{ color: 'var(--teal-light)', letterSpacing: '.22em' }}>
                Leitura assistida por IA · Fundamentada na tradição iridológica
              </p>
              <div className="lp-reveal mt-8 flex flex-wrap items-center gap-x-7 gap-y-4" data-d="3">
                <Link href="/signup" className="btn btn-primary">Começar grátis — 3 leituras</Link>
                <Link href="/login" className="link-quiet text-sm">Já tenho conta · Entrar</Link>
              </div>
              <p className="lp-reveal mt-7 text-xs leading-relaxed" data-d="3" style={{ color: 'rgba(242,237,228,.74)', letterSpacing: '.04em', maxWidth: '46ch' }}>
                3 leituras ou 15 dias · Apoio à anamnese, não substitui avaliação médica.
              </p>
            </div>
            <div className="order-1 lp-reveal lg:order-2" data-d="1">
              <div className="lp-hero-photo">
                <Image src="/lp/hero-captura.png" alt="Terapeuta fotografando a íris do cliente em sessão" fill priority sizes="(max-width:1024px) 92vw, 600px" className="object-cover object-center" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ A DOR (desktop full-bleed; mobile banner — mostra os personagens) ════════ */}
      <section className="relative overflow-hidden bg-black">
        <Image src="/lp/dor.png" alt="Cliente de braços cruzados, fechado, numa sessão de terapia" fill sizes="100vw" className="hidden object-cover object-center md:block" />
        <div className="vignette hidden md:block" aria-hidden="true" />
        <div className="absolute inset-0 hidden md:block" style={{ background: 'linear-gradient(rgba(0,0,0,.72), rgba(0,0,0,.78))' }} aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-[920px] px-6 pt-16 pb-16 text-center md:px-10 md:py-32" style={{ textShadow: '0 1px 24px rgba(0,0,0,.65)' }}>
          <div className="lp-reveal mb-10 md:hidden">
            <div className="lp-hero-strip" style={{ aspectRatio: '16 / 9' }}>
              <Image src="/lp/dor.png" alt="" fill sizes="92vw" className="object-cover object-center" />
            </div>
          </div>
          <p className="eyebrow lp-reveal" style={{ color: 'var(--teal-light)' }}>A verdade do consultório</p>
          <h2 className="display lp-reveal mt-6" style={{ fontSize: 'clamp(2.35rem,4.8vw,4rem)' }}>
            O mais difícil nunca foi a sua técnica.<br /><em style={{ color: 'var(--teal-light)' }}>É o cliente que senta na sua frente e não se abre.</em>
          </h2>
          <p className="body-copy lp-reveal mx-auto mt-8" data-d="1" style={{ color: 'rgba(242,237,228,.82)', fontSize: '1.18rem' }}>
            Você conhece a cena. Ele responde por cima, mede cada frase, guarda o que importa pra depois —
            se é que vem. Levam semanas até ele confiar o suficiente pra dizer o que dói de verdade.
          </p>
          <p className="body-copy lp-reveal mx-auto mt-5" data-d="2" style={{ color: 'rgba(242,237,228,.82)', fontSize: '1.18rem' }}>
            E tem aquele cliente que desaparece: saiu de uma sessão correta, técnica, bem conduzida — e mesmo
            assim não se sentiu lido. Não marca a próxima. Você nunca soube o que faltou.{' '}
            <strong style={{ color: 'var(--teal-light)', fontWeight: 600, fontStyle: 'italic' }}>Faltou ele se sentir visto antes de você ganhar a confiança pra ver.</strong>
          </p>
        </div>
      </section>

      {/* ════════ A VIRADA (funde prova + leitura-já-é-terapia; foto de ler junto) ════════ */}
      <section className="bg-white text-black">
        <div className="mx-auto max-w-[1100px] px-6 py-20 md:px-10 md:py-24">
          <div className="lp-reveal mx-auto mb-10 max-w-[940px]">
            <div className="lp-hero-strip" style={{ aspectRatio: '16 / 9' }}>
              <Image src="/lp/cliente-se-sente-visto.png" alt="Cliente se sentindo visto e acolhido durante a devolutiva, ao lado da terapeuta" fill sizes="(max-width:1100px) 92vw, 940px" className="object-cover object-center" />
            </div>
          </div>
          <div className="mx-auto max-w-[900px] text-center">
          <p className="eyebrow lp-reveal" style={{ color: 'var(--teal-dark)' }}>O que muda</p>
          <h2 className="display lp-reveal mt-6" data-d="1" style={{ fontSize: 'clamp(2.6rem,5.4vw,4.6rem)', color: '#0d0d0d' }}>
            E se ele chegasse à sessão{' '}<em style={{ color: 'var(--teal-dark)' }}>já se sentindo visto?</em>
          </h2>
          <p className="body-copy lp-reveal mx-auto mt-7" data-d="2" style={{ color: '#3a3a3a', fontSize: '1.18rem' }}>
            Com o Iris Codex, a leitura começa antes da sua primeira pergunta. Você faz a devolutiva —
            lado a lado ou pela tela — e lê o relatório com o cliente. E ali, frase após frase, ele se
            reconhece. Tem gente que se cala. Tem gente que chora. Não porque o texto adivinhou um destino,
            mas porque alguém finalmente pôs em palavras o que ele sentia e nunca soube nomear.{' '}
            <strong style={{ color: '#0d0d0d', fontWeight: 600 }}>Essa devolutiva já é a primeira sessão.</strong>
          </p>
          <p className="body-copy lp-reveal mx-auto mt-6" data-d="2" style={{ color: '#3a3a3a', fontSize: '1.18rem' }}>
            A confiança que levava três semanas pra nascer acontece no primeiro minuto.
          </p>
          <p className="body-copy lp-reveal mx-auto mt-8" data-d="3" style={{ color: '#4a4a4a', fontSize: '1.12rem', maxWidth: '60ch' }}>
            Uma honestidade: isto não substitui o que só você faz. O Iris Codex não cria o vínculo — ele faz
            o cliente chegar mais aberto. A relação continua sendo sua, construída sessão a sessão. O que
            muda é por onde você começa: não da página em branco, mas já lá no fundo.
          </p>
          <p className="body-copy lp-reveal mx-auto mt-8" data-d="3" style={{ color: '#3a3a3a', fontSize: '1.15rem', maxWidth: '60ch' }}>
            <strong style={{ color: '#0d0d0d', fontWeight: 600 }}>Não acredite na nossa palavra.</strong> Faça a primeira leitura na íris de um cliente que você conhece de cor — e veja se ele se reconhece.
          </p>
          </div>
        </div>
      </section>

      {/* ════════ A PROFUNDIDADE (escura — macro de íris ao fundo) ════════ */}
      <section className="relative overflow-hidden bg-black text-ivory">
        <Image src="/lp/iris-macro.png" alt="" fill sizes="100vw" className="object-cover" style={{ opacity: 0.32 }} aria-hidden="true" />
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.52)' }} aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-[1080px] px-6 py-24 md:px-10 md:py-28">
          <div className="lp-reveal text-center">
            <p className="eyebrow" style={{ color: 'var(--teal-light)' }}>O que vem no relatório</p>
            <h2 className="display mx-auto mt-6" style={{ fontSize: 'clamp(2.35rem,4.8vw,4rem)', maxWidth: '26ch' }}>
              Não é um retrato. <em style={{ color: 'var(--teal-light)' }}>É a pessoa inteira — em camadas que ela mesma não sabia nomear.</em>
            </h2>
          </div>
          <div className="mt-14 grid gap-x-12 gap-y-9 md:grid-cols-2">
            {[
              { t: 'O jeito de processar a vida', d: 'O temperamento de base — a maneira de sentir o mundo que ele sempre teve, e nunca soube que tinha nome.' },
              { t: 'Onde tudo começou', d: 'A linha do tempo emocional: quando o padrão se formou, e o que o manteve de pé desde então.' },
              { t: 'O que se repete', d: 'Aquilo que ele refaz de novo e de novo, sem perceber que escolhe.' },
              { t: 'As forças que ele subestima', d: 'O que nele já é potência — esperando ser usado de propósito, não por acaso.' },
              { t: 'O que pede cuidado agora', d: 'Onde a vida vem cobrando — em linguagem de emoção e comportamento, nunca de exame.' },
              { t: 'O que ele protege', d: 'A ferida que aprendeu a esconder cedo — e a defesa que montou em volta dela.' },
              { t: 'O ritmo do dia a dia', d: 'Como sono, descanso e o jeito de se cuidar conversam com o que ele sente — estilo de vida, não receita.' },
              { t: 'As perguntas certas', d: 'O que perguntar — e a hora de perguntar — pra conversa começar funda, sem soar interrogatório.' },
              { t: 'O caminho pra devolutiva', d: 'Por onde abrir, onde tocar primeiro, o que merece esperar: a direção já na sua mão quando ele sentar.' },
              { t: 'A síntese em uma frase', d: 'A pessoa inteira condensada num parágrafo que ele vai querer reler — o ponto onde costuma se emocionar.' },
            ].map((item, i) => (
              <div key={item.t} className="lp-reveal" data-d={String((i % 2) + 1)} style={{ borderLeft: '2px solid var(--teal)', paddingLeft: '1.4rem' }}>
                <h3 className="display" style={{ fontSize: '1.25rem', color: 'var(--ivory)' }}>{item.t}</h3>
                <p className="body-copy mt-2" style={{ color: 'rgba(242,237,228,.72)', fontSize: '1rem' }}>{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ ESPIAR DENTRO ("o que cabe numa leitura" — escala + curiosidade) ════════ */}
      <section className="bg-ivory text-black">
        <div className="mx-auto max-w-[1080px] px-6 py-20 md:px-10 md:py-24">
          <div className="lp-reveal text-center">
            <p className="eyebrow" style={{ color: 'var(--teal-dark)' }}>Por dentro de uma leitura</p>
            <h2 className="display mx-auto mt-6" style={{ fontSize: 'clamp(2.35rem,4.8vw,4rem)', color: '#0d0d0d', maxWidth: '22ch' }}>
              Uma frase te parou. <em style={{ color: 'var(--teal-dark)' }}>Agora imagine a leitura inteira.</em>
            </h2>
            <p className="body-copy mx-auto mt-6" style={{ color: '#3a3a3a', fontSize: '1.18rem', maxWidth: '60ch' }}>
              Não é uma página. São mais de uma dúzia de frentes que se conversam — do temperamento ao que
              pede cuidado, da história que formou o cliente ao roteiro pra conduzir a devolutiva.
            </p>
            <p className="mt-5 text-xs" style={{ color: 'var(--mist)', letterSpacing: '.04em', fontStyle: 'italic' }}>
              Tópicos e trechos ilustrativos — sem dados reais de cliente.
            </p>
          </div>

          {/* mock de páginas empilhadas — peso físico do documento */}
          <div className="lp-reveal relative mx-auto mt-14 max-w-[620px]" data-d="1">
            <div className="paper" style={{ position: 'absolute', inset: 0, transform: 'rotate(-3deg) translateY(-14px)', opacity: 0.4 }} aria-hidden="true" />
            <div className="paper" style={{ position: 'absolute', inset: 0, transform: 'rotate(1.8deg) translateY(-7px)', opacity: 0.65 }} aria-hidden="true" />
            <div className="paper relative p-9 md:p-11" style={{ zIndex: 1 }}>
              {[
                { h: 'Em poucas palavras', f: '“Alguém que aprende a temperatura de um ambiente antes de entrar nele. Aprendeu cedo que ser útil era a forma mais segura de ser querido — e cansa de ser o porto de todo mundo, sem saber de quem é o seu.”' },
                { h: 'Linha do tempo emocional', f: '“Entre os 4 e os 7 anos, algo pediu que ela aprendesse a—”' },
                { h: 'Forças e recursos', f: '“Lê o não-dito com uma precisão que ela nem reconhece como—”' },
              ].map((row, i) => (
                <div key={row.h} style={i > 0 ? { marginTop: '1.6rem' } : undefined}>
                  <p style={{ fontSize: '.62rem', letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--teal)', fontFamily: 'var(--font-raleway),sans-serif' }}>{row.h}</p>
                  <p className="mt-2" style={{ fontStyle: 'italic', fontFamily: 'var(--font-cormorant),serif', fontSize: '1.18rem', lineHeight: 1.5, color: '#15110b' }}>{row.f}</p>
                </div>
              ))}
              <hr className="rule" style={{ margin: '1.8rem 0 1.2rem' }} />
              <p style={{ fontSize: '.95rem', color: 'var(--mist)', fontFamily: 'var(--font-cormorant),serif', fontStyle: 'italic', lineHeight: 1.6 }}>
                + Temperamento · Padrões que se repetem · O que pede cuidado agora · Roteiro pra devolutiva · Síntese final <span style={{ color: 'var(--teal-dark)' }}>…e mais.</span>
              </p>
            </div>
          </div>

          {/* fecho de curiosidade */}
          <div className="lp-reveal mt-12 text-center" data-d="2">
            <p className="display mx-auto" style={{ fontStyle: 'italic', fontSize: 'clamp(1.3rem,3vw,1.7rem)', color: 'var(--teal-dark)', maxWidth: '42ch', lineHeight: 1.45 }}>
              Isto é a borda de uma leitura. A do seu cliente vai dizer o nome dele — e coisas que nem você esperava.
            </p>
            <Link href="/signup" className="link-quiet mt-6 inline-block" style={{ color: 'var(--teal-dark)', fontFamily: 'var(--font-raleway),sans-serif', fontSize: '.82rem', letterSpacing: '.14em', textTransform: 'uppercase' }}>
              Ver a primeira leitura grátis →
            </Link>
          </div>
        </div>
      </section>

      {/* ════════ PERGUNTAS DEMO (exemplo ilustrativo — foto do relatório no tablet) ════════ */}
      <section className="bg-white text-black">
        <div className="mx-auto grid max-w-[1280px] items-center gap-14 px-6 py-20 md:px-10 md:py-24 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lp-reveal lg:order-1">
            <div className="relative mx-auto w-full max-w-[440px]" style={{ aspectRatio: '4 / 5', borderRadius: '2px', overflow: 'hidden', boxShadow: '0 30px 80px -40px rgba(0,0,0,.5)' }}>
              <Image src="/lp/relatorio-tablet.png" alt="Terapeuta segura o relatório do Iris Codex num tablet" fill sizes="(max-width:1024px) 80vw, 440px" className="object-cover object-center" />
            </div>
          </div>
          <div className="order-1 lp-reveal lg:order-2">
            <p className="eyebrow" style={{ color: 'var(--teal-dark)' }}>Além do relatório</p>
            <h2 className="display mt-6" style={{ fontSize: 'clamp(2.35rem,4.8vw,4rem)', color: '#0d0d0d' }}>
              Você não chega à sessão com uma página em branco. <em style={{ color: 'var(--teal-dark)' }}>Chega com o caminho.</em>
            </h2>
            <p className="mt-5 text-xs" style={{ color: 'var(--mist)', letterSpacing: '.04em', fontStyle: 'italic' }}>
              Exemplo ilustrativo das perguntas que acompanham a leitura.
            </p>
            <div className="mt-8 space-y-5">
              {[
                'Onde no corpo isso vive — agora, enquanto você lê? Garganta que aperta, peito que fecha, estômago que pesa?',
                'O que se solta quando você imagina receber cuidado sem precisar merecer primeiro?',
                'Quem na sua vida conhece a versão sua que este texto descreve? E quem você só deixa ver a outra?',
              ].map((q, i) => (
                <div key={i} style={{ borderLeft: '2px solid var(--teal)', paddingLeft: '1.4rem' }}>
                  <p style={{ fontStyle: 'italic', fontFamily: 'var(--font-cormorant),serif', fontSize: '1.3rem', lineHeight: 1.5, color: '#2a2a2a' }}>{q}</p>
                </div>
              ))}
            </div>
            <p className="body-copy mt-8" style={{ color: '#3a3a3a', fontSize: '1.18rem' }}>
              Os catálogos de iridologia te entregam o mapa e te deixam ali, sozinho com ele. O Iris Codex te
              entrega o mapa e a primeira pergunta — onde tocar, o que merece atenção antes do resto. Não é
              interrogatório de anamnese: é a conversa começando funda.
            </p>
          </div>
        </div>
      </section>

      {/* ════════ BATIDA ESCURA (transição — reaquece antes do método) ════════ */}
      <section className="relative overflow-hidden bg-black">
        <Image src="/lp/olho-espelho.png" alt="" fill sizes="100vw" className="object-cover opacity-40" />
        <div className="vignette" aria-hidden="true" />
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.5)' }} aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-[820px] px-6 py-20 text-center md:px-10 md:py-28">
          <p className="display lp-reveal" style={{ fontSize: 'clamp(1.8rem,4.5vw,3.2rem)' }}>
            Tudo isso — <em style={{ color: 'var(--teal-light)' }}>de uma foto da íris.</em>
          </p>
        </div>
      </section>

      {/* ════════ MÉTODO (faixa compacta — selo de credibilidade) ════════ */}
      <section className="bg-ivory text-black">
        <div className="mx-auto max-w-[1100px] px-6 py-20 text-center md:px-10 md:py-24">
          <p className="eyebrow lp-reveal" style={{ color: 'var(--teal-dark)' }}>O método</p>
          <h2 className="display lp-reveal mx-auto mt-6" data-d="1" style={{ fontSize: 'clamp(2.35rem,4.8vw,4rem)', color: '#0d0d0d', maxWidth: '20ch' }}>
            Tradição como base. <em style={{ color: 'var(--teal-dark)' }}>Método como diferença.</em>
          </h2>
          <div className="mt-12 grid gap-px md:grid-cols-3" style={{ background: '#e8e0d2' }}>
            {[
              { n: '01', t: 'Herança de um século', d: 'Mais de cem anos de observação iridológica acumulada como base — a tradição lida com rigor, não palpite.' },
              { n: '02', t: 'IA própria, com método', d: 'Treinada na tradição iridológica, ela escreve cada leitura única — sem texto-modelo, sem horóscopo.' },
              { n: '03', t: 'O enfoque certo', d: 'Padrões emocionais e comportamentais. Não diagnóstico, não laudo.' },
            ].map((m, i) => (
              <div key={m.n} className="lp-reveal bg-ivory p-8 text-left md:p-9" data-d={String(i + 1)}>
                <span className="display" style={{ fontSize: '1.5rem', color: 'var(--teal)' }}>{m.n}</span>
                <h3 className="eyebrow mt-4" style={{ color: '#0d0d0d', letterSpacing: '.16em', fontSize: '.78rem' }}>{m.t}</h3>
                <p className="body-copy mt-2 text-sm" style={{ color: '#4a4a4a' }}>{m.d}</p>
              </div>
            ))}
          </div>
          <p className="display lp-reveal mt-12" data-d="3" style={{ fontStyle: 'italic', fontSize: '1.5rem', color: 'var(--teal-dark)' }}>
            O mapa do Ser, com ciência e método.
          </p>
        </div>
      </section>

      {/* ════════ O LASTRO (íris-vs-IA — de onde vem a leitura) ════════ */}
      <section className="bg-white text-black">
        <div className="mx-auto grid max-w-[1280px] items-center gap-14 px-6 py-20 md:px-10 md:py-24 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lp-reveal lg:order-1">
            <div className="lp-iris-photo lp-iris-photo--light mx-auto" style={{ width: 'min(70vw,340px)' }}>
              <Image src="/lp/iris-marfim.png" alt="Íris humana em detalhe — os sinais que a IA lê" fill sizes="(max-width:1024px) 70vw, 340px" className="object-cover" />
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-x-3 gap-y-2">
              {['densidade', 'trama de fibras', 'pigmentos', 'pupila'].map((s) => (
                <span key={s} style={{ fontSize: '.6rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--teal-dark)', fontFamily: 'var(--font-raleway),sans-serif', border: '1px solid #ddd2c0', borderRadius: '2px', padding: '.4rem .7rem' }}>{s}</span>
              ))}
            </div>
            <p className="mt-4 text-center text-xs" style={{ color: 'var(--mist)', fontStyle: 'italic' }}>os sinais que a IA lê na imagem — e organiza em achados</p>
          </div>
          <div className="order-1 lp-reveal lg:order-2">
            <p className="eyebrow" style={{ color: 'var(--teal-dark)' }}>De onde vem a leitura</p>
            <h2 className="display mt-6" style={{ fontSize: 'clamp(2.35rem,4.8vw,4rem)', color: '#0d0d0d' }}>
              A íris fundamenta o relatório. <em style={{ color: 'var(--teal-dark)' }}>A IA não inventa — parte do que está ali.</em>
            </h2>
            <p className="body-copy mt-7" style={{ color: '#3a3a3a', fontSize: '1.18rem' }}>
              Primeiro a IA lê a imagem da íris e identifica os sinais — densidade, trama de fibras,
              pigmentos, pupila — e os organiza em achados. Só então escreve a leitura, partindo dos sinais
              que aparecem naquela íris específica, não de um texto pronto aplicado a todo mundo. Troque a
              pessoa, e não muda um adjetivo: muda tudo.{' '}
              <strong style={{ color: '#0d0d0d', fontWeight: 600 }}>O achado é o lastro; a leitura terapêutica é o produto.</strong>
            </p>
            <p className="body-copy mt-5" style={{ color: 'var(--mist)', fontSize: '1rem' }}>
              E somos claros: cada achado é uma hipótese pra investigar com o cliente, não um diagnóstico
              fechado — uma tradição lida com método, não promessa de ciência exata.
            </p>
          </div>
        </div>
      </section>

      {/* ════════ COMO FUNCIONA (3 micro-passos com ícones) ════════ */}
      <section className="bg-white text-black">
        <div className="mx-auto max-w-[900px] px-6 py-16 text-center md:px-10 md:py-20">
          <p className="eyebrow lp-reveal" style={{ color: 'var(--teal-dark)' }}>Como funciona</p>
          <div className="mt-10 grid gap-10 sm:grid-cols-3">
            {[
              { Icon: Camera, t: 'Capture a íris', d: 'A foto do olho do seu cliente, direto pelo app.' },
              { Icon: FileText, t: 'Receba em minutos', d: 'O relatório completo chega pronto.' },
              { Icon: Check, t: 'Revise e entregue', d: 'Você ajusta, assina e conduz.' },
            ].map((s, i) => (
              <div key={s.t} className="lp-reveal flex flex-col items-center" data-d={String(i + 1)}>
                <s.Icon size={30} strokeWidth={1.5} color="var(--teal)" aria-hidden="true" />
                <h3 className="eyebrow mt-5" style={{ color: '#0d0d0d', letterSpacing: '.14em', fontSize: '.8rem' }}>{s.t}</h3>
                <p className="body-copy mt-2 text-sm" style={{ color: '#5a5a5a' }}>{s.d}</p>
              </div>
            ))}
          </div>
          <div className="lp-reveal mt-12 flex items-center justify-center gap-4" data-d="2">
            <hr className="hairline" style={{ width: 32 }} />
            <p className="body-copy" style={{ color: 'var(--teal-dark)', fontStyle: 'italic', fontFamily: 'var(--font-cormorant),serif', fontSize: '1.15rem' }}>
              Você no controle — a interpretação e a conduta são sempre suas.
            </p>
            <hr className="hairline" style={{ width: 32 }} />
          </div>
        </div>
      </section>

      {/* ════════ TIRADA COM O CELULAR (simplicidade — prova o passo "capture") ════════ */}
      <section className="bg-ivory text-black">
        <div className="mx-auto max-w-[1080px] px-6 py-20 text-center md:px-10 md:py-24">
          <p className="eyebrow lp-reveal" style={{ color: 'var(--teal-dark)' }}>Sem equipamento, sem câmera especial</p>
          <h2 className="display lp-reveal mx-auto mt-6" data-d="1" style={{ fontSize: 'clamp(2.35rem,4.8vw,4rem)', color: '#0d0d0d', maxWidth: '20ch' }}>
            Você fotografa com o celular que já tem. <em style={{ color: 'var(--teal-dark)' }}>E pronto.</em>
          </h2>
          <p className="body-copy lp-reveal mx-auto mt-6" data-d="2" style={{ color: '#3a3a3a', fontSize: '1.18rem', maxWidth: '58ch' }}>
            Nada de iridoscópio, nada de estúdio. iPhone ou Android, a câmera do dia a dia — o app guia o
            enquadramento e avisa quando a foto está boa. Você aponta, confirma, e o relatório começa.
          </p>

          <div className="lp-reveal mt-14 grid gap-6 sm:grid-cols-2" data-d="2">
            {[
              { src: '/lp/captura-iphone.png', dispositivo: 'iPhone', legenda: 'Tirada com um iPhone, na sessão.' },
              { src: '/lp/captura-android.png', dispositivo: 'Android', legenda: 'Tirada com um Android comum.' },
            ].map((foto) => (
              <figure key={foto.dispositivo}>
                <div className="relative w-full" style={{ aspectRatio: '4 / 5', borderRadius: '2px', overflow: 'hidden', boxShadow: '0 30px 70px -38px rgba(0,0,0,.4)', border: '1px solid #e6ddcf', background: 'linear-gradient(135deg, #eef1ed, #dde8e5)' }}>
                  <Image src={foto.src} alt={`Foto da íris tirada com ${foto.dispositivo}`} fill sizes="(max-width:640px) 92vw, 500px" className="object-cover object-center" />
                  <span className="absolute left-4 top-4" style={{ fontSize: '.6rem', letterSpacing: '.18em', textTransform: 'uppercase', fontFamily: 'var(--font-raleway),sans-serif', color: 'var(--ivory)', background: 'rgba(0,0,0,.55)', borderRadius: '2px', padding: '.35rem .6rem', backdropFilter: 'blur(4px)' }}>{foto.dispositivo}</span>
                </div>
                <figcaption className="mt-3 text-xs" style={{ color: 'var(--mist)', fontStyle: 'italic' }}>{foto.legenda}</figcaption>
              </figure>
            ))}
          </div>

          <p className="display lp-reveal mt-12" data-d="3" style={{ fontStyle: 'italic', fontSize: '1.5rem', color: 'var(--teal-dark)' }}>
            A íris no seu bolso. <span style={{ fontStyle: 'normal', fontFamily: 'var(--font-raleway),sans-serif', fontSize: '1rem', letterSpacing: '.1em' }}>Voilà.</span>
          </p>
        </div>
      </section>

      {/* ════════ SEGURANÇA DE DADOS (objeção final antes da oferta) ════════ */}
      <section className="bg-black text-ivory">
        <div className="mx-auto max-w-[920px] px-6 py-20 text-center md:px-10 md:py-24">
          <p className="eyebrow lp-reveal" style={{ color: 'var(--teal-light)' }}>A imagem do seu cliente</p>
          <h2 className="display lp-reveal mx-auto mt-6" data-d="1" style={{ fontSize: 'clamp(2.1rem,4.4vw,3.4rem)', maxWidth: '24ch' }}>
            A leitura fica. <em style={{ color: 'var(--teal-light)' }}>A foto, não.</em>
          </h2>
          <p className="body-copy lp-reveal mx-auto mt-7" data-d="2" style={{ color: 'rgba(242,237,228,.82)', fontSize: '1.15rem', maxWidth: '60ch' }}>
            A íris é o dado mais íntimo que existe. Por isso ela tem hora pra ir embora: assim que o relatório
            é gerado e conferido, a imagem é apagada de vez — e, em qualquer caso, no máximo em 24 horas. O que
            permanece é a leitura. A foto cumpre o papel dela e desaparece.
          </p>
          <div className="lp-reveal mx-auto mt-12 grid max-w-[760px] gap-px sm:grid-cols-3" data-d="3" style={{ background: 'rgba(242,237,228,.1)' }}>
            {[
              { Icon: Clock, t: 'Apagada na geração', d: 'Ou em até 24 horas — o que vier primeiro.' },
              { Icon: Lock, t: 'Você é o controlador', d: 'Em conformidade com a LGPD, do início ao fim.' },
              { Icon: Check, t: 'Nunca treina IA', d: 'A imagem do seu cliente não vira dado de ninguém.' },
            ].map((s) => (
              <div key={s.t} className="bg-black p-7 text-left">
                <s.Icon size={22} strokeWidth={1.5} color="var(--teal-light)" aria-hidden="true" />
                <h3 className="eyebrow mt-4" style={{ color: 'var(--ivory)', letterSpacing: '.14em', fontSize: '.74rem' }}>{s.t}</h3>
                <p className="body-copy mt-2 text-sm" style={{ color: 'rgba(242,237,228,.66)' }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ OFERTA (trial herói + escada de valor por leitura) ════════ */}
      <section id="oferta" className="bg-ivory text-black">
        <div className="mx-auto max-w-[1120px] px-6 py-20 md:px-10 md:py-24">
          <div className="lp-reveal text-center">
            <p className="eyebrow" style={{ color: 'var(--teal-dark)' }}>A oferta</p>
            <p className="mx-auto mt-5" style={{ color: 'var(--teal-dark)', fontStyle: 'italic', fontFamily: 'var(--font-cormorant),serif', fontSize: '1.3rem', maxWidth: '36ch' }}>
              Você já viu o que ele vai ler na sua frente.
            </p>
            <div className="mx-auto mt-7" style={{ width: 164 }}>
              <div className="relative mx-auto" style={{ aspectRatio: '3 / 4', transform: 'rotate(-3deg)', borderRadius: '2px', overflow: 'hidden', boxShadow: '0 24px 60px -28px rgba(0,0,0,.45)', border: '1px solid #e6ddcf' }}>
                <Image src="/lp/print-relatorio.png" alt="Capa do relatório do Iris Codex" fill sizes="164px" className="object-cover object-top" />
              </div>
            </div>
          </div>

          {/* bloco trial — o herói da oferta */}
          <div className="lp-reveal mx-auto mt-10 max-w-[680px] text-center" data-d="1" style={{ background: 'var(--white)', border: '1px solid var(--teal)', borderRadius: '4px', padding: '2.6rem 1.6rem' }}>
            <h2 className="display mx-auto" style={{ fontSize: 'clamp(2rem,4.4vw,3.2rem)', color: '#0d0d0d', maxWidth: '18ch' }}>
              Agora sinta o <em style={{ color: 'var(--teal-dark)' }}>uau</em> na sua própria íris. De graça.
            </h2>
            <p className="body-copy mx-auto mt-6" style={{ color: '#4a4a4a', fontSize: '1.15rem' }}>
              Crie sua conta e faça 3 leituras grátis (ou 15 dias) — sem cartão.
            </p>
            <div className="mt-8">
              <Link href="/signup" className="btn btn-primary">Começar com 3 leituras grátis</Link>
            </div>
            <p className="mx-auto mt-6 text-sm" style={{ color: 'var(--mist)', maxWidth: '52ch' }}>
              Depois das 3, você segue no seu ritmo — uma leitura avulsa quando precisar, sem pacote e sem mensalidade.
            </p>
          </div>

          {/* fileira de pacotes — preço por leitura é o protagonista */}
          <div className="lp-reveal mt-16 text-center" data-d="2">
            <p className="eyebrow" style={{ color: 'var(--mist)' }}>Quando quiser continuar</p>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PACOTES.map((p, i) => {
              const destaque = p.tom === 'destaque'
              const badgeColor = p.tom === 'neutro' ? 'var(--mist)' : 'var(--teal-dark)'
              const badgeBorder = p.tom === 'neutro' ? '#ddd2c0' : 'var(--teal)'
              return (
                <div
                  key={p.nome}
                  className={`lp-reveal relative bg-white p-7 text-left${destaque ? ' lg:-translate-y-2' : ''}`}
                  data-d={String((i % 3) + 1)}
                  style={{
                    borderRadius: '4px',
                    border: destaque ? '1px solid var(--teal)' : '1px solid #e6ddcf',
                    boxShadow: destaque ? '0 30px 60px -28px rgba(30,107,97,.32)' : '0 1px 3px rgba(0,0,0,.04)',
                  }}
                >
                  <div style={{ minHeight: '2.1rem', marginBottom: '.8rem' }}>
                    {p.selo && (
                      <span style={{ display: 'inline-block', fontSize: '.54rem', lineHeight: 1.35, letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: 'var(--font-raleway),sans-serif', color: badgeColor, border: `1px solid ${badgeBorder}`, borderRadius: '2px', padding: '.28rem .5rem' }}>{p.selo}</span>
                    )}
                  </div>
                  <p className="eyebrow" style={{ color: '#0d0d0d', fontSize: '.7rem', letterSpacing: '.16em' }}>{p.nome}</p>
                  <p className="display mt-4" style={{ fontSize: '2rem', color: '#0d0d0d', lineHeight: 1 }}>{p.porLeitura}</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--mist)', letterSpacing: '.04em' }}>por leitura</p>
                  <hr style={{ border: 0, borderTop: '1px solid var(--teal)', width: 28, margin: '1.1rem 0' }} />
                  <p className="display" style={{ fontSize: '1.1rem', color: '#0d0d0d' }}>{p.leituras}</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--mist)' }}>{p.total} no total</p>
                  <p className="body-copy mt-4 text-sm" style={{ color: '#5a5a5a' }}>{p.micro}</p>
                </div>
              )
            })}
          </div>

          {/* régua de confiança */}
          <div className="lp-reveal mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-3" data-d="3">
            {[
              { Icon: Lock, t: 'Sem cartão no teste' },
              { Icon: CreditCard, t: 'PIX ou cartão' },
              { Icon: Clock, t: 'Créditos por 12 meses' },
              { Icon: Check, t: 'Sem assinatura' },
            ].map((s) => (
              <span key={s.t} className="inline-flex items-center gap-2 text-xs" style={{ color: 'var(--mist)', letterSpacing: '.02em' }}>
                <s.Icon size={15} strokeWidth={1.5} color="var(--teal)" aria-hidden="true" />
                {s.t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ FAQ ════════ */}
      <section className="bg-white text-black">
        <div className="mx-auto max-w-[820px] px-6 py-20 md:px-10 md:py-24">
          <div className="lp-reveal mb-10 text-center">
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
        <div className="relative z-10 mx-auto max-w-[900px] px-6 py-24 text-center md:px-10 md:py-32">
          <h2 className="display lp-reveal" style={{ fontSize: 'clamp(2.3rem,5.2vw,4.2rem)' }}>
            Seu próximo cliente<br />merece <em style={{ color: 'var(--teal-light)' }}>se sentir lido.</em>
          </h2>
          <div className="lp-reveal mt-12" data-d="1">
            <Link href="/signup" className="btn btn-primary">Começar grátis</Link>
          </div>
          <p className="lp-reveal mt-8 text-xs" data-d="1" style={{ color: 'var(--mist)', letterSpacing: '.06em' }}>
            Sem cartão · 3 leituras · sem assinatura.
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

.display { font-family: var(--font-cormorant), Georgia, serif; font-weight:400; letter-spacing:-0.01em; line-height:1.1; text-wrap:balance; }
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
.lp-hero-strip { position:relative; width:100%; aspect-ratio:16/9; border-radius:2px; overflow:hidden; box-shadow:0 40px 100px -45px rgba(0,0,0,.85), 0 0 0 1px rgba(91,191,176,.18); }
@media (min-width:768px){ .lp-hero-strip { aspect-ratio:21/9; } }
/* hero — foto de gente em 2 colunas no desktop (texto ao lado; ambos na 1ª tela) */
.lp-hero-photo { position:relative; width:100%; aspect-ratio:16/9; border-radius:2px; overflow:hidden; box-shadow:0 40px 100px -45px rgba(0,0,0,.85), 0 0 0 1px rgba(91,191,176,.18); }
@media (min-width:1024px){ .lp-hero-photo { aspect-ratio:3/2; } }

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
