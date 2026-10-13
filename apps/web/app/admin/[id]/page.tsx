import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '../../../lib/auth/sessao.ts'
import { db } from '../../../lib/db/index.ts'
import { gameMembers, games, gameSettings, invites, users } from '../../../lib/db/schema.ts'
import { apagarAcao, conviteAcao, escolhaAcao, expulsarAcao, forcarAcao, pausarAcao, retomarAcao, revogarAcao, settingsAcao } from '../acoes.ts'

export default async function AdminJogo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  await exigirAdmin()
  const gid = Number((await params).id)
  const { erro } = await searchParams
  const [g] = await db().select().from(games).where(eq(games.id, gid))
  if (!g) notFound()
  const [s] = await db().select().from(gameSettings).where(eq(gameSettings.gameId, gid))
  const membros = await db().select({ id: gameMembers.id, username: users.username, teamRef: gameMembers.teamRef, ready: gameMembers.ready })
    .from(gameMembers).innerJoin(users, eq(users.id, gameMembers.userId)).where(eq(gameMembers.gameId, gid))
  const convites = await db().select().from(invites).where(eq(invites.gameId, gid)).orderBy(invites.createdAt)
  const jogo = <input type="hidden" name="jogo" value={gid} />

  return (
    <main>
      <h1>{g.name}</h1>
      <p><Link href="/admin">admin</Link> · <Link href={`/jogo/${gid}`}>abrir o jogo</Link> · {g.mode} · {g.status} · rodada {g.round}</p>
      {erro && <p role="alert">{erro}</p>}
      {g.status === 'lobby' && <form action={escolhaAcao}>{jogo}<button>Iniciar escolha de times</button></form>}
      {g.status === 'running' && <form action={pausarAcao}>{jogo}<button>Pausar</button></form>}
      {g.status === 'paused' && <form action={retomarAcao}>{jogo}<button>Retomar</button></form>}
      {(g.status === 'running' || g.status === 'picking') && <form action={forcarAcao}>{jogo}<button>Forçar avanço</button></form>}

      <h2>Membros</h2>
      <ul>
        {membros.map((m) => (
          <li key={m.id}>
            {m.username} {m.teamRef && `(${m.teamRef})`} {m.ready && '✔'}
            <form action={expulsarAcao} style={{ display: 'inline' }}>{jogo}<input type="hidden" name="membro" value={m.id} /><button>expulsar</button></form>
          </li>
        ))}
      </ul>

      <h2>Convites</h2>
      <ul>
        {convites.map((c) => (
          <li key={c.code}>
            <code>{c.code}</code> {c.uses}/{c.maxUses} {c.expiresAt && `até ${c.expiresAt.toLocaleString('pt-BR')}`} {c.revoked ? 'revogado' : (
              <form action={revogarAcao} style={{ display: 'inline' }}>{jogo}<input type="hidden" name="codigo" value={c.code} /><button>revogar</button></form>
            )}
          </li>
        ))}
      </ul>
      <form action={conviteAcao}>
        {jogo}
        <label>Usos <input name="usos" type="number" min={1} defaultValue={1} /></label>
        <label>Validade em horas (vazio = sem) <input name="horas" type="number" min={1} /></label>
        <button>Gerar convite</button>
      </form>

      <h2>Configurações</h2>
      {s && (
        <form action={settingsAcao}>
          {jogo}
          <label>Planejamento (s) <input name="planningTimeoutS" type="number" defaultValue={s.planningTimeoutS} /></label>
          <label>Intervalo (s) <input name="halftimeTimeoutS" type="number" defaultValue={s.halftimeTimeoutS} /></label>
          <label>Resultados (s) <input name="resultsPauseS" type="number" defaultValue={s.resultsPauseS} /></label>
          <label>ms por minuto <input name="msPerMinute" type="number" defaultValue={s.msPerMinute} /></label>
          <label>Resolução diária <input name="dailyResolveAt" defaultValue={s.dailyResolveAt} /></label>
          <label>Fuso <input name="timezone" defaultValue={s.timezone} /></label>
          <label><input type="checkbox" name="autoReadyOnTimeout" defaultChecked={s.autoReadyOnTimeout} /> Pronto automático no prazo</label>
          <button>Salvar</button>
        </form>
      )}

      <h2>Apagar</h2>
      <form action={apagarAcao}>
        {jogo}
        <label>Digite &quot;apagar&quot; <input name="confirmar" /></label>
        <button>Apagar jogo</button>
      </form>
    </main>
  )
}
