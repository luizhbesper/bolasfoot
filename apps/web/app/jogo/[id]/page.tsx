import { and, desc, eq, gte } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { membroAtual } from '../../../lib/auth/sessao.ts'
import { db } from '../../../lib/db/index.ts'
import { games, roundLogs, rounds, type ConfigJogo } from '../../../lib/db/schema.ts'
import type { ResumoRodada } from '../../../lib/game/rodada.ts'
import { catalogo, permitido } from '../../../lib/game/escolha.ts'
import { Escolha } from './escolha.tsx'

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
    return <Escolha nomeJogo={g!.name} regra={regra(g!.config)} erro={erro} times={g!.status === 'picking' ? catalogo(g!.gameSeed).filter((t) => permitido(g!.config, t)) : []} />

  const [r] = await db().select().from(rounds).where(and(eq(rounds.gameId, gid), eq(rounds.n, g!.round)))
  const logs = (await db().select().from(roundLogs).where(and(eq(roundLogs.gameId, gid), gte(roundLogs.n, g!.round - 1)))
    .orderBy(desc(roundLogs.n), desc(roundLogs.etapa)))
    // o que ainda está tocando ao vivo não aparece pronto
    .filter((l) => !(l.n === g!.round && ((l.etapa === 0 && r?.phase === 'ao_vivo_1t') || (l.etapa === 1 && r?.phase === 'ao_vivo_2t'))))
  const eu = ctx.membro

  // ponytail: lista crua de resultados até o hub (U3) e a partida (U4)
  return (
    <main>
      {erro && <p role="alert">{erro}</p>}
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
