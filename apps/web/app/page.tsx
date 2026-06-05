import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Fraunces } from 'next/font/google'
import { DISCLAIMER_COMPACT } from '@/components/legal/DisclaimerCopy'
import { TopBar } from './_landing/TopBar'
import { RevealInit } from './_landing/RevealInit'
import { Camera, FileText, Check, Lock, CreditCard, Clock } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Home raiz "/" — Landing "O ESPELHO" (promovida de /lp para a raiz em 2026-06-03;
// /lp redireciona pra cá via next.config). Convenção dos melhores SaaS: o apex é a
// peça de marketing/aquisição, o app vive atrás do login. Terapeuta logado em "/"
// cai direto no /dashboard (middleware). Fotos macro REAIS (hero, fibras, marfim,
// olho); fonte display = Fraunces (Georgia segue no relatório/PDF); tokens da marca,
// links reais e DisclaimerCopy. Mock de relatório procedural até a foto real existir.
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
  title: 'Iris Codex — A íris como mapa do ser',
  description:
    'O Iris Codex lê na íris o que seu cliente nem sabe dizer e te entrega o mapa pra conduzir a sessão — um relatório profundo de temperamento, padrões e história, em minutos. Para o terapeuta integrativo.',
  robots: { index: true, follow: true }, // GA: indexável (pricing oficial + raiz pública desde 2026-06-03)
  openGraph: {
    title: 'A íris lembra o que a pessoa esqueceu de si.',
    description: 'De uma foto da íris, um retrato profundo de quem seu cliente é — e o caminho pra conduzir a terapia.',
    type: 'website',
  },
}

const PACOTES = [
  { nome: 'Avulsa', porLeitura: 'R$ 99,70', total: 'R$ 99,70', leituras: '1 leitura completa', micro: 'Pra uma leitura pontual.', selo: 'Comece por aqui', tom: 'neutro' },
  { nome: 'Pequeno', porLeitura: 'R$ 59,70', total: 'R$ 298,50', leituras: '5 leituras completas', micro: 'Pros primeiros clientes.', selo: null, tom: null },
  { nome: 'Médio', porLeitura: 'R$ 49,70', total: 'R$ 745,50', leituras: '15 leituras completas', micro: 'Pra quem já atende com regularidade.', selo: 'Nossa recomendação', tom: 'destaque' },
  { nome: 'Grande', porLeitura: 'R$ 39,70', total: 'R$ 1.191,00', leituras: '30 leituras completas', micro: 'Pro consultório em volume.', selo: 'Melhor custo por leitura', tom: 'teal' },
] as const

const FAQ = [
  { q: 'É diagnóstico médico?', a: 'Não — é apoio à anamnese, com enfoque emocional e comportamental. Não substitui avaliação médica.', open: true },
  { q: 'É texto genérico?', a: 'Não — cada relatório é único, escrito para aquela pessoa. Sem texto-modelo.', open: false },
  { q: 'Quanto tempo leva pra receber o relatório?', a: 'Poucos minutos. Você fotografa a íris e o relatório chega pronto na sequência — dá pra ler junto com o cliente ali mesmo, na sessão.', open: false },
  { q: 'Funciona com qualquer cor de olho?', a: 'Olhos claros ou escuros, funciona. O que importa é uma foto nítida da íris — e o próprio app te guia até o enquadramento ficar bom.', open: false },
  { q: 'Preciso saber iridologia?', a: 'Não precisa. Uma IA própria, treinada na tradição iridológica, faz a leitura por você. Você revisa, conduz e dá a palavra final — a interpretação e a relação com o cliente são suas.', open: false },
  { q: 'Posso editar o relatório antes de entregar?', a: 'Pode. O relatório chega como ponto de partida: você revisa, ajusta o que quiser e dá a palavra final. A interpretação e a conduta são sempre suas.', open: false },
  { q: 'E se eu não souber conduzir a devolutiva?', a: 'A gente te orienta. Além da leitura pronta — que já vem com as perguntas certas — você recebe um guia de como conduzir a devolutiva, presencial ou online. Você nunca está sozinho diante do relatório.', open: false },
  { q: 'Como pago — e posso parar quando quiser?', a: 'Sem assinatura e sem mensalidade. Você compra suas leituras antes de usar — uma avulsa ou um pacote — e vai consumindo no seu ritmo. Não há fatura correndo nem nada a cancelar: comprou, é seu, com até 12 meses para usar. PIX ou cartão.', open: false },
  { q: 'Meus dados são seguros?', a: 'Sim. A foto da íris é apagada assim que o relatório é gerado e conferido — e, em qualquer caso, em no máximo 24 horas. Você é o controlador dos dados, em conformidade com a LGPD, e as imagens nunca treinam nenhuma IA.', open: false },
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
                A íris lembra <em style={{ color: 'var(--teal-light)' }}>o que a pessoa esqueceu de si.</em>
              </h1>
              <p className="body-copy lg lp-reveal mt-6" data-d="2" style={{ color: 'rgba(242,237,228,.82)' }}>
                Está tudo ali: o jeito de sentir o mundo, a ferida antiga, a força que ela nem sabe que tem. O
                Iris Codex lê na íris e te entrega o mapa pronto pra conduzir a sessão. E quando o cliente se
                reconhece no que você lê, ele para de se defender.
              </p>
              <p className="display lp-reveal mt-6" data-d="2" style={{ fontStyle: 'italic', fontSize: 'clamp(1.5rem,3vw,2.1rem)', color: 'var(--teal-light)' }}>
                A terapia começou.
              </p>
              <p className="eyebrow lp-reveal mt-5" data-d="2" style={{ color: 'var(--teal-light)', letterSpacing: '.22em' }}>
                Leitura assistida por IA · Fundamentada na tradição iridológica
              </p>
              <div className="lp-reveal mt-8 flex flex-wrap items-center gap-x-7 gap-y-4" data-d="3">
                <Link href="/signup" className="btn btn-primary">Começar grátis — 1 leitura</Link>
                <Link href="/login" className="link-quiet text-sm">Já tenho conta · Entrar</Link>
              </div>
              <p className="lp-reveal mt-7 text-xs leading-relaxed" data-d="3" style={{ color: 'rgba(242,237,228,.74)', letterSpacing: '.04em', maxWidth: '46ch' }}>
                1 leitura grátis · sem cartão · Apoio à anamnese, não substitui avaliação médica.
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
            Às vezes, o que trava o seu cliente <em style={{ color: 'var(--teal-light)' }}>nem ele sabe.</em>
          </h2>
          <p className="body-copy lp-reveal mx-auto mt-8" data-d="1" style={{ color: 'rgba(242,237,228,.82)', fontSize: '1.18rem' }}>
            Você faz tudo certo. Cria o espaço, ganha a confiança, escuta de verdade. E mesmo assim a conversa
            não chega lá — não porque ele esconde de você, mas porque ele mesmo não alcança. O que trava está
            fundo demais, esquecido, num lugar que ele não sabe nomear.
          </p>
          <p className="body-copy lp-reveal mx-auto mt-5" data-d="2" style={{ color: 'rgba(242,237,228,.82)', fontSize: '1.18rem' }}>
            Então ele vai embora sem nunca tocar no que importava — sem nem saber que estava ali. E fica em você
            a certeza incômoda de que o nó existia o tempo todo, bem na frente dos dois, invisível.
          </p>
          <p className="display lp-reveal mx-auto mt-8" data-d="3" style={{ fontStyle: 'italic', fontSize: 'clamp(1.4rem,2.6vw,1.9rem)', color: 'var(--teal-light)', maxWidth: '42ch' }}>
            Não foi falta de confiança, nem de técnica. O que ele precisava enxergar estava escondido — até dele mesmo.
          </p>
        </div>
      </section>

      {/* ════════ A DEVOLUTIVA (a cena — o cliente se reconhece; logo após a dor) ════════ */}
      <section className="bg-white text-black">
        <div className="mx-auto max-w-[1100px] px-6 py-20 md:px-10 md:py-24">
          <div className="lp-reveal mx-auto mb-10 max-w-[940px]">
            <div className="lp-hero-strip" style={{ aspectRatio: '16 / 9' }}>
              <Image src="/lp/cliente-se-sente-visto.png" alt="Cliente se reconhecendo durante a devolutiva, ao lado da terapeuta" fill sizes="(max-width:1100px) 92vw, 940px" className="object-cover object-center" />
            </div>
          </div>
          <div className="mx-auto max-w-[820px] text-center">
            <p className="eyebrow lp-reveal" style={{ color: 'var(--teal-dark)' }}>A devolutiva</p>
            <h2 className="display lp-reveal mt-6" data-d="1" style={{ fontSize: 'clamp(2.5rem,5vw,4.3rem)', color: '#0d0d0d' }}>
              O instante em que <em style={{ color: 'var(--teal-dark)' }}>ele se vê.</em>
            </h2>
            <p className="body-copy lp-reveal mx-auto mt-7" data-d="2" style={{ color: '#3a3a3a', fontSize: '1.18rem' }}>
              Você lê o relatório com ele. Em algum trecho, ele para de te acompanhar e olha pra dentro —
              reconhece no papel o que nunca soube dizer. <em>“É de mim que tá falando. Ninguém nunca me disse
              isso.”</em> Não foi você que disse: foi ele que se viu. Você só observa — e sabe que chegou.
            </p>
          </div>
        </div>
      </section>

      {/* ════════ O QUE É O IRIS CODEX (etapas + mock do relatório — o que é, mostrado) ════════ */}
      <section className="bg-ivory text-black">
        <div className="mx-auto max-w-[1080px] px-6 py-20 md:px-10 md:py-24">
          <div className="lp-reveal text-center">
            <p className="eyebrow" style={{ color: 'var(--teal-dark)' }}>O que é o Iris Codex</p>
            <h2 className="display mx-auto mt-6" style={{ fontSize: 'clamp(2.35rem,4.8vw,4rem)', color: '#0d0d0d', maxWidth: '22ch' }}>
              Quanto de uma pessoa cabe <em style={{ color: 'var(--teal-dark)' }}>numa foto do olho?</em>
            </h2>
          </div>

          <div className="lp-reveal mx-auto mt-12 grid max-w-[940px] gap-8 text-left sm:grid-cols-3" data-d="1">
            {[
              { n: '01', t: 'Você fotografa a íris', d: 'Com o seu próprio celular, ali na sessão — sem aparelho, sem câmera especial.' },
              { n: '02', t: 'O Iris Codex faz a leitura', d: 'Analisa a imagem, lê os sinais da íris e escreve — sozinho, em minutos.' },
              { n: '03', t: 'Você recebe o relatório', d: 'Completo e profundo, com o retrato do cliente e o caminho pra conduzir.' },
            ].map((s) => (
              <div key={s.n} style={{ borderTop: '2px solid var(--teal)', paddingTop: '1rem' }}>
                <span className="display" style={{ fontSize: '1.4rem', color: 'var(--teal-dark)' }}>{s.n}</span>
                <h3 className="display mt-2" style={{ fontSize: '1.2rem', color: '#0d0d0d' }}>{s.t}</h3>
                <p className="body-copy mt-2 text-sm" style={{ color: '#4a4a4a' }}>{s.d}</p>
              </div>
            ))}
          </div>

          <p className="body-copy lp-reveal mx-auto mt-12 text-center" data-d="2" style={{ color: '#3a3a3a', fontSize: '1.18rem', maxWidth: '62ch' }}>
            Não são meia dúzia de frases que serviriam pra qualquer um: é um retrato inteiro de quem <em>aquela</em> pessoa é — e uma leitura de emoção e comportamento, nunca um diagnóstico.
          </p>

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

          <p className="lp-reveal mt-6 text-center text-xs" data-d="2" style={{ color: 'var(--mist)', letterSpacing: '.04em', fontStyle: 'italic' }}>
            Tópicos e trechos ilustrativos — sem dados reais de cliente.
          </p>
        </div>
      </section>

      {/* ════════ POR QUE O IRIS CODEX (manifesto — refém/teto/segunda porta; sem imagem, respiro) ════════ */}
      <section className="bg-ivory text-black">
        <div className="mx-auto max-w-[820px] px-6 py-24 text-center md:px-10 md:py-32">
          <p className="eyebrow lp-reveal" style={{ color: 'var(--teal-dark)' }}>Por que o Iris Codex</p>
          <h2 className="display lp-reveal mx-auto mt-6" data-d="1" style={{ fontSize: 'clamp(2.35rem,4.8vw,4rem)', color: '#0d0d0d', maxWidth: '20ch' }}>
            Você é refém do que o cliente <em style={{ color: 'var(--teal-dark)' }}>consegue trazer.</em>
          </h2>
          <p className="body-copy lp-reveal mx-auto mt-8" data-d="2" style={{ color: '#3a3a3a', fontSize: '1.18rem' }}>
            Pensa bem: tudo o que você tem pra trabalhar é o que ele consegue te trazer. A escuta mais afiada do
            mundo ainda esbarra nesse limite — o que ele não alcança em si, você não alcança nele. E o que mais
            importa mora quase sempre justo aí, no que ele nem sabe que carrega. Não é falha da sua técnica: é o
            teto de quem só tem uma porta de entrada — a fala.
          </p>
          <p className="body-copy lp-reveal mx-auto mt-6" data-d="2" style={{ color: '#3a3a3a', fontSize: '1.18rem' }}>
            O Iris Codex te dá uma segunda porta. Lê na íris o que a fala não alcança e te entrega o mapa antes
            da primeira pergunta. Você para de depender do que ele consegue dizer — e passa a ver o que, de outro
            jeito, ficaria invisível pros dois.
          </p>
        </div>
      </section>

      {/* ════════ A PROFUNDIDADE (escura — macro de íris ao fundo) ════════ */}
      <section className="relative overflow-hidden bg-black text-ivory">
        <Image src="/lp/iris-macro.png" alt="" fill sizes="100vw" className="object-cover" style={{ opacity: 0.32 }} aria-hidden="true" />
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,.52)' }} aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-[1080px] px-6 py-24 md:px-10 md:py-28">
          <div className="lp-reveal text-center">
            <p className="eyebrow" style={{ color: 'var(--teal-light)' }}>O que a íris revela</p>
            <h2 className="display mx-auto mt-6" style={{ fontSize: 'clamp(2.35rem,4.8vw,4rem)', maxWidth: '20ch' }}>
              Isto é dele. <em style={{ color: 'var(--teal-light)' }}>De mais ninguém.</em>
            </h2>
            <p className="body-copy mx-auto mt-7" style={{ color: 'rgba(242,237,228,.82)', fontSize: '1.15rem' }}>
              A partir dos sinais que só aquela íris tem, o Iris Codex escreve quem a pessoa é: o temperamento que
              trouxe de nascença e a história que o moldou. O que herdou sem escolher — padrões que vêm de antes
              dela, de gerações que nem conheceu. O que aprendeu a proteger cedo, e o que ainda lhe falta pra se
              sentir inteira. As forças que não reconhece, os medos que a movem, o jeito de amar e de se defender.
              E vai além do retrato: entrega as perguntas certas e o caminho pra você conduzir, até a frase-síntese
              onde ela costuma se reconhecer.
            </p>
          </div>
          <div className="mt-14 grid gap-x-12 gap-y-9 md:grid-cols-2">
            {[
              { t: 'O jeito de processar a vida', d: 'O temperamento de base — a maneira de sentir o mundo que ele sempre teve, sem nunca ter reparado.' },
              { t: 'Onde tudo começou', d: 'A linha do tempo emocional: quando o padrão se formou, e o que o manteve de pé desde então.' },
              { t: 'O que se repete', d: 'O que ele repete sem perceber que está escolhendo.' },
              { t: 'As forças que ele subestima', d: 'A força que ele tem e não usa de propósito — porque nunca reparou que era força.' },
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

      {/* ════════ PERGUNTAS DEMO (exemplo ilustrativo — foto do relatório no tablet) ════════ */}
      <section className="bg-white text-black">
        <div className="mx-auto grid max-w-[1280px] items-center gap-14 px-6 py-20 md:px-10 md:py-24 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lp-reveal lg:order-1">
            <div className="lp-frame-light relative mx-auto w-full max-w-[440px]" style={{ aspectRatio: '4 / 5' }}>
              <Image src="/lp/relatorio-tablet.png" alt="Terapeuta segura o relatório do Iris Codex num tablet" fill sizes="(max-width:1024px) 80vw, 440px" className="object-cover object-center" />
            </div>
          </div>
          <div className="order-1 lp-reveal lg:order-2">
            <p className="eyebrow" style={{ color: 'var(--teal-dark)' }}>As perguntas</p>
            <h2 className="display mt-6" style={{ fontSize: 'clamp(2.35rem,4.8vw,4rem)', color: '#0d0d0d' }}>
              O que a boca não diz, <em style={{ color: 'var(--teal-dark)' }}>o corpo lembra.</em>
            </h2>
            <p className="body-copy mt-6" style={{ color: '#3a3a3a', fontSize: '1.18rem' }}>
              Junto com o relatório vêm as perguntas pra conduzir a devolutiva — e elas não miram a cabeça. Miram
              o corpo. Em vez de pedir que ele explique, fazem ele sentir, ali na hora: a garganta que aperta, o
              peito que fecha, o estômago que pesa. Porque o que a pessoa não diz em palavras, o corpo guarda inteiro.
            </p>
            <p className="mt-7 text-xs" style={{ color: 'var(--mist)', letterSpacing: '.04em', fontStyle: 'italic' }}>
              Exemplos das perguntas que acompanham a leitura.
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
              Cem anos aprendendo a ler <em style={{ color: 'var(--teal-dark)' }}>o que está na íris.</em>
            </h2>
            <p className="body-copy mt-7" style={{ color: '#3a3a3a', fontSize: '1.18rem' }}>
              Não existem duas íris iguais — nem as suas duas. A trama das fibras, a densidade, os pigmentos:
              um desenho que é só seu. Há mais de um século, a tradição iridológica observa esse desenho e
              cataloga o que ele revela do temperamento e do comportamento. O Iris Codex herdou esse acúmulo —
              foi treinado nessa tradição pra reconhecer os sinais daquela íris e partir deles pra escrever,
              nunca de um texto pronto. Troque a pessoa, e não muda um adjetivo: muda tudo.
            </p>
            <p className="body-copy mt-5" style={{ color: 'var(--mist)', fontSize: '1rem' }}>
              E somos claros: cada achado é uma hipótese pra investigar com o cliente, não um diagnóstico
              fechado — tradição lida com método, não promessa de ciência exata.
            </p>
            <p className="display mt-8" style={{ fontStyle: 'italic', fontSize: '1.5rem', color: 'var(--teal-dark)' }}>
              O mapa do ser, com ciência e método.
            </p>
          </div>
        </div>
      </section>

      {/* ════════ TIRADA COM O CELULAR (simplicidade — prova o passo "capture") ════════ */}
      <section className="bg-white text-black">
        <div className="mx-auto max-w-[1080px] px-6 py-20 text-center md:px-10 md:py-24">
          <p className="eyebrow lp-reveal" style={{ color: 'var(--teal-dark)' }}>Sem equipamento, sem câmera especial</p>
          <h2 className="display lp-reveal mx-auto mt-6" data-d="1" style={{ fontSize: 'clamp(2.35rem,4.8vw,4rem)', color: '#0d0d0d', maxWidth: '20ch' }}>
            Você fotografa com o celular que já tem. <em style={{ color: 'var(--teal-dark)' }}>E pronto.</em>
          </h2>
          <p className="body-copy lp-reveal mx-auto mt-6" data-d="2" style={{ color: '#3a3a3a', fontSize: '1.18rem', maxWidth: '54ch' }}>
            Nada de iridoscópio, nada de estúdio. O app guia o enquadramento e avisa quando a foto está boa.
          </p>

          <div className="lp-reveal mt-14 grid gap-6 sm:grid-cols-2" data-d="2">
            {[
              { src: '/lp/captura-iphone.png', dispositivo: 'iPhone', legenda: 'Tirada com um iPhone, na sessão.' },
              { src: '/lp/captura-android.png', dispositivo: 'Android', legenda: 'Tirada com um Android comum.' },
            ].map((foto) => (
              <figure key={foto.dispositivo}>
                <div className="lp-frame-light relative w-full" style={{ aspectRatio: '4 / 5', background: 'linear-gradient(135deg, #eef1ed, #dde8e5)' }}>
                  <Image src={foto.src} alt={`Foto da íris tirada com ${foto.dispositivo}`} fill sizes="(max-width:640px) 92vw, 500px" className="object-cover object-center" />
                  <span className="absolute left-4 top-4" style={{ fontSize: '.6rem', letterSpacing: '.18em', textTransform: 'uppercase', fontFamily: 'var(--font-raleway),sans-serif', color: 'var(--ivory)', background: 'rgba(0,0,0,.55)', borderRadius: '2px', padding: '.35rem .6rem', backdropFilter: 'blur(4px)' }}>{foto.dispositivo}</span>
                </div>
                <figcaption className="mt-3 text-xs" style={{ color: 'var(--mist)', fontStyle: 'italic' }}>{foto.legenda}</figcaption>
              </figure>
            ))}
          </div>

          <p className="display lp-reveal mt-12" data-d="3" style={{ fontStyle: 'italic', fontSize: '1.5rem', color: 'var(--teal-dark)' }}>
            A íris no seu bolso. Só isso.
          </p>
        </div>
      </section>

      {/* ════════ SEGURANÇA DE DADOS (objeção final antes da oferta) ════════ */}
      <section className="bg-black text-ivory">
        <div className="mx-auto max-w-[920px] px-6 py-20 text-center md:px-10 md:py-24">
          <p className="eyebrow lp-reveal" style={{ color: 'var(--teal-light)' }}>A imagem do seu cliente</p>
          <h2 className="display lp-reveal mx-auto mt-6" data-d="1" style={{ fontSize: 'clamp(2.35rem,4.8vw,4rem)', maxWidth: '24ch' }}>
            A leitura fica. <em style={{ color: 'var(--teal-light)' }}>A foto, não.</em>
          </h2>
          <p className="body-copy lp-reveal mx-auto mt-7" data-d="2" style={{ color: 'rgba(242,237,228,.82)', fontSize: '1.15rem', maxWidth: '60ch' }}>
            A íris é o dado mais íntimo que existe. Por isso ela tem hora pra ir embora: assim que o relatório
            é gerado e conferido, a imagem é apagada de vez — e, em qualquer caso, no máximo em 24 horas. O que
            permanece é a leitura. A foto cumpre o papel dela e desaparece.
          </p>
          <div className="lp-reveal mx-auto mt-12 grid max-w-[760px] gap-px sm:grid-cols-3" data-d="3" style={{ background: 'var(--rule-dark)' }}>
            {[
              { Icon: Clock, t: 'Apagada na geração', d: 'Ou em até 24 horas — o que vier primeiro.' },
              { Icon: Lock, t: 'Você é o controlador', d: 'Em conformidade com a LGPD, do início ao fim.' },
              { Icon: Check, t: 'Nunca treina IA', d: 'A imagem do seu cliente não vira dado de ninguém.' },
            ].map((s) => (
              <div key={s.t} className="bg-black p-7 text-left">
                <s.Icon size={22} strokeWidth={1.5} color="var(--teal-light)" aria-hidden="true" />
                <h3 className="eyebrow mt-4" style={{ color: 'var(--ivory)', letterSpacing: '.16em', fontSize: '.74rem' }}>{s.t}</h3>
                <p className="body-copy mt-2 text-sm" style={{ color: 'rgba(242,237,228,.66)' }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ A PROVA (anti-genérico: mesma rubrica, duas pessoas — antes da oferta) ════════ */}
      <section className="bg-ivory text-black">
        <div className="mx-auto max-w-[1000px] px-6 py-20 text-center md:px-10 md:py-24">
          <p className="eyebrow lp-reveal" style={{ color: 'var(--teal-dark)' }}>A prova</p>
          <h2 className="display lp-reveal mx-auto mt-6" data-d="1" style={{ fontSize: 'clamp(2rem,4.2vw,3.2rem)', color: '#0d0d0d', maxWidth: '22ch' }}>
            Duas pessoas. <em style={{ color: 'var(--teal-dark)' }}>A mesma pergunta. Nunca a mesma resposta.</em>
          </h2>
          <div className="lp-reveal mt-12 grid gap-5 text-left sm:grid-cols-2" data-d="2">
            {[
              '“A trama fechada e firme da íris fala de quem cedo virou a própria muralha. Ela protege a ideia de que dar conta sozinha é o mesmo que estar segura — e trata pedir ajuda como uma rachadura na muralha. O que defende não é o orgulho: é a criança que aprendeu que ninguém viria.”',
              '“A trama mais aberta e os anéis de tensão falam de quem sente tudo cedo demais e forte demais. Ele protege a própria sensibilidade fingindo dureza — ri primeiro, minimiza, sai pela tangente. O que defende não é a calma: é o medo de que, se baixar a guarda, não consiga fechar de novo.”',
            ].map((trecho, i) => (
              <div key={i} className="paper p-8 md:p-9">
                <p style={{ fontSize: '.62rem', letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--teal)', fontFamily: 'var(--font-raleway),sans-serif' }}>O que ele protege</p>
                <p className="mt-3" style={{ fontStyle: 'italic', fontFamily: 'var(--font-cormorant),serif', fontSize: '1.18rem', lineHeight: 1.55, color: '#15110b' }}>{trecho}</p>
              </div>
            ))}
          </div>
          <p className="lp-reveal mt-6 text-xs" data-d="2" style={{ color: 'var(--mist)', letterSpacing: '.04em', fontStyle: 'italic' }}>
            Dois exemplos ilustrativos — a mesma seção do relatório, duas pessoas diferentes. Sem dados reais de cliente.
          </p>
          <p className="display lp-reveal mx-auto mt-10" data-d="3" style={{ fontStyle: 'italic', fontSize: 'clamp(1.4rem,2.6vw,1.9rem)', color: 'var(--teal-dark)', maxWidth: '32ch' }}>
            Não existe leitura de prateleira. Cada íris só sabe falar de uma pessoa — e é sempre a que está na sua frente.
          </p>
        </div>
      </section>

      {/* ════════ OFERTA (trial herói + escada de valor por leitura) ════════ */}
      <section id="oferta" className="bg-ivory text-black">
        <div className="mx-auto max-w-[1120px] px-6 py-20 md:px-10 md:py-24">
          <div className="lp-reveal text-center">
            <p className="eyebrow" style={{ color: 'var(--teal-dark)' }}>Comece</p>
            <p className="mx-auto mt-5" style={{ color: 'var(--teal-dark)', fontStyle: 'italic', fontFamily: 'var(--font-cormorant),serif', fontSize: '1.3rem', maxWidth: '36ch' }}>
              Agora veja na íris de alguém que você atende.
            </p>
            <div className="mx-auto mt-7" style={{ width: 164 }}>
              <div className="lp-frame-light relative mx-auto" style={{ aspectRatio: '3 / 4', transform: 'rotate(-3deg)' }}>
                <Image src="/lp/print-relatorio.png" alt="Capa do relatório do Iris Codex" fill sizes="164px" className="object-cover object-top" />
              </div>
            </div>
          </div>

          {/* bloco trial — o herói da oferta */}
          <div className="lp-reveal mx-auto mt-10 max-w-[680px] text-center" data-d="1" style={{ background: 'var(--white)', border: '1px solid var(--teal)', borderRadius: '4px', padding: '2.6rem 1.6rem' }}>
            <h2 className="display mx-auto" style={{ fontSize: 'clamp(2rem,4.2vw,3.2rem)', color: '#0d0d0d', maxWidth: '20ch' }}>
              A primeira leitura é sua. <em style={{ color: 'var(--teal-dark)' }}>Use como quiser.</em>
            </h2>
            <p className="body-copy mx-auto mt-6" style={{ color: '#4a4a4a', fontSize: '1.15rem', maxWidth: '44ch' }}>
              Ganhou uma leitura por nossa conta. Faça na sua própria íris ou na de um cliente. Você escolhe.
            </p>
            <div className="mt-8">
              <Link href="/signup" className="btn btn-primary">Fazer minha leitura grátis</Link>
            </div>
            <p className="mx-auto mt-6 text-sm" style={{ color: 'var(--mist)', maxWidth: '52ch' }}>
              Se fizer sentido, você compra suas leituras quando quiser — avulsa ou pacote, sem assinatura. No seu ritmo.
            </p>
          </div>

          {/* fileira de pacotes — preço por leitura é o protagonista */}
          <div className="lp-reveal mt-20 text-center" data-d="2">
            <p className="eyebrow" style={{ color: 'var(--teal-dark)' }}>Quando quiser continuar</p>
            <h2 className="display mx-auto mt-6" style={{ fontSize: 'clamp(2rem,4.2vw,3.2rem)', color: '#0d0d0d' }}>
              Compre quando quiser. <em style={{ color: 'var(--teal-dark)' }}>Sem assinatura.</em>
            </h2>
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
                  data-d={String((i % 4) + 1)}
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
                  <p className="display mt-1" style={{ fontSize: '1.4rem', color: '#0d0d0d', lineHeight: 1.05 }}>{p.total} <span className="body-copy" style={{ fontSize: '.72rem', color: 'var(--mist)', letterSpacing: '.04em' }}>no total</span></p>
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
            <h2 className="display mt-6" style={{ fontSize: 'clamp(2rem,4.2vw,3.2rem)', color: '#0d0d0d' }}>Antes de começar.</h2>
          </div>
          <div style={{ borderTop: '1px solid var(--rule-light)', borderBottom: '1px solid var(--rule-light)' }}>
            {FAQ.map((item) => (
              <details key={item.q} name="faq" className="lp-faq lp-reveal" open={item.open || undefined} style={{ borderTop: '1px solid var(--rule-light)' }}>
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
          <h2 className="display lp-reveal" style={{ fontSize: 'clamp(2.5rem,5vw,4.3rem)' }}>
            Seu próximo cliente já traz<br />o mapa <em style={{ color: 'var(--teal-light)' }}>nos próprios olhos.</em>
          </h2>
          <div className="lp-reveal mt-12" data-d="1">
            <Link href="/signup" className="btn btn-primary">Fazer minha leitura grátis</Link>
          </div>
          <p className="lp-reveal mt-8 text-xs" data-d="1" style={{ color: 'var(--mist)', letterSpacing: '.06em' }}>
            Sem cartão · 1 leitura grátis · sem assinatura.
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
  --rule-light:#e8e0d2; --rule-dark:rgba(242,237,228,.1);
  background:var(--black); color:var(--ivory);
  font-family: var(--font-raleway), ui-sans-serif, system-ui, sans-serif; font-weight:300;
  overflow-x:hidden;
}
.lp-root *{ -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }
html:has(.lp-root){ scroll-behavior:smooth; }

.display { font-family: var(--font-cormorant), Georgia, serif; font-weight:400; letter-spacing:-0.01em; line-height:1.1; text-wrap:balance; }
.display em { font-style:italic; font-weight:400; }
.eyebrow { font-family: var(--font-raleway), sans-serif; font-weight:400; font-size:.72rem; letter-spacing:.34em; text-transform:uppercase; }
.body-copy { font-weight:300; line-height:1.68; letter-spacing:.005em; max-width:68ch; text-wrap:pretty; }
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

/* molduras de foto — sistema único (M1): fundo claro = borda bege; fundo escuro = anel teal */
.lp-frame-light { position:relative; border-radius:2px; overflow:hidden; border:1px solid #e6ddcf; box-shadow:0 30px 70px -38px rgba(0,0,0,.42); }
.lp-frame-dark { position:relative; border-radius:2px; overflow:hidden; box-shadow:0 40px 100px -45px rgba(0,0,0,.85), 0 0 0 1px rgba(91,191,176,.18); }

.vignette { position:absolute; inset:0; z-index:1; pointer-events:none; background:radial-gradient(circle at 50% 45%, transparent 30%, rgba(0,0,0,.55) 78%, rgba(0,0,0,.85) 100%); }

.paper { background:var(--white); color:#1a1a1a; border-radius:2px; border:1px solid #e6ddcf; box-shadow:0 30px 80px -40px rgba(0,0,0,.55); font-family:var(--font-cormorant),Georgia,serif; }
.paper .rule { border:0; border-top:1.5px solid var(--teal); }
.paper .ln { height:9px; border-radius:1px; background:#ece6da; }

/* reveal — visível por padrão; só esconde quando JS arma (html.lp-anim) */
.lp-reveal { transition:opacity .9s cubic-bezier(.16,1,.3,1), transform .9s cubic-bezier(.16,1,.3,1); }
html.lp-anim .lp-reveal:not(.in) { opacity:0; transform:translateY(22px); }
.lp-reveal[data-d="1"] { transition-delay:.1s; } .lp-reveal[data-d="2"] { transition-delay:.2s; } .lp-reveal[data-d="3"] { transition-delay:.3s; } .lp-reveal[data-d="4"] { transition-delay:.4s; }

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
