// Tudo dentro de /jogo/[id] tem o contexto do jogo (SSE + mundo); com o mundo criado, também a casca com menu e barra.
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { membroAtual } from '../../../lib/auth/sessao.ts'
import { db } from '../../../lib/db/index.ts'
import { gameMembers, games, gameSettings, users } from '../../../lib/db/schema.ts'
import { baseDe } from '../../../lib/game/base.ts'
import { estadoFase, prontos } from '../../../lib/game/rodada.ts'
import { Casca } from './casca.tsx'
import { JogoProvider } from './contexto.tsx'

export default async function LayoutJogo({ params, children }: { params: Promise<{ id: string }>; children: ReactNode }) {
  const gid = Number((await params).id)
  const ctx = await membroAtual(gid)
  if (!ctx) redirect('/')
  const [g] = await db().select({ name: games.name, config: games.config }).from(games).where(eq(games.id, gid))
  const [cfg] = await db().select({ ms: gameSettings.msPerMinute }).from(gameSettings).where(eq(gameSettings.gameId, gid))
  const membros = await db().select({ id: gameMembers.id, nome: users.username, teamRef: gameMembers.teamRef })
    .from(gameMembers).innerJoin(users, eq(users.id, gameMembers.userId)).where(eq(gameMembers.gameId, gid)).orderBy(gameMembers.id)
  const fase = await estadoFase(db(), gid)
  const eu = ctx.membro
  const time = eu.teamRef ? baseDe(g!.config).times.find((t) => t.fileRef === eu.teamRef) : undefined

  return (
    <JogoProvider jogo={gid} msPorMinuto={cfg!.ms} eu={{ id: eu.id, tecnicoId: eu.tecnicoId, admin: ctx.usuario.isAdmin }} membros={membros}
      fase={fase} prontos={(await prontos(db(), gid)).prontos}>
      {fase.status === 'lobby' || fase.status === 'picking' ? children : (
        <Casca nomeJogo={g!.name} usuario={ctx.usuario.username} timeInicial={time ? { fileRef: time.fileRef, nome: time.nome } : null}>
          {children}
        </Casca>
      )}
    </JogoProvider>
  )
}
