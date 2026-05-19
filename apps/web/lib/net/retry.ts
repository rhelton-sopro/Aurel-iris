// Retry de erro de REDE (não de erro de API real).
// 2026-05-19: signInWithOtp/verifyOtp/upload falhavam com
// "Failed to fetch" / "Load failed" / status 0 / ERR_CONNECTION_CLOSED na
// 1ª tentativa; o 2º clique idêntico funcionava. Automatiza esse re-clique.

interface MaybeErr {
  message?: string
  status?: number
}

/** true só para falha de conexão/rede — NÃO para erro de API (422, 429,
 *  "código inválido", "not found", etc.), que não deve ser retentado. */
export function isNetworkError(err: MaybeErr | null | undefined): boolean {
  if (!err) return false
  if (err.status === 0) return true
  const m = (err.message ?? '').toLowerCase()
  return (
    m.includes('failed to fetch') ||
    m.includes('load failed') ||
    m.includes('networkerror') ||
    m.includes('network error') ||
    m.includes('err_connection') ||
    m.includes('connection closed') ||
    m.includes('fetch failed')
  )
}

/**
 * Executa uma chamada estilo supabase ({ error }) e, se o erro for de REDE,
 * retenta após um delay. Erro real de API passa direto (sem retry).
 */
export async function withNetworkRetry<T extends { error: MaybeErr | null }>(
  call: () => Promise<T>,
  { retries = 1, delayMs = 800 }: { retries?: number; delayMs?: number } = {},
): Promise<T> {
  let result = await call()
  let attempt = 0
  while (attempt < retries && isNetworkError(result.error)) {
    await new Promise((r) => setTimeout(r, delayMs))
    result = await call()
    attempt++
  }
  return result
}
