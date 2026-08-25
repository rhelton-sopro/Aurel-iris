// Endereços digitados à mão no campo "Para" da caixa de suporte.
//
// Bug de 25/08: o campo aceitava UM endereço só. O founder colava vários
// separados por ponto e vírgula ("a@x.com; b@y.com") e o envio inteiro morria
// em "Destinatário avulso inválido" — inclusive os terapeutas já escolhidos na
// caixinha, que não tinham nada com aquilo.
//
// ⚠️ Este arquivo é usado pelos DOIS lados (tela e server action) de propósito:
// o aviso que aparece na tela tem que ser exatamente a regra que decide o
// envio. Não duplicar a regex do outro lado. NÃO marcar como server-only.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface EnderecosAvulsos {
  /** Endereços válidos, na ordem digitada, sem repetição. */
  validos: string[]
  /** O que veio escrito e não é endereço — mostrado ao founder tal e qual. */
  invalidos: string[]
}

/**
 * Separa o que foi digitado por `;`, `,`, quebra de linha ou espaço.
 *
 * Aceita a forma `Fulana <fulana@x.com>` que sai ao copiar de outro cliente de
 * e-mail — o que interessa é o endereço entre os sinais. Duplicata (ignorando
 * maiúsculas) cai fora: ninguém pode receber a mesma mensagem duas vezes.
 */
export function parseEnderecos(raw: string | null | undefined): EnderecosAvulsos {
  const validos: string[] = []
  const invalidos: string[] = []
  // Pedaço sem "@" costuma ser o NOME que veio colado junto ("Fulana
  // <fulana@x.com>"). Só vira erro se, no fim, não sobrar endereço nenhum —
  // aí é o founder tendo digitado algo que não é e-mail.
  const semArroba: string[] = []
  const vistos = new Set<string>()

  for (const parte of (raw ?? '').split(/[;,\n\r\s]+/)) {
    const bruto = parte.trim()
    if (!bruto) continue
    const limpo = bruto.replace(/^</, '').replace(/>$/, '')
    if (!limpo.includes('@')) {
      semArroba.push(bruto)
      continue
    }
    if (!EMAIL.test(limpo)) {
      invalidos.push(bruto)
      continue
    }
    const chave = limpo.toLowerCase()
    if (vistos.has(chave)) continue
    vistos.add(chave)
    validos.push(limpo)
  }

  if (!validos.length) invalidos.push(...semArroba)

  return { validos, invalidos }
}
