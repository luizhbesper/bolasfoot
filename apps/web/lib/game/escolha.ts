// Lobby e escolha de times (docs/plano.md §3.5). O buscador mostra a divisão de cada time no mundo que vai nascer:
// o mesmo novoJogo com a mesma seed que o `comecarJogo` usa.
import { novoJogo } from '@bolasfoot/engine'
import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/index.ts'
import { gameMembers, games, gameSettings, type ConfigJogo } from '../db/schema.ts'
import { base } from './base.ts'
import { publicar } from './canal.ts'
import { estadoFase, prontos, seedDoMundo } from './rodada.ts'

export interface TimeEscolha { fileRef: string; nome: string; uf: string; divisao: number }

const BRASIL = 29
const catalogos = new Map<string, TimeEscolha[]>()

/** Times brasileiros com a divisão do mundo que vai nascer. ponytail: um novoJogo por jogo, guardado em memória. */
export function catalogo(gameSeed: string): TimeEscolha[] {
  let c = catalogos.get(gameSeed)
  if (!c) {
    const m = novoJogo(base, { habilidadeIndividual: false }, seedDoMundo(gameSeed))
    c = m.times.filter((t) => t.pais === BRASIL)
      .map((t) => ({ fileRef: t.fileRef, nome: t.nome, uf: base.ufs[t.uf!]?.sigla ?? '', divisao: t.divisao }))
      .sort((a, b) => (a.divisao || 9) - (b.divisao || 9) || a.nome.localeCompare(b.nome, 'pt-BR'))
    catalogos.set(gameSeed, c)
  }
  return c
}

export const permitido = (cfg: ConfigJogo, t: TimeEscolha) =>
  !cfg.proibidos.includes(t.fileRef) && (cfg.divisoes.length === 0 || cfg.divisoes.includes(t.divisao))

/** Admin abre a escolha de times (lobby → picking), com o prazo do planejamento. */
export async function iniciarEscolha(d: Db, gameId: number) {
  const [s] = await d.select().from(gameSettings).where(eq(gameSettings.gameId, gameId))
  await d.update(games).set({ status: 'picking', deadline: new Date(Date.now() + s!.planningTimeoutS * 1000) })
    .where(and(eq(games.id, gameId), eq(games.status, 'lobby')))
  publicar(gameId, await estadoFase(d, gameId))
}

/** Escolhe (ou troca) o time. Time de outro membro, proibido ou fora das divisões é recusado. */
export async function escolherTime(d: Db, gameId: number, userId: number, fileRef: string): Promise<string | null> {
  const [g] = await d.select().from(games).where(eq(games.id, gameId))
  if (g?.status !== 'picking') return 'a escolha de times não está aberta'
  const t = catalogo(g.gameSeed).find((x) => x.fileRef === fileRef)
  if (!t || !permitido(g.config, t)) return 'time não permitido'
  try {
    const r = await d.update(gameMembers).set({ teamRef: fileRef, ready: false })
      .where(and(eq(gameMembers.gameId, gameId), eq(gameMembers.userId, userId))).returning({ id: gameMembers.id })
    if (!r.length) return 'você não está neste jogo'
    publicar(gameId, { tipo: 'pick', membro: r[0]!.id, time: fileRef })
    publicar(gameId, await prontos(d, gameId))
    return null
  } catch (e) {
    if ((e as { cause?: { code?: string } }).cause?.code === '23505' || (e as { code?: string }).code === '23505') return 'time já escolhido'
    throw e
  }
}
