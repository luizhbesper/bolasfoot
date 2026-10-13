import { eq } from 'drizzle-orm'
import { beforeEach, expect, test } from 'vitest'
import { db } from '../db/index.ts'
import { gameMembers, games, users } from '../db/schema.ts'
import { limpar } from '../db/teste.ts'
import { criarJogo } from './admin.ts'
import { catalogo, escolherTime, iniciarEscolha } from './escolha.ts'
import { carregarMundo, marcarReady, transicionar } from './rodada.ts'

let jogo: number, ana: number, bia: number
beforeEach(async () => {
  await limpar()
  ;[ana, bia] = (await db().insert(users).values([{ username: 'ana', passwordHash: 'h', isAdmin: true }, { username: 'bia', passwordHash: 'h' }]).returning()).map((u) => u.id) as [number, number]
  jogo = await criarJogo(db(), ana, 'j', 'live', { habilidadeIndividual: false, salarioMensal: true, proibidos: [], divisoes: [1] })
  await db().insert(gameMembers).values({ gameId: jogo, userId: bia })
})
const status = async () => (await db().select().from(games).where(eq(games.id, jogo)))[0]!.status

test('escolha: filtros, time ocupado, todos prontos criam o mundo', async () => {
  const [g] = await db().select().from(games)
  const serieA = catalogo(g!.gameSeed).filter((t) => t.divisao === 1)
  const serieB = catalogo(g!.gameSeed).find((t) => t.divisao === 2)!
  expect(serieA).toHaveLength(20)
  expect(await escolherTime(db(), jogo, ana, serieA[0]!.fileRef)).toBe('a escolha de times não está aberta')

  await iniciarEscolha(db(), jogo)
  expect(await status()).toBe('picking')
  expect(await escolherTime(db(), jogo, ana, serieB.fileRef)).toBe('time não permitido')
  expect(await escolherTime(db(), jogo, ana, serieA[0]!.fileRef)).toBeNull()
  expect(await escolherTime(db(), jogo, bia, serieA[0]!.fileRef)).toBe('time já escolhido')
  await marcarReady(db(), jogo, bia, true) // sem time: não fica pronto
  expect((await db().select().from(gameMembers).where(eq(gameMembers.userId, bia)))[0]!.ready).toBe(false)
  expect(await escolherTime(db(), jogo, bia, serieA[1]!.fileRef)).toBeNull()

  await marcarReady(db(), jogo, ana, true)
  expect(await status()).toBe('picking')
  await marcarReady(db(), jogo, bia, true)
  expect(await status()).toBe('running')

  // as divisões do buscador são as do mundo que nasceu
  const m = await carregarMundo(db(), jogo, 1, 0)
  const humanos = m.times.filter((t) => t.humano)
  expect(humanos.map((t) => t.fileRef).sort()).toEqual([serieA[0]!.fileRef, serieA[1]!.fileRef].sort())
  expect(humanos.every((t) => t.divisao === 1)).toBe(true)
})

test('prazo da escolha: quem não escolheu fica de fora; ninguém escolheu, espera', async () => {
  await iniciarEscolha(db(), jogo)
  expect(await transicionar(db(), jogo, true)).toBe(false)
  expect(await status()).toBe('picking')
  const [g] = await db().select().from(games)
  await escolherTime(db(), jogo, ana, catalogo(g!.gameSeed)[0]!.fileRef)
  expect(await transicionar(db(), jogo, true)).toBe(true)
  const mb = await db().select().from(gameMembers).orderBy(gameMembers.id)
  expect(mb.map((x) => x.tecnicoId !== null)).toEqual([true, false])
})
