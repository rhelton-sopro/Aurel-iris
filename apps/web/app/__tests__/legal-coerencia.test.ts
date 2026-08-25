import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  TRIAL_READINGS_MAX,
  TRIAL_DAYS,
  CREDIT_VALIDITY_DAYS,
  REFUND_WINDOW_DAYS,
} from '@/lib/billing/config'
import { TOS_VERSION } from '@/lib/consent/tos'

/**
 * Guard de coerência entre os TEXTOS LEGAIS e o SISTEMA (2026-08-25).
 *
 * Nasceu de uma divergência real que durou 81 dias: os Termos de Uso prometiam
 * "3 leituras" de avaliação gratuita enquanto o código dava 1 desde 2026-06-05.
 * O número estava travado em lib/billing/config.ts o tempo todo — só que o texto
 * era uma cópia solta, e cópia solta não avisa quando a fonte muda. Uma conta
 * chegou a aceitar os Termos dentro dessa janela.
 *
 * O que este teste NÃO é: uma revisão jurídica. Ele não sabe se a cláusula está
 * bem escrita. Ele sabe se o NÚMERO que está escrito é o número que o sistema
 * aplica — que é o tipo de erro que ninguém pega lendo, porque o texto continua
 * fazendo sentido sozinho.
 *
 * ⛔ Se um destes valores mudar, o teste quebra e obriga a reescrever o texto
 * junto. É o ponto.
 */
const RAIZ = path.resolve(__dirname, '../..')

/**
 * Lê a COPY que a pessoa enxerga, não o arquivo cru. Duas normalizações, e as
 * duas foram exigidas por falso-positivo real deste próprio teste:
 *
 *  1. Tira comentários. Sem isso, a nota que EXPLICA o erro histórico ("o '3
 *     leituras' desta linha ficou 81 dias divergente") era lida como se a
 *     promessa ainda estivesse na tela.
 *  2. Colapsa espaço em branco. O JSX quebra frases no meio por causa da
 *     margem do arquivo, então a frase que o leitor vê como uma linha só está
 *     no fonte partida em duas — e não casaria com a busca literal.
 */
function ler(rota: string): string {
  const cru = readFileSync(path.join(RAIZ, rota), 'utf8')
  return cru
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // blocos /* */ e {/* */} do JSX
    .replace(/^\s*\/\/.*$/gm, ' ') // linhas //
    .replace(/\s+/g, ' ') // quebras do JSX viram espaço simples
}

const TERMOS = ler('app/termos/page.tsx')
const PRIVACIDADE = ler('app/privacidade/page.tsx')
const COMPRAR = ler('app/(dashboard)/assinatura/comprar/page.tsx')

describe('Termos de Uso — números batem com lib/billing/config.ts', () => {
  it('avaliação gratuita diz o mesmo número de leituras que o sistema dá', () => {
    expect(TRIAL_READINGS_MAX).toBe(1) // se mudar, o texto abaixo muda junto
    expect(TERMOS).toContain(`${TRIAL_READINGS_MAX} leitura ou ${TRIAL_DAYS} dias`)
  })

  it('⛔ não sobrou nenhuma promessa de 3 leituras grátis', () => {
    expect(TERMOS).not.toMatch(/3 leituras/)
  })

  it('validade dos créditos bate com CREDIT_VALIDITY_DAYS', () => {
    expect(CREDIT_VALIDITY_DAYS).toBe(365)
    expect(TERMOS).toContain('12 (doze) meses')
  })

  it('janela de arrependimento bate com REFUND_WINDOW_DAYS', () => {
    expect(REFUND_WINDOW_DAYS).toBe(7)
    expect(TERMOS).toContain(`${REFUND_WINDOW_DAYS} dias corridos`)
  })

  it('declara o ciclo de vida de 24h da imagem de íris', () => {
    // O termo que o EXAMINADO assina (v2) promete isso a ele; o terapeuta é o
    // controlador desses dados e precisa conhecer a retenção que aplicamos.
    expect(TERMOS).toContain('24 horas após o envio da última foto')
  })

  it('declara o link de convite como uso único e 7 dias', () => {
    expect(TERMOS).toContain('uso único')
    expect(TERMOS).toContain('7 dias')
  })
})

describe('Política de Privacidade — declara o que o sistema realmente coleta', () => {
  it('CPF e endereço constam na lista de dados do terapeuta', () => {
    // Ambos são coletados e obrigatórios (o endereço, na compra). Declarar a
    // menos é o furo — não a mais.
    expect(PRIVACIDADE).toContain('<strong>CPF</strong>')
    expect(PRIVACIDADE).toContain('<strong>endereço</strong>')
  })

  it('lista TODOS os subprocessadores que recebem dado', () => {
    for (const fornecedor of [
      'Supabase',
      'Vercel',
      'Anthropic',
      'Resend',
      'Render', // gera os PDFs — recebe o conteúdo do relatório
      'Hostinger', // caixa de suporte
      'Mercado Pago', // recebe nome, e-mail e CPF pra gerar a cobrança
    ]) {
      expect(PRIVACIDADE).toContain(fornecedor)
    }
  })

  it('a retenção da imagem de íris não contradiz o termo do examinado', () => {
    // Esta era a contradição mais séria: a Política dizia que a retenção dos
    // dados do examinado era "definida pelo controlador", enquanto o termo
    // assinado por ele promete o apagamento automático em 24h.
    expect(PRIVACIDADE).toContain('24 horas após o envio da última foto')
  })
})

describe('Tela de compra — não contradiz os Termos', () => {
  it('nomeia o processador que realmente abre (Mercado Pago, não Asaas)', () => {
    expect(COMPRAR).toContain('Mercado Pago')
    expect(COMPRAR).not.toMatch(/checkout Asaas/)
  })

  it('menciona o reembolso proporcional, não só o integral', () => {
    // A tela prometia menos do que os Termos garantem: quem já tivesse usado
    // uma leitura concluía que não tinha direito a nada.
    expect(COMPRAR).toContain('proporcional')
  })
})

describe('Versão dos documentos', () => {
  it('o conteúdo mudou em 2026-08-25, então a versão deixou de ser v1', () => {
    // Manter "v1" com texto diferente do que as contas aceitaram criaria dois
    // documentos distintos alegando ser a mesma versão.
    expect(TOS_VERSION).not.toBe('v1')
  })
})
