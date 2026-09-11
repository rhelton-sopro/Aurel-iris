import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { concluiuDepoisDaReserva, exameReaproveitavel } from '../regras-de-geracao'

describe('exameReaproveitavel', () => {
  const exame = { achados: [{ campo: 'figado', intensidade: 'I2' }] }

  it('usa exame válido', () => {
    expect(exameReaproveitavel({ exame_json: exame, validation_status: 'valid' })).toBe(exame)
  })
  it('usa invalid_retried — passou na 2ª tentativa', () => {
    expect(exameReaproveitavel({ exame_json: exame, validation_status: 'invalid_retried' })).toBe(exame)
  })
  it('recusa invalid_final — reprovado nas duas', () => {
    expect(exameReaproveitavel({ exame_json: exame, validation_status: 'invalid_final' })).toBeNull()
  })
  it('recusa exame vazio {}', () => {
    expect(exameReaproveitavel({ exame_json: {}, validation_status: 'valid' })).toBeNull()
  })
  it('recusa linha ausente', () => {
    expect(exameReaproveitavel(null)).toBeNull()
    expect(exameReaproveitavel(undefined)).toBeNull()
    expect(exameReaproveitavel({ exame_json: null })).toBeNull()
  })
})

describe('concluiuDepoisDaReserva', () => {
  const reservaDoDossie = '2026-09-08T18:06:01.435+00:00'

  it('Mapa entregue ANTES da reserva não autoriza cobrar (o Dossiê que falhou)', () => {
    expect(concluiuDepoisDaReserva(reservaDoDossie, ['2026-09-02T21:40:00+00:00', null])).toBe(false)
  })
  it('documento concluído depois autoriza cobrar', () => {
    expect(concluiuDepoisDaReserva(reservaDoDossie, [null, '2026-09-11T17:36:00+00:00'])).toBe(true)
  })
  it('sem documento concluído não cobra', () => {
    expect(concluiuDepoisDaReserva(reservaDoDossie, [null, undefined])).toBe(false)
    expect(concluiuDepoisDaReserva(reservaDoDossie, [])).toBe(false)
  })
  it('data de reserva ilegível não cobra', () => {
    expect(concluiuDepoisDaReserva('lixo', ['2026-09-11T17:36:00+00:00'])).toBe(false)
  })
})

// ⛔ GUARDA DA REGRESSÃO DE 11/09. A tela e a rota de geração têm que decidir "dá pra
// gerar com o exame salvo?" pela MESMA função. Quando cada uma tinha a sua cópia, a tela
// passou a mostrar o botão e a rota continuou exigindo as fotos — um mês de leituras
// travadas sem nenhum teste acusar. Se um destes quebrar, alguém separou as regras de novo.
describe('contrato tela ↔ rota de geração', () => {
  const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
  const ler = (rel: string) => readFileSync(path.join(web, rel), 'utf8')
  const rota = ler('app/api/readings/[id]/analyze/route.ts')

  it('a rota decide o reuso do exame pela regra compartilhada', () => {
    expect(rota).toMatch(/exameReaproveitavel\(/)
  })
  it('o reuso do exame não depende de qual documento foi pedido', () => {
    expect(rota).not.toMatch(/reusaStage1\s*=\s*doc\s*===/)
  })
  it('a tela decide "tem exame" pela mesma regra', () => {
    expect(ler('lib/emocional/findings.ts')).toMatch(/exameReaproveitavel\(/)
  })
  it('página e cron debitam pela mesma regra de reserva', () => {
    expect(ler('app/(dashboard)/leituras/[id]/page.tsx')).toMatch(/concluiuDepoisDaReserva\(/)
    expect(ler('lib/billing/cron-jobs.ts')).toMatch(/concluiuDepoisDaReserva\(/)
  })
})
