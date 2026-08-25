// Versão vigente dos Termos de Uso + Política de Privacidade do TERAPEUTA
// (usuário da plataforma) — distinto do termo de consentimento do EXAMINADO
// (lib/consent/term-v2.md + consent_terms, atualmente v2).
//
// AI-DRAFTED, pendente de revisão jurídica (débito registrado em memória,
// paralelo ao term-v2). Bump de versão = nova string aqui + (futuro)
// re-aceite forçado das contas existentes via o GATE de /perfil/completar.
//
// ── v2 (2026-08-25) ────────────────────────────────────────────────────────
// Bump obrigatório: o conteúdo dos dois documentos mudou. Manter "v1" com
// texto diferente do que 39 contas aceitaram criaria dois documentos distintos
// alegando ser a mesma versão — pior do que o erro que estávamos corrigindo.
//
// O que mudou em relação ao v1:
//   TERMOS
//     · avaliação gratuita: "3 leituras" → 1 leitura (o código sempre deu 1
//       desde 2026-06-05; o texto ficou para trás). 1 conta aceitou o v1 na
//       janela em que ele prometia 3.
//     · pagamento: PIX com desconto e parcelamento passam a constar (estavam
//       só na tela de compra), e o processador (Mercado Pago) é nomeado.
//     · reembolso parcial: dito que é por solicitação ao suporte, não automático.
//     · ciclo de vida da foto da íris (24h) passa a constar — o terapeuta é o
//       controlador e precisa conhecer a retenção que a plataforma aplica.
//     · link de convite: uso único e 7 dias.
//     · beta: saiu "há limite de leituras por conta no período" (não existe
//       limite além do saldo de créditos).
//   PRIVACIDADE
//     · §2: CPF e endereço passam a constar na lista de dados do terapeuta —
//       ambos são obrigatórios no cadastro e não estavam declarados.
//     · §6: entram os subprocessadores que faltavam — Mercado Pago (pagamento,
//       Brasil), Render/Gotenberg (geração de PDF, EUA) e Hostinger (caixa de
//       suporte, fora do Brasil). Sem eles a lista estava incompleta para o
//       art. 33. A lista agora separa quem trata no Brasil de quem trata fora.
//     · §7: passa a declarar o apagamento automático das imagens de íris em 24h,
//       alinhando com o que o termo do examinado (v2) já promete.
//     · §10: menciona o armazenamento local da preferência de captura.
// ───────────────────────────────────────────────────────────────────────────

export const TOS_VERSION = 'v2'

// Data de vigência exibida nas páginas /termos e /privacidade.
export const TOS_EFFECTIVE_DATE = '25 de agosto de 2026'
