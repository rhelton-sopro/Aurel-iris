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
        dados conforme a Lei nº 13.709/2018 (LGPD) e a Lei nº 12.965/2014 (Marco
        Civil da Internet).
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink">
        <section className="space-y-2">
          <h2 className="text-base font-medium">1. Controlador e contato</h2>
          <p>
            O Iris Codex é o responsável pelo tratamento dos dados do terapeuta
            usuário. Para exercício de direitos e dúvidas sobre privacidade,
            contate o responsável pelo tratamento de dados pelo e-mail{' '}
            <a href="mailto:rhelton@gmail.com" className="underline">
              rhelton@gmail.com
            </a>
            . O Iris Codex encontra-se em fase beta restrita; a identificação
            registral completa do controlador será publicada nesta Política
            antes de qualquer disponibilização ao público geral.
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
            fluxo próprio da plataforma. Caso o examinado seja criança ou
            adolescente, você é responsável por obter o consentimento específico
            e em destaque de ao menos um dos pais ou responsável legal,
            observando o art. 14 da LGPD e o melhor interesse do menor.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">4. Bases legais</h2>
          <p>
            Tratamos os dados do terapeuta com fundamento na execução de
            contrato e procedimentos preliminares (art. 7º, V), no cumprimento
            de obrigação legal/regulatória (art. 7º, II — incluindo a guarda de
            registros de acesso a aplicação exigida pelo art. 15 do Marco Civil
            da Internet) e no legítimo interesse, restrito a dados do próprio
            terapeuta e telemetria, para segurança e melhoria do serviço (art.
            7º, IX).
          </p>
          <p>
            Os dados de examinados incluem <strong>dados pessoais sensíveis</strong>{' '}
            — imagens de íris (dado biométrico) e informações relativas à saúde
            e ao contexto terapêutico (art. 5º, II da LGPD). Esse tratamento se
            fundamenta no <strong>consentimento específico e destacado do
            titular para finalidades específicas (art. 11, I da LGPD)</strong>,
            coletado e registrado por você no fluxo próprio da plataforma,
            podendo ainda apoiar-se na tutela da saúde por profissional (art.
            11, II, &quot;f&quot;). O Iris Codex, como operador, processa esses
            dados exclusivamente para gerar o relatório de apoio, sob suas
            instruções.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">5. Finalidades</h2>
          <p>
            Autenticação e operação da conta; geração e armazenamento das
            leituras e relatórios; comunicação operacional; segurança,
            prevenção a fraude e cumprimento legal; melhoria da ferramenta
            (sem uso de conteúdo de examinado para essa finalidade).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">
            6. Operadores e transferência internacional
          </h2>
          <p>
            Utilizamos subprocessadores para viabilizar o serviço:{' '}
            <strong>Supabase</strong> (banco de dados e autenticação),{' '}
            <strong>Vercel</strong> (hospedagem),{' '}
            <strong>Resend</strong> (envio de e-mails) e{' '}
            <strong>Anthropic</strong> (processamento de IA para geração do
            relatório). Esses fornecedores armazenam e/ou processam dados nos{' '}
            <strong>Estados Unidos</strong>. Como os EUA não possuem decisão de
            adequação da ANPD, a transferência internacional fundamenta-se em
            cláusulas contratuais firmadas com cada subprocessador, com
            garantias compatíveis com a LGPD (art. 33, II e VIII), e, quanto a
            dados sensíveis de examinados, no consentimento específico e
            destacado do titular para a transferência (art. 33, VIII), coletado
            por você no fluxo de consentimento. Os Acordos de Tratamento de
            Dados (DPA) dos subprocessadores estão disponíveis mediante
            solicitação ao contato do item 1.
          </p>
          <p>
            As imagens e textos enviados para processamento de IA não são
            utilizados para treinar modelos da Anthropic nem de terceiros. A
            geração do relatório é um <strong>apoio assistido por IA, sem
            decisão automatizada com efeitos jurídicos</strong> sobre o titular
            (art. 20 da LGPD) — a interpretação e a conduta cabem ao terapeuta.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">7. Retenção</h2>
          <p>
            Dados da conta do terapeuta são mantidos enquanto a conta estiver
            ativa e por período razoável após o encerramento, para cumprimento
            de obrigações legais. <strong>Registros de acesso à aplicação são
            guardados por 6 (seis) meses</strong>, nos termos do art. 15 do
            Marco Civil da Internet. Dados de examinados são mantidos pelo
            período definido por você (controlador) e eliminados após sua
            instrução ou o encerramento da conta, ressalvada a guarda mínima
            legal e a <strong>preservação anonimizada da prova de
            consentimento</strong> (art. 16, I da LGPD).
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
            (art. 18 da LGPD). As solicitações devem ser dirigidas ao contato do
            item 1. Responderemos à confirmação de existência de tratamento e ao
            acesso em até <strong>15 (quinze) dias</strong> (art. 19, II da
            LGPD); as demais no menor prazo possível. Quando você atuar como
            controlador de dados de examinados, encaminharemos a você, como
            operador, as solicitações de titulares recebidas diretamente, para
            que você as atenda.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">9. Segurança</h2>
          <p>
            Adotamos medidas técnicas e administrativas para proteger os dados
            (controle de acesso, criptografia em trânsito, isolamento por
            terapeuta). O acesso é por código de uso único enviado por e-mail —{' '}
            <strong>não armazenamos senha</strong>. Nenhum sistema é totalmente
            imune; em caso de incidente de segurança que possa acarretar risco
            ou dano relevante, comunicaremos a ANPD e os titulares afetados nos
            termos do art. 48 da LGPD e, quando atuarmos como operador,{' '}
            <strong>notificaremos você (controlador) sem demora injustificada</strong>{' '}
            para as providências cabíveis.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">
            10. Cookies e armazenamento local
          </h2>
          <p>
            Utilizamos apenas o cookie de sessão de autenticação (Supabase),
            estritamente necessário para manter você conectado. Não utilizamos
            cookies de publicidade nem analytics de terceiros. Registros de
            acesso seguem a retenção do item 7 (art. 15 do Marco Civil).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium">11. Alterações</h2>
          <p>
            Esta Política pode ser atualizada. Mudanças relevantes serão
            sinalizadas (por e-mail cadastrado e/ou no acesso à plataforma) e
            poderá ser solicitado novo aceite. A versão vigente é identificada
            no topo desta página.
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
