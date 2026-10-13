import Link from 'next/link'
import { exigirAdmin } from '../../lib/auth/sessao.ts'
import { db } from '../../lib/db/index.ts'
import { games } from '../../lib/db/schema.ts'
import { criarJogoAcao } from './acoes.ts'

export default async function Admin() {
  await exigirAdmin()
  const todos = await db().select().from(games).orderBy(games.id)
  return (
    <main>
      <h1>Admin</h1>
      <p><Link href="/">voltar</Link></p>
      <h2>Jogos</h2>
      <ul>{todos.map((g) => <li key={g.id}><Link href={`/admin/${g.id}`}>{g.name}</Link> ({g.mode}, {g.status})</li>)}</ul>
      <h2>Novo jogo</h2>
      <form action={criarJogoAcao}>
        <label>Nome <input name="nome" required /></label>
        <label>Modo <select name="modo"><option value="live">live</option><option value="daily">daily</option></select></label>
        <label><input type="checkbox" name="habilidadeIndividual" /> Habilidade individual</label>
        <label><input type="checkbox" name="salarioSemanal" /> Salário semanal</label>
        <fieldset>
          <legend>Divisões permitidas na escolha (nenhuma marcada = todas)</legend>
          {[1, 2, 3, 0].map((d) => (
            <label key={d}><input type="checkbox" name="divisoes" value={d} /> {d ? `Série ${'ABC'[d - 1]}` : 'fora das séries (a Série D sai dos estaduais)'}</label>
          ))}
        </fieldset>
        <label>Times proibidos (fileRef, separados por vírgula) <input name="proibidos" /></label>
        <button>Criar</button>
      </form>
    </main>
  )
}
