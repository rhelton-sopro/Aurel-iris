import { beforeEach, describe, expect, it, vi } from 'vitest'

// Regressão de PRODUÇÃO (2026-08-09, Daniel Negri): o cliente abriu o link do
// terapeuta, digitou o e-mail com que JÁ era cliente daquele mesmo terapeuta e
// levou na cara o erro cru do Postgres — "duplicate key value violates unique
// constraint clients_therapist_email_unique" — sem nenhuma saída na tela.
// Regra do founder: um e-mail não pode ser negado na hora de fazer o exame.

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((p: string) => {
    throw new Error(`NEXT_REDIRECT:${p}`)
  }),
}))

const validateToken = vi.fn()
vi.mock('@/lib/invite/tokens', () => ({
  validateToken: (...a: unknown[]) => validateToken(...a),
  generateToken: vi.fn(() => 'tok-novo'),
  buildInviteUrl: vi.fn((t: string) => `https://iriscodex.com/convite/${t}`),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
  })),
}))

const serviceFrom = vi.fn()
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: (t: string) => serviceFrom(t) })),
}))

import { completeInviteNewClientAction } from './invites'

const THERAPIST = 'therapist-1'
const TOKEN = 'tok-abc'
const EMAIL = 'daniel.negri@negripar.com'

/** Chain encadeável e thenable (mesmo padrão de clients.test.ts). */
function chain(resolved: { terminal?: unknown; single?: unknown }): Record<string, unknown> {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'eq', 'ilike', 'order', 'limit', 'is']) {
    c[m] = vi.fn(() => c)
  }
  c.single = vi.fn(() => Promise.resolve(resolved.single ?? { data: null, error: null }))
  c.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
    Promise.resolve(resolved.terminal ?? { data: [], error: null }).then(onF, onR)
  return c
}

function form(over: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const base: Record<string, string> = {
    full_name: 'Daniel Augusto Negri',
    birth_date: '1977-04-06',
    biological_sex: 'masculino',
    email: EMAIL,
    phone: '(62) 98101-0229',
    notes: '',
    consent_accepted: 'true',
  }
  for (const [k, v] of Object.entries({ ...base, ...over })) fd.set(k, v)
  return fd
}

/** Roda a action capturando o redirect (que o mock lança). */
async function run(fd: FormData): Promise<{ redirectedTo?: string; error?: unknown }> {
  try {
    const state = await completeInviteNewClientAction(TOKEN, {}, fd)
    return { error: state.error }
  } catch (e) {
    const msg = (e as Error).message
    if (msg.startsWith('NEXT_REDIRECT:')) return { redirectedTo: msg.slice('NEXT_REDIRECT:'.length) }
    throw e
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  validateToken.mockResolvedValue({
    status: 'ok',
    token: { id: 'row-1', token: TOKEN, therapist_id: THERAPIST, client_id: null },
  })
})

describe('completeInviteNewClientAction — e-mail já cadastrado com o mesmo terapeuta', () => {
  it('reaproveita o cadastro existente e segue pra captura (não devolve erro)', async () => {
    const insert = vi.fn()
    const existente = {
      id: 'client-existente',
      full_name: 'Daniel Augusto Negri',
      birth_date: '1977-04-06',
      biological_sex: 'masculino',
      phone: '62981010229',
      notes: null,
    }
    serviceFrom.mockImplementation((t: string) => {
      if (t === 'clients') {
        const c = chain({ terminal: { data: [existente], error: null } })
        c.insert = insert
        return c
      }
      return chain({})
    })

    const { redirectedTo, error } = await run(form())

    expect(error).toBeUndefined()
    expect(redirectedTo).toBe(`/convite/${TOKEN}/capturar?client=client-existente`)
    expect(insert).not.toHaveBeenCalled()
  })

  it('completa só o que estava em branco e anexa a observação nova — sem repetir', async () => {
    const update = vi.fn()
    const existente = {
      id: 'client-existente',
      full_name: 'Daniel Augusto Negri', // preenchido pelo terapeuta
      birth_date: null, // em branco
      biological_sex: 'masculino',
      phone: '62981010229',
      notes: 'Encaminhado pela Nailli.\n\nDorme mal.',
    }
    serviceFrom.mockImplementation((t: string) => {
      const c = chain({ terminal: { data: [existente], error: null } })
      if (t === 'clients') c.update = vi.fn((p: unknown) => { update(p); return c })
      return c
    })

    await run(form({ full_name: 'OUTRO NOME', notes: 'Dorme mal.' }))

    expect(update).toHaveBeenCalledTimes(1)
    const patch = update.mock.calls[0][0] as Record<string, string>
    expect(patch).toEqual({ birth_date: '1977-04-06' }) // só o vazio
    expect(patch.full_name).toBeUndefined() // não sobrescreve o terapeuta
    expect(patch.notes).toBeUndefined() // observação já estava lá
  })

  it('acha o cadastro mesmo com o e-mail digitado em outra caixa', async () => {
    const ilike = vi.fn()
    serviceFrom.mockImplementation((t: string) => {
      const c = chain(
        t === 'clients'
          ? { terminal: { data: [{ id: 'client-existente', full_name: 'X', birth_date: '1977-04-06', biological_sex: 'masculino', phone: '1', notes: null }], error: null } }
          : {},
      )
      if (t === 'clients') c.ilike = vi.fn((col: string, pat: string) => { ilike(col, pat); return c })
      return c
    })

    const { redirectedTo } = await run(form({ email: '  Daniel.Negri@NegriPar.com ' }))

    expect(redirectedTo).toBe(`/convite/${TOKEN}/capturar?client=client-existente`)
    expect(ilike).toHaveBeenCalledWith('email', EMAIL)
  })

  it('escapa _ e % do e-mail pra não casar o cliente errado', async () => {
    const ilike = vi.fn()
    serviceFrom.mockImplementation((t: string) => {
      const c = chain({ terminal: { data: [], error: null }, single: { data: { id: 'novo' }, error: null } })
      if (t === 'clients') c.ilike = vi.fn((col: string, pat: string) => { ilike(col, pat); return c })
      return c
    })

    await run(form({ email: 'ana_paula@x.com' }))

    expect(ilike).toHaveBeenCalledWith('email', 'ana\\_paula@x.com')
  })
})

describe('completeInviteNewClientAction — cadastro novo', () => {
  it('cria o cliente e vai pra captura', async () => {
    serviceFrom.mockImplementation((t: string) =>
      chain(
        t === 'clients'
          ? { terminal: { data: [], error: null }, single: { data: { id: 'client-novo' }, error: null } }
          : {},
      ),
    )

    const { redirectedTo, error } = await run(form({ email: 'novo@x.com' }))

    expect(error).toBeUndefined()
    expect(redirectedTo).toBe(`/convite/${TOKEN}/capturar?client=client-novo`)
  })

  it('nunca vaza a mensagem crua do Postgres pra tela do cliente', async () => {
    serviceFrom.mockImplementation((t: string) =>
      chain(
        t === 'clients'
          ? {
              terminal: { data: [], error: null },
              single: {
                data: null,
                error: { code: '23514', message: 'new row violates check constraint "clients_biological_sex_check"' },
              },
            }
          : {},
      ),
    )

    const { error } = await run(form({ email: 'novo@x.com' }))

    expect(typeof error).toBe('string')
    expect(error).not.toMatch(/constraint|violates|duplicate key/i)
  })
})
