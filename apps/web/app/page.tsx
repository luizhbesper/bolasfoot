import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { exigirUsuario } from '../lib/auth/sessao.ts'
import { db } from '../lib/db/index.ts'
import { gameMembers, games } from '../lib/db/schema.ts'
import { sairAcao } from './acoes-conta.ts'

export default async function Home() {
  const u = await exigirUsuario()
  const meus = await db().select({ id: games.id, name: games.name, status: games.status })
    .from(gameMembers).innerJoin(games, eq(games.id, gameMembers.gameId)).where(eq(gameMembers.userId, u.id))
  return (
    <main>
      <h1>Bolasfoot</h1>
      <p>
        {u.username} · <Link href="/convite">tenho um código</Link>
        {u.isAdmin && <> · <Link href="/admin">admin</Link></>}
      </p>
      <form action={sairAcao}><button>Sair</button></form>
      <h2>Seus jogos</h2>
      <ul>
        {meus.map((g) => <li key={g.id}><Link href={`/jogo/${g.id}`}>{g.name}</Link> ({g.status})</li>)}
      </ul>
    </main>
  )
}
