import { eq } from 'drizzle-orm'
import { beforeEach, expect, test } from 'vitest'
import { conferirSenha } from '../auth/senha.ts'
import { semear } from './cli.ts'
import { db } from './index.ts'
import { gameMembers, games, gameSettings, users } from './schema.ts'
import { limpar } from './teste.ts'

beforeEach(limpar)

test('seed cria o admin uma vez só e atualiza a senha', async () => {
  await semear(db(), { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'a' })
  await semear(db(), { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'b' })
  const todos = await db().select().from(users)
  expect(todos).toHaveLength(1)
  expect(todos[0]!.isAdmin).toBe(true)
  expect(await conferirSenha('b', todos[0]!.passwordHash)).toBe(true)
  expect(await conferirSenha('a', todos[0]!.passwordHash)).toBe(false)
})

test('defaults das configurações e apagar jogo em cascata', async () => {
  const [u] = await db().insert(users).values({ username: 'x', passwordHash: 'h' }).returning()
  const [g] = await db().insert(games).values({
    name: 'j', adminId: u!.id, gameSeed: 's', config: { habilidadeIndividual: false, salarioMensal: true, proibidos: [], divisoes: [] },
  }).returning()
  await db().insert(gameSettings).values({ gameId: g!.id })
  await db().insert(gameMembers).values({ gameId: g!.id, userId: u!.id })
  const [s] = await db().select().from(gameSettings)
  expect(s).toMatchObject({ planningTimeoutS: 180, msPerMinute: 400, timezone: 'America/Sao_Paulo', autoReadyOnTimeout: true })
  await db().delete(games).where(eq(games.id, g!.id))
  expect(await db().select().from(gameMembers)).toHaveLength(0)
  expect(await db().select().from(gameSettings)).toHaveLength(0)
})
