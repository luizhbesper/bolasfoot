import { and, eq } from 'drizzle-orm'
import { beforeEach, expect, test } from 'vitest'
import { db } from '../db/index.ts'
import { gameMembers, games, invites, roundLogs, rounds, snapshots, users, type FaseRodada } from '../db/schema.ts'
import { limpar } from '../db/teste.ts'
import { tecnicosEmCampo } from '@bolasfoot/engine'
import { resgatarConvite } from '../auth/conta.ts'
import { criarJogo } from './admin.ts'
import { base } from './base.ts'
import { batida, carregarMundo, comandosPendentes, comecarJogo, definirComandos, enviarComandos, lancesDaRodada, marcarReady, pausar, retomar, sha256, transicionar, vigiarPresenca } from './rodada.ts'

let jogo: number, ana: number, bia: number
const [t1, t2] = base.times.filter((t) => t.pais === 29).sort((a, b) => b.nivel - a.nivel)

beforeEach(async () => {
  await limpar()
  ;[ana, bia] = (await db().insert(users).values([{ username: 'ana', passwordHash: 'h', isAdmin: true }, { username: 'bia', passwordHash: 'h' }]).returning()).map((u) => u.id) as [number, number]
  jogo = await criarJogo(db(), ana!, 'j', 'live', { habilidadeIndividual: false, salarioMensal: true, proibidos: [], divisoes: [] })
  await db().insert(gameMembers).values({ gameId: jogo, userId: bia! })
  await db().update(gameMembers).set({ teamRef: t1!.fileRef }).where(eq(gameMembers.userId, ana!))
  await db().update(gameMembers).set({ teamRef: t2!.fileRef }).where(eq(gameMembers.userId, bia!))
  await db().transaction((tx) => comecarJogo(tx, jogo))
})

const jogoAtual = async () => (await db().select().from(games).where(eq(games.id, jogo)))[0]!
const rodada = async (n: number) => (await db().select().from(rounds).where(and(eq(rounds.gameId, jogo), eq(rounds.n, n))))[0]!
const vencer = () => db().update(games).set({ deadline: new Date(Date.now() - 1) }).where(eq(games.id, jogo))

test('o mundo nasce com os dois humanos e a rodada 1 abre', async () => {
  const m = await carregarMundo(db(), jogo, 1, 0)
  const humanos = m.times.filter((t) => t.humano).map((t) => t.fileRef)
  expect(humanos.sort()).toEqual([t1!.fileRef, t2!.fileRef].sort())
  expect(m.seed).not.toContain((await jogoAtual()).gameSeed)
  const [snap] = await db().select().from(snapshots)
  console.log(`snapshot: ${(snap!.data.length / 1e6).toFixed(2)} MB gzip`)
  expect((await jogoAtual()).status).toBe('running')
  expect((await rodada(1)).phase).toBe('planejamento')
})

test('comandos: inválido não grava; fora do jogo é recusado', async () => {
  expect(await enviarComandos(db(), jogo, ana!, [{ tipo: 'tatica', estilo: 1 }, { tipo: 'tatica', estilo: 9 }])).toEqual({ erros: [null, 'tática inválida'] })
  expect(await enviarComandos(db(), jogo, ana!, [{ tipo: 'tatica', estilo: 1 }])).toEqual({ erros: [null] })
  expect(await enviarComandos(db(), jogo, ana!, 'x')).toEqual({ erro: 'lista de comandos inválida' })
  const [carlos] = await db().insert(users).values({ username: 'carlos', passwordHash: 'h' }).returning()
  expect(await enviarComandos(db(), jogo, carlos!.id, [])).toEqual({ erro: 'você não joga neste jogo' })
})

test('definirComandos troca os únicos (escalação, tática) e soma o resto', async () => {
  await definirComandos(db(), jogo, ana!, [{ tipo: 'tatica', estilo: 1 }, { tipo: 'banco', acao: 'pegar' }])
  await definirComandos(db(), jogo, ana!, [{ tipo: 'tatica', estilo: 2 }, { tipo: 'banco', acao: 'pagar' }])
  expect(await comandosPendentes(db(), jogo, ana!)).toEqual([
    { tipo: 'banco', acao: 'pegar' }, { tipo: 'tatica', estilo: 2 }, { tipo: 'banco', acao: 'pagar' },
  ])
  expect(await comandosPendentes(db(), jogo, bia!)).toEqual([])
})

test('preferências de telas diferentes viram um comando só', async () => {
  await definirComandos(db(), jogo, ana!, [{ tipo: 'config', energiaMin: 60 }])
  await definirComandos(db(), jogo, ana!, [{ tipo: 'config', renovarAuto: true }])
  await definirComandos(db(), jogo, ana!, [{ tipo: 'config', energiaMin: 70 }])
  expect(await comandosPendentes(db(), jogo, ana!)).toEqual([{ tipo: 'config', renovarAuto: true, energiaMin: 70 }])
})

test('lances de leilão: um por jogador e visíveis para todos', async () => {
  const m = await carregarMundo(db(), jogo, 1, 0)
  const j = m.times.find((t) => !t.humano && t.divisao === 1)!.jogadores[0]!
  await definirComandos(db(), jogo, ana!, [{ tipo: 'lance', jogador: j, valor: 100 }])
  await definirComandos(db(), jogo, ana!, [{ tipo: 'lance', jogador: j, valor: 200 }])
  await definirComandos(db(), jogo, bia!, [{ tipo: 'lance', jogador: j, valor: 150 }])
  expect((await lancesDaRodada(db(), jogo)).map((x) => x.valor).sort()).toEqual([150, 200])
})

test('uma proposta por jogador: a nova substitui a anterior', async () => {
  const m = await carregarMundo(db(), jogo, 1, 0)
  const [j1, j2] = m.times.find((t) => t.fileRef === t2!.fileRef)!.jogadores as [number, number]
  await definirComandos(db(), jogo, ana!, [{ tipo: 'comprar', jogador: j1, valor: 100 }, { tipo: 'comprar', jogador: j2, valor: 100 }])
  await definirComandos(db(), jogo, ana!, [{ tipo: 'comprar', jogador: j1, valor: 200 }])
  expect(await comandosPendentes(db(), jogo, ana!)).toEqual([
    { tipo: 'comprar', jogador: j2, valor: 100 }, { tipo: 'comprar', jogador: j1, valor: 200 },
  ])
})

test('todos prontos resolvem; concorrência resolve uma vez; seed revelada confere', async () => {
  await enviarComandos(db(), jogo, ana!, [{ tipo: 'tatica', estilo: 2 }])
  await marcarReady(db(), jogo, ana!, true)
  expect((await rodada(1)).phase).toBe('planejamento') // falta a Bia
  await marcarReady(db(), jogo, bia!, true)
  const g1 = await jogoAtual()
  const fase1 = (await rodada(g1.round)).phase
  expect(g1.round > 1 || fase1 !== 'planejamento').toBe(true) // sem humano em campo, já abre a rodada 2
  const [log] = await db().select().from(roundLogs)
  expect((log!.data as { resultados: { erro: string | null }[] }).resultados).toEqual([expect.objectContaining({ erro: null })])

  // anda até a rodada 4, sempre com 5 chamadas concorrentes por prazo vencido
  const vistas = new Set<FaseRodada>([fase1])
  while ((await jogoAtual()).round < 4) {
    await vencer()
    const r = await Promise.all(Array.from({ length: 5 }, () => transicionar(db(), jogo)))
    expect(r.filter(Boolean)).toHaveLength(1)
    const g = await jogoAtual()
    const atual = await rodada(g.round)
    vistas.add(atual.phase)
    if (atual.phase === 'intervalo' || atual.phase === 'ao_vivo_1t') expect(atual.seed).toBeNull() // ainda secreta
  }
  expect(vistas).toContain('intervalo') // live com humano em campo
  for (const n of [1, 2, 3]) {
    const r = await rodada(n)
    expect(sha256(r.seed!)).toBe(r.seedHash)
  }
  expect((await rodada(4)).seed).toBeNull()
  expect((await db().select().from(snapshots).where(eq(snapshots.n, 4)))).toHaveLength(1)
})

test('só quem tem jogo precisa ficar pronto', async () => {
  const membros = await db().select().from(gameMembers).where(eq(gameMembers.gameId, jogo))
  const tecnico = new Map(membros.map((x) => [x.userId, x.tecnicoId!]))
  await db().update(games).set({ mode: 'daily' }).where(eq(games.id, jogo)) // sem o ao vivo: menos fases até lá
  // anda até um planejamento em que só um dos dois joga
  let emCampo: number[]
  for (;;) {
    const g = await jogoAtual()
    if ((await rodada(g.round)).phase === 'planejamento') {
      emCampo = tecnicosEmCampo(await carregarMundo(db(), jogo, g.round, 0))
      if (emCampo.includes(tecnico.get(ana!)!) !== emCampo.includes(tecnico.get(bia!)!)) break
    }
    await vencer()
    await transicionar(db(), jogo)
  }
  const [joga, fora] = emCampo.includes(tecnico.get(ana!)!) ? [ana!, bia!] : [bia!, ana!]
  const n = (await jogoAtual()).round
  await enviarComandos(db(), jogo, fora, [{ tipo: 'tatica', estilo: 2 }]) // quem não joga ainda mexe
  await marcarReady(db(), jogo, joga, true)
  expect((await jogoAtual()).round > n || (await rodada(n)).phase !== 'planejamento').toBe(true)
  const [log] = await db().select().from(roundLogs).where(and(eq(roundLogs.gameId, jogo), eq(roundLogs.n, n)))
  expect((log!.data as { resultados: unknown[] }).resultados).toHaveLength(1) // o comando de quem não joga entrou
}, 60_000)

test('prazo vencido sem pronto automático espera todos; o admin força', async () => {
  const { gameSettings } = await import('../db/schema.ts')
  await db().update(gameSettings).set({ autoReadyOnTimeout: false })
  await vencer()
  expect(await transicionar(db(), jogo)).toBe(false)
  expect((await jogoAtual()).deadline).toBeNull()
  expect(await transicionar(db(), jogo, true)).toBe(true)
})

test('prazo 0 = sem limite; nos resultados, quem jogou continua e a rodada abre', async () => {
  const { gameSettings } = await import('../db/schema.ts')
  await db().update(gameSettings).set({ resultsPauseS: 0 })
  for (let i = 0; i < 40 && (await rodada((await jogoAtual()).round)).phase !== 'resultados'; i++) {
    await vencer()
    await transicionar(db(), jogo)
  }
  const n = (await jogoAtual()).round
  expect((await rodada(n)).phase).toBe('resultados')
  expect((await jogoAtual()).deadline).toBeNull()
  expect(await transicionar(db(), jogo)).toBe(false) // sem prazo, ninguém pronto: espera
  await marcarReady(db(), jogo, ana!, true)
  await marcarReady(db(), jogo, bia!, true)
  expect((await jogoAtual()).round).toBe(n + 1)
}, 60_000)

test('presença: alguém offline pausa sozinho; todos de volta retomam; pausa do admin não se desfaz', async () => {
  const membros = await db().select().from(gameMembers).where(eq(gameMembers.gameId, jogo))
  const [a, b] = membros.map((m) => m.id) as [number, number]
  await batida(db(), a)
  await vigiarPresenca(db()) // a Bia nunca conectou
  expect(await jogoAtual()).toMatchObject({ status: 'paused', autoPaused: true })
  await batida(db(), b)
  await vigiarPresenca(db())
  expect(await jogoAtual()).toMatchObject({ status: 'running', autoPaused: false, pausedAt: null })
  await pausar(db(), jogo)
  await vigiarPresenca(db())
  expect((await jogoAtual()).status).toBe('paused')
})

test('retomar: o prazo anda o tempo parado, uma vez só', async () => {
  const antes = (await jogoAtual()).deadline!.getTime()
  await pausar(db(), jogo)
  await db().update(games).set({ pausedAt: new Date(Date.now() - 60_000) }).where(eq(games.id, jogo))
  await Promise.all([retomar(db(), jogo), retomar(db(), jogo)]) // admin e presença juntos: conta uma vez só
  const depois = (await jogoAtual()).deadline!.getTime()
  expect(depois - antes).toBeGreaterThanOrEqual(60_000)
  expect(depois - antes).toBeLessThan(65_000)
})

test('quem entra com o jogo andando vira técnico sem time e recebe propostas', async () => {
  await db().insert(invites).values({ code: 'MEIO-01', gameId: jogo, createdBy: ana! })
  const r = await resgatarConvite(db(), 'MEIO-01', { usuario: 'cid', senha: '' })
  expect(r).toMatchObject({ gameId: jogo })
  const [mb] = await db().select().from(gameMembers).where(eq(gameMembers.userId, (r as { userId: number }).userId))
  expect(mb!.tecnicoId).not.toBeNull()
  const m = await carregarMundo(db(), jogo, 1, 0)
  const c = m.tecnicos[mb!.tecnicoId!]!
  expect(c).toMatchObject({ nome: 'cid', humano: true, time: null })
  expect(m.ofertas.find((o) => o.tecnico === c.id)?.times.length).toBeGreaterThan(0)
  // e pode aceitar uma delas
  const time = m.ofertas.find((o) => o.tecnico === c.id)!.times[0]!
  expect(await enviarComandos(db(), jogo, mb!.userId, [{ tipo: 'aceitarOferta', time }])).toEqual({ erros: [null] })
})
