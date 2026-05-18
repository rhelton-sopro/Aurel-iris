import Link from 'next/link'
import { TOS_VERSION, TOS_EFFECTIVE_DATE } from '@/lib/consent/tos'

export const metadata = {
  title: 'Política de Privacidade — Iris Codex',
}

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-light uppercase tracking-display text-ink">
        Política de Privacidade
      </h1>
      <p className="mt-2 text-sm text-mist">
        Versão {TOS_VERSION} — vigente desde {TOS_EFFECTIVE_DATE}. Tratamento de
        dados conforme a Lei nº 13.709/2018 (LGPD).
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink">
        <section className="space-y-2">
          <h2 className="text-base font-medium">1. Controlador e contato</h2>
          <p>
            O Iris Codex é o responsável pelo tratamento dos dados do terapeuta
            usuário. Para exercício de direitos e dúvidas sobre privacidade,
            contate o encarregado pelo e-mail{' '}
            <a href="mailto:rhelton@gmail.com" className="underline">
              rhelton@gmail.com
            </a>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">
            2. Dados que tratamos — terapeuta
          </h2>
          <p>
            Nome completo, e-mail, telefone/WhatsApp, especialidades, aceite dos
            termos (data e versão) e dados de uso (registros de acesso, logs
            técnicos e de segurança).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">
            3. Dados de examinados inseridos por você
          </h2>
          <p>
            Ao usar a ferramenta, você insere dados de seus examinados (nome,
            data de nascimento, sexo biológico, contato, imagens de íris e
            anotações). Quanto a esses dados, <strong>você é o controlador</strong>{' '}
            e o Iris Codex atua como <strong>operador</strong>, tratando-os
            apenas para prestar o serviço, conforme suas instruções e os{' '}
            <Link href="/termos" className="underline">
              Termos de Uso
            </Link>
            . O consentimento do examinado é coletado e registrado por meio do
            fluxo próprio da plataforma.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">4. Bases legais</h2>
          <p>
            Tratamos os dados do terapeuta com fundamento na execução de
            contrato e procedimentos preliminares (art. 7º, V), no cumprimento
            de obrigação legal/regulatória (art. 7º, II) e no legítimo interesse
            para segurança e melhoria do serviço (art. 7º, IX). Dados de
            examinados são tratados com base no consentimento do titular (art.
            7º, I) obtido por você.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">5. Finalidades</h2>
          <p>
            Autenticação e operação da conta; geração e armazenamento das
            leituras e relatórios; comunicação operacional; segurança,
            prevenção a fraude e cumprimento legal; melhoria da ferramenta.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">
            6. Operadores e transferência internacional
          </h2>
          <p>
            Utilizamos subprocessadores para viabilizar o serviço:{' '}
            <strong>Supabase</strong> (banco de dados e autenticação),{' '}
            <strong>Vercel</strong> (hospedagem da aplicação),{' '}
            <strong>Resend</strong> (envio de e-mails) e{' '}
            <strong>Anthropic</strong> (processamento de IA para geração do
            relatório). Esses fornecedores podem processar dados fora do Brasil;
            nesse caso, a transferência internacional observa o art. 33 da LGPD,
            adotadas as salvaguardas cabíveis. As imagens e textos enviados para
            processamento de IA não são utilizados para treinar modelos de
            terceiros.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">7. Retenção</h2>
          <p>
            Mantemos os dados pelo tempo necessário às finalidades acima e ao
            cumprimento de obrigações legais. Encerrada a conta ou atendida
            solicitação de eliminação, os dados são apagados ou anonimizados,
            ressalvada a guarda mínima exigida por lei e a preservação
            anonimizada da prova de consentimento (art. 16 da LGPD).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">
            8. Direitos do titular
          </h2>
          <p>
            Você e os titulares podem solicitar confirmação de tratamento,
            acesso, correção, anonimização, portabilidade, eliminação e
            informação sobre compartilhamento, bem como revogar consentimento
            (art. 18 da LGPD). As solicitações podem ser feitas pelo contato do
            item 1 e serão atendidas nos prazos legais.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">9. Segurança</h2>
          <p>
            Adotamos medidas técnicas e administrativas para proteger os dados
            (controle de acesso, criptografia em trânsito, isolamento por
            terapeuta). Nenhum sistema é totalmente imune; em caso de incidente
            relevante, adotaremos as providências e comunicações exigidas pela
            LGPD.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">
            10. Cookies e armazenamento local
          </h2>
          <p>
            Utilizamos apenas armazenamento estritamente necessário para manter
            sua sessão autenticada. Não utilizamos cookies de publicidade.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">11. Alterações</h2>
          <p>
            Esta Política pode ser atualizada. Mudanças relevantes serão
            sinalizadas e poderá ser solicitado novo aceite. A versão vigente é
            identificada no topo desta página.
          </p>
        </section>
      </div>

      <div className="mt-12 border-t border-b-ink/20 pt-6 text-sm">
        <Link href="/signup" className="underline">
          Voltar ao cadastro
        </Link>
      </div>
    </main>
  )
}
