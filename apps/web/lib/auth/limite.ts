// Rate limit do login, em memória por IP (um processo só: §7).
const JANELA_MS = 10 * 60 * 1000
const MAX = 10
const tentativas = new Map<string, { n: number; ate: number }>()

/** Conta uma tentativa; false = passou do limite nesta janela. */
export function tentar(ip: string, agora = Date.now()): boolean {
  const t = tentativas.get(ip)
  if (!t || t.ate < agora) {
    tentativas.set(ip, { n: 1, ate: agora + JANELA_MS })
    return true
  }
  return ++t.n <= MAX
}
