// Máquina de estados do jogo no servidor (docs/plano.md §3.2). Toda mudança de fase passa por `transicionar`, numa
// transação com o jogo travado (FOR UPDATE): o último ready, o agendador e o "forçar" do admin nunca resolvem duas vezes.
//
//   planejamento ─(todos ready | prazo)─► resolve ─┬─ live, humano em campo ─► ao_vivo_1t ─► intervalo ─(ready | prazo)─►
//                                                  │                           resolve o 2º tempo ─► ao_vivo_2t ─► resultados
//                                                  ├─ daily, humano em campo ─► resultados
//                                                  └─ ninguém em campo (proposta de emprego, virada) ─► planejamento n+1
//   resultados ─(prazo)─► planejamento n+1
import {
  avancarRodada, continuarRodada, contratarTecnicoHumano, novoJogo, validar,
  type Comando, type ComandoDe, type Mundo, type Partida, type Rodada,
} from '@bolasfoot/engine'
import { and, eq, isNotNull } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'
import type { Db } from '../db/index.ts'
import { commands, gameMembers, games, gameSettings, roundLogs, rounds, snapshots, users, type FaseRodada } from '../db/schema.ts'
import { base } from './base.ts'
import { publicar, type EventoJogo } from './canal.ts'

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type Q = Db | Tx
type Jogo = typeof games.$inferSelect
type Settings = typeof gameSettings.$inferSelect

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
/** Seed da rodada n: secreta até os comandos travarem; o hash sai antes (commit-reveal, §2.5). */
export const seedDaRodada = (gameSeed: string, n: number) => sha256(`${gameSeed}:${n}`)
/** O mundo vai para o cliente: a seed dele não pode ser a do jogo, de onde saem as das rodadas. */
export const seedDoMundo = (gameSeed: string) => sha256(`${gameSeed}:mundo`)

const daqui = (s: number) => new Date(Date.now() + s * 1000)

// --- snapshots -------------------------------------------------------------------------------------------------------

export const comprimir = (m: Mundo) => gzipSync(JSON.stringify(m))
export const descomprimir = (b: Buffer): Mundo => JSON.parse(gunzipSync(b).toString())

async function salvarMundo(q: Q, gameId: number, n: number, etapa: number, m: Mundo) {
  const data = comprimir(m)
  await q.insert(snapshots).values({ gameId, n, etapa, data })
    .onConflictDoUpdate({ target: [snapshots.gameId, snapshots.n, snapshots.etapa], set: { data } })
}

export async function carregarMundo(q: Q, gameId: number, n: number, etapa: number): Promise<Mundo> {
  const [s] = await q.select({ data: snapshots.data }).from(snapshots)
    .where(and(eq(snapshots.gameId, gameId), eq(snapshots.n, n), eq(snapshots.etapa, etapa)))
  if (!s) throw new Error(`sem snapshot ${gameId}/${n}/${etapa}`)
  return descomprimir(s.data)
}

// --- leitura do estado ---------------------------------------------------------------------------------------------

const settingsDe = async (q: Q, gameId: number) => (await q.select().from(gameSettings).where(eq(gameSettings.gameId, gameId)))[0]!
const rodadaDe = async (q: Q, gameId: number, n: number) =>
  (await q.select().from(rounds).where(and(eq(rounds.gameId, gameId), eq(rounds.n, n))))[0]
/** Membros com técnico no mundo (quem joga). */
const jogadoresDe = (q: Q, gameId: number) =>
  q.select().from(gameMembers).where(and(eq(gameMembers.gameId, gameId), isNotNull(gameMembers.tecnicoId))).orderBy(gameMembers.id)

/** O estado que o SSE manda (boas-vindas e a cada mudança). */
export async function estadoFase(q: Q, gameId: number): Promise<Extract<EventoJogo, { tipo: 'fase' }>> {
  const [g] = await q.select().from(games).where(eq(games.id, gameId))
  const r = g && g.round ? await rodadaDe(q, gameId, g.round) : undefined
  return {
    tipo: 'fase', status: g?.status ?? 'finished', rodada: g?.round ?? 0, fase: r?.phase ?? null,
    prazo: g?.deadline?.getTime() ?? null, inicio: r?.startedAt?.getTime() ?? null,
  }
}

export async function prontos(q: Q, gameId: number): Promise<Extract<EventoJogo, { tipo: 'ready' }>> {
  const ms = await q.select({ id: gameMembers.id }).from(gameMembers).where(and(eq(gameMembers.gameId, gameId), eq(gameMembers.ready, true)))
  return { tipo: 'ready', prontos: ms.map((m) => m.id) }
}

// --- transições ----------------------------------------------------------------------------------------------------

/** O mundo nasce com os times escolhidos e a 1ª rodada abre. Roda na transação que encerra a escolha de times. */
export async function comecarJogo(tx: Tx, gameId: number): Promise<void> {
  const [g] = await tx.select().from(games).where(eq(games.id, gameId))
  const m = novoJogo(base, { habilidadeIndividual: g!.config.habilidadeIndividual, salarioMensal: g!.config.salarioMensal }, seedDoMundo(g!.gameSeed))
  const membros = await tx.select({ id: gameMembers.id, teamRef: gameMembers.teamRef, username: users.username })
    .from(gameMembers).innerJoin(users, eq(users.id, gameMembers.userId)).where(eq(gameMembers.gameId, gameId)).orderBy(gameMembers.id)
  for (const mb of membros) {
    if (!mb.teamRef) continue // sem time: fica de fora (expulso ou não escolheu)
    const t = m.times.find((x) => x.fileRef === mb.teamRef)
    if (!t) throw new Error(`time inexistente: ${mb.teamRef}`)
    const c = contratarTecnicoHumano(m, mb.username, 29, t.id)
    await tx.update(gameMembers).set({ tecnicoId: c.id }).where(eq(gameMembers.id, mb.id))
  }
  await salvarMundo(tx, gameId, 1, 0, m)
  await abrirRodada(tx, g!, 1, await settingsDe(tx, gameId))
}

async function abrirRodada(tx: Tx, g: Jogo, n: number, s: Settings) {
  await tx.insert(rounds).values({ gameId: g.id, n, seedHash: sha256(seedDaRodada(g.gameSeed, n)) })
  await tx.update(games).set({ status: 'running', round: n, deadline: daqui(s.planningTimeoutS) }).where(eq(games.id, g.id))
  await tx.update(gameMembers).set({ ready: false }).where(eq(gameMembers.gameId, g.id))
}

async function mudarFase(tx: Tx, g: Jogo, n: number, phase: FaseRodada, deadline: Date | null, startedAt: Date | null = null) {
  await tx.update(rounds).set({ phase, startedAt }).where(and(eq(rounds.gameId, g.id), eq(rounds.n, n)))
  await tx.update(games).set({ deadline }).where(eq(games.id, g.id))
  if (phase === 'intervalo') await tx.update(gameMembers).set({ ready: false }).where(eq(gameMembers.gameId, g.id))
}

/** Quando o tempo ao vivo acaba no relógio do cliente: 45 + o maior acréscimo entre as partidas. */
const fimDoTempo = (inicio: Date, partidas: Partida[], tempo: 1 | 2, msPorMinuto: number) =>
  new Date(inicio.getTime() + (45 + Math.max(0, ...partidas.map((p) => p.acrescimos[tempo - 1]!))) * msPorMinuto)

/** O que o log da rodada guarda: placar e eventos com os nomes (o resto o cliente acha no snapshot). */
const resumo = (m: Mundo, r: Rodada) => ({
  resultados: r.resultados, dias: r.dias, virou: r.virou,
  partidas: r.partidas.map((p) => ({
    times: [p.lados[0].time, p.lados[1].time], nomes: [m.times[p.lados[0].time]!.nome, m.times[p.lados[1].time]!.nome],
    placar: p.placar, acrescimos: p.acrescimos,
    eventos: p.eventos.map((e) => ({ ...e, nome: e.jogador === null ? null : p.jogadores[e.jogador]?.nome ?? null })),
    penaltis: p.penaltis && { placar: p.penaltis.placar, vencedor: p.penaltis.vencedor },
  })),
})
export type ResumoRodada = ReturnType<typeof resumo>

/** Trava os comandos, roda o motor e grava o resultado. */
async function resolver(tx: Tx, g: Jogo, n: number, etapa: 0 | 1, s: Settings) {
  const m = await carregarMundo(tx, g.id, n, etapa)
  const seed = seedDaRodada(g.gameSeed, n)
  const tecnicoDe = new Map((await jogadoresDe(tx, g.id)).map((x) => [x.id, x.tecnicoId!]))
  const salvos = await tx.select().from(commands)
    .where(and(eq(commands.gameId, g.id), eq(commands.n, n), eq(commands.etapa, etapa))).orderBy(commands.memberId)
  const comandos: ComandoDe[] = salvos.flatMap((c) => {
    const tecnico = tecnicoDe.get(c.memberId)
    return tecnico === undefined ? [] : (c.list as Comando[]).map((comando) => ({ tecnico, comando }))
  })

  const r = etapa ? continuarRodada(m, base, comandos, seed) : avancarRodada(m, base, comandos, seed, g.mode === 'live')
  await tx.insert(roundLogs).values({ gameId: g.id, n, etapa, data: resumo(m, r) })
  const agora = new Date()
  if (r.fase === 'intervalo') {
    await salvarMundo(tx, g.id, n, 1, m)
    return mudarFase(tx, g, n, 'ao_vivo_1t', fimDoTempo(agora, r.partidas, 1, s.msPerMinute), agora)
  }
  await salvarMundo(tx, g.id, n + 1, 0, m)
  await tx.update(rounds).set({ seed }).where(and(eq(rounds.gameId, g.id), eq(rounds.n, n))) // revela
  if (etapa) return mudarFase(tx, g, n, 'ao_vivo_2t', fimDoTempo(agora, r.partidas, 2, s.msPerMinute), agora)
  if (r.partidas.length) return mudarFase(tx, g, n, 'resultados', daqui(s.resultsPauseS))
  return abrirRodada(tx, g, n + 1, s)
}

/**
 * Avança a fase se der: todos prontos ou prazo vencido (`forcar` = o admin manda). Idempotente: chamar de novo sem
 * nada mudar não faz nada. Devolve se mudou.
 */
export async function transicionar(d: Db, gameId: number, forcar = false): Promise<boolean> {
  const mudou = await d.transaction(async (tx) => {
    const [g] = await tx.select().from(games).where(eq(games.id, gameId)).for('update')
    const vencido = forcar || (g?.deadline != null && g.deadline <= new Date())
    if (g?.status === 'picking') {
      // escolha de times: todos com time e prontos, ou prazo (quem não escolheu fica de fora)
      const membros = await tx.select().from(gameMembers).where(eq(gameMembers.gameId, gameId))
      if (!(membros.length > 0 && membros.every((x) => x.teamRef && x.ready)) && !vencido) return false
      if (!membros.some((x) => x.teamRef)) {
        await tx.update(games).set({ deadline: null }).where(eq(games.id, gameId)) // ninguém escolheu: espera
        return false
      }
      await comecarJogo(tx, gameId)
      return true
    }
    if (g?.status !== 'running') return false
    const r = (await rodadaDe(tx, gameId, g.round))!
    const s = await settingsDe(tx, gameId)
    switch (r.phase) {
      case 'planejamento':
      case 'intervalo': {
        const membros = await jogadoresDe(tx, gameId)
        const todos = membros.length > 0 && membros.every((x) => x.ready)
        if (!todos && !vencido) return false
        if (!todos && !forcar && !s.autoReadyOnTimeout) {
          // prazo vencido sem pronto automático: espera todos (ou o admin)
          await tx.update(games).set({ deadline: null }).where(eq(games.id, gameId))
          return false
        }
        await resolver(tx, g, r.n, r.phase === 'intervalo' ? 1 : 0, s)
        return true
      }
      case 'ao_vivo_1t':
        if (!vencido) return false
        await mudarFase(tx, g, r.n, 'intervalo', daqui(s.halftimeTimeoutS))
        return true
      case 'ao_vivo_2t':
        if (!vencido) return false
        await mudarFase(tx, g, r.n, 'resultados', daqui(s.resultsPauseS))
        return true
      case 'resultados':
        if (!vencido) return false
        await abrirRodada(tx, g, r.n + 1, s)
        return true
    }
  })
  if (mudou) {
    publicar(gameId, await estadoFase(d, gameId))
    publicar(gameId, await prontos(d, gameId))
  }
  return mudou
}

// --- ações dos membros ---------------------------------------------------------------------------------------------

const etapaDa = (phase: FaseRodada | undefined) => (phase === 'planejamento' ? 0 : phase === 'intervalo' ? 1 : null)

/**
 * Guarda a lista de comandos do membro para a fase corrente (substitui a anterior). Valida cada um com o motor contra
 * o mundo atual; com qualquer erro, nada é gravado.
 */
export async function enviarComandos(d: Db, gameId: number, userId: number, lista: unknown): Promise<{ erro: string } | { erros: (string | null)[] }> {
  return d.transaction(async (tx) => {
    const [g] = await tx.select().from(games).where(eq(games.id, gameId)).for('share')
    if (g?.status !== 'running') return { erro: 'o jogo não está rodando' }
    const [mb] = await tx.select().from(gameMembers).where(and(eq(gameMembers.gameId, gameId), eq(gameMembers.userId, userId)))
    if (mb?.tecnicoId == null) return { erro: 'você não joga neste jogo' }
    const r = await rodadaDe(tx, gameId, g.round)
    const etapa = etapaDa(r?.phase)
    if (etapa === null) return { erro: 'fora do planejamento' }
    if (!Array.isArray(lista)) return { erro: 'lista de comandos inválida' }
    const m = await carregarMundo(tx, gameId, g.round, etapa)
    const erros = lista.map((c) => validar(m, mb.tecnicoId!, c as Comando))
    if (erros.some((e) => e !== null)) return { erros }
    await tx.insert(commands).values({ gameId, n: g.round, etapa, memberId: mb.id, list: lista })
      .onConflictDoUpdate({ target: [commands.gameId, commands.n, commands.etapa, commands.memberId], set: { list: lista } })
    return { erros }
  })
}

/** Comandos já guardados pelo membro na fase corrente (vazio fora do planejamento/intervalo). */
export async function comandosPendentes(q: Q, gameId: number, userId: number): Promise<Comando[]> {
  const [g] = await q.select().from(games).where(eq(games.id, gameId))
  if (g?.status !== 'running') return []
  const etapa = etapaDa((await rodadaDe(q, gameId, g.round))?.phase)
  if (etapa === null) return []
  const [c] = await q.select({ list: commands.list }).from(commands).innerJoin(gameMembers, eq(gameMembers.id, commands.memberId))
    .where(and(eq(commands.gameId, gameId), eq(commands.n, g.round), eq(commands.etapa, etapa), eq(gameMembers.userId, userId)))
  return (c?.list as Comando[] | undefined) ?? []
}

/** Tipos que valem uma vez por fase: o novo substitui o anterior; os outros (compras, propostas…) se somam. */
const UNICOS = new Set<Comando['tipo']>(['escalar', 'tatica', 'batedores', 'treino', 'ingresso', 'mudarTatica'])

export function juntarComandos(atuais: Comando[], novos: Comando[]): Comando[] {
  const trocados = new Set(novos.map((c) => c.tipo).filter((t) => UNICOS.has(t)))
  return [...atuais.filter((c) => !trocados.has(c.tipo)), ...novos]
}

/** Soma `novos` aos comandos já guardados da fase (ver `juntarComandos`) e grava tudo com `enviarComandos`. */
export async function definirComandos(d: Db, gameId: number, userId: number, novos: Comando[]) {
  return enviarComandos(d, gameId, userId, juntarComandos(await comandosPendentes(d, gameId, userId), novos))
}

/** Pronto / não pronto na fase corrente (ou na escolha de times); o último pronto resolve. */
export async function marcarReady(d: Db, gameId: number, userId: number, ready: boolean): Promise<void> {
  const [g] = await d.select().from(games).where(eq(games.id, gameId))
  const naEscolha = g?.status === 'picking'
  if (!naEscolha && (g?.status !== 'running' || etapaDa((await rodadaDe(d, gameId, g.round))?.phase) === null)) return
  const onde = and(eq(gameMembers.gameId, gameId), eq(gameMembers.userId, userId))
  // na escolha, só fica pronto quem já tem time
  await d.update(gameMembers).set({ ready }).where(naEscolha ? and(onde, isNotNull(gameMembers.teamRef)) : onde)
  publicar(gameId, await prontos(d, gameId))
  if (ready) await transicionar(d, gameId)
}

// --- admin ---------------------------------------------------------------------------------------------------------

export async function pausar(d: Db, gameId: number) {
  await d.update(games).set({ status: 'paused', deadline: null }).where(and(eq(games.id, gameId), eq(games.status, 'running')))
  publicar(gameId, await estadoFase(d, gameId))
}

/** Volta com o prazo inteiro da fase. ponytail: não guarda o que sobrava; um tempo ao vivo pausado termina na hora. */
export async function retomar(d: Db, gameId: number) {
  const [g] = await d.select().from(games).where(eq(games.id, gameId))
  if (g?.status !== 'paused') return
  const s = await settingsDe(d, gameId)
  const phase = (await rodadaDe(d, gameId, g.round))!.phase
  const prazo = { planejamento: s.planningTimeoutS, intervalo: s.halftimeTimeoutS, resultados: s.resultsPauseS, ao_vivo_1t: 0, ao_vivo_2t: 0 }[phase]
  await d.update(games).set({ status: 'running', deadline: daqui(prazo) }).where(eq(games.id, gameId))
  publicar(gameId, await estadoFase(d, gameId))
}
