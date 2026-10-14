// Motor de partida: estado serializável + simulação minuto a minuto, segmentada por tempo.
// Fonte principal: c/b.java (tick, posse, ataque, chute, gol) e best/I.java (orquestração).
import { escolherParaSlot, foraDePosicao, type Escalacao } from './escalacao.ts'
import type { Habilidades, Mundo, Tatica } from './mundo.ts'
import type { Rng } from './rng.ts'

export interface ContextoPartida {
  /** chave da competição (suspensões) */
  competicao: string
  /** tipo do original: 0 amistoso, 1 liga, 2 copa, 3 estadual, 4 continental… (aq.tz) */
  tipoComp: number
  /** a.SR.H(): nº da temporada */
  temporada: number
  /** campo neutro; padrão: Mundial (5) e seleções (7). Fonte: I.java:1484 (hX) */
  neutro?: boolean
  /** final em sede rotativa (mF): cidade e o clube dono do estádio; o mando não muda. Fonte: best/I.java:187-197 */
  sede?: { cidade: string; time: number }
  /** jogo eliminatório que pode ir para os pênaltis */
  mataMata?: {
    /** gols da ida [do mandante de hoje, do visitante de hoje]; ausente = jogo único */
    ida?: [number, number]
    golFora: boolean
    /** falso = empate não vai para os pênaltis (f/z.zA, fase 2129) */
    penaltis: boolean
  }
}

export interface EstatJogador {
  gols: number
  assistencias: number
  /** chutes no alvo que não viraram gol (s_0.tK) */
  noAlvo: number
  golsContra: number
  amarelos: number
  vermelhos: number
  penaltisPerdidos: number
  penaltisDefendidos: number
}

export interface JogadorPartida {
  id: number
  /** 0 mandante, 1 visitante */
  equipe: 0 | 1
  nome: string
  posicao: number
  lado: number
  ex: number
  cr1: number
  cr2: number
  idade: number
  estrela: boolean
  craque: boolean
  forca: number
  energia: number
  habilidades: Habilidades | null
  slot: number
  /** amarelos nesta partida (F.gi) */
  amarelos: number
  /** dias de lesão sofrida nesta partida (0 = nenhuma) */
  lesao: number
  e: EstatJogador
}

export interface LadoPartida {
  time: number
  reputacao: number
  pais: number
  continente: number
  humano: boolean
  tatica: Tatica
  batedores: { falta: number | null; escanteio: number | null }
  /** ordem importa: o original percorre ArrayLists na ordem de inserção */
  emCampo: number[]
  banco: number[]
  titulares: number[]
  entraram: number[]
  subs: number
  /** minutos de substituição da IA (I.gn, I.gm; -1 = vazio, I.java:113-114) */
  minTatica: [number, number, number]
  minCansaco: [number, number, number, number]
  posse: number
  chutes: number
  noAlvo: number
  fora: number
  desarmes: number
  passesErrados: number
}

/** 1 gol, 2 amarelo, 3 2º amarelo, 4 vermelho, 5 lesão, 6 substituição, 7 pênalti perdido, 8 assistência */
export type TipoEvento = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
/** subtipo do gol: 1 normal, 2 contra, 3 pênalti, 4 falta, 5 olímpico */
export type TipoGol = 1 | 2 | 3 | 4 | 5

export interface Evento {
  tipo: TipoEvento
  tempo: 1 | 2
  minuto: number
  /** lado do time a que o evento pertence (no gol contra: quem marcou o ponto) */
  lado: 0 | 1
  jogador: number | null
  /** assistente, quem entrou (6) ou o goleiro que defendeu (7) */
  jogador2?: number
  subtipo?: TipoGol
  /** dias de lesão (5) */
  dias?: number
}

export interface Cobranca {
  lado: 0 | 1
  jogador: number
  gol: boolean
}

export interface Partida {
  ctx: ContextoPartida
  lados: [LadoPartida, LadoPartida]
  jogadores: Record<number, JogadorPartida>
  placar: [number, number]
  /** lado que "tenta" no próximo tick (c.b.TB) */
  vez: 0 | 1
  /** acréscimos de cada tempo (I.fQ) */
  acrescimos: [number, number]
  /** último tempo simulado */
  tempo: 0 | 1 | 2
  /** contadores da partida, dos dois times (I.fS/fT/fU) */
  incidentes: { amarelos: number; vermelhos: number; lesoes: number }
  eventos: Evento[]
  /** disputa de pênaltis, se houve */
  penaltis: { placar: [number, number]; vencedor: 0 | 1; cobrancas: Cobranca[] } | null
}

const outro = (l: 0 | 1): 0 | 1 => (l === 0 ? 1 : 0)
const neutro = (p: Partida) => p.ctx.neutro ?? (p.ctx.tipoComp === 5 || p.ctx.tipoComp === 7)
const temCr = (j: JogadorPartida, c: number) => j.cr1 === c || j.cr2 === c
const algumHumano = (p: Partida) => p.lados[0].humano || p.lados[1].humano
export const emCampo = (p: Partida, l: 0 | 1) => p.lados[l].emCampo.map((id) => p.jogadores[id]!)

export function iniciarPartida(mundo: Mundo, times: [number, number], escalacoes: [Escalacao, Escalacao], ctx: ContextoPartida, rng: Rng): Partida {
  const jogadores: Record<number, JogadorPartida> = {}
  const add = (id: number, slot: number, equipe: 0 | 1) => {
    const j = mundo.jogadores[id]!
    jogadores[id] = {
      id,
      equipe,
      nome: j.nome,
      posicao: j.posicao,
      lado: j.lado,
      ex: j.ex,
      cr1: j.cr1,
      cr2: j.cr2,
      idade: j.idade,
      estrela: j.estrela,
      craque: j.craque,
      forca: j.forca,
      energia: j.energia,
      habilidades: j.habilidades,
      slot,
      amarelos: 0,
      lesao: 0,
      e: { gols: 0, assistencias: 0, noAlvo: 0, golsContra: 0, amarelos: 0, vermelhos: 0, penaltisPerdidos: 0, penaltisDefendidos: 0 },
    }
    return id
  }
  const lado = (i: 0 | 1): LadoPartida => {
    const t = mundo.times[times[i]]!
    const esc = escalacoes[i]
    const titulares = esc.titulares.map(({ id, slot }) => add(id, slot, i))
    return {
      time: t.id,
      reputacao: t.reputacao,
      pais: t.pais,
      continente: t.continente,
      humano: t.humano,
      tatica: { ...esc.tatica },
      batedores: { ...t.batedores },
      emCampo: [...titulares],
      banco: esc.banco.map((id) => add(id, -1, i)),
      titulares,
      entraram: [],
      subs: 5,
      minTatica: [-1, -1, -1],
      minCansaco: [-1, -1, -1, -1],
      posse: 0,
      chutes: 0,
      noAlvo: 0,
      fora: 0,
      desarmes: 0,
      passesErrados: 0,
    }
  }
  const p: Partida = {
    ctx,
    lados: [lado(0), lado(1)],
    jogadores,
    placar: [0, 0],
    vez: rng.bool() ? 0 : 1, // c/b.java:77 (vN)
    acrescimos: [rng.int(3), rng.int(5) + 1], // I.java:1064
    tempo: 0,
    incidentes: { amarelos: 0, vermelhos: 0, lesoes: 0 },
    eventos: [],
    penaltis: null,
  }
  sortearMinutosSub(p, rng)
  return p
}

/** Minutos das substituições da IA. Fonte: best/I.java:208-292 (hb) */
function sortearMinutosSub(p: Partida, rng: Rng): void {
  const faixa = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
  const [m, v] = p.lados
  const gs = rng.shuffle(faixa(19, 38))
  const r = rng.int(100)
  m.minTatica[0] = gs[0]!
  m.minTatica[1] = gs[1]!
  v.minTatica[0] = gs[2]!
  v.minTatica[1] = gs[3]!
  if (rng.int(100) > 30) m.minTatica[2] = gs[4]!
  if (rng.int(100) > 30) v.minTatica[2] = gs[5]!
  const pool = rng.shuffle(r > 90 ? faixa(5, 15) : r > 50 ? faixa(16, 35) : faixa(36, 42))
  m.minCansaco[0] = pool[0]!
  m.minCansaco[1] = pool[1]!
  v.minCansaco[0] = pool[2]!
  v.minCansaco[1] = pool[3]!
  const gw = rng.shuffle(faixa(43, 47))
  if (rng.int(100) > 20) m.minCansaco[2] = gw[0]!
  if (rng.int(100) > 50) m.minCansaco[3] = gw[1]!
  if (rng.int(100) > 20) v.minCansaco[2] = gw[2]!
  if (rng.int(100) > 50) v.minCansaco[3] = gw[3]!
}

// ── Valor do jogador e setores ────────────────────────────────────────────

const PESOS_HAB: [number[], Partial<Record<keyof Habilidades, number>>][] = [
  [[1], { gol: 0.6, tec: 0.15, vel: 0.15, pas: 0.1 }],
  [[3, 4, 5, 6, 7, 8], { des: 0.5, tec: 0.1, vel: 0.25, pas: 0.1, arm: 0.05 }],
  [[2, 9], { des: 0.4, vel: 0.1, tec: 0.1, pas: 0.3, arm: 0.05, fin: 0.05 }],
  [[11, 12, 13], { des: 0.4, vel: 0.15, tec: 0.1, pas: 0.2, arm: 0.1, fin: 0.05 }],
  [[14, 15, 16], { des: 0.05, vel: 0.1, tec: 0.1, pas: 0.25, arm: 0.4, fin: 0.1 }],
  [[10, 17], { des: 0.05, vel: 0.25, tec: 0.15, pas: 0.25, arm: 0.2, fin: 0.1 }],
  [[19, 20, 21, 22, 23, 24], { vel: 0.25, tec: 0.25, pas: 0.05, arm: 0.05, fin: 0.4 }],
  [[18, 25], { vel: 0.25, tec: 0.15, pas: 0.15, arm: 0.05, fin: 0.4 }],
]

/** B(): valor do jogador no jogo. Fonte: c/b.java:284-395 */
export function valorJogo(p: Partida, j: JogadorPartida): number {
  let n = j.forca
  if (j.habilidades) {
    n = 0
    const pesos = PESOS_HAB.find(([slots]) => slots.includes(j.slot))?.[1] ?? {}
    for (const [k, w] of Object.entries(pesos)) n += Math.round(j.habilidades[k as keyof Habilidades] * w)
  }
  if (foraDePosicao(j.posicao, j.slot)) n = Math.round(n * 0.5)
  if (n <= 0) n = 1
  const tipo = p.ctx.tipoComp
  const clube = p.lados[j.equipe]
  const [m, v] = p.lados
  const r = Math.round
  if (tipo === 7) {
    // ponytail: em seleções o "clube" do original é o clube do jogador; aqui é o lado (seleções: Fase 6)
    const ref = clube.pais === m.pais ? m : clube.pais === v.pais ? v : null
    if (ref) n = ref.reputacao < 3 ? r(n * 0.65) : ref.reputacao === 3 ? r(n * 0.85) : ref.reputacao === 4 ? r(n * 0.95) : n
  }
  if (tipo === 4) n = clube.reputacao < 3 ? r(n * 0.75) : clube.reputacao === 3 ? r(n * 0.85) : clube.pais === 29 ? r(n * 0.9) : n
  if (tipo === 5) n = clube.reputacao < 3 ? r(n * 0.55) : clube.reputacao === 3 ? r(n * 0.75) : clube.continente !== 0 ? r(n * 0.9) : n
  if (tipo === 1) n = clube.reputacao < 3 ? r(n * 0.85) : clube.reputacao === 3 ? r(n * 0.95) : n
  if ((tipo === 3 || tipo === 2) && m.reputacao < 3 && v.reputacao >= 3 && clube === v) n = r(n * 0.8)
  return n / 10
}

function somaSlots(p: Partida, l: 0 | 1, de: number, ate: number, max: number): [number, number] {
  let soma = 0, n = 0
  for (const j of emCampo(p, l)) {
    if (n < max && j.slot >= de && j.slot <= ate) {
      soma += valorJogo(p, j)
      n++
    }
  }
  return [soma, n]
}

/** Fonte: c/b.java:173-197 (ez) */
export function meio(p: Partida, l: 0 | 1): number {
  const [soma, n] = somaSlots(p, l, 10, 17, 5)
  return n < 3 ? 0.01 : ([0, 0.04, 0.08][Math.min(p.lados[l].tatica.marcacao, 2)]! + soma) / 5
}

/** Fonte: c/b.java:199-218 (eA) */
export function ataque(p: Partida, l: 0 | 1): number {
  const [soma, n] = somaSlots(p, l, 19, 25, 3)
  return n < 1 ? 0 : soma / 3
}

/** Fonte: c/b.java:263-282 (eE) */
export function defesa(p: Partida, l: 0 | 1): number {
  const [soma, n] = somaSlots(p, l, 2, 9, 5)
  return n < 3 ? 0.01 : soma / 5
}

/** Fonte: c/b.java:220-238 (eB) */
export function goleiro(p: Partida, l: 0 | 1): number {
  const g = emCampo(p, l).find((j) => j.slot === 1)
  if (!g) return 0.1
  const v = valorJogo(p, g)
  return foraDePosicao(g.posicao, g.slot) ? Math.round(v * 0.2) : v
}

/** Fonte: c/b.java:249-261 (eD) */
const zagueiros = (p: Partida, l: 0 | 1) => emCampo(p, l).filter((j) => j.slot >= 3 && j.slot <= 8).length

/** Fonte: c/b.java:492-512 (a, b): k = 8, ou 11/10 da 5ª temporada em diante */
const difA = (p: Partida, x: number, y: number) => (x - y) / (p.ctx.temporada >= 5 ? 11 : 8)
const difB = (p: Partida, x: number, y: number) => (x - y) / (p.ctx.temporada >= 5 ? 10 : 8)

// ── Tick ──────────────────────────────────────────────────────────────────

/** Fonte: c/b.java:407-447 (vR). Devolve o lado que fica com a bola. */
function disputaPosse(p: Partida, rng: Rng): 0 | 1 {
  const tb = p.vez, ot = outro(tb)
  const [mA, mB] = [meio(p, tb), meio(p, ot)]
  let d2 = 1 + difA(p, mA, mB)
  let d3 = 1 + difA(p, mB, mA)
  if (!neutro(p) && tb === 0) d2 += 0.3
  if (d2 < 0.2) d2 = 0.2
  if (d3 < 0.2) d3 = 0.2
  const venceu = rng.ponderado([55, 45], [d2, d3]) === 0 ? tb : ot
  p.lados[venceu].posse++
  return venceu
}

/** Fonte: c/b.java:449-490 (vS). true = o ataque chega à finalização. */
function avanca(p: Partida, rng: Rng): boolean {
  const tb = p.vez, ot = outro(tb)
  const d2 = defesa(p, ot)
  const d3 = ataque(p, tb)
  let d4 = 1 + difA(p, d3, d2)
  let d5 = 1 + difA(p, d2, d3)
  if (d2 === 0) d5 = 0.1
  if (!neutro(p) && tb === 0) d4 += 0.3
  if (d3 === 0) d4 = 0.1
  if (d4 < 0.2) d4 = 0.2
  if (d5 < 0.2) d5 = 0.2
  if (algumHumano(p)) {
    const z = zagueiros(p, ot)
    if (z === 0) d5 = 0.1
    else if (z === 1) d5 = 0.05
  }
  return rng.ponderado([50, 50], [d4, d5]) === 0
}

/** Peso de chute por slot: zagueiro 1, ala 8, volante 4, meia 8, atacante 22. Fonte: c/b.java:45 (Tx) */
const PESO_CHUTE = [-1, -1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 4, 4, 4, 8, 8, 8, 8, 22, 22, 22, 22, 22, 22, 22, 22]
/** Fonte: c/b.java:46 (Ty) */
const PESO_ASSIST = [1, 1, 10, 2, 2, 2, 2, 2, 2, 10, 10, 4, 4, 4, 20, 20, 20, 10, 10, 10, 10, 10, 10, 10, 10, 10]
/** Fonte: c/b.java:47 (Tz) */
const PESO_CONTRA = [-1, 1, 5, 18, 18, 18, 18, 18, 18, 5, 1, 5, 5, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

/** Sorteio por peso com `r <= acumulado` (variante de vU/C/vV). */
function sortearPor<T>(itens: T[], peso: (x: T) => number, rng: Rng, pesoAcum = peso): T | null {
  let total = 0
  for (const x of itens) total += peso(x)
  const r = rng.float() * total
  let acc = 0
  for (const x of itens) if (r <= (acc += pesoAcum(x))) return x
  return null
}

/** Fonte: c/b.java:632-684 (vU) */
function escolherChutador(p: Partida, l: 0 | 1, rng: Rng): JogadorPartida | null {
  const lista = emCampo(p, l)
  const peso = (j: JogadorPartida) => {
    if (j.slot === 1 || j.posicao === 0 || j.slot <= 0 || j.slot > 25) return 0
    let w = PESO_CHUTE[j.slot]!
    if (temCr(j, 9)) w += 4
    else if (temCr(j, 5)) w += j.posicao === 2 ? 4 : 2
    return w
  }
  // sem candidato: o último da lista, exceto o primeiro (c/b.java:673-682)
  return sortearPor(lista, peso, rng) ?? (lista.length > 1 ? lista[lista.length - 1]! : null)
}

/**
 * Fonte: c/b.java:686-780 (C). Velocidade soma +1 no total e +2 no acumulado, como no original.
 */
function escolherAssistente(p: Partida, l: 0 | 1, autor: JogadorPartida | null, rng: Rng): JogadorPartida | null {
  if (rng.int(100) > 80) return null
  const marcacao = p.lados[l].tatica.marcacao
  const peso = (vel: number) => (j: JogadorPartida) => {
    if (j === autor || j.slot <= 0 || j.slot > 25) return 0
    let w = PESO_ASSIST[j.slot]!
    if (temCr(j, 11)) w += temCr(j, 4) ? 15 : 10
    else if (temCr(j, 4)) w += j.cr1 === 8 ? 4 : 2
    else if (temCr(j, 8)) w += j.cr1 === 13 ? 4 : 2
    else if (temCr(j, 13)) w += vel + (j.posicao === 1 ? 2 : 0)
    else if (temCr(j, 6)) w += j.posicao === 1 ? 7 : 5
    if (marcacao === 1 && j.posicao === 1) w += 20
    return w
  }
  return sortearPor(emCampo(p, l), peso(1), rng, peso(2))
}

/** Defensor que faz gol contra. Fonte: c/b.java:782-807 (vV) */
function escolherAutorContra(p: Partida, defensor: 0 | 1, rng: Rng): JogadorPartida | null {
  return sortearPor(emCampo(p, defensor), (j) => (j.slot >= 0 && j.slot <= 25 ? PESO_CONTRA[j.slot]! : 0), rng)
}

/** Pesos {gol, defesa, fora} por gols já marcados. Fonte: c/b.java:71-74 */
const PESOS_CHUTE: [number, number, number][] = [[5.5, 35.55, 15], [4.5, 40.55, 15], [3, 40.55, 15], [0.5, 40.55, 15]]

/** Fonte: c/b.java:520-588 (vT) */
function chute(p: Partida, tempo: 1 | 2, minuto: number, rng: Rng): void {
  const tb = p.vez, ot = outro(tb)
  const d2 = defesa(p, ot)
  const d3 = ataque(p, tb)
  const chutador = escolherChutador(p, tb, rng)
  const d4 = chutador ? valorJogo(p, chutador) : 0.1
  const d5 = goleiro(p, ot)
  let d6 = 1 + difB(p, d5, d4)
  let d7 = 1 + difB(p, d2, d3)
  if (algumHumano(p)) {
    const z = zagueiros(p, ot)
    if (z === 0) d6 = Math.round(d6 * 0.2)
    else if (z === 1) d6 = Math.round(d6 * 0.4)
  }
  if (!neutro(p)) {
    // bug do original mantido: d7 é sobrescrito a partir de d6
    if (tb === 0) d7 = (d6 += 0.1) + 0.1
    else d7 = (d6 -= 0.1) - 0.1
  }
  const gols = p.placar[tb]
  let pesos = PESOS_CHUTE[gols >= 6 ? 3 : gols >= 5 ? 2 : gols >= 3 ? 1 : 0]!
  if (gols >= 2 && p.lados[ot].reputacao - p.lados[tb].reputacao >= 2) pesos = PESOS_CHUTE[2]! // anti-goleada
  if (d6 < 0.2) d6 = 0.2
  if (d7 < 0.2) d7 = 0.2
  const r = rng.ponderado(pesos, [1, d6, d7])
  p.lados[tb].chutes++
  if (r === 0) {
    p.lados[tb].noAlvo++
    gol(p, tempo, minuto, chutador, rng)
  } else if (r === 1) {
    p.lados[tb].noAlvo++
    if (chutador) chutador.e.noAlvo++
  } else p.lados[tb].fora++
}

/** Pênalti com humano: 70% ± modificadores. Fonte: a/gb.java:98-184 */
function cobrarPenalti(p: Partida, l: 0 | 1, batedor: JogadorPartida, rng: Rng): { gol: boolean; goleiro: JogadorPartida | null; defendeu: boolean } {
  const gk = emCampo(p, outro(l)).find((j) => j.slot === 1) ?? null
  let chance = 70
  if (temCr(batedor, 9) || batedor.craque) chance += 10
  if (batedor.estrela) chance += 5
  if (gk) {
    if (temCr(gk, 1)) chance -= 10
    if (gk.craque) chance -= 10
    if (gk.estrela) chance -= 5
  }
  if (rng.int(100) + 1 <= chance) return { gol: true, goleiro: gk, defendeu: false }
  const n = rng.int(7) // narração: 2/6 fora, 0/3/5 defesa do goleiro
  return { gol: false, goleiro: gk, defendeu: n === 0 || n === 3 || n === 5 }
}

/**
 * Gol: tipo, autor, assistência. Fonte: c/b.java:833-907.
 * Correção do port: a estatística de gol vai uma vez para quem consta no evento
 * (o original somava 2× e creditava o chutador mesmo no gol contra/olímpico).
 */
function gol(p: Partida, tempo: 1 | 2, minuto: number, chutador: JogadorPartida | null, rng: Rng): void {
  const tb = p.vez
  const n = rng.int(1000)
  let tipo: TipoGol = n < 900 ? 1 : n < 950 ? 3 : n < 980 ? 4 : n < 990 ? 2 : n < 995 ? 5 : 1
  const autor = chutador ?? escolherChutador(p, tb, rng)
  let marcador = autor
  let assistente: JogadorPartida | null = null
  if (tipo === 1) assistente = escolherAssistente(p, tb, autor, rng)
  const naLista = (id: number | null) => (id !== null && p.lados[tb].emCampo.includes(id) ? p.jogadores[id]! : null)
  if (autor && tipo === 5) {
    const esc = naLista(p.lados[tb].batedores.escanteio)
    if (esc) marcador = esc
    else if (autor.posicao === 0) tipo = 1
  }
  if (tipo === 2) {
    const contra = escolherAutorContra(p, outro(tb), rng)
    if (contra) marcador = contra
    else tipo = 1
  }
  if (tipo === 3 || tipo === 4) marcador = naLista(p.lados[tb].batedores.falta) ?? marcador
  if (assistente && assistente === marcador) assistente = null

  if (tipo === 3 && algumHumano(p) && marcador) {
    const c = cobrarPenalti(p, tb, marcador, rng)
    if (!c.gol) {
      marcador.e.penaltisPerdidos++
      if (c.defendeu && c.goleiro) c.goleiro.e.penaltisDefendidos++
      p.eventos.push({ tipo: 7, tempo, minuto, lado: tb, jogador: marcador.id, subtipo: 3, ...(c.defendeu && c.goleiro ? { jogador2: c.goleiro.id } : {}) })
      return
    }
  }
  p.placar[tb]++
  if (marcador) {
    if (tipo === 2) marcador.e.golsContra++
    else marcador.e.gols++
  }
  p.eventos.push({ tipo: 1, tempo, minuto, lado: tb, jogador: marcador?.id ?? null, subtipo: tipo, ...(assistente ? { jogador2: assistente.id } : {}) })
  if (assistente) {
    assistente.e.assistencias++
    p.eventos.push({ tipo: 8, tempo, minuto, lado: tb, jogador: assistente.id })
  }
}

/** Um minuto de jogo. Fonte: c/b.java:126-156 (vO) */
export function tick(p: Partida, tempo: 1 | 2, minuto: number, rng: Rng): void {
  const tb = p.vez
  if (disputaPosse(p, rng) === tb) {
    if (avanca(p, rng)) chute(p, tempo, minuto, rng)
    else if (rng.int(100) < 50) p.lados[outro(tb)].desarmes++
    else p.lados[tb].passesErrados++
  } else if (rng.int(100) < 50) p.lados[outro(tb)].desarmes++
  else p.lados[tb].passesErrados++
  p.vez = outro(tb)
}

/** Simula um tempo inteiro. Fonte: best/I.java:1036-1123 (V) */
export function simularTempo(p: Partida, tempo: 1 | 2, rng: Rng): Partida {
  if (p.tempo !== tempo - 1) throw new Error(`tempo ${tempo} fora de ordem (último: ${p.tempo})`)
  if (tempo === 2) { if (algumHumano(p)) intervaloIA(p, rng); subsIA(p, 0, rng) } // intervalo: m(2, 0)
  for (let minuto = 0; minuto < 45 + p.acrescimos[tempo - 1]!; minuto++) {
    incidentes(p, tempo, minuto, rng)
    tick(p, tempo, minuto, rng)
  }
  p.tempo = tempo
  if (tempo === 2 && p.ctx.mataMata?.penaltis && confrontoEmpatado(p)) disputaPenaltis(p, rng)
  return p
}

// ── Cartões, lesões, energia ───────────────────────────────────────────────

/** Perda por idade a cada 7 minutos. Fonte: best/F.java:349-361 (fq), :334 (aj) */
function drenarEnergia(p: Partida, tempo: 1 | 2): void {
  for (const l of [0, 1] as const)
    for (const j of emCampo(p, l)) {
      if (j.slot === 1 && tempo === 1) continue
      j.energia -= j.idade <= 20 ? 1 : j.idade <= 25 ? 2 : j.idade <= 31 ? 3 : j.idade <= 36 ? 4 : 5
      if (j.energia < 0) j.energia = 1
    }
}

/** Faixas de slot das vítimas. Fonte: best/aq.java:843 (sS) */
const FAIXAS_VITIMA: [number, number][] = [[10, 13], [14, 17], [3, 8], [2, 3], [8, 9], [19, 24], [1, 1]]

/** Sorteio uniforme entre quem está numa faixa de slots. Fonte: best/I.java:956-970 */
function sortearNaFaixa(lista: JogadorPartida[], [de, ate]: [number, number], rng: Rng): JogadorPartida | null {
  const c = lista.filter((j) => j.slot >= de && j.slot <= ate)
  return c.length ? c[rng.int(c.length)]! : null
}

const vitimaAmarelo = (r: number) => (r < 25 ? 0 : r < 40 ? 1 : r < 65 ? 2 : r < 73 ? 3 : r < 82 ? 4 : r < 85 ? 6 : 5) // I.java:938 (H), rand(100)
const vitimaVermelho = (r: number) => (r === 0 ? 6 : r < 80 ? 0 : r < 110 ? 1 : r < 160 ? 2 : r < 170 ? 3 : r < 190 ? 4 : 5) // I.java:972 (J), rand(200)
const vitimaLesao = (r: number) => (r === 0 ? 6 : r < 150 ? 0 : r < 250 ? 1 : r < 320 ? 2 : r < 360 ? 3 : r < 420 ? 4 : 5) // I.java:947 (I), rand(500)

/** Cartões, lesão, energia e substituições da IA no minuto. Fonte: best/I.java:517-596 */
function incidentes(p: Partida, tempo: 1 | 2, minuto: number, rng: Rng): void {
  const l: 0 | 1 = rng.int(100) > 55 ? 0 : 1 // mandante punido em 44%
  const lista = emCampo(p, l)
  const marc = [30, 10, 0][p.lados[l].tatica.marcacao] ?? 30
  const f = minuto < 15 ? 0 : minuto < 30 ? 1 : 2
  if (minuto % 7 === 0) drenarEnergia(p, tempo)
  let Y = (tempo === 1 ? [70, 40, 30] : [45, 40, 30])[f]! + marc
  const R = (tempo === 1 ? [1200, 900, 800] : [800, 700, 550])[f]!
  const J = (tempo === 1 ? [1500, 1000, 800] : [800, 600, 600])[f]!
  const c = p.incidentes
  if (c.amarelos > 5) Y *= 2 // o ramo "> 10 → 1000" do original nunca roda
  if (c.vermelhos >= 2) Y = R * 2
  if (c.lesoes >= 1) Y = J * 5
  if (rng.int(Y) === 1) {
    const v = sortearNaFaixa(lista, FAIXAS_VITIMA[vitimaAmarelo(rng.int(100))]!, rng)
    c.amarelos++
    if (v) registrar(p, ++v.amarelos === 2 ? 3 : 2, l, v, tempo, minuto, rng)
  } else if (rng.int(R) === 1) {
    const v = sortearNaFaixa(lista, FAIXAS_VITIMA[vitimaVermelho(rng.int(200))]!, rng)
    if (v) registrar(p, 4, l, v, tempo, minuto, rng)
    c.vermelhos++
  } else if (rng.int(J) === 1) {
    c.lesoes++
    const v = sortearNaFaixa(lista, FAIXAS_VITIMA[vitimaLesao(rng.int(500))]!, rng)
    if (v) registrar(p, 5, l, v, tempo, minuto, rng)
  } else if (tempo === 2 && minuto >= 5 && !algumHumano(p)) subsIA(p, minuto, rng)
}

/** Dias de lesão; ≥35 anos perde 5 de força. Fonte: best/F.java:2116-2162 (p) */
export function duracaoLesao(j: Pick<JogadorPartida, 'idade' | 'energia' | 'forca'>, rng: Rng): number {
  const a = rng.int(14)
  const b = 5 + rng.int(20)
  const e = j.energia < 10 ? 5 : j.energia < 50 ? 1 : 0
  const i = j.idade
  let dias = i <= 20 ? a : i <= 25 ? e + a + 1 : i <= 30 ? e + a + 2 : i <= 35 ? e + a + 3 : i <= 45 ? e + a + b : e + a + 10 + b
  if (i >= 35 && (j.forca -= 5) < 0) j.forca = 1
  const r = rng.int(100)
  dias += r === 1 ? 70 : r < 4 ? 40 : r < 10 ? 20 : 0
  return dias
}

/** Evento de cartão/lesão e reposição da IA. Fonte: best/I.java:646-707 */
function registrar(p: Partida, tipo: 2 | 3 | 4 | 5, l: 0 | 1, j: JogadorPartida, tempo: 1 | 2, minuto: number, rng: Rng): void {
  const ev: Evento = { tipo, tempo, minuto, lado: l, jogador: j.id }
  p.eventos.push(ev)
  if (tipo === 2 || tipo === 3) j.e.amarelos++
  if (tipo === 4 || tipo === 3) j.e.vermelhos++
  const lado = p.lados[l]
  if (tipo === 3 || tipo === 4) {
    remover(lado.emCampo, j.id)
    if (j.slot <= 13 && lado.subs > 0 && !algumHumano(p)) repor(p, l, j, true, false, tempo, minuto, rng)
  } else if (tipo === 5) {
    ev.dias = j.lesao = duracaoLesao(j, rng)
    // Partida com humano (regra do port, igual para os dois lados): lesão no 1º tempo segue em campo até o intervalo, onde
    // o humano escolhe a troca (a IA troca no `intervaloIA`); no 2º tempo não há mais pausa, então o médico tira na hora
    // e entra o melhor do banco para a posição. Sem substituição sobrando, ele termina o jogo.
    if (!algumHumano(p)) {
      remover(lado.emCampo, j.id)
      if (lado.subs > 0) repor(p, l, j, false, true, tempo, minuto, rng)
    } else if (tempo === 2 && lado.subs > 0) repor(p, l, j, false, true, tempo, minuto, rng)
  }
}

function remover(lista: number[], id: number): void {
  const i = lista.indexOf(id)
  if (i >= 0) lista.splice(i, 1)
}

/**
 * Reposição pelo banco. Expulsão: sai um atacante (ou meia; ou qualquer um se o expulso era o goleiro)
 * e quem entra ocupa o slot do expulso. Fonte: best/I.java:709-750
 */
function repor(p: Partida, l: 0 | 1, j: JogadorPartida, expulsao: boolean, lesao: boolean, tempo: 1 | 2, minuto: number, rng: Rng): void {
  const lista = emCampo(p, l)
  const sai = expulsao
    ? (sortearNaFaixa(lista, [18, 25], rng) ?? sortearNaFaixa(lista, [14, 17], rng) ?? (j.slot === 1 ? sortearNaFaixa(lista, [2, 25], rng) : null))
    : j
  if (!sai || j.slot < 0) return
  const entra = escolherParaSlot(p.lados[l].banco.map((id) => p.jogadores[id]!), j.slot)
  if (!entra) return
  if (lesao && sai.posicao !== 0 && entra.posicao === 0) return
  trocar(p, l, sai, entra, j.slot, tempo, minuto)
}

/** Fonte: best/I.java:752-785 */
function trocar(p: Partida, l: 0 | 1, sai: JogadorPartida, entra: JogadorPartida, slot: number, tempo: 1 | 2, minuto: number): void {
  const lado = p.lados[l]
  entra.slot = slot > 0 ? slot : sai.slot
  remover(lado.emCampo, sai.id)
  lado.emCampo.push(entra.id)
  lado.entraram.push(entra.id)
  remover(lado.banco, entra.id)
  lado.subs--
  p.eventos.push({ tipo: 6, tempo, minuto, lado: l, jogador: sai.id, jogador2: entra.id })
}

// ── Substituições da IA ───────────────────────────────────────────────────

/** l perde por pelo menos n gols. Fonte: best/I.java:883 (n) */
const perdendo = (p: Partida, l: 0 | 1, n: number) => p.placar[outro(l)] - p.placar[l] >= n

/** Intervalo da IA contra humano (ver `registrar`): tira os lesionados e até 2 cansados, o que o original faria durante o 2º tempo. */
function intervaloIA(p: Partida, rng: Rng): void {
  for (const l of [0, 1] as const) {
    if (p.lados[l].humano) continue
    for (const j of emCampo(p, l)) if (j.lesao > 0 && p.lados[l].subs > 0) repor(p, l, j, false, true, 2, 0, rng)
    for (let i = 0; i < 2 && p.lados[l].subs > 0; i++) if (!trocaIA(p, l, 'cansaco', 0, rng)) break
  }
}

/** Fonte: best/I.java:808-838 (m). Só no 2º tempo; minuto 0 = intervalo. */
function subsIA(p: Partida, minuto: number, rng: Rng): void {
  const [m, v] = p.lados
  let fez = false
  if (!m.humano && m.subs > 0) {
    if (minuto === 0 && perdendo(p, 0, 1)) {
      if (rng.int(100) > 50) fez = trocaIA(p, 0, 'tatica', minuto, rng)
    } else if (m.minTatica.includes(minuto)) {
      if (perdendo(p, 0, 1) || p.placar[0] === p.placar[1]) fez = trocaIA(p, 0, 'tatica', minuto, rng)
    } else if (m.minCansaco.includes(minuto)) fez = trocaIA(p, 0, 'cansaco', minuto, rng)
  }
  if (!fez && !v.humano && v.subs > 0) {
    if (minuto === 0 && perdendo(p, 1, 2)) {
      if (rng.int(100) > 50) trocaIA(p, 1, 'tatica', minuto, rng)
    } else if (v.minTatica.includes(minuto)) {
      if (perdendo(p, 1, 1)) trocaIA(p, 1, 'tatica', minuto, rng)
    } else if (v.minCansaco.includes(minuto)) trocaIA(p, 1, 'cansaco', minuto, rng)
  }
}

/**
 * Fonte: best/I.java:840-877. Correção do port: a troca tática olha quem já entrou
 * no próprio lado (o original sempre olhava o mandante).
 */
function trocaIA(p: Partida, l: 0 | 1, tipo: 'tatica' | 'cansaco', minuto: number, rng: Rng): boolean {
  const lista = emCampo(p, l)
  if (tipo === 'cansaco') {
    let limiar = 60, inicio = 0
    if (minuto > 40) {
      limiar = 90
      if (lista.length) inicio = rng.int(lista.length)
    }
    for (let i = inicio; i < lista.length; i++) {
      const j = lista[i]!
      if (j.slot !== 1 && j.energia < limiar) {
        repor(p, l, j, false, false, 2, minuto, rng)
        return true
      }
    }
    return false
  }
  if (!lista.length) return false
  const entraram = p.lados[l].entraram
  let j = lista[rng.int(lista.length)]!
  if (entraram.includes(j.id)) j = lista[rng.int(lista.length)]!
  if (j.slot === 1 || entraram.includes(j.id)) return false
  repor(p, l, j, false, false, 2, minuto, rng)
  return true
}

// ── Comandos do técnico humano (intervalo) ─────────────────────────────────

/** Substituição pedida pelo humano; `slot` opcional muda a posição de quem entra. */
export function substituir(p: Partida, l: 0 | 1, saiId: number, entraId: number, slot?: number): void {
  const lado = p.lados[l]
  if (lado.subs <= 0) throw new Error('sem substituições')
  if (!lado.emCampo.includes(saiId)) throw new Error('quem sai não está em campo')
  if (!lado.banco.includes(entraId)) throw new Error('quem entra não está no banco')
  if (slot !== undefined && (slot < 1 || slot > 25 || emCampo(p, l).some((j) => j.slot === slot && j.id !== saiId)))
    throw new Error('slot inválido')
  trocar(p, l, p.jogadores[saiId]!, p.jogadores[entraId]!, slot ?? 0, (p.tempo === 2 ? 2 : p.tempo + 1) as 1 | 2, 0)
}

export function mudarTatica(p: Partida, l: 0 | 1, tatica: Partial<Pick<Tatica, 'marcacao' | 'estilo' | 'jogada'>>): void {
  Object.assign(p.lados[l].tatica, tatica)
}

// ── Pênaltis ──────────────────────────────────────────────────────────────

/** Ainda empatado no confronto (inclui ida e gol fora). Fonte: best/I.java:1125-1180 (hk) */
export function confrontoEmpatado(p: Partida): boolean {
  const mm = p.ctx.mataMata
  if (!mm) return false
  const [g0, g1] = p.placar
  let v0 = 0, v1 = 0
  if (g0 > g1) v0++
  else if (g1 > g0) v1++
  let t0 = g0, t1 = g1
  if (mm.ida) {
    const [i0, i1] = mm.ida
    if (i0 > i1) v0++
    else if (i1 > i0) v1++
    t0 += i0
    t1 += i1
  }
  if (v0 !== v1) return false
  if (t0 !== t1) return false
  if (mm.ida && mm.golFora && mm.ida[0] !== g1) return false
  return true
}

/** Fonte: best/I.java:1107-1119 (só IA) e a/bg_0.java:165-264 (com humano: cobrança a cobrança, 70%) */
function disputaPenaltis(p: Partida, rng: Rng): void {
  if (!algumHumano(p)) {
    const a = rng.int(7) + 2
    const b = rng.int(7) + 2
    p.penaltis = a >= b ? { placar: [a, a - 1], vencedor: 0, cobrancas: [] } : { placar: [a, a + 1], vencedor: 1, cobrancas: [] }
    return
  }
  // ponytail: ordem dos batedores = posição desc, força desc (o comparador abg do original é inconsistente)
  const fila = ([0, 1] as const).map((l) =>
    emCampo(p, l).sort((a, b) => b.posicao - a.posicao || b.forca - a.forca || b.energia - a.energia),
  )
  const gols: [number, number] = [0, 0]
  const batidas: [number, number] = [0, 0]
  const cobrancas: Cobranca[] = []
  for (;;) {
    for (const l of [0, 1] as const) {
      const f = fila[l]!
      const j = f[batidas[l] % Math.max(f.length, 1)]
      const gol = rng.int(100) + 1 <= 70
      batidas[l]++
      if (gol) gols[l]++
      if (j) cobrancas.push({ lado: l, jogador: j.id, gol })
      // melhor de 5 com fim antecipado; depois, morte súbita a cada par
      const [b0, b1] = batidas
      if (b0 <= 5 && b1 <= 5) {
        if (gols[0] > gols[1] + (5 - b1)) return void (p.penaltis = { placar: gols, vencedor: 0, cobrancas })
        if (gols[1] > gols[0] + (5 - b0)) return void (p.penaltis = { placar: gols, vencedor: 1, cobrancas })
      } else if (l === 1 && gols[0] !== gols[1]) return void (p.penaltis = { placar: gols, vencedor: gols[0] > gols[1] ? 0 : 1, cobrancas })
    }
  }
}

/** Posse em % (aq.A). */
export function possePct(p: Partida): [number, number] {
  const t = p.lados[0].posse + p.lados[1].posse
  if (t === 0) return [50, 50]
  const a = Math.round((p.lados[0].posse / t) * 100)
  return [a, 100 - a]
}
