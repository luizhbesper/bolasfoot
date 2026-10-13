import { eq } from 'drizzle-orm'
import { beforeEach, expect, test } from 'vitest'
import { db } from '../db/index.ts'
import { gameMembers, games, invites, users } from '../db/schema.ts'
import { limpar } from '../db/teste.ts'
import { entrar, resgatarConvite } from './conta.ts'
import { hashSenha } from './senha.ts'

let jogo: number
let admin: number
beforeEach(async () => {
  await limpar()
  admin = (await db().insert(users).values({ username: 'admin', passwordHash: await hashSenha('x'), isAdmin: true }).returning())[0]!.id
  jogo = (await db().insert(games).values({
    name: 'j', adminId: admin, gameSeed: 's', config: { habilidadeIndividual: false, salarioMensal: true, proibidos: [], divisoes: [] },
  }).returning())[0]!.id
})
const convite = (code: string, extra: Partial<typeof invites.$inferInsert> = {}) =>
  db().insert(invites).values({ code, gameId: jogo, createdBy: admin, ...extra })
const membros = () => db().select().from(gameMembers).where(eq(gameMembers.gameId, jogo))

test('convite → criar conta → entrar → membro do jogo', async () => {
  await convite('K7QX-2M', { maxUses: 2 })
  const r = await resgatarConvite(db(), ' k7qx-2m ', { usuario: 'Ana', senha: '' })
  expect(r).toMatchObject({ gameId: jogo })
  expect(await entrar(db(), 'ana', '')).toBe((r as { userId: number }).userId)
  expect(await entrar(db(), 'ana', 'errada')).toBeNull()
  expect(await membros()).toHaveLength(1)
  // de novo, já membro: não gasta uso
  expect(await resgatarConvite(db(), 'K7QX-2M', { usuario: 'ana', senha: '' })).toMatchObject({ gameId: jogo })
  expect((await db().select().from(invites))[0]!.uses).toBe(1)
})

test('conta existente: senha errada recusa; logado só entra no jogo', async () => {
  await convite('AAAA-11', { maxUses: 5 })
  expect(await resgatarConvite(db(), 'AAAA-11', { usuario: 'admin', senha: 'y' })).toEqual({ erro: 'usuário já existe; senha não confere' })
  expect(await resgatarConvite(db(), 'AAAA-11', { userId: admin })).toEqual({ userId: admin, gameId: jogo })
  expect(await membros()).toHaveLength(1)
})

test('revogado, vencido e esgotado são recusados', async () => {
  await convite('REVO-01', { revoked: true })
  await convite('VENC-01', { expiresAt: new Date(Date.now() - 1000) })
  await convite('ESGO-01', { maxUses: 1 })
  expect(await resgatarConvite(db(), 'REVO-01', { usuario: 'a', senha: '' })).toEqual({ erro: 'convite inválido' })
  expect(await resgatarConvite(db(), 'VENC-01', { usuario: 'a', senha: '' })).toEqual({ erro: 'convite vencido' })
  expect(await resgatarConvite(db(), 'NADA-00', { usuario: 'a', senha: '' })).toEqual({ erro: 'convite inválido' })
  await resgatarConvite(db(), 'ESGO-01', { usuario: 'a', senha: '' })
  expect(await resgatarConvite(db(), 'ESGO-01', { usuario: 'b', senha: '' })).toEqual({ erro: 'convite esgotado' })
  expect(await db().select().from(users)).toHaveLength(2) // admin + a; b não foi criado
})

test('usos concorrentes não passam do máximo', async () => {
  await convite('CONC-01', { maxUses: 2 })
  await Promise.all(['a', 'b', 'c', 'd'].map((u) => resgatarConvite(db(), 'CONC-01', { usuario: u, senha: '' })))
  expect(await membros()).toHaveLength(2)
})
