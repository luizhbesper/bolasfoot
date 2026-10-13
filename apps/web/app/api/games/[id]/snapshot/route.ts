// O mundo mais recente que o membro pode ver (até a rodada corrente), em gzip direto do banco.
import { and, desc, eq, lte } from 'drizzle-orm'
import { membroAtual } from '../../../../../lib/auth/sessao.ts'
import { db } from '../../../../../lib/db/index.ts'
import { games, snapshots } from '../../../../../lib/db/schema.ts'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gameId = Number((await params).id)
  if (!(await membroAtual(gameId))) return new Response(null, { status: 401 })
  const [g] = await db().select().from(games).where(eq(games.id, gameId))
  const [s] = await db().select({ n: snapshots.n, etapa: snapshots.etapa, data: snapshots.data }).from(snapshots)
    .where(and(eq(snapshots.gameId, gameId), lte(snapshots.n, g!.round))).orderBy(desc(snapshots.n), desc(snapshots.etapa)).limit(1)
  if (!s) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(s.data), {
    headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', 'Cache-Control': 'no-store', 'X-Rodada': `${s.n}.${s.etapa}` },
  })
}
