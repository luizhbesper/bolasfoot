import { count, eq } from 'drizzle-orm'
import Link from 'next/link'
import { exigirAdmin } from '../../lib/auth/sessao.ts'
import { db } from '../../lib/db/index.ts'
import { gameMembers, games } from '../../lib/db/schema.ts'
import { Pagina } from '../_ui/pagina.tsx'
import { criarJogoAcao, pausarTodosAcao } from './acoes.ts'
import s from './admin.module.css'
import { STATUS } from './status.ts'
import { bases } from '../../lib/game/base.ts'

export default async function Admin() {
  const u = await exigirAdmin()
  const todos = await db().select({ id: games.id, name: games.name, mode: games.mode, status: games.status, round: games.round, membros: count(gameMembers.id) })
    .from(games).leftJoin(gameMembers, eq(gameMembers.gameId, games.id)).groupBy(games.id).orderBy(games.id)
  return (
    <Pagina usuario={u}>
      <div className="linha" style={{ gap: 10 }}>
        <h1>Admin</h1>
        <form action={pausarTodosAcao} style={{ marginLeft: 'auto' }}><input type="hidden" name="pausar" value="1" /><button>Pausar todos</button></form>
        <form action={pausarTodosAcao}><input type="hidden" name="pausar" value="0" /><button>Retomar todos</button></form>
      </div>
      <div className={s.colunas}>
        <section className="card" style={{ overflow: 'hidden' }}>
          <div className="secao" style={{ paddingBottom: 6 }}><h2>Jogos</h2></div>
          <div className="rolagem">
            <table className="tabela">
              <thead><tr><th>Nome</th><th>Modo</th><th>Situação</th><th className="num">Técnicos</th><th className="num">Rodada</th></tr></thead>
              <tbody>
                {todos.map((g) => (
                  <tr key={g.id}>
                    <td><Link href={`/admin/${g.id}`}>{g.name}</Link></td>
                    <td className="mudo">{g.mode === 'daily' ? 'Diário' : 'Ao vivo'}</td>
                    <td><span className={`etiqueta ${STATUS[g.status][1]}`}>{STATUS[g.status][0]}</span></td>
                    <td className="num">{g.membros}</td>
                    <td className="num mudo">{g.round || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {todos.length === 0 && <p className="secao mudo" style={{ margin: 0 }}>Nenhum jogo ainda.</p>}
        </section>

        <section className="card secao">
          <h2>Novo jogo</h2>
          <form action={criarJogoAcao} className="form">
            <label>Nome <input name="nome" required placeholder="Liga dos Amigos" /></label>
            <label>Modo
              <select name="modo"><option value="live">Ao vivo (todos juntos numa call)</option><option value="daily">Diário (uma rodada por dia)</option></select>
            </label>
            <label>Base
              <select name="base">{Object.keys(bases).map((k) => <option key={k} value={k}>{k === '2022' ? 'Original (2022-23)' : `Elencos de ${k} (mod julho/26)`}</option>)}</select>
            </label>
            <label className="check"><input type="checkbox" name="habilidadeIndividual" /> Habilidade individual</label>
            <label className="check"><input type="checkbox" name="salarioSemanal" /> Salário semanal</label>
            <label className="check"><input type="checkbox" name="semEstaduais" /> Pular os estaduais e os regionais (a temporada começa na liga)</label>
            <label className="check"><input type="checkbox" name="renovarAuto" /> Renovar contratos automaticamente (padrão; cada técnico pode mudar no elenco)</label>
            <fieldset>
              <legend>Divisões permitidas na escolha (nenhuma = todas)</legend>
              {[1, 2, 3, 0].map((d) => (
                <label key={d} className="check"><input type="checkbox" name="divisoes" value={d} /> {d ? `Série ${'ABC'[d - 1]}` : 'Fora das séries'}</label>
              ))}
              <span className="fraco" style={{ fontSize: 12 }}>A Série D sai dos estaduais no meio do ano (sem estaduais, por força).</span>
            </fieldset>
            <label>Times proibidos <input name="proibidos" placeholder="flarj, palmeiras" /></label>
            <button className="primario">Criar jogo</button>
          </form>
        </section>
      </div>
    </Pagina>
  )
}
