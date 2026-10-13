// Pós-jogo: suspensões, notas, lesões e energia de volta ao mundo; recuperação; público e renda.
import { foraDePosicao } from './escalacao.ts'
import type { Mundo, TimeM } from './mundo.ts'
import { possePct, type JogadorPartida, type Partida, type ContextoPartida } from './partida.ts'
import type { Rng } from './rng.ts'

const suspensao = (mundo: Mundo, id: number, comp: string) => (mundo.jogadores[id]!.suspensoes[comp] ??= { amarelos: 0, jogos: 0 })

/** Minuto absoluto na escala do original (1ºT 0..~47, 2ºT 48..~98). */
const absoluto = (tempo: 1 | 2, minuto: number) => (tempo === 1 ? minuto : 48 + minuto)

/**
 * Minutos jogados. Correção do port: só substituição e expulsão contam
 * (o original redefinia os minutos em qualquer evento, F.java:2297-2304).
 */
export function minutosJogados(p: Partida, id: number): number {
  let entrada = 0, saida = 98
  for (const e of p.eventos) {
    if (e.tipo === 6 && e.jogador2 === id) entrada = absoluto(e.tempo, e.minuto)
    if ((e.tipo === 6 || e.tipo === 3 || e.tipo === 4) && e.jogador === id) saida = absoluto(e.tempo, e.minuto)
  }
  return Math.min(saida - entrada, 90)
}

/**
 * Nota do jogador. Fonte: best/F.java:2289-2482.
 * Correções do port: gol vale +0.9 uma vez (Partida já conta uma vez), minutos só por
 * substituição/expulsão e pênalti perdido −1.2 pelo contador certo.
 */
export function nota(p: Partida, j: JogadorPartida, rng: Rng): number {
  const l = j.equipe, o = l === 0 ? 1 : 0
  const [gf, gc] = [p.placar[l], p.placar[o]]
  const res = gf > gc ? 1 : gf < gc ? 2 : 0
  const slot = j.slot < 1 ? [1, 2, 7, 15, 23][j.posicao]! : j.slot
  const f = j.forca
  let d = res === 0 ? (f <= 30 ? 5.5 : f <= 60 ? 5.8 : f <= 90 ? 6.2 : 6.8)
    : res === 1 ? (f <= 60 ? 6.0 : f <= 90 ? 6.7 : 7.2)
    : f <= 30 ? 5.0 : f <= 60 ? 5.2 : f <= 90 ? 5.5 : 6.0
  if (foraDePosicao(j.posicao, slot)) {
    d -= 1.5
    if (slot === 1) d -= 1.5
  }
  const posse = possePct(p)
  if (slot >= 10 && slot <= 17) {
    if (posse[l] > posse[o]) {
      d += rng.int(3) === 1 ? 0.3 : 0.8
      if (j.ex === 0) d += 0.3
      if (j.cr1 === 11 || j.cr1 === 4) d += 0.5
    } else if (posse[l] < posse[o]) {
      d -= rng.int(3) === 1 ? 0.3 : 0.8
      if (j.ex === 0) d -= 0.5
    }
  }
  const e = j.e
  d += e.gols * 0.9 - e.golsContra * 1.5 - e.penaltisPerdidos * 1.2 - e.amarelos * 0.2 - e.vermelhos * 0.8 + e.assistencias * 0.4
  const [L, O] = [p.lados[l], p.lados[o]]
  if (slot >= 1 && slot <= 13) {
    if (L.desarmes > O.desarmes) {
      d += rng.int(3) === 1 ? 0.9 : 0.6
      if (slot >= 2 && slot <= 9 && rng.int(3) === 1) d += 0.6
      if (slot >= 11 && slot <= 13 && rng.int(3) === 1) d += 0.6
    } else if (L.desarmes < O.desarmes) {
      d -= 0.5
      if (slot >= 3 && slot <= 8 && rng.int(4) === 1) d -= 0.6
      if (slot >= 11 && slot <= 13 && rng.int(4) === 1) d -= 0.6
    }
  }
  d += e.noAlvo * 0.3
  if (slot === 1) {
    d += -0.8 + O.noAlvo * 0.2 + e.penaltisDefendidos * 1.2
    if (O.chutes > 10) d += 0.2 // os ramos > 15 e > 20 do original nunca rodam
    d += gc >= 5 ? -2 : gc >= 4 ? -1.5 : gc >= 2 ? -1 : gc >= 1 ? -0.5 : 1
    if (O.noAlvo === 0) d -= 1.5
  }
  if (slot >= 1 && slot <= 13) {
    if (gc === 0) {
      d += 0.5
      if (slot >= 2 && slot <= 9) d += 0.5
      if (slot >= 11 && slot <= 13 && rng.int(3) === 1) d += 0.5
    } else if (gc > 1) d -= 0.1 * gc
    if (slot >= 2 && slot <= 13 && rng.int(3) === 1) d -= 0.4
  }
  if (j.estrela) d += 0.4
  if (j.craque) d += 0.6
  if (d > 10) d = 10
  if (d < 0) d = 1
  const min = minutosJogados(p, j.id)
  if (min < 15) d -= 2.5
  else if (min < 45) d -= 1.5
  if (d < 2) d = 2
  if (min < 20 && d <= 2) d = 0
  return d
}

/** Gancho do vermelho direto: 1/2/3/5/10 jogos. Fonte: best/F.java:2177-2190 */
export function ganchoVermelho(rng: Rng): number {
  const r = rng.int(1000)
  return r < 700 ? 1 : r < 900 ? 2 : r < 970 ? 3 : r <= 990 ? 5 : 10
}

/**
 * Aplica a partida ao mundo. Ordem de best/f_0.java:1486-1500: cumpre suspensões (I.hi)
 * antes de lançar os cartões desta partida (I.hh). Devolve as notas (0 = sem nota).
 */
export function aplicarPosJogo(mundo: Mundo, p: Partida, rng: Rng): { notas: Record<number, number> } {
  const comp = p.ctx.competicao
  // I.hi (I.java:468-486): todo o elenco dos dois times cumpre o que deve nesta competição
  for (const l of p.lados)
    for (const id of mundo.times[l.time]!.jogadores) {
      const s = mundo.jogadores[id]!.suspensoes[comp]
      if (!s) continue
      if (s.amarelos >= 3) s.amarelos = 0
      else if (s.jogos >= 1) s.jogos--
    }

  // I.hh (I.java:419-466): notas de titulares e de quem entrou; cartões viram suspensão
  const notas: Record<number, number> = {}
  for (const l of p.lados)
    for (const id of [...l.titulares, ...l.entraram]) {
      const j = p.jogadores[id]!
      notas[id] = nota(p, j, rng)
      const m = mundo.jogadores[id]!
      m.energia = j.energia
      m.forca = j.forca
      m.jogou = true
      if (!m.juvenil) m.jogos++ // I.hh → F.b
      if (j.lesao > 0) m.lesaoAte = mundo.dia + j.lesao
    }
  // I.hh → F.a: gol (não contra) na carreira
  for (const e of p.eventos) if (e.tipo === 1 && e.subtipo !== 2 && e.jogador !== null && !mundo.jogadores[e.jogador]!.juvenil) mundo.jogadores[e.jogador]!.gols++
  // estatísticas da temporada (artilharia e ficha do jogador). Fonte: n/a (o original guarda por jogo, ver ref 25/31)
  const est = (id: number) => ((mundo.jogadores[id]!.estatisticas ??= {})[comp] ??= [0, 0, 0, 0, 0, 0])
  for (const [id, n] of Object.entries(notas)) {
    const x = est(Number(id))
    x[0]++
    x[5] = Math.round((x[5] + n) * 10) / 10
  }
  for (const e of p.eventos) {
    if (e.jogador === null) continue
    if (e.tipo === 1 && e.subtipo !== 2) est(e.jogador)[1]++
    else if (e.tipo === 8) est(e.jogador)[2]++
    if (e.tipo === 2 || e.tipo === 3) est(e.jogador)[3]++
    if (e.tipo === 3 || e.tipo === 4) est(e.jogador)[4]++
  }
  if (p.ctx.tipoComp !== 0)
    for (const e of p.eventos) {
      if ((e.tipo !== 2 && e.tipo !== 3 && e.tipo !== 4) || e.jogador === null) continue
      if (mundo.jogadores[e.jogador]!.juvenil) continue
      const s = suspensao(mundo, e.jogador, comp)
      if (e.tipo === 2) s.amarelos++
      else if (e.tipo === 3) {
        s.amarelos++
        s.jogos++
      } else s.jogos += ganchoVermelho(rng)
    }
  return { notas }
}

/** Recuperação de energia após a rodada. Fonte: best/F.java:363-403 (fr) */
export function recuperarEnergia(mundo: Mundo): void {
  for (const j of mundo.jogadores) {
    if (j.juvenil) continue
    const i = j.idade
    const humano = mundo.times[j.time]?.humano ?? false
    const ganho = j.jogou
      ? humano
        ? i <= 20 ? 13 : i <= 25 ? 24 : i <= 31 ? 37 : i <= 36 ? 40 : 30
        : i <= 20 ? 20 : i <= 25 ? 30 : i <= 31 ? 50 : i <= 36 ? 52 : 42
      : i < 26 ? 30 : i < 45 ? 35 : 30
    j.energia = Math.min(100, j.energia + ganho)
  }
}

/** Preços por setor e competição (aq.qK). Fonte: best/aq.java:539 */
const PRECOS: number[][][] = [
  [[5, 15, 20, 30], [3, 12, 15, 25]],
  [[3, 12, 15, 30], [10, 15, 25, 80], [7, 13, 20, 70], [5, 12, 17, 40], [3, 12, 15, 30]],
  [[3, 12, 15, 30], [3, 12, 15, 30], [3, 12, 15, 30], [7, 13, 20, 70], [10, 15, 25, 80], [10, 15, 25, 80]],
  [[3, 5, 12, 20], [3, 12, 15, 30], [3, 12, 15, 30], [5, 12, 20, 50], [10, 15, 25, 70], [10, 15, 25, 70]],
  [[30, 45, 65, 200], [20, 35, 55, 150]],
  [[0, 0, 0, 0]],
  [[20, 25, 45, 150], [20, 25, 40, 120]],
  [[0, 0, 0, 0]],
  [[20, 25, 45, 150], [20, 25, 40, 120]],
]

/** Preço padrão do ingresso. Fonte: best/v_0.java:240-261 */
export function precoPadrao(tipoComp: number, mandante: Pick<TimeM, 'continente' | 'divisao' | 'reputacao'>): number[] {
  const t = tipoComp === 10 ? 2 : tipoComp
  const cont = Math.min(mandante.continente, 1)
  if (t === 1 || t === 5 || t === 7) return PRECOS[1]![mandante.divisao]!
  if (t === 2 || t === 3) return PRECOS[t]![mandante.reputacao]!
  if (t === 4 || t === 6 || t === 8) return PRECOS[t]![cont]!
  return [10, 25, 35, 50]
}

const DEMANDA = [[200, 500, 50, 0], [1000, 5000, 1200, 20], [2000, 10000, 1500, 50], [4000, 20000, 2500, 300], [4500, 30000, 3500, 400], [5000, 40000, 5500, 500]]
const RUIDO = [[10, 20, 5, 0], [100, 500, 200, 10], [300, 1000, 400, 20], [400, 1200, 500, 30], [500, 1500, 1000, 50]]

/**
 * Público por setor e renda, calculados antes da partida. A renda só é creditada a mandante
 * humano e nunca em comp 5/7 (I.hf, I.java:383) — isso fica com a economia (W3).
 * `satisfacao` = satisfação da torcida (al.og, começa em 85; 80 se não há técnico).
 * Fonte: best/v_0.java:90-233
 */
export function publico(mandante: TimeM, visitante: Pick<TimeM, 'reputacao'>, ctx: ContextoPartida, rng: Rng, satisfacao = 85): { setores: number[]; renda: number } {
  const tipo = ctx.tipoComp
  const cap = mandante.estadio.setores
  const padrao = precoPadrao(tipo, mandante)
  let dem = [...DEMANDA[mandante.reputacao]!]
  if (tipo === 3 || tipo === 10) dem = dem.map((x) => Math.round(x * 0.7))
  if (tipo === 0) dem = dem.map((x) => Math.round(x * 0.4))
  let b = 0.3
  if (ctx.mataMata) b += 0.15
  if (tipo === 4 || tipo === 7 || tipo === 9) b += 0.3
  else if (tipo === 6 || tipo === 8 || tipo === 11) b += 0.15
  dem = dem.map((x, k) => x + Math.round(cap[k]! * b))
  const dif = visitante.reputacao - mandante.reputacao
  const pct = [0, 0.05, 0.1, 0.15, 0.2, 0.25][Math.abs(dif)]!
  dem = dem.map((x) => x + Math.sign(dif) * Math.round(x * pct))
  dem = dem.map((x) => Math.round((x * satisfacao) / 100))
  dem = dem.map((x, k) => {
    const n = RUIDO[mandante.divisao]![k]!
    return n > 0 ? x + rng.int(n) : x
  })
  let precos = padrao
  if (!mandante.estadio.precoAuto && mandante.estadio.precos) {
    precos = mandante.estadio.precos
    dem = dem.map((x, k) => x + Math.round(0.03 * x) * (padrao[k]! - precos[k]!))
  }
  dem = dem.map((x, k) => Math.min(Math.max(x, 0), cap[k]!))
  let renda = dem.reduce((s, x, k) => s + x * precos[k]!, 0)
  // ponytail: Copa do Mundo (×5) depende do subtipo da competição; entra com as seleções (Fase 6)
  if (tipo === 7) renda *= 3
  else if (tipo === 9) renda *= 2
  return { setores: dem, renda }
}
