// Canal em memória por jogo (SSE). Fica no globalThis porque o agendador (instrumentation) e as rotas são bundles
// diferentes do mesmo processo. ponytail: um processo só (plano §7); LISTEN/NOTIFY se um dia tiver mais de um.
import type { FaseRodada, StatusJogo } from '../db/schema.ts'

export type EventoJogo =
  | { tipo: 'fase'; status: StatusJogo; rodada: number; fase: FaseRodada | null; prazo: number | null; inicio: number | null }
  | { tipo: 'ready'; prontos: number[] }
  | { tipo: 'pick'; membro: number; time: string | null }

type Ouvinte = (e: EventoJogo) => void
const g = globalThis as { __canais?: Map<number, Set<Ouvinte>> }
const canais = (g.__canais ??= new Map())

export function ouvir(gameId: number, f: Ouvinte): () => void {
  const s = canais.get(gameId) ?? new Set()
  canais.set(gameId, s.add(f))
  return () => {
    s.delete(f)
    if (!s.size) canais.delete(gameId)
  }
}

export function publicar(gameId: number, e: EventoJogo) {
  for (const f of canais.get(gameId) ?? []) f(e)
}
