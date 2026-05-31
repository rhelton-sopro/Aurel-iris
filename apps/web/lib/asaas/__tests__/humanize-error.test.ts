import { describe, expect, it } from 'vitest'

import { humanizeAsaasError } from '../humanize-error'

describe('humanizeAsaasError', () => {
  it('mapeia invalid_action parcial-próximo-dia → mensagem amigável', () => {
    const raw =
      '{"errors":[{"code":"invalid_action","description":"Esta transação só pode ser estornada parcialmente no próximo dia."}]}'
    expect(humanizeAsaasError(raw)).toMatch(/a partir do dia seguinte/i)
    expect(humanizeAsaasError(raw)).not.toContain('{')
  })

  it('mapeia erro de saldo → mensagem de liquidação', () => {
    const raw =
      '{"errors":[{"code":"invalid_action","description":"Saldo insuficiente para estorno."}]}'
    expect(humanizeAsaasError(raw)).toMatch(/saldo|liquid/i)
    expect(humanizeAsaasError(raw)).not.toContain('"errors"')
  })

  it('usa o description do Asaas pra erros genéricos (sem JSON cru)', () => {
    const raw =
      '{"errors":[{"code":"invalid_object","description":"cpfCnpj inválido."}]}'
    expect(humanizeAsaasError(raw)).toBe('cpfCnpj inválido.')
  })

  it('fallback genérico pra texto não-JSON (ex: network / 500 plataforma)', () => {
    expect(humanizeAsaasError('network')).toMatch(/provedor de pagamento/i)
    expect(humanizeAsaasError('Internal Server Error')).toMatch(
      /provedor de pagamento/i,
    )
  })

  it('fallback pra null/vazio e nunca vaza chaves JSON', () => {
    expect(humanizeAsaasError(null)).toMatch(/provedor de pagamento/i)
    expect(humanizeAsaasError('')).toMatch(/provedor de pagamento/i)
    expect(humanizeAsaasError('{"errors":[]}')).not.toContain('errors')
  })
})
