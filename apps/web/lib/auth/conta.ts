// Contas e convites (docs/plano.md §2.4), sem cookie nem request: testável direto contra o banco.
import { and, eq, sql } from 'drizzle-orm'
import type { Db } from '../db/index.ts'
import { gameMembers, games, invites, users } from '../db/schema.ts'
import { entrarComJogoAndando } from '../game/rodada.ts'
import { conferirSenha, hashSenha } from './senha.ts'

export const normalizarUsuario = (u: string) => u.trim().toLowerCase()
export const normalizarCodigo = (c: string) => c.trim().toUpperCase().replace(/\s+/g, '')

/** id do usuário, ou null se usuário/senha não conferem. */
export async function entrar(d: Db, usuario: string, senha: string): Promise<number | null> {
  const [u] = await d.select().from(users).where(eq(users.username, normalizarUsuario(usuario)))
  return u && (await conferirSenha(senha, u.passwordHash)) ? u.id : null
}

export type Conta = { userId: number } | { usuario: string; senha: string }

/**
 * Usa um convite: entra no jogo com a conta logada, com usuário e senha de uma conta existente, ou criando a conta.
 * Recusa revogado, vencido e esgotado. Quem já é membro entra de novo sem gastar uso.
 */
export async function resgatarConvite(d: Db, codigo: string, conta: Conta): Promise<{ userId: number; gameId: number } | { erro: string }> {
  return d.transaction(async (tx) => {
    const [c] = await tx.select().from(invites).where(eq(invites.code, normalizarCodigo(codigo))).for('update')
    if (!c || c.revoked) return { erro: 'convite inválido' }
    if (c.expiresAt && c.expiresAt < new Date()) return { erro: 'convite vencido' }

    let userId: number
    if ('userId' in conta) userId = conta.userId
    else {
      const usuario = normalizarUsuario(conta.usuario)
      if (!usuario) return { erro: 'escolha um usuário' }
      const [u] = await tx.select().from(users).where(eq(users.username, usuario))
      if (u) {
        if (!(await conferirSenha(conta.senha, u.passwordHash))) return { erro: 'usuário já existe; senha não confere' }
        userId = u.id
      } else {
        if (c.uses >= c.maxUses) return { erro: 'convite esgotado' }
        userId = (await tx.insert(users).values({ username: usuario, passwordHash: await hashSenha(conta.senha) }).returning())[0]!.id
      }
    }

    const ja = await tx.select().from(gameMembers).where(and(eq(gameMembers.gameId, c.gameId), eq(gameMembers.userId, userId)))
    if (ja.length) return { userId, gameId: c.gameId }
    if (c.uses >= c.maxUses) return { erro: 'convite esgotado' }
    const [mb] = await tx.insert(gameMembers).values({ gameId: c.gameId, userId }).returning()
    // jogo andando: entra sem time, esperando proposta (o jogo travado: não cruza com a resolução da rodada)
    const [g] = await tx.select().from(games).where(eq(games.id, c.gameId)).for('update')
    if (g?.status === 'running' || g?.status === 'paused') {
      const [u] = await tx.select({ username: users.username }).from(users).where(eq(users.id, userId))
      await entrarComJogoAndando(tx, g, mb!.id, u!.username)
    }
    await tx.update(invites).set({ uses: sql`${invites.uses} + 1` }).where(eq(invites.code, c.code))
    return { userId, gameId: c.gameId }
  })
}
