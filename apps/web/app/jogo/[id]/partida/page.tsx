import { and, desc, eq, lte } from 'drizzle-orm'
import { exigirUsuario } from '../../../../lib/auth/sessao.ts'
import { db } from '../../../../lib/db/index.ts'
import { games, roundLogs } from '../../../../lib/db/schema.ts'
import { comandosPendentes, type ResumoRodada } from '../../../../lib/game/rodada.ts'
import { Partida } from './partida.tsx'

export default async function PaginaPartida({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigirUsuario()
  const gid = Number((await params).id)
  const [g] = await db().select({ round: games.round }).from(games).where(eq(games.id, gid))
  // o último log até a rodada corrente: no 1º tempo e no intervalo, o do 1º tempo; depois, o da partida inteira.
  // ponytail: o log inteiro vai para o cliente e a tela esconde o que o relógio ainda não alcançou (espiar não muda nada:
  // tudo já está decidido e os comandos só valem no intervalo).
  const [l] = await db().select().from(roundLogs).where(and(eq(roundLogs.gameId, gid), lte(roundLogs.n, g?.round ?? 0)))
    .orderBy(desc(roundLogs.n), desc(roundLogs.etapa)).limit(1)
  return (
    <Partida log={l ? { n: l.n, etapa: l.etapa, resumo: l.data as ResumoRodada } : null}
      pendentes={await comandosPendentes(db(), gid, u.id)} />
  )
}
