import { and, eq } from 'drizzle-orm'
import Link from 'next/link'
import { exigirUsuario } from '../lib/auth/sessao.ts'
import { db } from '../lib/db/index.ts'
import { gameMembers, games, rounds, type FaseRodada, type StatusJogo } from '../lib/db/schema.ts'
import { baseDe } from '../lib/game/base.ts'
import { Pagina } from './_ui/pagina.tsx'
import { Escudo, Marca } from './_ui/ui.tsx'
import s from './inicio.module.css'

const FASE: Record<FaseRodada, string> = {
  planejamento: 'Planejamento', ao_vivo_1t: 'Ao vivo · 1º tempo', intervalo: 'Intervalo', ao_vivo_2t: 'Ao vivo · 2º tempo', resultados: 'Resultados',
}

function situacao(status: StatusJogo, fase: FaseRodada | null): [string, string] {
  if (status === 'lobby') return ['Esperando o início', '']
  if (status === 'picking') return ['Escolha de times', 'ceu']
  if (status === 'paused') return ['Pausado', 'pessego']
  if (status === 'finished') return ['Encerrado', '']
  return [fase ? FASE[fase] : 'Em andamento', fase?.startsWith('ao_vivo') ? 'menta' : 'lavanda']
}

export default async function Home() {
  const u = await exigirUsuario()
  const meus = await db().select({ id: games.id, name: games.name, status: games.status, mode: games.mode, round: games.round, config: games.config, teamRef: gameMembers.teamRef, fase: rounds.phase })
    .from(gameMembers).innerJoin(games, eq(games.id, gameMembers.gameId))
    .leftJoin(rounds, and(eq(rounds.gameId, games.id), eq(rounds.n, games.round)))
    .where(eq(gameMembers.userId, u.id)).orderBy(games.id)
  return (
    <Pagina usuario={u}>
      <h1><Marca tamanho={48} /></h1>
      <h2 className="mudo" style={{ fontSize: 15, fontWeight: 500 }}>Seus jogos</h2>
      {meus.length === 0 ? (
        <div className="card secao">
          <p style={{ margin: 0 }}>Você ainda não está em nenhum jogo.</p>
          <p className="mudo" style={{ margin: 0 }}>Peça um código a quem organiza e <Link href="/convite">entre com ele</Link>.</p>
        </div>
      ) : (
        <div className={s.grade}>
          {meus.map((g) => {
            const time = g.teamRef ? baseDe(g.config).times.find((t) => t.fileRef === g.teamRef) : undefined
            const [rotulo, cor] = situacao(g.status, g.fase)
            return (
              <Link key={g.id} href={`/jogo/${g.id}`} className={`card ${s.jogo}`}>
                <div className={s.cabeca}>
                  <span className={`etiqueta ${cor}`}>{rotulo}</span>
                  <span className="fraco">{g.mode === 'daily' ? 'Diário' : 'Ao vivo'}</span>
                </div>
                <strong className={s.nome}>{g.name}</strong>
                <div className={s.time}>
                  {time ? <><Escudo fileRef={time.fileRef} tamanho={28} /><span>{time.nome}</span></> : <span className="mudo">Sem time ainda</span>}
                  {g.round > 0 && <span className="fraco" style={{ marginLeft: 'auto' }}>rodada {g.round}</span>}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </Pagina>
  )
}
