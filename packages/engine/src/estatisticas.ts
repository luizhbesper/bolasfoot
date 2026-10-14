// Métricas de um lote de partidas. O mesmo resumo serve ao motor (pnpm sim, teste estatístico)
// e à saída do oráculo Java (tools/Oracle.java), para comparar o port com o original.
import base from '@bolasfoot/data/base.json' with { type: 'json' }
import type { Base } from '@bolasfoot/data'
import { TIPO } from './calendario.ts'
import { contratarTecnicoHumano } from './carreira.ts'
import { classificacaoFinal, type Competicao } from './competicoes.ts'
import { escalarIA } from './escalacao.ts'
import { novoJogo, type Mundo } from './mundo.ts'
import { iniciarPartida, simularTempo, type ContextoPartida, type Partida } from './partida.ts'
import { derivar } from './rng.ts'
import { avancarRodada, type ComandoDe } from './rodada.ts'

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

// ── Temporadas (gate da Fase 2: pnpm sim --temporadas) ─────────────────────

/** Correlação de Spearman entre duas ordens (sem empates). */
function spearman(a: number[], b: number[]): number {
  const n = a.length
  const d2 = a.reduce((s, x, i) => s + (x - b[i]!) * (x - b[i]!), 0)
  return 1 - (6 * d2) / (n * (n * n - 1))
}

export interface ResumoTemporada {
  temporada: number
  /** campeões (nomes) de A, B, C, D, Copa, Libertadores, Sul-Americana e Mundial */
  campeoes: Record<'A' | 'B' | 'C' | 'D' | 'CB' | 'LIB' | 'SUL' | 'MUN', string>
  /** Spearman entre a colocação final da Série A e a ordem por Nivel do começo do jogo (1 = só os favoritos no topo) */
  spearmanA: number
  /** Série A: gols por jogo e resultado */
  golsJogo: number
  casa: number
  empate: number
  /** média da força dos 11 melhores de cada time, por divisão (A, B, C, fora das séries BR) */
  forcaTop11: [number, number, number, number]
  /** média de Nivel original dos times da Série A (os grandes continuam lá?) */
  nivelMedioA: number
  idadeMedia: number
  ativos: number
  juniores: number
  aposentados: number
  estrelas: number
  forcaMax: number
  transferencias: number
  trocasDeTecnico: number
  /** times BR por reputação 0..5 */
  reputacaoBR: number[]
  hallDaFama: number
  /** o técnico humano-piloto: time em que terminou a temporada (null = desempregado), colocação na liga, caixa depois da virada */
  piloto: { time: string | null; divisao: number; caixa: number; posicao: number | null; diretoria: number; torcida: number; demissoes: number }
}

/**
 * Fotografia de uma temporada: competições pelas `encerradas`; jogadores, reputações e caixa já depois da virada (o
 * começo da seguinte). `nivel0`: Nivel de cada time no começo do jogo.
 */
export function resumoTemporada(m: Mundo, encerradas: Competicao[], nivel0: number[], piloto: number, marcas: { transf: number; trocas: number }): ResumoTemporada {
  const comp = (id: string) => encerradas.find((c) => c.id === id)
  const nome = (id: number | null | undefined) => (id == null ? '-' : m.times[id]!.nome)
  const a = comp('BR-1')!
  const final = classificacaoFinal(a)
  const porNivel = [...final].sort((x, y) => nivel0[y]! - nivel0[x]! || x - y)
  const jogosA = a.fases.flatMap((f) => (f.tipo === 'liga' ? f.jogos : []))
  const ativos = m.jogadores.filter((j) => j.time >= 0)
  const pros = ativos.filter((j) => !j.juvenil)
  const top11 = (div: number) => {
    const ts = m.times.filter((t) => (div === 0 ? !t.ligaNacional || t.divisao === 0 : t.ligaNacional && t.divisao === div))
    const v = ts.map((t) => {
      const f = t.jogadores.map((id) => m.jogadores[id]!.forca).sort((x, y) => y - x).slice(0, 11)
      return f.reduce((s, x) => s + x, 0) / f.length
    })
    return +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(1)
  }
  const tc = m.tecnicos[piloto]!
  const campanha = tc.campanhas.findLast((c) => c.temporada === m.temporada - 1)
  const tp = campanha ? m.times[campanha.time]! : null
  const ligaPiloto = tp && encerradas.find((c) => c.tipo === TIPO.liga && classificacaoFinal(c).includes(tp.id))
  const rep = [0, 0, 0, 0, 0, 0]
  for (const t of m.times) if (t.ligaNacional) rep[t.reputacao]!++
  return {
    temporada: m.temporada - 1,
    campeoes: { A: nome(a.campeao), B: nome(comp('BR-2')?.campeao), C: nome(comp('BR-3')?.campeao), D: nome(comp('BR-4')?.campeao), CB: nome(comp('CB')?.campeao), LIB: nome(comp('LIB')?.campeao), SUL: nome(comp('SUL')?.campeao), MUN: nome(comp('MUN')?.campeao) },
    spearmanA: +spearman(final.map((_, i) => i), final.map((t) => porNivel.indexOf(t))).toFixed(3),
    golsJogo: +(jogosA.reduce((s, j) => s + j.gols![0] + j.gols![1], 0) / jogosA.length).toFixed(2),
    casa: +(jogosA.filter((j) => j.gols![0] > j.gols![1]).length / jogosA.length).toFixed(3),
    empate: +(jogosA.filter((j) => j.gols![0] === j.gols![1]).length / jogosA.length).toFixed(3),
    forcaTop11: [top11(1), top11(2), top11(3), top11(0)],
    nivelMedioA: +(final.reduce((s, t) => s + nivel0[t]!, 0) / final.length).toFixed(2),
    idadeMedia: +(pros.reduce((s, j) => s + j.idade, 0) / pros.length).toFixed(2),
    ativos: pros.length,
    juniores: ativos.length - pros.length,
    aposentados: m.jogadores.length - ativos.length,
    estrelas: pros.filter((j) => j.estrela).length,
    forcaMax: Math.max(...pros.map((j) => j.forca)),
    transferencias: m.transferencias.length - marcas.transf,
    trocasDeTecnico: m.trocasDeTecnico.length - marcas.trocas,
    reputacaoBR: rep,
    hallDaFama: m.hallDaFama.length,
    piloto: {
      time: tp?.nome ?? null, divisao: tp?.divisao ?? 0, caixa: tc.time !== null ? m.times[tc.time]!.financas?.caixa ?? 0 : 0,
      diretoria: tc.diretoria, torcida: tc.torcida, posicao: tp && ligaPiloto ? classificacaoFinal(ligaPiloto).indexOf(tp.id) + 1 : null,
      demissoes: m.trocasDeTecnico.slice(marcas.trocas).filter((x) => x.saiu === piloto && x.motivo > 0).length,
    },
  }
}

/**
 * N temporadas de um mundo com um humano-piloto (começa no 10º da Série A por Nivel; escala pela IA e, desempregado,
 * aceita a primeira proposta) jogando pelo caminho da máquina de estados (`avancarRodada`).
 */
export function simularTemporadas(n: number, seed: string, B: Base = base as Base): ResumoTemporada[] {
  const m = novoJogo(B, { habilidadeIndividual: false }, seed)
  const nivel0 = m.times.map((t) => t.nivel)
  const time = m.times.filter((t) => t.divisao === 1).sort((x, y) => y.nivel - x.nivel || x.id - y.id)[9]!.id
  const piloto = contratarTecnicoHumano(m, 'Piloto', 29, time).id
  const out: ResumoTemporada[] = []
  let marcas = { transf: 0, trocas: 0 }
  for (let k = 0; out.length < n; k++) {
    // desempregado, aceita a primeira proposta
    const oferta = m.tecnicos[piloto]!.time === null ? m.ofertas.find((o) => o.tecnico === piloto) : undefined
    const comandos: ComandoDe[] = oferta ? [{ tecnico: piloto, comando: { tipo: 'aceitarOferta', time: oferta.times[0]! } }] : []
    const r = avancarRodada(m, B, comandos, `${seed}:${k}`)
    if (!r.virou) continue
    out.push(resumoTemporada(m, r.encerradas!, nivel0, piloto, marcas))
    marcas = { transf: m.transferencias.length, trocas: m.trocasDeTecnico.length }
  }
  return out
}
