// Só com TEST_ENDPOINTS=1: vence o prazo da fase corrente de um jogo (o agendador resolve no próximo segundo).
import { eq } from 'drizzle-orm'
import { db } from '../../../../lib/db/index.ts'
import { games } from '../../../../lib/db/schema.ts'
import { env } from '../../../../lib/env.ts'

export async function POST(req: Request) {
  if (!env().TEST_ENDPOINTS) return new Response(null, { status: 404 })
  const jogo = Number(new URL(req.url).searchParams.get('jogo'))
  await db().update(games).set({ deadline: new Date() }).where(eq(games.id, jogo))
  return Response.json({ ok: true })
}
