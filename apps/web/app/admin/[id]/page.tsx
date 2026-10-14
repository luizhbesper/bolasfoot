import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirAdmin } from '../../../lib/auth/sessao.ts'
import { db } from '../../../lib/db/index.ts'
import { gameMembers, games, gameSettings, invites, users } from '../../../lib/db/schema.ts'
import { baseDe } from '../../../lib/game/base.ts'
import { Erro, Pagina } from '../../_ui/pagina.tsx'
import { Escudo } from '../../_ui/ui.tsx'
import { apagarAcao, conviteAcao, escolhaAcao, expulsarAcao, forcarAcao, pausarAcao, retomarAcao, revogarAcao, settingsAcao } from '../acoes.ts'
import s from '../admin.module.css'
import { STATUS } from '../status.ts'

export default async function AdminJogo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const u = await exigirAdmin()
  const gid = Number((await params).id)
  const { erro } = await searchParams
  const [g] = await db().select().from(games).where(eq(games.id, gid))
  if (!g) notFound()
  const [cfg] = await db().select().from(gameSettings).where(eq(gameSettings.gameId, gid))
  const membros = await db().select({ id: gameMembers.id, username: users.username, teamRef: gameMembers.teamRef, ready: gameMembers.ready })
    .from(gameMembers).innerJoin(users, eq(users.id, gameMembers.userId)).where(eq(gameMembers.gameId, gid)).orderBy(gameMembers.id)
  const convites = await db().select().from(invites).where(eq(invites.gameId, gid)).orderBy(invites.createdAt)
  const h = await headers()
  const origem = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`
  const jogo = <input type="hidden" name="jogo" value={gid} />

  return (
    <Pagina usuario={u}>
      <div className="linha" style={{ gap: 14 }}>
        <Link href="/admin" className="mudo">← Admin</Link>
        <h1>{g.name}</h1>
        <span className={`etiqueta ${STATUS[g.status][1]}`}>{STATUS[g.status][0]}</span>
        <span className="fraco">{g.mode === 'daily' ? 'Diário' : 'Ao vivo'}{g.round > 0 && ` · rodada ${g.round}`}</span>
        <Link href={`/jogo/${gid}`} style={{ marginLeft: 'auto' }}>Abrir o jogo</Link>
      </div>
      <Erro texto={erro} />
      <div className={s.acoes}>
        {g.status === 'lobby' && <form action={escolhaAcao}>{jogo}<button className="primario">Iniciar escolha de times</button></form>}
        {g.status === 'running' && <form action={pausarAcao}>{jogo}<button>Pausar</button></form>}
        {g.status === 'paused' && <form action={retomarAcao}>{jogo}<button className="primario">Retomar</button></form>}
        {(g.status === 'running' || g.status === 'picking') && <form action={forcarAcao}>{jogo}<button>Forçar avanço</button></form>}
      </div>

      <div className={s.colunas}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <section className="card" style={{ overflow: 'hidden' }}>
            <div className="secao" style={{ paddingBottom: 6 }}><h2>Técnicos</h2></div>
            <div className="rolagem">
              <table className="tabela">
                <thead><tr><th>Usuário</th><th>Time</th><th>Pronto</th><th /></tr></thead>
                <tbody>
                  {membros.map((m) => {
                    const t = m.teamRef ? baseDe(g.config).times.find((x) => x.fileRef === m.teamRef) : undefined
                    return (
                      <tr key={m.id}>
                        <td>{m.username}</td>
                        <td>{t ? <span className="linha" style={{ gap: 8 }}><Escudo fileRef={t.fileRef} tamanho={20} mini />{t.nome}</span> : <span className="fraco">—</span>}</td>
                        <td>{m.ready ? <span className="etiqueta menta">Pronto</span> : <span className="fraco">—</span>}</td>
                        <td className="num">
                          <form action={expulsarAcao}>{jogo}<input type="hidden" name="membro" value={m.id} /><button className="fantasma">Expulsar</button></form>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card" style={{ overflow: 'hidden' }}>
            <div className="secao" style={{ paddingBottom: 6 }}><h2>Convites</h2></div>
            {convites.length > 0 && (
              <div className="rolagem">
                <table className="tabela">
                  <thead><tr><th>Código</th><th>Link</th><th className="num">Usos</th><th>Validade</th><th /></tr></thead>
                  <tbody>
                    {convites.map((c) => (
                      <tr key={c.code} style={c.revoked ? { opacity: 0.5 } : undefined}>
                        <td><span className={s.codigo}>{c.code}</span></td>
                        <td className="mudo" style={{ userSelect: 'all' }}>{`${origem}/convite?codigo=${c.code}`}</td>
                        <td className="num">{c.uses}/{c.maxUses}</td>
                        <td className="mudo">{c.expiresAt ? c.expiresAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'sem validade'}</td>
                        <td className="num">{c.revoked ? <span className="fraco">revogado</span> : (
                          <form action={revogarAcao}>{jogo}<input type="hidden" name="codigo" value={c.code} /><button className="fantasma">Revogar</button></form>
                        )}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <form action={conviteAcao} className="form secao" style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {jogo}
              <label>Usos <input name="usos" type="number" min={1} defaultValue={1} style={{ width: 90 }} /></label>
              <label>Validade em horas <input name="horas" type="number" min={1} placeholder="sem" style={{ width: 140 }} /></label>
              <button className="primario">Gerar convite</button>
            </form>
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {cfg && (
            <section className="card secao">
              <h2>Configurações</h2>
              <form action={settingsAcao} className="form">
                {jogo}
                <div className={s.campos}>
                  <label>Planejamento (s) <input name="planningTimeoutS" type="number" defaultValue={cfg.planningTimeoutS} /></label>
                  <label>Intervalo (s) <input name="halftimeTimeoutS" type="number" defaultValue={cfg.halftimeTimeoutS} /></label>
                  <label>Resultados (s) <input name="resultsPauseS" type="number" defaultValue={cfg.resultsPauseS} /></label>
                  <label>ms por minuto <input name="msPerMinute" type="number" defaultValue={cfg.msPerMinute} /></label>
                  <label>Resolução diária <input name="dailyResolveAt" defaultValue={cfg.dailyResolveAt} /></label>
                  <label>Fuso <input name="timezone" defaultValue={cfg.timezone} /></label>
                </div>
                <label className="check"><input type="checkbox" name="autoReadyOnTimeout" defaultChecked={cfg.autoReadyOnTimeout} /> Pronto automático no prazo</label>
                <button>Salvar</button>
              </form>
            </section>
          )}
          <section className="card secao" style={{ borderColor: 'rgba(240,168,168,.25)' }}>
            <h2>Apagar o jogo</h2>
            <p className="mudo" style={{ margin: 0 }}>Apaga mundo, rodadas, convites e membros. Não tem volta.</p>
            <form action={apagarAcao} className="form">
              {jogo}
              <label>Digite &quot;apagar&quot; <input name="confirmar" autoComplete="off" /></label>
              <button className="perigo">Apagar jogo</button>
            </form>
          </section>
        </div>
      </div>
    </Pagina>
  )
}
