/**
 * Destino guardado através de um desvio (`?next=`).
 *
 * Existe porque o produto perdia o destino em DOIS desvios diferentes, e o
 * sintoma era o mesmo nos dois:
 *
 *   1. Sessão expirada. Os avisos por e-mail ("o cliente terminou as fotos",
 *      "relatório pronto") levam direto pra `/leituras/<id>`. Sem sessão — ou
 *      no celular, quando o e-mail chegou e o login está no computador — o
 *      middleware mandava pro /login e o destino sumia; depois do código, o
 *      terapeuta caía no /dashboard e tinha que caçar a leitura na lista.
 *
 *   2. Cadastro incompleto. Qualquer tela pedida virava "complete seu
 *      cadastro" e, ao salvar, o destino também sumia no /dashboard.
 *
 * A regra de segurança é uma só e vale pros dois: só devolvemos caminho
 * INTERNO. Um `next` que aponte pra fora vira redirect aberto — a pessoa clica
 * num link do nosso domínio e termina no site de outro, ainda achando que está
 * aqui. Por isso a validação recusa tudo que não seja inequivocamente interno.
 */

/** Telas que nunca são destino — voltar pra elas depois do login faz laço. */
const NUNCA_DESTINO = ['/login', '/signup', '/perfil/completar']

/** Control chars: o navegador os ignora ao resolver a URL, então "/\t/evil.com"
 *  passaria por uma checagem ingênua e viraria destino externo. */
const CONTROL_CHARS = new RegExp('[\u0000-\u001f\u007f]')

/**
 * Devolve o caminho quando ele é um destino interno seguro; `null` caso
 * contrário. Aceita caminho com query e âncora (`/leituras/x?a=1#b`).
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null
  // Precisa começar com UMA barra. "//evil.com" e "/\evil.com" são absolutos
  // pro navegador e escapariam de uma checagem ingênua de "começa com /".
  if (!raw.startsWith('/')) return null
  if (raw[1] === '/' || raw[1] === '\\') return null
  if (CONTROL_CHARS.test(raw)) return null

  const semQuery = raw.split(/[?#]/)[0] ?? ''
  if (NUNCA_DESTINO.some((p) => semQuery === p || semQuery.startsWith(p + '/'))) {
    return null
  }
  return raw
}

/** Monta `/login?next=…` preservando o destino (ou `/login` puro se inseguro). */
export function loginHrefComDestino(destino: string | null | undefined): string {
  const seguro = safeNextPath(destino)
  return seguro ? `/login?next=${encodeURIComponent(seguro)}` : '/login'
}
