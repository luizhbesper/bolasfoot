import { eq } from 'drizzle-orm'
import { beforeEach, expect, test } from 'vitest'
import { resgatarConvite } from '../auth/conta.ts'
import { db } from '../db/index.ts'
import { gameMembers, games, gameSettings, invites, users } from '../db/schema.ts'
import { limpar } from '../db/teste.ts'
import { apagarJogo, criarJogo, editarSettings, gerarConvite, revogarConvite } from './admin.ts'

const config = { habilidadeIndividual: false, salarioMensal: true, proibidos: [], divisoes: [] }
let admin: number
beforeEach(async () => {
  await limpar()
  admin = (await db().insert(users).values({ username: 'admin', passwordHash: 'h', isAdmin: true }).returning())[0]!.id
})

test('criar jogo, convidar, revogar, configurar e apagar', async () => {
  const g = await criarJogo(db(), admin, 'Liga', 'live', config)
  const [jogo] = await db().select().from(games).where(eq(games.id, g))
  expect(jogo!.gameSeed).toMatch(/^[0-9a-f]{32}$/)
  expect(await db().select().from(gameMembers)).toHaveLength(1) // o admin

  const code = await gerarConvite(db(), g, admin, 2, 24)
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$/)
  expect(await resgatarConvite(db(), code, { usuario: 'bia', senha: '' })).toMatchObject({ gameId: g })
  await revogarConvite(db(), code)
  expect(await resgatarConvite(db(), code, { usuario: 'caio', senha: '' })).toEqual({ erro: 'convite inválido' })

  const s = { planningTimeoutS: 60, halftimeTimeoutS: 20, resultsPauseS: 5, msPerMinute: 100, dailyResolveAt: '22:30', timezone: 'America/Sao_Paulo', autoReadyOnTimeout: false }
  expect(await editarSettings(db(), g, { ...s, timezone: 'Marte/Base' })).toBe('fuso inválido')
  expect(await editarSettings(db(), g, { ...s, dailyResolveAt: '25:00' })).toBe('horário no formato HH:MM')
  expect(await editarSettings(db(), g, s)).toBeNull()
  expect((await db().select().from(gameSettings))[0]).toMatchObject(s)

  await apagarJogo(db(), g)
  expect(await db().select().from(invites)).toHaveLength(0)
  expect(await db().select().from(gameMembers)).toHaveLength(0)
  expect(await db().select().from(users)).toHaveLength(2) // contas ficam
})
