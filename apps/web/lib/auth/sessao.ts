// Sessão: token aleatório num cookie httpOnly; o banco guarda só o sha256 dele.
import { and, eq, gt } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createHash, randomBytes } from 'node:crypto'
import { cache } from 'react'
import { db } from '../db/index.ts'
import { sessions, users } from '../db/schema.ts'
import { env } from '../env.ts'

const COOKIE = 'sessao'
const DURACAO_S = 60 * 60 * 24 * 30
const hash = (token: string) => createHash('sha256').update(token).digest('hex')

export async function criarSessao(userId: number) {
  const token = randomBytes(32).toString('base64url')
  await db().insert(sessions).values({ tokenHash: hash(token), userId, expiresAt: new Date(Date.now() + DURACAO_S * 1000) })
  ;(await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: env().APP_ENV !== 'local', path: '/', maxAge: DURACAO_S })
}

export async function encerrarSessao() {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (token) await db().delete(sessions).where(eq(sessions.tokenHash, hash(token)))
  jar.delete(COOKIE)
}

export type Usuario = { id: number; username: string; isAdmin: boolean }

/** Usuário logado (uma consulta por request). */
export const usuarioAtual = cache(async (): Promise<Usuario | null> => {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  const [u] = await db().select({ id: users.id, username: users.username, isAdmin: users.isAdmin })
    .from(sessions).innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hash(token)), gt(sessions.expiresAt, new Date())))
  return u ?? null
})

export async function exigirUsuario(): Promise<Usuario> {
  return (await usuarioAtual()) ?? redirect('/entrar')
}

export async function exigirAdmin(): Promise<Usuario> {
  const u = await exigirUsuario()
  if (!u.isAdmin) redirect('/')
  return u
}
