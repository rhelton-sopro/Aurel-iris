'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAdult, MIN_AGE } from '@/lib/gates/profile-completeness'
import {
  generateToken,
  validateToken,
  buildInviteUrl,
} from '@/lib/invite/tokens'

// ── Action 1: TERAPEUTA gera token ─────────────────────────────────────

export interface CreateInviteResult {
  url?: string
  expires_at?: string
  error?: string
}

/**
 * Terapeuta gera um convite single-use. clientId opcional:
 *   - null → cliente NOVO (form de cadastro inline em /convite/[token])
 *   - uuid → cliente JÁ CADASTRADO (skip cadastro, vai direto pra captura
 *     com re-consent 'reconfirm_device' + channel 'remote_link')
 *
 * notifyOnCapture (v2.9.0): se true (default), terapeuta recebe email
 * quando cliente completar as 6 fotos. Persistido na coluna
 * notify_on_capture_complete do token (migration 0034) — lido pelo
 * notify-therapist-capture-complete.ts pra decidir disparo.
 *
 * Validações server-side:
 *   - sessão obrigatória (auth.uid())
 *   - se clientId preenchido: RLS valida ownership do cliente
 *   - default expires_at = now + 7 dias (DB default)
 */
export async function createInviteTokenAction(
  clientId: string | null,
  notifyOnCapture: boolean = true,
): Promise<CreateInviteResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) {
    return { error: 'Não autenticado.' }
  }

  // Se clientId preenchido, valida ownership via RLS (SELECT — RLS de
  // clients limita ao therapist_id = auth.uid()).
  if (clientId) {
    const { data: owned, error: ownErr } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .maybeSingle()
    if (ownErr || !owned) {
      return { error: 'Cliente não encontrado ou sem permissão.' }
    }
  }

  // TERMO_GATE_BYPASS — BILLING-03 + LGPD-01 (D-19) — Decisão A+ (founder 2026-05-28).
  // O gate de termo biométrico NÃO é aplicado aqui (na criação do link de
  // convite). Razão: o consentimento biométrico pertence ao CLIENTE e é
  // assinado por ele NO PONTO DE CAPTURA do fluxo remote_link
  // (/convite/[token]/capturar), via passo de termo que precede a captura das
  // fotos (signInviteTermAction + consent_channel='remote_link'). Gatear na
  // geração do link forçaria o terapeuta a assinar pelo cliente — errado.
  // D-19 fala "antes de INICIAR captura", e a captura efetiva acontece no
  // /convite/[token]/capturar, não na geração do link.
  //
  // Onde o gate de termo VIVE de fato:
  //   - office_handoff: createReadingAction → assertClientTermoSigned (08-15 task 2)
  //   - remote_link:    /convite/[token]/capturar → passo de termo bloqueante
  //                     ANTES do CaptureClient (08-15 A+); cliente assina via
  //                     signInviteTermAction (app/actions/invite-consent.ts).
  //
  // Insert via session client (RLS policy aceita therapist_id = auth.uid()).
  // therapist_id é setado server-side a partir de user.id — não confia em
  // input do cliente.
  const token = generateToken()
  const service = createServiceClient()
  const { data, error } = await service
    .from('client_invite_tokens' as never)
    .insert({
      token,
      therapist_id: user.id,
      client_id: clientId,
      notify_on_capture_complete: notifyOnCapture,
    } as never)
    .select('expires_at')
    .single()
  if (error || !data) {
    return { error: error?.message ?? 'Falha ao gerar convite.' }
  }

  revalidatePath('/clientes')
  return {
    url: buildInviteUrl(token),
    expires_at: (data as { expires_at: string }).expires_at,
  }
}

// ── Action 2: PÚBLICO completa cadastro do cliente novo ────────────────

const newClientSchema = z
  .object({
    full_name: z.string().min(1, 'Nome é obrigatório'),
    birth_date: z.string().min(1, 'Data de nascimento é obrigatória'),
    biological_sex: z.enum(['feminino', 'masculino']),
    email: z
      .string()
      .min(1, 'E-mail é obrigatório')
      .refine((v) => /.+@.+\..+/.test(v), 'E-mail inválido'),
    phone: z.string().min(1, 'Telefone é obrigatório'),
    notes: z.string().max(2000).optional().nullable(),
    consent_accepted: z.boolean().refine((v) => v === true, 'Aceite o termo'),
  })
  .refine((d) => isAdult(d.birth_date) === true, {
    path: ['birth_date'],
    message: `É necessário ter ${MIN_AGE} anos ou mais.`,
  })

export type CompleteInviteFormState = {
  error?: Record<string, string[]> | string | null
}

/** Normaliza e-mail pra comparação/gravação: sem espaços, minúsculo. */
function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

/**
 * Acha o cadastro que o cliente JÁ tem com ESTE terapeuta, comparando e-mail
 * sem diferenciar maiúsculas (a constraint clients_therapist_email_unique é
 * case-sensitive; a comparação aqui é mais larga de propósito, pra reaproveitar
 * "Daniel.Negri@x.com" quando ele digita "daniel.negri@x.com").
 *
 * `%` e `_` são wildcards no ilike — escapados pra não casar o cliente errado
 * (e-mail com underscore é comum).
 */
async function findExistingClientByEmail(
  service: ReturnType<typeof createServiceClient>,
  therapistId: string,
  email: string,
) {
  const pattern = normalizeEmail(email).replace(/([\\%_])/g, '\\$1')
  const { data } = await service
    .from('clients')
    .select('id, full_name, birth_date, biological_sex, phone, notes')
    .eq('therapist_id', therapistId)
    .ilike('email', pattern)
    .order('created_at', { ascending: true })
    .limit(1)
  return data?.[0] ?? null
}

/** Derivado do próprio select — não redeclarar os campos à mão, senão o tipo
 *  daqui e o do banco divergem em silêncio na próxima migration. */
type ExistingClient = NonNullable<
  Awaited<ReturnType<typeof findExistingClientByEmail>>
>

/**
 * Ao reaproveitar um cadastro que já existia, completa APENAS o que estava em
 * branco. Nunca sobrescreve dado que o terapeuta já tinha preenchido — o
 * prontuário dele é a fonte. A observação nova do cliente é anexada (não
 * substitui) pra não sumir em silêncio: ele digitou achando que ia ser lida.
 */
async function fillBlankFields(
  service: ReturnType<typeof createServiceClient>,
  existing: ExistingClient,
  input: {
    full_name: string
    birth_date: string
    biological_sex: string
    phone: string
    notes?: string | null
  },
): Promise<void> {
  const patch: {
    full_name?: string
    birth_date?: string
    biological_sex?: string
    phone?: string
    notes?: string
  } = {}
  const isBlank = (v: string | null) => v === null || v.trim() === ''

  if (isBlank(existing.full_name)) patch.full_name = input.full_name
  if (isBlank(existing.birth_date)) patch.birth_date = input.birth_date
  if (isBlank(existing.biological_sex)) patch.biological_sex = input.biological_sex
  if (isBlank(existing.phone)) patch.phone = input.phone

  // Anexa a observação nova. O `includes` evita repetir o mesmo texto quando o
  // cliente reenvia o form (duplo toque, voltar-e-mandar-de-novo).
  const novaNota = input.notes?.trim()
  const notasAtuais = existing.notes ?? ''
  if (novaNota) {
    if (notasAtuais.trim() === '') {
      patch.notes = novaNota
    } else if (!notasAtuais.includes(novaNota)) {
      patch.notes = `${notasAtuais}\n\n${novaNota}`
    }
  }

  if (Object.keys(patch).length === 0) return

  const { error } = await service.from('clients').update(patch).eq('id', existing.id)
  // Nice-to-have: falhar aqui não pode impedir a captura de começar.
  if (error) console.error('[invite] fillBlankFields falhou:', error.message)
}

/**
 * Path PÚBLICO — chamado de /convite/[token]/page.tsx pelo cliente sem
 * sessão. Valida o token (NÃO marca used_at — isso só na finalize da
 * captura), cria o client com therapist_id derivado do token, persiste
 * o consent ('initial' + 'remote_link'), e redireciona pra captura.
 *
 * NÃO valida sessão Supabase — token é o auth aqui. Service-role faz
 * tudo bypassando RLS.
 */
export async function completeInviteNewClientAction(
  token: string,
  _prevState: CompleteInviteFormState,
  formData: FormData,
): Promise<CompleteInviteFormState> {
  const validation = await validateToken(token)
  if (validation.status !== 'ok') {
    return { error: 'Convite inválido ou expirado.' }
  }
  // Se token já vinha com client_id, este endpoint é o errado (cliente
  // existente vai direto pra captura — não cadastra de novo).
  if (validation.token.client_id) {
    return { error: 'Este convite é para um cliente já cadastrado.' }
  }

  const parsed = newClientSchema.safeParse({
    full_name: formData.get('full_name'),
    birth_date: formData.get('birth_date'),
    biological_sex: formData.get('biological_sex'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    notes: formData.get('notes') || null,
    consent_accepted: formData.get('consent_accepted') === 'true',
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const service = createServiceClient()
  const therapistId = validation.token.therapist_id
  const email = normalizeEmail(parsed.data.email)

  // 1. Cria o client com therapist_id do token (service-role; RLS bypassed).
  //
  // ANTES disso: se este e-mail JÁ é cliente deste mesmo terapeuta, reaproveita
  // o cadastro em vez de tentar criar outro (founder 2026-08-09: "um e-mail não
  // pode ser negado quando ele vai fazer o exame"). Sem isso, o insert batia na
  // constraint clients_therapist_email_unique e o cliente via na tela o erro
  // cru do Postgres — "duplicate key value violates unique constraint" — sem
  // saída nenhuma (Daniel Negri, 09/08: já era cliente do mesmo terapeuta desde
  // 18/07). É a MESMA pessoa com o MESMO terapeuta: o certo é seguir pra
  // captura, não barrar.
  let client = await findExistingClientByEmail(service, therapistId, email)

  if (client) {
    await fillBlankFields(service, client, parsed.data)
  } else {
    const { data: created, error: clientErr } = await service
      .from('clients')
      .insert({
        therapist_id: therapistId,
        full_name: parsed.data.full_name,
        birth_date: parsed.data.birth_date,
        biological_sex: parsed.data.biological_sex,
        email,
        phone: parsed.data.phone,
        notes: parsed.data.notes ?? null,
      })
      .select('id, full_name, birth_date, biological_sex, phone, notes')
      .single()

    if (clientErr || !created) {
      // 23505 aqui = corrida entre dois submits (duplo toque / reenvio do
      // form): o outro já criou. Busca o vencedor e segue.
      if ((clientErr as { code?: string } | null)?.code === '23505') {
        client = await findExistingClientByEmail(service, therapistId, email)
      }
      if (!client) {
        // Nunca devolve error.message do Postgres pra tela do cliente final.
        console.error('[invite] falha ao criar cliente:', clientErr?.message)
        return {
          error:
            'Não conseguimos concluir seu cadastro agora. Tente de novo em instantes ou avise seu terapeuta.',
        }
      }
    } else {
      client = created
    }
  }

  // 2. Vincula client_id ao token. Sem isto, re-entrada do cliente
  //    (network drop mid-captura) cai no form de cadastro outra vez
  //    porque /convite/[token]/page.tsx checa validation.token.client_id
  //    pra decidir entre "Olá, X — começar leitura" e "form de cadastro".
  //    Guard idempotente (is null) evita race entre 2 submits paralelos.
  //    NÃO marca used_at — single-use é queimado só na finalize.
  await service
    .from('client_invite_tokens' as never)
    .update({ client_id: client.id } as never)
    .eq('id', validation.token.id)
    .is('client_id', null)

  // 3. WR-03: NÃO escreve consent aqui. O consentimento biométrico LGPD é
  //    propriedade exclusiva de signInviteTermAction no momento da assinatura
  //    (com PDF + IP + user-agent + atualização do current-pointer
  //    clients.consent_last_at). Antes, inseríamos uma row 'initial' fantasma
  //    sem IP/PDF/pointer — duplicata que corrompia a trilha de auditoria
  //    jurídica (asseverava consentimento sem nenhum artefato de prova). O
  //    checkbox do form de cadastro é UI acknowledgment, não o aceite biométrico.

  // 4. Redireciona pra captura (token segue na URL — auth pública).
  redirect(`/convite/${token}/capturar?client=${client.id}`)
}
