// Carreira: evolução semanal e treino, juniores, envelhecimento e aposentadoria; técnicos (pontos, reputação,
// diretoria e torcida, demissão, ofertas de emprego) e a reputação dos times.
// Fontes: best/F.java:1210-1560 (fV/fW/fX/fY/fZ/ga, b: teto), :1563-1748 (gc/gd/ge: aposentadoria, a: vaga),
// :1750-1898 (gf, a: junior novo), :2945-3100 (h/c/aG: habilidades); best/f_0.java:1979 (aT: semana), :1056 (af: virada);
// best/al.java (técnico: e = pontos, a = satisfação, b/q = títulos, a(n..)/kk = reputação, i/E = sai/entra);
// best/ah.java:831-910 (d/kk: reputação do time), :1584 (p: faixa na tabela), :1618 (kE: substituto);
// best/f_0.java:1732 (n: demissões e ofertas do dia), :2141 (a: técnico livre); f/s.java:1410 (b), :1723 (A);
// best/Z.java:1005 (a: divisões das ofertas); best/ay.java:200 (b), :238 (zw); best/ag.java:50 (jQ); best/m_0.java:217 (nome).
import type { Base } from '@bolasfoot/data'
import { TIPO, datas } from './calendario.ts'
import type { Competicao, FaseLiga, Jogo } from './competicoes.ts'
import { abrirCaixa, salarioJogador, valorJogador } from './economia.ts'
import { promoverJunior } from './mercado.ts'
import { BRA, forcaInicial, habilidadesIniciais, novoTecnico, subperfil, type Habilidades, type JogadorM, type Mundo, type TimeM } from './mundo.ts'
import type { Rng } from './rng.ts'

export interface Campanha {
  temporada: number
  time: number
  jogos: number
  vitorias: number
  derrotas: number
  pontos: number
  titulos: number
}

export interface Tecnico {
  id: number
  nome: string
  /** nacionalidade (al.nZ) */
  pais: number
  humano: boolean
  time: number | null
  /** último time, país e divisão − 1 (al.nX, bf, nY: gravados ao sair) */
  timeAnterior: number | null
  paisAnterior: number
  divisaoAnterior: number
  /** 0..5 (al.nc) e os pontos que a movem (al.nu) */
  reputacao: number
  pontosReputacao: number
  /** pontos de carreira (al.oc): jogos e colocações */
  pontos: number
  /** confiança da diretoria (al.of) e da torcida (al.og), 0..100 */
  diretoria: number
  torcida: number
  /** temporadas completas no clube atual (al.oi) */
  temporadas: number
  jogos: number
  vitorias: number
  derrotas: number
  /** uma por time e temporada (al.ob, best.j) */
  campanhas: Campanha[]
  titulos: { temporada: number; competicao: string; time: number }[]
}

/** Propostas de emprego para um técnico humano (s_0.a(lista, al, 0)). */
export interface Oferta {
  tecnico: number
  dia: number
  times: number[]
}

/** 0 pediu demissão, 1 caixa negativo, 2 torcida, 3 resultados (aq.sg); -1 troca por proposta */
export interface TrocaDeTecnico {
  dia: number
  time: number
  saiu: number | null
  entrou: number
  motivo: number
}

export const MOTIVOS_DEMISSAO = [
  'você solicitou a demissão.',
  'você estava levando o clube para o abismo financeiro.',
  'a pressão da torcida estava grande pelos maus resultados.',
  'seus resultados não agradaram nem a torcida nem a diretoria.',
]

const HABS: (keyof Habilidades)[] = ['gol', 'vel', 'tec', 'pas', 'des', 'arm', 'fin']
/** O técnico do time, se ainda estiver nele (sem substituto, o time fica com um interino). */
const tec = (m: Mundo, t: TimeM) => (m.tecnicos[t.tecnico]?.time === t.id ? m.tecnicos[t.tecnico] : undefined)
const clamp = (v: number) => Math.max(0, Math.min(100, v))

// ── Juniores ──────────────────────────────────────────────────────────────

/** Progresso inicial pela idade e potencial estimado. Fonte: best/F.java:1536 (ga), :1523 (fZ) */
export function iniciarJunior(j: JogadorM, rng: Rng): void {
  let p = ({ 16: 15, 17: 35, 18: 55, 19: 70, 20: 75 } as Record<number, number>)[j.idade] ?? 0
  p += rng.int(5) + 1 + j.potencial
  j.progresso = p < 1 ? 1 : p > 100 ? 95 : p
  const r = rng.int(100) + 1
  j.potencialEstimado = Math.max(1, Math.min(10, r <= 15 ? j.potencial : r <= 60 ? j.potencial - 1 : j.potencial + 1))
}

/** Nome e às vezes sobrenome (ou um 2º nome curto) do arquivo do país. Fonte: best/m_0.java:217 (au) */
export function gerarNome(base: Base, pais: number, rng: Rng): string {
  const lista = base.nomes[base.paises[pais]?.codigo ?? ''] ?? base.nomes.BRA!
  const { nomes, sobrenomes } = lista
  let i = rng.int(nomes.length)
  if (nomes.length >= 1000 && rng.int(2) === 0) i = rng.int(500)
  let nome = nomes[Math.max(i, 1)] ?? nomes[0]!
  const palavras = nome.split(/\s+/).length
  if (palavras === 1 && sobrenomes.length > 2) {
    const s = sobrenomes[Math.max(rng.int(sobrenomes.length), 1)]!
    if (s !== nome) nome += ` ${s}`
  } else if (palavras === 2) {
    const dois = rng.int(2) === 0
    if (nome.length <= 12 && dois && nomes.length > 2) {
      const s = nomes[Math.max(rng.int(nomes.length), 1)]!
      if (s !== nome && s.length <= 6) nome += ` ${s}`
    }
  }
  // ponytail: país sem arquivo de nomes usa a lista geral por continente (F.av); aqui, a do Brasil
  return nome
}

/** Características por posição. Fonte: best/F.java:1900 (at) */
const CARACTERISTICAS = [
  [[0, 3], [0, 1], [2, 0], [1, 2], [3, 1], [0, 2]],
  [[6, 10], [6, 13], [10, 11], [10, 13], [10, 6], [10, 9], [6, 11]],
  [[7, 10], [7, 12], [7, 5], [10, 13], [7, 13], [7, 10], [7, 5], [7, 13], [7, 12], [7, 9], [7, 10], [5, 12]],
  [[4, 11], [4, 9], [9, 11], [11, 9], [4, 8], [4, 13], [7, 10], [7, 11], [7, 5], [7, 13], [10, 13], [10, 11], [9, 4], [10, 12], [4, 11], [8, 11], [7, 9], [11, 13], [7, 11]],
  [[9, 5], [13, 9], [9, 5], [8, 9], [9, 13], [9, 5], [9, 8], [5, 13], [8, 11], [9, 11], [9, 12], [13, 8]],
]

/** Faixas (até 1..100) de cada potencial 1..10, por porte do clube. Fonte: best/F.java:1797-1858 */
const FAIXAS_POTENCIAL = [
  [2, 5, 5, 10, 25, 60, 80, 90, 98, 100], // Nivel ≥ 19 ou reputação > 3 (o "≤ 4 → 3" do original nunca acontece)
  [2, 5, 5, 10, 30, 65, 90, 95, 98, 100], // Nivel ≥ 15
  [4, 8, 15, 25, 50, 75, 95, 98, 99, 100],
]

/**
 * Junior novo no time (ou `reusar`: o mesmo jogador renasce como outro junior). `posicao` -1 = sorteada.
 * Fonte: best/F.java:1779 (a), :538 (fI)
 */
export function gerarJunior(m: Mundo, base: Base, t: TimeM, posicao: number, rng: Rng, reusar?: JogadorM): JogadorM {
  const faixa = FAIXAS_POTENCIAL[t.nivel >= 19 || t.reputacao > 3 ? 0 : t.nivel >= 15 ? 1 : 2]!
  const n4 = rng.int(100) + 1
  let potencial = faixa.findIndex((lim) => n4 <= lim) + 1
  const estrela = n4 === 1
  const idade = rng.int(4) + 16
  const r = rng.int(100) + 1
  const pos = (posicao >= 0 ? posicao : r <= 10 ? 0 : r <= 30 ? 1 : r <= 50 ? 2 : r <= 80 ? 3 : 4) as JogadorM['posicao']
  const opcoes = CARACTERISTICAS[pos]!
  const [cr1, cr2] = opcoes[rng.int(opcoes.length)] as [number, number]
  let pais = t.pais
  if (r === 1 && t.nivel >= 18) {
    const k = rng.int(6)
    if (t.pais === BRA) pais = [11, 43, 195, 150, 84][k] ?? rng.int(200)
    else if ([3, 154, 85, 104, 72].includes(t.pais)) pais = [3, 154, 85, 104, 174, 72][k]!
  }
  if (pais !== t.pais) potencial = rng.int(4) + 7
  const j: JogadorM = reusar ?? ({ id: m.jogadores.length, suspensoes: {} } as JogadorM)
  Object.assign(j, {
    nome: gerarNome(base, pais, rng), pais, idade, posicao: pos, lado: rng.int(2), cr1, cr2, estrela, craque: false, potencial,
    titular: false, time: t.id, juvenil: true, ex: subperfil(pos, cr1, cr2), energia: 100, habilidades: null, suspensoes: {},
    lesaoAte: 0, jogou: false, aVenda: false, preco: 0, paraEmprestimo: false, emprestado: false, timeAnterior: -1, promovidoEm: 0,
    evolucao: 0, evolucaoJunior: 0, evolucaoHab: [0, 0, 0, 0, 0, 0, 0], gols: 0, jogos: 0,
  } satisfies Partial<JogadorM>)
  const { forca, n8, n6 } = forcaInicial(j, t, base.paises[t.pais]?.nivel ?? 10, rng)
  j.forca = forca
  if (m.opcoes.habilidadeIndividual) j.habilidades = habilidadesIniciais(j, n8, n6, rng)
  iniciarJunior(j, rng)
  j.contratoAte = m.dia + rng.int(30) + 210
  j.valor = valorJogador(j, t, m.continentes[pais] ?? -1)
  j.salario = salarioJogador(j, t, m.opcoes.salarioMensal ?? true)
  j.preco = j.valor
  if (!reusar) {
    m.jogadores.push(j)
    t.juniores.push(j.id)
  }
  return j
}

// ── Evolução semanal ──────────────────────────────────────────────────────

/** Teto do país do clube. Fonte: best/F.java:1283-1296 */
function tetoPais(t: TimeM): number {
  const p = t.pais
  switch (t.continente) {
    case 0: return [3, 72, 104, 65, 97].includes(p) ? 95 : p === 154 || p === 85 ? 90 : p === 21 || p === 162 ? 80 : 70
    case 1: return p === 29 || p === 11 ? 90 : p === 195 || p === 46 || p === 42 ? 80 : p === 151 || p === 150 ? 70 : 60
    case 2: return [10, 129, 57].includes(p) ? 75 : [141, 169, 190].includes(p) ? 70 : 60
    case 3: return p === 107 || p === 49 ? 75 : [98, 9, 59, 43].includes(p) ? 70 : 60
    case 4: return p === 131 ? 80 : p === 68 ? 70 : p === 51 ? 65 : 55
    case 5: return p === 143 ? 60 : 45
    default: return 100
  }
}

const TETO_DIVISAO = [[30, 30, 30, 30, 30, 30], [80, 85, 90, 95, 100, 100], [50, 60, 60, 65, 80, 80], [40, 40, 40, 45, 70, 70], [25, 30, 30, 30, 50, 60], [30, 30, 30, 30, 30, 30]]

/**
 * Teto de evolução: pela divisão e reputação (ou só reputação fora das ligas), limitado pelo país; o ex-junior com
 * progresso ≥ 60 ganha mais conforme o potencial. `rep3` = 70 nas habilidades, 65 na força.
 * Fonte: best/F.java:1262 (b), :1416-1446 (fW)
 */
function teto(t: TimeM, j: JogadorM, rep3: number, rng: Rng): number {
  if (t.reputacao < 0 || t.reputacao > 5) t.reputacao = 1
  const r = t.reputacao
  let n = t.ligaNacional ? TETO_DIVISAO[t.divisao]?.[r] ?? 30 : r >= 4 ? 100 : r === 3 ? rep3 : r === 2 ? 40 : r === 1 ? 30 : 20
  n = Math.min(n, tetoPais(t))
  if (j.progresso >= 60) {
    const x = rng.int(5)
    const b = ({ 7: 5, 8: 15, 9: 25, 10: 30 } as Record<number, number>)[j.potencial]
    if (b !== undefined) n += b + x
    n = Math.min(n, 100)
  }
  return n
}

/** Soma ao acumulado de uma habilidade (gol e des valem 1,2×). Fonte: best/F.java:2992 (c) */
function acumularHab(j: JogadorM, d: number, k: number): void {
  j.evolucaoHab[k]! += k === 4 || k === 0 ? d * 1.2 : d
}

/** Distribui pela posição: a principal leva tudo, as secundárias 40% e 30%. Devolve a principal. Fonte: best/F.java:2945 (h) */
function distribuirHab(j: JogadorM, d: number): number {
  const [a, b, c] =
    j.posicao === 0 ? [0, -1, -1] : j.posicao === 1 ? (j.ex === 0 ? [4, 5, 6] : [3, 6, 4]) : j.posicao === 2 ? [4, 3, 5] : j.posicao === 3 ? (j.ex === 0 ? [4, 5, 6] : [5, 6, 4]) : [6, 5, 4]
  acumularHab(j, d, a)
  if (b >= 0) acumularHab(j, d * 0.4, b)
  if (c >= 0) acumularHab(j, d * 0.3, c)
  return a
}

/** Treino focado: a habilidade escolhida para a posição leva o dobro. Fonte: best/F.java:1236 (f) */
function evoluirHab(m: Mundo, j: JogadorM, t: TimeM, d: number, rng: Rng): void {
  const h = j.habilidades!
  const focado = m.semanaTreino === 3 || (t.humano && !t.treino.auxiliar && t.treino.foco === 1)
  if (focado) acumularHab(j, d * 2, t.treino.habilidade[j.posicao]!)
  else distribuirHab(j, d)
  for (let k = 0; k <= 6; k++)
    if (j.evolucaoHab[k]! > 1 && h[HABS[k]!] < teto(t, j, 70, rng) && h[HABS[k]!] < 100) {
      h[HABS[k]!]++
      j.evolucaoHab[k]! -= 1
    }
}

/** Declínio das habilidades: só a principal cai. Fonte: best/F.java:1218 (e) */
function declinarHab(m: Mundo, j: JogadorM, d: number): void {
  const h = j.habilidades!
  let k = 0
  if (m.semanaTreino !== 3) k = distribuirHab(j, d)
  else acumularHab(j, d * 10, 0)
  if (j.evolucaoHab[k]! > 1 && h[HABS[k]!] > 1) {
    h[HABS[k]!]--
    j.evolucaoHab[k]! -= 1
  }
}

/** Ganho semanal até 31 anos. Fonte: best/F.java:1324-1414 (fW) */
function crescer(m: Mundo, j: JogadorM, t: TimeM, rng: Rng): void {
  let n = t.nivel, extra = 0
  if (!t.ligaNacional) {
    extra = 0.03
    n = t.reputacao >= 4 ? 20 : t.reputacao === 3 ? 18 : 12
  }
  const i = j.idade
  const tab = n >= 19 ? [8, 6, 5, 4] : n >= 15 ? [6, 5, 4, 3] : n >= 11 ? [5, 4, 3, 2] : [4, 3, 2, 1]
  const lim = n >= 19 ? [20, 23, 29] : [18, 21, 29]
  let d = (i < lim[0]! ? tab[0]! : i < lim[1]! ? tab[1]! : i < lim[2]! ? tab[2]! : tab[3]!) / 50
  if (j.jogou) d += 0.04
  const f = j.forca
  d -= f >= 30 && f <= 40 ? 0.02 : f >= 41 && f <= 50 ? 0.03 : f >= 51 && f <= 70 ? 0.04 : f >= 71 && f <= 100 ? 0.05 : 0
  if (j.progresso > 0) {
    if (j.progresso < 50) d -= 0.05
    else if (j.progresso < 70) d -= 0.02
    if (j.potencial >= 9) d += 0.07
    else if (j.potencial >= 7) d += 0.05
  }
  if (j.craque) d += 0.02
  else if (j.estrela) d += 0.01
  const p = t.pais
  if (t.continente === 2 || t.continente === 3) d -= d > 0.06 ? 0.02 : 0
  else if (t.continente === 5) d -= d > 0.06 ? 0.04 : 0
  else if (t.continente === 4) d -= p !== 131 && d > 0.06 ? 0.03 : 0
  else if (t.continente === 1) d -= d > 0.06 ? 0.02 : 0 // o teste de país do original é sempre verdadeiro (`!= || !=`)
  else if (t.continente === 0) {
    if ([3, 72, 104, 65, 97].includes(p)) d += 0.01
    else if (p === 154 || p === 85 || p === 21) d -= d > 0.06 ? 0.01 : 0
    else d -= d > 0.06 ? 0.02 : 0
  }
  d += extra
  if (d < 0) d = 0.01
  if (j.habilidades) evoluirHab(m, j, t, d, rng)
  j.evolucao += d
  const max = teto(t, j, 65, rng)
  if (j.evolucao > 1 && j.forca < 100) {
    if (j.forca < max) {
      j.forca++
      j.evolucao -= 1
    } else j.evolucao = 1
  }
}

/** Queda semanal a partir dos 32 anos. Fonte: best/F.java:1448 (fX) */
function declinar(m: Mundo, j: JogadorM, t: TimeM): void {
  const div = t.ligaNacional ? t.divisao : t.reputacao >= 4 ? 1 : t.reputacao >= 3 ? 2 : 3
  let anos = j.idade - 31
  if (t.nivel >= 20) anos -= 2
  const f = j.forca
  const x = f >= 1 && f <= 50 ? 0.7 * anos : f >= 51 && f <= 70 ? anos : f >= 71 ? 1.2 * anos : 0
  if (x > 0) {
    const d = x / 50
    const piso = div === 1 ? 35 : div === 2 ? 25 : div === 3 ? 10 : 1
    j.evolucao += d
    if (j.habilidades) declinarHab(m, j, d)
    if (j.evolucao > 1 && j.forca > piso) {
      j.forca--
      j.evolucao -= 1
    }
  }
  if (j.forca < 1) j.forca = 1
}

/** Progresso semanal do junior (até 20 anos). Fonte: best/F.java:1488 (fY) */
function progredirJunior(j: JogadorM): void {
  if (j.idade > 20) return
  let d = j.idade <= 17 ? 20 / 40 : j.idade === 18 ? 15 / 40 : j.idade === 19 ? 14 / 40 : j.idade === 20 ? 5 / 40 : 0.01
  const p = j.potencial
  d += p <= 3 ? 0.03 : p <= 6 ? 0.04 : p <= 8 ? 0.07 : p === 9 ? 0.1 : 0.11
  j.evolucaoJunior += d
  if (j.evolucaoJunior > 1 && j.progresso < 100) {
    j.progresso++
    j.evolucaoJunior -= 1
  }
  if (j.progresso > 100) j.progresso = 100
}

/**
 * Evento de domingo: com habilidade individual, a cada 4 semanas a IA (e o humano com auxiliar) sorteia o treino;
 * profissionais evoluem ou declinam; juniores progridem. Fonte: best/f_0.java:1979 (aT), best/F.java:1210 (fV)
 */
export function evolucaoSemanal(m: Mundo, rng: Rng): void {
  const hab = m.opcoes.habilidadeIndividual
  if (hab && m.semanaTreino === 3) for (const t of m.times) t.treino.habilidade = [0, 1, 2, 3, 4].map(() => 1 + rng.int(3))
  for (const j of m.jogadores) {
    const t = m.times[j.time]
    if (!t || j.juvenil) continue
    if (j.idade < 32) crescer(m, j, t, rng)
    else declinar(m, j, t)
    j.jogou = false
  }
  for (const j of m.jogadores) if (j.juvenil && m.times[j.time]) progredirJunior(j)
  if (hab) m.semanaTreino = m.semanaTreino === 3 ? 0 : m.semanaTreino + 1
}

/** O humano escolhe o foco do treino (ou deixa o auxiliar decidir). Fonte: a/iQ.java:52 */
export function definirTreino(m: Mundo, timeId: number, foco: 0 | 1, auxiliar: boolean): void {
  const t = m.times[timeId]!
  t.treino.foco = foco
  t.treino.auxiliar = auxiliar
}

// ── Aposentadoria e virada de ano ─────────────────────────────────────────

/**
 * Tira o jogador do futebol. A IA repõe com um junior (promovido na hora se a posição ou o elenco ficam curtos);
 * às vezes o aposentado vira técnico. Fonte: best/F.java:1683 (a(String, int, boolean))
 */
export function aposentar(m: Mundo, base: Base, jogadorId: number, rng: Rng): void {
  const j = m.jogadores[jogadorId]!
  const t = m.times[j.time]
  if (!t || j.juvenil) return
  let viraTecnico = false
  if (t.ligaNacional) {
    let n = [120, 25, 50, 60, 100][t.divisao] ?? 125
    if (j.estrela) n = 5
    if (j.craque) n = 2
    viraTecnico = rng.int(n) === 1
  }
  const naPosicao = t.jogadores.filter((id) => m.jogadores[id]!.posicao === j.posicao).length - 1
  let posicao = -1, promover = false
  if (!t.humano) {
    posicao = j.posicao
    if (naPosicao < [2, 3, 3, 6, 4][j.posicao]! || t.jogadores.length < 16) promover = true
  }
  if (t.juniores.length >= 20 && t.humano) promover = true
  const folga = t.humano ? 0 : t.divisao > 2 || t.reputacao < 3 ? 5 : 2
  const semJunior = t.juniores.length >= 20 - folga && !promover
  t.jogadores = t.jogadores.filter((id) => id !== j.id)
  if (t.batedores.falta === j.id) t.batedores.falta = null
  if (t.batedores.escanteio === j.id) t.batedores.escanteio = null
  j.aVenda = j.paraEmprestimo = j.emprestado = false
  j.time = -1
  // F.java:1714-1721: hall da fama pelos gols na carreira, com a régua subindo com as temporadas
  const n = m.temporada
  if (n < 2 ? j.gols > 0 : n < 10 ? j.gols > 10 : n < 20 ? j.gols > 30 : j.gols > 50)
    m.hallDaFama.push({ nome: j.nome, gols: j.gols, jogos: j.jogos, temporada: n })
  if (!semJunior) {
    const novo = gerarJunior(m, base, t, posicao, rng)
    if (promover) promoverJunior(m, novo.id, rng)
  }
  if (viraTecnico) {
    const c = novoTecnico(m.tecnicos.length, j.nome, j.pais, false, null, t.reputacao)
    Object.assign(c, { paisAnterior: t.pais, divisaoAnterior: t.divisao - 1 })
    m.tecnicos.push(c)
  }
}

/** Chance de pedir para parar, pela idade efetiva (estrela −1, craque −3, goleiro −3). Fonte: best/F.java:1593 (ge) */
function querParar(j: JogadorM, rng: Rng): boolean {
  const r = rng.int(100) + 1
  if (j.idade <= 32) return false
  let i = j.idade
  if (j.estrela) i--
  if (j.craque) i -= 3
  if (j.posicao === 0) i -= 3
  return i < 32 ? false : i === 32 ? r > 99 : i <= 34 ? r > 90 : i <= 35 ? r > 55 : i <= 36 ? r > 30 : i <= 38 ? r > 15 : i <= 39 ? r > 5 : i <= 40 ? r > 3 : i <= 42 ? r > 2 : i <= 48 ? r > 1 : true
}

/**
 * Virada do ano: todos fazem aniversário; os veteranos da IA se aposentam (os do humano só avisam, ponytail: aviso na
 * caixa de entrada da W8); juniores de 20 anos sobem se valem a vaga ou dão lugar a outro; quem tem menos de 15
 * juniores ganha de 2 a 5 novos; valor e salário são recalculados. Chamado pela W7. Fonte: best/f_0.java:1056 (af), best/F.java:1572 (gd), :1750 (gf)
 */
export function envelhecer(m: Mundo, base: Base, rng: Rng): { queremParar: number[] } {
  const queremParar: number[] = []
  const profissionais = m.jogadores.filter((j) => !j.juvenil && j.time >= 0)
  const juniores = m.jogadores.filter((j) => j.juvenil && j.time >= 0)
  for (const j of profissionais) {
    j.idade++
    const t = m.times[j.time]!
    if (j.emprestado) continue
    if (t.humano) j.aVenda = false
    if (!querParar(j, rng)) continue
    if (t.humano) queremParar.push(j.id)
    else aposentar(m, base, j.id, rng)
  }
  for (const j of juniores) {
    j.idade++
    const t = m.times[j.time]
    if (!t || j.idade < 20) continue
    const n = [3, 5, 5, 8, 6][j.posicao]!
    const minPot = [1, 4, 5, 6, 6, 6][t.reputacao] ?? 6
    const tem = t.jogadores.filter((id) => m.jogadores[id]!.posicao === j.posicao).length
    if (j.potencial >= minPot && tem < n) {
      if (t.jogadores.length < 32) {
        promoverJunior(m, j.id, rng)
        if (t.juniores.length < 20) gerarJunior(m, base, t, -1, rng)
      }
    } else if (!t.humano) gerarJunior(m, base, t, -1, rng, j)
  }
  // f_0.c(true) (f_0.java:1150): juniores novos em quem tem menos de 15
  for (const t of m.times) {
    const k = t.juniores.length
    if (k >= 15) continue
    let n = t.ligaNacional ? 2 + rng.int(3) : rng.int(3) + (t.nivel >= 20 ? 1 : 0)
    if (n + k >= 20) n = 20 - k - 2
    if (n > 0) for (let i = 0; i <= n; i++) gerarJunior(m, base, t, -1, rng)
  }
  for (const j of m.jogadores) {
    const t = m.times[j.time]
    if (!t || j.juvenil) continue
    j.valor = valorJogador(j, t, m.continentes[j.pais] ?? -1, m.temporada)
    j.salario = salarioJogador(j, t, m.opcoes.salarioMensal ?? true)
  }
  return { queremParar }
}

// ── Técnico: jogos e satisfação ───────────────────────────────────────────

/** Faixa na tabela (1 líder, 2 topo, 3 meio, 4 perto da degola, 5 rebaixamento); -1 fora de liga ou em grupos. Fonte: best/ah.java:1584 (p) */
function faixaNaTabela(c: Competicao, time: number): number {
  if (c.tipo !== TIPO.liga && c.tipo !== TIPO.estadual) return -1
  const f = c.fases.at(-1)
  if (!f || f.tipo !== 'liga' || f.grupos.length > 0) return -1
  const pos = f.times.indexOf(time) + 1
  if (pos === 0) return -1
  const n = f.times.length, reb = c.rebaixados ?? 0
  const topo = c.tipo === TIPO.estadual ? 2 : 4
  return pos === 1 ? 1 : pos > n - reb ? 5 : pos <= topo ? 2 : pos > n - (reb + (n < 20 ? 2 : 4)) ? 4 : 3
}

/** Pontos de carreira por jogo (vitória, empate), por tipo de competição. Fonte: best/al.java:566-648 (e) */
function pontosDoJogo(c: Competicao, gp: number, gc: number, fora: boolean): number {
  const t = c.tipo, div = t === 1 || t === 3 ? c.divisao : 0
  const bonus = fora && t !== 7 && t !== 5 ? 1 : 0
  if (gp > gc) {
    const v = t === 1 ? (div === 1 ? 4 : div === 2 ? 3 : div === 3 ? 2 : 1) : ({ 2: 4, 3: 1, 4: 5, 5: 7, 6: 4, 7: 8, 8: 4, 10: 2, 11: 2, 12: 3, 9: 2, 13: 5, 14: 6 } as Record<number, number>)[t] ?? 0
    return v + bonus
  }
  if (gp < gc) return 0
  if (t === 1) return div === 1 ? 2 : div === 2 ? 1 : bonus
  return ({ 2: 1, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 11: 2, 10: 1, 12: 1, 9: 1, 13: 2, 14: 2 } as Record<number, number>)[t] ?? bonus
}

function campanha(m: Mundo, c: Tecnico, time: number): Campanha {
  let x = c.campanhas.find((k) => k.time === time && k.temporada === m.temporada)
  if (!x) c.campanhas.push((x = { temporada: m.temporada, time, jogos: 0, vitorias: 0, derrotas: 0, pontos: 0, titulos: 0 }))
  return x
}

/** Diretoria por resultado e faixa: [vitória, empate, derrota] em casa e fora, índice = faixa. Fonte: best/al.java:241-424 */
const TABELAS_DIRETORIA: Record<string, number[][]> = {
  liga: [[0, 5, 4, 1, 1, 0], [0, 2, 1, -1, -1, -3], [0, -2, -2, -3, -5, -7], [0, 6, 5, 2, 2, 1], [0, 2, 1, 0, -1, -2], [0, -1, -1, -2, -4, -5]],
  estadual: [[0, 2, 2, 1, 1, 1], [0, 1, 1, 0, 0, -1], [0, -2, -2, -3, -3, -5], [0, 3, 2, 2, 2, 1], [0, 1, 1, 1, 0, -1], [0, -1, -1, -2, -2, -3]],
  continental: [[0, 5, 4, 3, 3, 3], [0, 2, 1, 0, -1, -3], [0, -2, -2, -3, -3, -5], [0, 7, 6, 4, 4, 5], [0, 2, 1, 0, 0, -2], [0, -1, -1, -2, -2, -3]],
}

/**
 * Diretoria e torcida depois de um jogo (`confronto` 1/2 = venceu/perdeu o mata-mata, avaliado no jogo decisivo).
 * Fonte: best/al.java:162 (a(I, bl, n2))
 */
function satisfacao(m: Mundo, c: Competicao, jogo: Jogo, time: number, decisivo: boolean, confronto: 0 | 1 | 2): void {
  const t = m.times[time]!, tc = tec(m, t)
  if (!tc) return
  const fora = jogo.fora === time
  const adv = m.times[fora ? jogo.casa : jogo.fora]!
  const [gp, gc] = fora ? [jogo.gols![1], jogo.gols![0]] : jogo.gols!
  let res = gp === gc ? 0 : gp > gc ? 1 : 2
  const goleada = Math.abs(gp - gc) >= 3
  const nivel = t.nivel - adv.nivel
  const dir = (v: number) => (tc.diretoria = clamp(tc.diretoria + v))
  const tor = (v: number) => (tc.torcida = clamp(tc.torcida + v))
  if (res === 0) {
    if (nivel >= 0 && !fora) {
      dir(-1)
      tor(-1)
    } else if (nivel < 0) dir(1)
  } else if (res === 2) {
    if (nivel >= 0 && !fora) {
      dir(-3)
      tor(-3)
    } else if (nivel >= 0) dir(-1)
  }
  const faixa = confronto ? -1 : faixaNaTabela(c, time)
  let semTabela = faixa === -1 || confronto > 0
  let n8 = c.tipo === 1 || c.tipo === 3 ? faixa : 2
  if (semTabela && !decisivo) {
    semTabela = false
    n8 = 1
  } else if (confronto > 0) {
    res = confronto
    semTabela = false
    n8 = 1
  }
  if (!semTabela) {
    const caixaNegativo = t.humano && tc.humano && (t.financas?.caixa ?? 0) < 0
    if (caixaNegativo) dir(c.tipo === 1 ? -10 : -5)
    const tab = TABELAS_DIRETORIA[c.tipo === 3 || c.tipo === 10 ? 'estadual' : c.tipo === 4 || c.tipo === 6 ? 'continental' : 'liga']!
    dir(tab[(fora ? 3 : 0) + (res === 1 ? 0 : res === 0 ? 1 : 2)]![n8]!)
  }
  if (res === 0) tor(fora ? 1 : -1)
  else if (res === 1) tor(fora ? (goleada ? 9 : 4) : goleada ? 7 : 3)
  else tor(fora ? (goleada ? -9 : -4) : goleada ? -12 : -5)
  if (tc.torcida < 20) dir(-3)
}

/**
 * Depois de cada jogo: campanha e pontos de carreira do técnico; diretoria e torcida nas competições oficiais.
 * `decisivo` = jogo único ou volta de mata-mata. Fonte: best/I.java:407-421, best/al.java:548 (e)
 */
export function posJogoTecnicos(m: Mundo, c: Competicao, jogo: Jogo, decisivo: boolean): void {
  for (const time of [jogo.casa, jogo.fora]) {
    const tc = tec(m, m.times[time]!)
    if (!tc) continue
    const fora = time === jogo.fora
    const [gp, gc] = fora ? [jogo.gols![1], jogo.gols![0]] : jogo.gols!
    const k = campanha(m, tc, time)
    k.jogos++
    tc.jogos++
    if (gp > gc) {
      k.vitorias++
      tc.vitorias++
    } else if (gp < gc) {
      k.derrotas++
      tc.derrotas++
    }
    const p = pontosDoJogo(c, gp, gc, fora)
    k.pontos += p
    tc.pontos += p
    if ([1, 3, 2, 4, 5, 6, 8, 10].includes(c.tipo)) satisfacao(m, c, jogo, time, decisivo, 0)
  }
}

/** Resultado de um confronto de mata-mata, avaliado pelo jogo decisivo. Fonte: f/g_0.java:317-331, :452 (a) */
export function confrontoTecnicos(m: Mundo, c: Competicao, decisivo: Jogo, vencedor: number): void {
  if (c.tipo === 7 || c.tipo === 9) return
  for (const time of [decisivo.casa, decisivo.fora]) satisfacao(m, c, decisivo, time, true, time === vencedor ? 1 : 2)
}

// ── Colocação final, títulos e reputação ──────────────────────────────────

/** Pontos de reputação por título (0) e vice (1), por tipo; time e técnico. Fonte: best/ah.java:831 (d), best/al.java:1076 (a) */
const REP_TIME = [[0, 500, 300, 10, 5000, 40000, 2000, 0, 500, 0, 50, 0, 0, 1000, 0], [0, 90, 50, 5, 1000, 1000, 500, 0, 0, 0, 0, 0, 0, 500, 0]]
const REP_TECNICO = [[0, 600, 500, 30, 6000, 10000, 2000, 0, 500, 0, 50, 100, 3000, 3000, 20000], [0, 150, 150, 5, 1000, 1000, 500, 2000, 0, 0, 0, 0, 300, 500, 0]]
/** Pontos de carreira pela colocação (índice = posição), por tipo. Fonte: best/al.java:831-940 (b) */
const PONTOS_COLOCACAO: number[][] = [
  [], [0, 25, 10, 8, 7, 6, 5, 4, 3, 2, 1], [0, 20, 7, 3, 3], [0, 15, 3], [0, 30, 15, 7, 7], [0, 25, 5], [0, 20, 10, 5, 5], [0, 35, 20, 10, 5],
  [0, 3], [], [0, 5, 3], [0, 2], [0, 18, 8, 4, 4], [0, 20, 10], [0, 25, 15, 7, 3],
]

function pontosReputacao(tabela: number[][], pos: number, tipo: number, c: Competicao, t: TimeM): number {
  let v = tabela[pos - 1]?.[tipo] ?? 0
  if (v > 1000 && !t.ligaNacional && t.continente > 1) v = Math.round(v * 0.6)
  if (tipo === 1 && c.divisao > 1) v = 50
  return v
}

/**
 * Colocação final (só até o 10º): reputação de time e técnico no título e no vice, pontos de carreira, e no título,
 * o troféu e a festa da diretoria e da torcida. Fonte: best/ah.java:794 (a), :913 (b), best/al.java:831 (b), :942 (q)
 */
export function colocacaoTecnico(m: Mundo, c: Competicao, time: number, pos: number): void {
  if (pos > 10) return
  const t = m.times[time]!, tc = tec(m, t), tipo = c.tipo
  if (pos <= 2) {
    t.pontosReputacao += pontosReputacao(REP_TIME, pos, tipo, c, t)
    if (tc) tc.pontosReputacao += pontosReputacao(REP_TECNICO, pos, tipo, c, t)
  }
  if (!tc) return
  let tab = PONTOS_COLOCACAO[tipo] ?? []
  if (tipo === 1 && c.divisao > 1) tab = c.divisao === 2 ? [0, 5, 3, 2, 1] : [0, 2, 1]
  if (tipo === 3 && c.divisao > 1) tab = []
  tc.pontos += tab[pos] ?? 0
  if (pos !== 1) return
  campanha(m, tc, time).titulos++
  tc.titulos.push({ temporada: m.temporada, competicao: c.id, time })
  const dir = (v: number) => (tc.diretoria = clamp(tc.diretoria + v))
  const tor = (v: number) => (tc.torcida = clamp(tc.torcida + v))
  if (tipo === 1 || tipo === 3) {
    if (c.divisao === 1) {
      tor(20)
      dir(15)
      if (tipo === 1) {
        tor(20)
        dir(15)
      }
    } else {
      tor(20)
      dir(10)
    }
  } else if (tipo === 11) tor(10)
  else if ([2, 4, 5, 6, 12].includes(tipo)) {
    tor(30)
    dir(30)
  }
}

/**
 * Começo de temporada: a reputação de times e técnicos desce sem títulos e sobe pelos pontos acumulados.
 * Chamado pela W7. Fonte: best/ah.java:871 (kk), best/al.java:1107 (kk)
 */
export function atualizarReputacoes(m: Mundo): void {
  for (const t of m.times) {
    const r = t.reputacao
    const desce = (custo: number, piso: number) => {
      t.pontosReputacao -= custo
      if (t.pontosReputacao < piso) {
        t.reputacao = r === 2 ? 2 : r - 1 // de 2 não desce (bug do original, mantido)
        t.pontosReputacao = 0
      }
    }
    if (r === 5) desce(6000, -90000)
    else if (r === 4) desce(600, -9000)
    else if (r === 3 && t.ligaNacional) desce(50, -1000)
    else if (r === 2 && t.ligaNacional) desce(5, -1000)
    const p = t.pontosReputacao
    if (p > 100000) t.pontosReputacao = 100001
    const n = p > 100000 ? 5 : p > 10000 ? 4 : p > 1000 ? 3 : p > 100 ? 2 : p > 10 ? 1 : 0
    if (n > t.reputacao) t.reputacao = n
  }
  for (const c of m.tecnicos) {
    const r = c.reputacao
    const liga = c.time !== null && m.times[c.time]!.ligaNacional
    const desce = (custo: number, piso: number) => {
      c.pontosReputacao -= custo
      if (c.pontosReputacao < piso) {
        c.reputacao = r - 1
        c.pontosReputacao = 0
      }
    }
    if (r === 5) desce(6000, -20000)
    else if (r === 4) desce(600, -3000)
    else if (r === 3 && liga) desce(50, -500)
    else if (r === 2 && liga) desce(5, -50)
    const p = c.pontosReputacao
    const n = p > 22000 ? 5 : p > 10000 ? 4 : p > 1000 ? 3 : p > 100 ? 2 : p > 10 ? 1 : 0
    if (n > c.reputacao) c.reputacao = n
  }
}

// ── Troca de técnico ──────────────────────────────────────────────────────

/** O técnico sai do time (al.lN + i). Humano saindo: o time volta para a IA, sem caixa. */
function sair(m: Mundo, c: Tecnico): void {
  const t = m.times[c.time!]!
  c.timeAnterior = t.id
  c.paisAnterior = t.pais
  c.divisaoAnterior = t.divisao - 1
  if (c.humano) {
    t.humano = false
    t.financas = null
    t.treino.auxiliar = true
  }
  c.time = null
}

/** O técnico assume o time; o humano abre caixa, tira todos da lista e renova os contratos por 180 dias. Fonte: best/al.java:976 (E) */
function entrar(m: Mundo, c: Tecnico, timeId: number): void {
  const t = m.times[timeId]!
  t.tecnico = c.id
  c.time = timeId
  c.diretoria = 95
  c.torcida = 85
  c.temporadas = 0
  if (c.humano) {
    t.humano = true
    abrirCaixa(m, timeId)
    for (const id of t.jogadores) {
      const j = m.jogadores[id]!
      j.aVenda = j.paraEmprestimo = false
      j.contratoAte = m.dia + 180
    }
  }
}

function trocar(m: Mundo, timeId: number, sai: Tecnico | undefined, entra: Tecnico, motivo: number): void {
  if (sai?.time === timeId) sair(m, sai)
  if (entra.time !== null) sair(m, entra)
  entrar(m, entra, timeId)
  m.trocasDeTecnico.push({ dia: m.dia, time: timeId, saiu: sai?.id ?? null, entrou: entra.id, motivo })
}

/** Ordem do comparador g_0: pontos de carreira, vitórias (desc), jogos (asc). */
const porCarreira = (a: Tecnico, b: Tecnico) => b.pontos - a.pontos || b.vitorias - a.vitorias || a.jogos - b.jogos

/** Técnico livre da IA do país do time, na faixa de reputação do modo. Fonte: best/f_0.java:2141 (a(ah, int)) */
function livre(m: Mundo, t: TimeM, modo: number, rng: Rng): Tecnico | null {
  const [min, max] = modo === -1 ? [0, 5] : modo === 0 ? [t.reputacao, t.reputacao] : modo === 1 ? [t.reputacao - 1, t.reputacao] : [t.reputacao - 2, t.reputacao + 1]
  const lista = m.tecnicos.filter((c) => c.time === null && !c.humano && (c.paisAnterior === t.pais || c.pais === t.pais) && c.reputacao >= min && c.reputacao <= max)
  if (lista.length === 0) return null
  if (rng.int(100) < 50) lista.sort(porCarreira)
  else rng.shuffle(lista)
  return lista[0]!
}

/**
 * O time troca de técnico: um livre do país pela reputação; o time de humano aceita qualquer um. Sem livres, o técnico da
 * IA troca de lugar com o de um time que faria proposta a ele. Devolve o novo técnico (ou null). Fonte: best/ah.java:1618 (kE)
 */
export function substituirTecnico(m: Mundo, timeId: number, motivo: number, rng: Rng): Tecnico | null {
  const t = m.times[timeId]!
  const atual = tec(m, t)
  const humano = atual?.humano ?? false
  let novo = livre(m, t, 0, rng) ?? livre(m, t, 1, rng) ?? (t.reputacao <= 3 ? livre(m, t, 2, rng) : null)
  if (!novo && humano) novo = livre(m, t, -1, rng) ?? m.tecnicos.find((c) => c.time === null && !c.humano) ?? null
  if (novo) {
    trocar(m, timeId, atual, novo, motivo)
    return novo
  }
  if (atual && !humano) {
    const outro = ofertasDeEmprego(m, atual, false, rng)[0]
    const tc = outro === undefined ? undefined : tec(m, m.times[outro]!)
    if (tc && tc !== atual) {
      // f_0.a(al, al): os dois trocam de time
      sair(m, atual)
      sair(m, tc)
      entrar(m, atual, outro!)
      entrar(m, tc, timeId)
      m.trocasDeTecnico.push({ dia: m.dia, time: timeId, saiu: atual.id, entrou: tc.id, motivo }, { dia: m.dia, time: outro!, saiu: tc.id, entrou: atual.id, motivo })
      return tc
    }
  }
  return null
}

// ── Ofertas de emprego ────────────────────────────────────────────────────

const DIVISOES = 4

/** Divisões consultadas por divisão do técnico (8 = a última). Fonte: best/Z.java:1006-1069 */
const DIVS_MESMO_PAIS = [[[0, 0, 1, 2], [1, 1, 2, 3], [2, 2, 3], [2, 3, 3]], [[0, 2], [1, 2], [2], [2, 3]], [[0], [1], [2], [2, 3]]]
const DIVS_OUTRO_PAIS = [[[0, 1], [1, 2], [2, 8], [3, 8]], [[0], [1], [8, 8], [8, 8]]]

/** Um time da IA da divisão: 3º a 6º se `melhores`, senão um dos 6 últimos. Fonte: f/s.java:1410 (b) */
function daDivisao(m: Mundo, c: Tecnico, div: number, melhores: boolean, lista: number[], rng: Rng): boolean {
  const f = m.competicoes.find((x) => x.tipo === TIPO.liga && x.divisao === div + 1)?.fases.find((x): x is FaseLiga => x.tipo === 'liga')
  if (!f || f.times.length === 0) return false
  const trecho = melhores ? f.times.slice(2, 6) : f.times.slice(-6)
  const cands = rng.shuffle(trecho.filter((id) => !m.times[id]!.humano && id !== c.timeAnterior))
  const t = cands.find((id) => !lista.includes(id))
  if (t !== undefined) lista.push(t)
  return true
}

/**
 * Times que fariam proposta ao técnico: da liga BR, pelas divisões vizinhas à dele. `melhores` = times da parte de cima
 * (proposta para quem está empregado). Só existe liga no Brasil, então o técnico de fora só recebe se for brasileiro.
 * Fonte: best/ay.java:200 (b), best/Z.java:1005 (a)
 */
export function ofertasDeEmprego(m: Mundo, c: Tecnico, melhores: boolean, rng: Rng): number[] {
  const lista: number[] = []
  // ay.b: a liga do país do último time (al.bz, só gravado ao sair de um time) usa as tabelas do mesmo país;
  // a liga da nacionalidade, as de outro país
  const mesmoPais = c.paisAnterior === BRA
  if (!mesmoPais && c.pais !== BRA) return lista
  let div = c.time !== null ? m.times[c.time]!.divisao - 1 : c.divisaoAnterior
  if (div < 0 || div > DIVISOES - 1) div = DIVISOES - 1
  const r = rng.int(1000)
  const divs = mesmoPais ? DIVS_MESMO_PAIS[r > 700 ? 1 : r > 500 ? 2 : 0]![div]! : DIVS_OUTRO_PAIS[r > 500 ? 1 : 0]![div]!
  for (const d of divs) {
    const k = d === 8 ? DIVISOES - 1 : d
    if (!daDivisao(m, c, k, melhores, lista, rng) && !c.humano) {
      // Z.a(lista, al, bl): um time do país fora das séries (Z.ek)
      const fora = rng.shuffle(m.times.filter((t) => t.pais === BRA && t.divisao === 0 && !t.humano && t.id !== c.timeAnterior))[0]
      if (fora && !lista.includes(fora.id)) lista.push(fora.id)
    }
  }
  return lista
}
function registrarOferta(m: Mundo, c: Tecnico, times: number[]): void {
  m.ofertas = m.ofertas.filter((o) => o.tecnico !== c.id)
  if (times.length > 0) m.ofertas.push({ tecnico: c.id, dia: m.dia, times })
}

/** O humano aceita uma proposta: o time atual procura substituto e o técnico do novo time sai. Fonte: a/gE.java:255 (Az) */
export function aceitarOferta(m: Mundo, tecnicoId: number, timeId: number, rng: Rng): string | null {
  const c = m.tecnicos[tecnicoId]!
  const o = m.ofertas.find((x) => x.tecnico === tecnicoId)
  if (!o || !o.times.includes(timeId)) return 'proposta não encontrada'
  if (m.times[timeId]!.humano) return 'o time já tem técnico humano'
  // sem substituto, o time antigo fica com um interino
  if (c.time !== null) substituirTecnico(m, c.time, -1, rng)
  trocar(m, timeId, tec(m, m.times[timeId]!), c, -1)
  m.ofertas = m.ofertas.filter((x) => x.tecnico !== tecnicoId)
  return null
}

/** O humano pede demissão; sem substituto, a diretoria recusa. Fonte: a/eg_0.java:1704 (rr) */
export function pedirDemissao(m: Mundo, tecnicoId: number, rng: Rng): string | null {
  const c = m.tecnicos[tecnicoId]!
  if (c.time === null) return 'sem time'
  return substituirTecnico(m, c.time, 0, rng) ? null : 'a diretoria ainda não achou um técnico à sua altura'
}

/**
 * Um técnico humano assume um time no começo do jogo, com a reputação do time; o técnico da IA fica livre.
 * Diferente de uma troca, não renova contratos. Fonte: best/ah.java:2017
 */
export function contratarTecnicoHumano(m: Mundo, nome: string, pais: number, timeId: number): Tecnico {
  const t = m.times[timeId]!
  const c = novoTecnico(m.tecnicos.length, nome, pais, true, timeId, t.reputacao)
  m.tecnicos.push(c)
  const antigo = tec(m, t)
  if (antigo) sair(m, antigo)
  t.tecnico = c.id
  t.humano = true
  for (const id of t.jogadores) m.jogadores[id]!.aVenda = m.jogadores[id]!.paraEmprestimo = false
  abrirCaixa(m, timeId)
  return c
}

/**
 * Depois de dia de liga ou estadual: os humanos sem time recebem propostas; quem tem diretoria abaixo de 10 cai
 * (humano sempre; IA só do 7º lugar para baixo). Fonte: best/f_0.java:1732 (n), f/s.java:1723 (A)
 */
export function demissoesDoDia(m: Mundo, tipoDoDia: number, rng: Rng): void {
  if (tipoDoDia !== TIPO.liga && tipoDoDia !== TIPO.estadual) return
  for (const c of m.tecnicos) if (c.humano && c.time === null) registrarOferta(m, c, ofertasDeEmprego(m, c, false, rng))
  for (const comp of m.competicoes) {
    if (comp.tipo !== tipoDoDia) continue
    const f = comp.fases.find((x): x is FaseLiga => x.tipo === 'liga')
    if (!f) continue
    f.times.forEach((id, i) => {
      const t = m.times[id]!, c = tec(m, t)
      if (!c || c.diretoria >= 10) return
      if (c.humano) substituirTecnico(m, id, (t.financas?.caixa ?? 0) < 0 ? 1 : rng.int(2) + 2, rng)
      else if (i > 5) substituirTecnico(m, id, rng.int(3) + 1, rng)
    })
  }
}

/** Na 20ª rodada da liga, os humanos empregados recebem propostas de times de cima. Fonte: best/a.java:761, best/ay.java:238 (zw) */
export function ofertasPromocao(m: Mundo, rng: Rng): void {
  for (const c of m.tecnicos) if (c.humano && c.time !== null) registrarOferta(m, c, ofertasDeEmprego(m, c, true, rng))
}

/** Dia da 20ª rodada da liga (evento cPromocao). */
export const diaDasPropostas = (m: Mundo) => datas(m.calendario, TIPO.liga)[19]

/**
 * Fim de temporada: mais uma temporada no clube; técnicos da IA com ao menos uma caem com chance maior quanto menor o
 * aproveitamento de vitórias na temporada que acabou. Chamado pela W7. Fonte: best/ag.java:50 (jQ)
 */
export function demissoesFimDeTemporada(m: Mundo, temporadaQueAcabou: number, rng: Rng): void {
  for (const c of m.tecnicos) if (c.time !== null) c.temporadas++
  for (const c of [...m.tecnicos]) {
    if (c.time === null || c.humano || c.temporadas < 1) continue
    const k = c.campanhas.findLast((x) => x.temporada === temporadaQueAcabou)
    const aproveitamento = k && k.jogos > 0 ? Math.trunc((k.vitorias * 100) / k.jogos) : 0
    if (rng.int(90) + 1 > aproveitamento) substituirTecnico(m, c.time, 3, rng)
  }
}
