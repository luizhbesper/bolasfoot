// Canal por jogo (SSE). Fica no globalThis porque o agendador (instrumentation) e as rotas são bundles diferentes do
// mesmo processo. Entre processos (dev + e2e no mesmo banco, ou mais de uma instância), o Postgres repassa por
// LISTEN/NOTIFY: quem transiciona pode não ser o processo que segura o SSE.
import { randomUUID } from 'node:crypto'
import { db } from '../db/index.ts'
import type { FaseRodada, StatusJogo } from '../db/schema.ts'

export type EventoJogo =
  | { tipo: 'fase'; status: StatusJogo; rodada: number; fase: FaseRodada | null; prazo: number | null; inicio: number | null
      /** pausado desde (o relógio do cliente congela aqui) */
      pausa: number | null; aguardando: boolean; offline: number[] }
  | { tipo: 'ready'; prontos: number[] }
  | { tipo: 'pick'; membro: number; time: string | null }
  /** alguém mudou um lance de leilão: as telas recarregam (os lances da rodada são públicos) */
  | { tipo: 'lance' }

type Ouvinte = (e: EventoJogo) => void
const g = globalThis as { __canais?: Map<number, Set<Ouvinte>>; __canalPg?: boolean }
const canais = (g.__canais ??= new Map())
const PROCESSO = randomUUID()
const CANAL = 'bolasfoot_jogo'

export function ouvir(gameId: number, f: Ouvinte): () => void {
  const s = canais.get(gameId) ?? new Set()
  canais.set(gameId, s.add(f))
  return () => {
    s.delete(f)
    if (!s.size) canais.delete(gameId)
  }
}

const entregar = (gameId: number, e: EventoJogo) => {
  for (const f of canais.get(gameId) ?? []) f(e)
}

export function publicar(gameId: number, e: EventoJogo) {
  entregar(gameId, e)
  if (g.__canalPg)
    db().$client.notify(CANAL, JSON.stringify({ de: PROCESSO, gameId, e })).catch((err) => console.error('canal:', err))
}

/** Liga o repasse entre processos (uma vez, na subida do servidor; os testes não ligam). */
export async function iniciarCanal() {
  if (g.__canalPg) return
  g.__canalPg = true
  await db().$client.listen(CANAL, (s) => {
    const { de, gameId, e } = JSON.parse(s) as { de: string; gameId: number; e: EventoJogo }
    if (de !== PROCESSO) entregar(gameId, e)
  })
}
