import { and, desc, eq, lte } from 'drizzle-orm'
import { db } from '../../../../lib/db/index.ts'
import { games, roundLogs } from '../../../../lib/db/schema.ts'
import type { ResumoRodada } from '../../../../lib/game/rodada.ts'
import { pendentesDe } from '../pendentes.ts'
import { Propostas } from './propostas.tsx'

export default async function PaginaPropostas({ params }: { params: Promise<{ id: string }> }) {
  const gid = Number((await params).id)
  const [g] = await db().select({ round: games.round }).from(games).where(eq(games.id, gid))
  // o resultado dos pedidos sai no log do planejamento (etapa 0) da rodada que resolveu
  const [l] = await db().select().from(roundLogs).where(and(eq(roundLogs.gameId, gid), eq(roundLogs.etapa, 0), lte(roundLogs.n, g?.round ?? 0)))
    .orderBy(desc(roundLogs.n)).limit(1)
  return <Propostas pendentes={await pendentesDe(params)} ultima={l ? { n: l.n, resultados: (l.data as ResumoRodada).resultados } : null} />
}
