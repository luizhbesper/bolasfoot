// Métricas de um lote de partidas. O mesmo resumo serve ao motor (pnpm sim, teste estatístico)
// e à saída do oráculo Java (tools/Oracle.java), para comparar o port com o original.
import base from '@bolasfoot/data/base.json' with { type: 'json' }
import type { Base } from '@bolasfoot/data'
import { escalarIA } from './escalacao.ts'
import { novoJogo } from './mundo.ts'
import { iniciarPartida, simularTempo, type ContextoPartida, type Partida } from './partida.ts'
import { derivar } from './rng.ts'

/** Uma partida reduzida ao que as duas implementações conseguem informar. */
export interface ResumoJogo {
  /** placar [mandante, visitante] */
  p: [number, number]
  /** chutes */
  c: [number, number]
  /** chutes no alvo (inclui gols) */
  a: [number, number]
  /** [posse0, posse1, desarmes0, desarmes1, passesErrados0, passesErrados1] (ticks) */
  x?: number[]
  /** eventos [tipo, subtipo do gol, tempo, minuto, lado] */
  e: [number, number, number, number, number][]
}

export interface Metricas {
  jogos: number
  golsJogo: number
  casa: number
  empate: number
  fora: number
  chutesJogo: number
  conversao: number
  noAlvo: number
  /** fração dos gols por subtipo: normal, contra, pênalti, falta, olímpico */
  tiposGol: { normal: number; contra: number; penalti: number; falta: number; olimpico: number }
  amarelosJogo: number
  expulsoesJogo: number
  lesoesJogo: number
  subsJogo: number
  assistPorGol: number
}

export function resumo(p: Partida): ResumoJogo {
  return {
    p: [...p.placar],
    c: [p.lados[0].chutes, p.lados[1].chutes],
    a: [p.lados[0].noAlvo, p.lados[1].noAlvo],
    x: [p.lados[0].posse, p.lados[1].posse, p.lados[0].desarmes, p.lados[1].desarmes, p.lados[0].passesErrados, p.lados[1].passesErrados],
    e: p.eventos.map((e) => [e.tipo, e.subtipo ?? 0, e.tempo, e.minuto, e.lado]),
  }
}

export function metricas(jogos: ResumoJogo[]): Metricas {
  const n = jogos.length
  let gols = 0, casa = 0, empate = 0, chutes = 0, alvo = 0
  const ev = new Map<number, number>()
  const sub = new Map<number, number>()
  for (const j of jogos) {
    gols += j.p[0] + j.p[1]
    if (j.p[0] > j.p[1]) casa++
    else if (j.p[0] === j.p[1]) empate++
    chutes += j.c[0] + j.c[1]
    alvo += j.a[0] + j.a[1]
    for (const [t, s] of j.e) {
      ev.set(t, (ev.get(t) ?? 0) + 1)
      if (t === 1) sub.set(s, (sub.get(s) ?? 0) + 1)
    }
  }
  const golsEv = ev.get(1) ?? 0
  const r = (x: number) => Math.round(x * 10000) / 10000
  const tipo = (s: number) => r((sub.get(s) ?? 0) / (golsEv || 1))
  return {
    jogos: n,
    golsJogo: r(gols / n),
    casa: r(casa / n),
    empate: r(empate / n),
    fora: r((n - casa - empate) / n),
    chutesJogo: r(chutes / n),
    conversao: r(gols / chutes),
    noAlvo: r(alvo / chutes),
    tiposGol: { normal: tipo(1), contra: tipo(2), penalti: tipo(3), falta: tipo(4), olimpico: tipo(5) },
    amarelosJogo: r((ev.get(2) ?? 0) / n),
    expulsoesJogo: r(((ev.get(3) ?? 0) + (ev.get(4) ?? 0)) / n),
    lesoesJogo: r((ev.get(5) ?? 0) / n),
    subsJogo: r((ev.get(6) ?? 0) / n),
    assistPorGol: r((ev.get(8) ?? 0) / (golsEv || 1)),
  }
}

/**
 * N partidas só da IA entre pares sorteados de uma divisão BR, com o mundo zerado a cada jogo
 * (energia 100, sem suspensões) — o mesmo protocolo do tools/Oracle.java.
 */
export function simularLote(n: number, seed: string, divisao = 1, opcoes = { habilidadeIndividual: false }): Partida[] {
  const mundo = novoJogo(base as Base, opcoes, seed)
  const times = mundo.times.filter((t) => t.pais === 29 && t.divisao === divisao)
  const ctx: ContextoPartida = { competicao: 'liga', tipoComp: 1, temporada: 1 }
  const jogos: Partida[] = []
  for (let i = 0; i < n; i++) {
    const rng = derivar(seed, `lote:${i}`)
    const a = rng.int(times.length)
    const b = (a + 1 + rng.int(times.length - 1)) % times.length
    const [m, v] = [times[a]!.id, times[b]!.id]
    const p = iniciarPartida(mundo, [m, v], [escalarIA(mundo, m, ctx.competicao, rng), escalarIA(mundo, v, ctx.competicao, rng)], ctx, rng)
    simularTempo(p, 1, derivar(seed, `lote:${i}:1T`))
    simularTempo(p, 2, derivar(seed, `lote:${i}:2T`))
    jogos.push(p)
  }
  return jogos
}
