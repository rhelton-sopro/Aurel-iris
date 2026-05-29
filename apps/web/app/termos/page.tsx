// audit-vocabulary:allowlist — página legal cita vocab clínico (diagnóstico,
// tratamento) apenas para NEGAR ("não realiza diagnóstico", "não substitui
// tratamento médico") + "tratamento de dados" no sentido LGPD.
import Link from 'next/link'
import { TOS_VERSION, TOS_EFFECTIVE_DATE } from '@/lib/consent/tos'
import { DisclaimerCopy } from '@/components/legal/DisclaimerCopy'

export const metadata = {
  title: 'Termos de Uso — Iris Codex',
}

// E-mail operacional de contato (mesma decisão de checkpoint que /privacidade).
// Decidido no checkpoint 08-09 Task 5 (founder, 2026-05-28): suporte@iriscodex.com.
// Override via NEXT_PUBLIC_OPERATOR_EMAIL no Vercel.
const OPERATOR_EMAIL =
  process.env.NEXT_PUBLIC_OPERATOR_EMAIL ?? 'suporte@iriscodex.com'

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

        {/* D-02 pricing + D-13/D-14 arrependimento — em destaque (D-14). */}
        <section className="space-y-3 border-2 border-teal/30 bg-ivory/50 p-4">
          <h2 className="text-base font-medium">Modelo de pagamento</h2>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <strong>Avaliação gratuita:</strong> 3 leituras ou 60 dias (o que
              ocorrer primeiro), sem necessidade de cartão de crédito.
            </li>
            <li>
              <strong>Pacotes pré-pagos</strong> (créditos adquiridos
              antecipadamente):
              <ul className="ml-5 mt-1 list-disc space-y-1">
                <li>Avulsa: R$ 99,70 (1 leitura)</li>
                <li>Pacote Pequeno: R$ 298,50 (5 leituras — R$ 59,70 por leitura)</li>
                <li>
                  Pacote Médio: R$ 745,50 (15 leituras — R$ 49,70 por leitura)
                  — <em>Mais escolhido</em>
                </li>
                <li>
                  Pacote Grande: R$ 1.191,00 (30 leituras — R$ 39,70 por
                  leitura) — <em>Melhor valor</em>
                </li>
              </ul>
            </li>
            <li>
              <strong>Validade dos créditos:</strong> 12 (doze) meses contados a
              partir da confirmação do pagamento. Você pode manter múltiplos
              pacotes ativos; o saldo é somado e consumido do mais antigo para o
              mais recente.
            </li>
            <li>
              Após o vencimento dos 12 meses, créditos não utilizados são
              encerrados <strong>sem reembolso</strong> (salvo avaliação
              caso-a-caso pelo suporte).
            </li>
          </ul>
        </section>

        <section className="space-y-3 border-2 border-teal/30 bg-ivory/50 p-4">
          <h2 className="text-base font-medium">Direito de arrependimento</h2>
          <p>
            Nos termos do art. 49 do Código de Defesa do Consumidor, você dispõe
            de <strong>7 dias corridos</strong> (sete dias) após a confirmação
            do pagamento para solicitar o cancelamento da compra de créditos:
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              Se nenhuma leitura do pacote foi consumida:{' '}
              <strong>reembolso integral</strong>.
            </li>
            <li>
              Se ao menos 1 leitura foi consumida:{' '}
              <strong>reembolso proporcional</strong> sobre o saldo restante.
            </li>
            <li>
              Após os 7 dias: sem reembolso de créditos não utilizados (avaliação
              caso-a-caso via suporte).
            </li>
          </ul>
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
            <a href={`mailto:${OPERATOR_EMAIL}`} className="underline">
              {OPERATOR_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>

      <div className="mt-10 border-t border-ink/15 pt-6">
        <DisclaimerCopy variant="inline" />
      </div>

      <div className="mt-8 border-t border-b-ink/20 pt-6 text-sm">
        <Link href="/" className="underline">
          Voltar
        </Link>
      </div>
    </main>
  )
}
