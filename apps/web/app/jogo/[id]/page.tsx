import { and, desc, eq, gte } from 'drizzle-orm'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { membroAtual } from '../../../lib/auth/sessao.ts'
import { db } from '../../../lib/db/index.ts'
import { gameMembers, games, gameSettings, roundLogs, rounds, users } from '../../../lib/db/schema.ts'
import type { ResumoRodada } from '../../../lib/game/rodada.ts'
import { readyAcao } from './acoes.ts'
import { AoVivo } from './ao-vivo.tsx'

export default async function Jogo({ params }: { params: Promise<{ id: string }> }) {
  const gid = Number((await params).id)
  const ctx = await membroAtual(gid)
  if (!ctx) redirect('/')
  const [g] = await db().select().from(games).where(eq(games.id, gid))
  const [s] = await db().select().from(gameSettings).where(eq(gameSettings.gameId, gid))
  const [r] = await db().select().from(rounds).where(and(eq(rounds.gameId, gid), eq(rounds.n, g!.round)))
  const membros = await db().select({ id: gameMembers.id, username: users.username, teamRef: gameMembers.teamRef, ready: gameMembers.ready, tecnicoId: gameMembers.tecnicoId })
    .from(gameMembers).innerJoin(users, eq(users.id, gameMembers.userId)).where(eq(gameMembers.gameId, gid)).orderBy(gameMembers.id)
  const logs = (await db().select().from(roundLogs).where(and(eq(roundLogs.gameId, gid), gte(roundLogs.n, g!.round - 1)))
    .orderBy(desc(roundLogs.n), desc(roundLogs.etapa)))
    // o que ainda está tocando ao vivo não aparece pronto
    .filter((l) => !(l.n === g!.round && ((l.etapa === 0 && r?.phase === 'ao_vivo_1t') || (l.etapa === 1 && r?.phase === 'ao_vivo_2t'))))
  const eu = ctx.membro
  const podeReady = g!.status === 'running' && (r?.phase === 'planejamento' || r?.phase === 'intervalo') && eu.tecnicoId !== null

  return (
    <main>
      <h1>{g!.name}</h1>
      <p><Link href="/">seus jogos</Link> · {g!.status} · rodada {g!.round}</p>
      <AoVivo jogo={gid} msPorMinuto={s!.msPerMinute} inicial={{ fase: r?.phase ?? null, prazo: g!.deadline?.getTime() ?? null, inicio: r?.startedAt?.getTime() ?? null }} />

      <h2>Técnicos</h2>
      <ul>{membros.map((m) => <li key={m.id}>{m.username} {m.teamRef && `(${m.teamRef})`} {m.ready ? '✔ pronto' : ''}</li>)}</ul>
      {podeReady && (
        <form action={readyAcao}>
          <input type="hidden" name="jogo" value={gid} />
          <input type="hidden" name="ready" value={eu.ready ? '0' : '1'} />
          <button>{eu.ready ? 'Não estou pronto' : 'Pronto'}</button>
        </form>
      )}

      <h2>Resultados</h2>
      {logs.map((l) => {
        const d = l.data as ResumoRodada
        const meus = d.resultados.filter((x) => x.tecnico === eu.tecnicoId)
        return (
          <section key={`${l.n}.${l.etapa}`}>
            <h3>Rodada {l.n}{l.etapa ? ' (2º tempo)' : ''}{d.virou && ' — fim de temporada'}</h3>
            <ul>
              {d.partidas.map((p, i) => (
                <li key={i}>
                  {p.nomes[0]} {p.placar[0]} × {p.placar[1]} {p.nomes[1]}
                  {p.penaltis && ` (pênaltis ${p.penaltis.placar[0]}–${p.penaltis.placar[1]})`}
                  {' — '}
                  {p.eventos.filter((e) => e.tipo === 1).map((e) => `${e.nome ?? '?'} ${e.minuto + (e.tempo === 2 ? 45 : 0)}'`).join(', ')}
                </li>
              ))}
            </ul>
            {meus.length > 0 && <ul>{meus.map((x, i) => <li key={i}>{x.comando.tipo}: {x.erro ?? 'ok'}</li>)}</ul>}
          </section>
        )
      })}
    </main>
  )
}
