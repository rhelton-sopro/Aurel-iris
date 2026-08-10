import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Guard de arquitetura (2026-08-10, caso Nailli).
 *
 * `report_findings` tem a policy `founder_full_access` (migration 0028): pela sessão,
 * só o e-mail do founder enxerga a tabela. Enquanto as telas liam o exame com o cliente
 * de SESSÃO, todo terapeuta que não fosse ele recebia null, o código caía no `?? {}` e o
 * motor rodava sem dado — gráficos zerados e "Repertório de suporte" ausente, sem erro
 * nenhum. Gerar sempre funcionou (o /analyze usa service-role); só a EXIBIÇÃO quebrava.
 *
 * Este teste falha se alguém voltar a ler report_findings pela sessão numa rota de
 * exibição. O caminho certo é getExameJson() — service-role, depois de a rota já ter
 * validado o dono carregando a `readings` por RLS.
 */
const RAIZ = path.resolve(__dirname, '../../..')

const ROTAS_DE_EXIBICAO = [
  'app/(dashboard)/leituras/[id]/page.tsx',
  'app/(dashboard)/leituras/[id]/emocional/page.tsx',
  'app/(dashboard)/leituras/[id]/emocional/documento/route.ts',
  'app/api/readings/[id]/emocional/pdf/route.ts',
]

describe('exame_json nas rotas que MOSTRAM o Mapa do Ser', () => {
  it.each(ROTAS_DE_EXIBICAO)('%s usa getExameJson (service-role)', (rota) => {
    const src = readFileSync(path.join(RAIZ, rota), 'utf8')
    expect(src).toContain('getExameJson')
  })

  it.each(ROTAS_DE_EXIBICAO)('%s não lê report_findings pela sessão', (rota) => {
    const src = readFileSync(path.join(RAIZ, rota), 'utf8')

    // Sobra uma leitura legítima em page.tsx: `method_version`, que é só rótulo de
    // versão no cabeçalho — não alimenta o render. O que não pode voltar é a leitura
    // do exame_json pela sessão.
    const lePorSessao = /from\((['"])report_findings\1\)[\s\S]{0,220}?exame_json/.test(src)
    expect(lePorSessao).toBe(false)
  })
})
