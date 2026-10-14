import { and, desc, eq, gte } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { membroAtual } from '../../../lib/auth/sessao.ts'
import { db } from '../../../lib/db/index.ts'
import { games, roundLogs, rounds, type ConfigJogo } from '../../../lib/db/schema.ts'
import type { ResumoRodada } from '../../../lib/game/rodada.ts'
import { catalogo, permitido } from '../../../lib/game/escolha.ts'
import { Escolha } from './escolha.tsx'
import { Hub } from './hub.tsx'

/** A regra de escolha do admin, em uma frase. */
function regra(cfg: ConfigJogo): string {
  const divs = cfg.divisoes.length ? cfg.divisoes.map((d) => d ? `Série ${'ABC'[d - 1]}` : 'fora das séries').join(', ') : ''
  const partes = [divs && `só ${divs}`, cfg.proibidos.length && `${cfg.proibidos.length} time(s) proibido(s)`].filter(Boolean)
  return partes.length ? `Regra do admin: ${partes.join('; ')}.` : 'Qualquer time brasileiro.'
}

export default async function Jogo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const gid = Number((await params).id)
  const { erro } = await searchParams
  const ctx = await membroAtual(gid)
  if (!ctx) redirect('/')
  const [g] = await db().select().from(games).where(eq(games.id, gid))
  if (g!.status === 'lobby' || g!.status === 'picking')
    return <Escolha nomeJogo={g!.name} regra={regra(g!.config)} erro={erro} times={g!.status === 'picking' ? catalogo(g!.gameSeed, g!.config).filter((t) => permitido(g!.config, t)) : []} />

  const [r] = await db().select().from(rounds).where(and(eq(rounds.gameId, gid), eq(rounds.n, g!.round)))
  // a última rodada já vista por todos: o que ainda toca ao vivo não entra
  const [ultima] = (await db().select().from(roundLogs).where(and(eq(roundLogs.gameId, gid), gte(roundLogs.n, g!.round - 1)))
    .orderBy(desc(roundLogs.n), desc(roundLogs.etapa)))
    .filter((l) => !(l.n === g!.round && ((l.etapa === 0 && r?.phase === 'ao_vivo_1t') || (l.etapa === 1 && r?.phase === 'ao_vivo_2t'))))
  return <Hub ultima={ultima ? { n: ultima.n, resumo: ultima.data as ResumoRodada } : null} erro={erro} />
}
