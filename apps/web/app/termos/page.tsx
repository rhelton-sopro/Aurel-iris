import Link from 'next/link'
import { TOS_VERSION, TOS_EFFECTIVE_DATE } from '@/lib/consent/tos'

export const metadata = {
  title: 'Termos de Uso — Iris Codex',
}

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-light uppercase tracking-display text-ink">
        Termos de Uso
      </h1>
      <p className="mt-2 text-sm text-mist">
        Versão {TOS_VERSION} — vigente desde {TOS_EFFECTIVE_DATE}.
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink">
        <section className="space-y-2">
          <h2 className="text-base font-medium">1. Objeto</h2>
          <p>
            O Iris Codex é uma ferramenta digital de <strong>apoio à anamnese
            terapêutica integrativa</strong>. Ela auxilia o terapeuta na
            organização e interpretação de leituras de íris.{' '}
            <strong>Não é dispositivo médico, não realiza diagnóstico e não
            substitui avaliação, diagnóstico ou tratamento médico</strong> de
            qualquer natureza.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">2. Elegibilidade e conta</h2>
          <p>
            O uso é destinado a profissionais terapeutas, maiores de 18 anos. O
            acesso é feito por código de uso único enviado ao seu e-mail. Você é
            responsável por manter a confidencialidade do acesso à sua conta e
            por toda atividade nela realizada.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">3. Uso aceitável</h2>
          <p>
            Você se compromete a utilizar a ferramenta apenas no contexto da sua
            prática terapêutica integrativa, sem empregá-la como instrumento de
            diagnóstico médico. A interpretação dos relatórios e a condução da
            relação com o examinado são de sua inteira responsabilidade
            profissional.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">
            4. Dados de examinados, LGPD e papel de operador
          </h2>
          <p>
            Em relação aos dados dos seus examinados, você atua como{' '}
            <strong>controlador</strong> e o Iris Codex como{' '}
            <strong>operador</strong>. Esses dados podem conter{' '}
            <strong>dados pessoais sensíveis</strong> (saúde) e{' '}
            <strong>biométricos</strong> (imagem de íris), exigindo de você
            consentimento específico e destacado nos termos do art. 11 da LGPD —
            a plataforma fornece o fluxo de consentimento para esse fim. Se o
            examinado for menor de idade, aplica-se o art. 14 da LGPD
            (consentimento de responsável).
          </p>
          <p>Como operador, o Iris Codex:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              tratará os dados de examinados exclusivamente conforme suas
              instruções e estes Termos;
            </li>
            <li>manterá confidencialidade;</li>
            <li>
              auxiliará você no atendimento a titulares e em incidentes de
              segurança;
            </li>
            <li>
              ao término, eliminará ou devolverá os dados, ressalvada a guarda
              legal;
            </li>
            <li>
              utilizará apenas os subprocessadores listados na{' '}
              <Link href="/privacidade" className="underline">
                Política de Privacidade
              </Link>
              , notificando alterações.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">5. Fase beta</h2>
          <p>
            A ferramenta encontra-se em fase beta restrita. Funcionalidades
            podem mudar, há limite de leituras por conta no período, e pode
            haver instabilidades. Recursos podem ser adicionados, alterados ou
            removidos sem aviso prévio.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">
            6. Propriedade intelectual
          </h2>
          <p>
            A plataforma, sua marca, código e materiais são de titularidade do
            Iris Codex. Os relatórios gerados podem ser usados por você no
            âmbito da sua prática profissional. Não é permitido copiar,
            redistribuir ou explorar comercialmente a ferramenta sem
            autorização.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">
            7. Limitação de responsabilidade
          </h2>
          <p>
            O Iris Codex é fornecido &quot;no estado em que se encontra&quot;,
            como ferramenta de apoio, sem garantia de resultado clínico ou
            terapêutico. Na máxima extensão permitida pela lei, o Iris Codex não
            se responsabiliza por decisões clínicas, interpretações ou condutas
            adotadas pelo terapeuta a partir do uso da ferramenta. As limitações
            deste item aplicam-se na máxima extensão permitida pela lei e{' '}
            <strong>não afastam direitos irrenunciáveis do consumidor, quando
            aplicável o Código de Defesa do Consumidor</strong>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">
            8. Suspensão e encerramento
          </h2>
          <p>
            Podemos suspender ou encerrar contas em caso de violação destes
            Termos ou uso indevido. Você pode solicitar o encerramento da sua
            conta a qualquer momento pelo contato abaixo.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">9. Alterações</h2>
          <p>
            Estes Termos podem ser atualizados. Mudanças relevantes serão
            sinalizadas (por e-mail cadastrado e/ou no acesso à plataforma) e
            poderá ser solicitado novo aceite. A versão vigente é identificada
            no topo desta página.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">10. Lei aplicável</h2>
          <p>
            Estes Termos são regidos pelas leis da República Federativa do
            Brasil, eleito o foro do domicílio do usuário para dirimir
            controvérsias.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">11. Contato</h2>
          <p>
            Dúvidas sobre estes Termos:{' '}
            <a href="mailto:rhelton@gmail.com" className="underline">
              rhelton@gmail.com
            </a>
            .
          </p>
        </section>
      </div>

      <div className="mt-12 border-t border-b-ink/20 pt-6 text-sm">
        <Link href="/" className="underline">
          Voltar
        </Link>
      </div>
    </main>
  )
}
