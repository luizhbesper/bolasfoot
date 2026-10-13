// Competições: fases de liga/grupos e de mata-mata, tabela, avanço de fase e o dia de jogos.
// Fontes: f/s.java (liga e grupos), f/z.java + f/g_0.java (mata-mata), best/t.java:746 (tabela de jogos),
// f/b_0.java (divisão nacional), best/Z.java:112 (Ar: divisões), best/f_0.java:1378-1694 (ap/at/ax: o dia).
import { datas, TIPO } from './calendario.ts'
import { escalarIA } from './escalacao.ts'
import { eventoCD, proximaRodadaCopa, registrarColocacoes } from './brasil.ts'
import type { Mundo } from './mundo.ts'
import { iniciarPartida, simularTempo, type ContextoPartida } from './partida.ts'
import { eventosEconomicos, premioFase, receber } from './economia.ts'
import { aplicarPosJogo, publico, recuperarEnergia } from './posjogo.ts'
import { derivar, type Rng } from './rng.ts'

export interface Jogo {
  dia: number
  casa: number
  fora: number
  /** [casa, fora]; ausente = não jogado */
  gols?: [number, number]
  /** lado (0 casa, 1 fora) que venceu nos pênaltis */
  penaltis?: 0 | 1
}

/** ak.java:47 — [pts, J, V, D, E, GP, GC] (o saldo é derivado) */
export interface Linha {
  pts: number
  j: number
  v: number
  e: number
  d: number
  gp: number
  gc: number
}

export interface FaseLiga {
  tipo: 'liga'
  /** ordem da classificação (s.Zb, reordenado a cada rodada) */
  times: number[]
  /** grupos (s.Za), também ordenados; vazio = sem grupos */
  grupos: number[][]
  linhas: Record<number, Linha>
  jogos: Jogo[]
  /** quantos avançam por grupo (s.Zd); 0 = pontos corridos */
  avancam: number
  /** ida e volta por fase do mata-mata seguinte (s.duasVoltasMataMata) */
  idaVolta: boolean[]
  /** código de formato do original (s.var0): 1020 Série C, 1022 grupos da C, 7/10 estadual com grupos cruzados */
  formato: number
}

export interface RodadaMataMata {
  idaVolta: boolean
  /** falso = empate no jogo único classifica o visitante (Copa do Brasil, 1ª fase: g_0.java:250, `2129`) */
  penaltis: boolean
  /** [time da casa na ida, outro] */
  confrontos: [number, number][]
  /** ida (um por confronto, na ordem), depois a volta */
  jogos: Jogo[]
  vencedores: number[]
}

export interface FaseMataMata {
  tipo: 'mata'
  rodadas: RodadaMataMata[]
  idaVolta: boolean[]
  /** z.Zg: 2029 = Copa do Brasil no formato novo (cada fase tem regra própria) */
  formato: number
  /** times que entram depois (Copa: f/f_0.afU) */
  reservados: number[]
}

export type Fase = FaseLiga | FaseMataMata

export interface Competicao {
  /** chave estável; também a chave das suspensões */
  id: string
  nome: string
  /** TIPO do calendário */
  tipo: number
  /** 1..4 para as séries; 0 nas copas */
  divisao: number
  fases: Fase[]
  campeao: number | null
  vice: number | null
  /** estaduais: índice em Base.ufs; regionais: região 0..3 */
  uf?: number
  /** opções guardadas para criar a fase depois (Série D, no evento cD) */
  opcoes?: OpcoesLiga
}

const linhaVazia = (): Linha => ({ pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 })

/** Comparador a_0.abn: pontos → vitórias → saldo → gols pró. Fonte: h/k_0.java */
export function compararLinha(a: Linha, b: Linha): number {
  return b.pts - a.pts || b.v - a.v || b.gp - b.gc - (a.gp - a.gc) || b.gp - a.gp
}

// ── Tabela de jogos ───────────────────────────────────────────────────────

/**
 * Pontos corridos pelo método do círculo, com `turnos` cópias (turno, returno espelhado, ...).
 * Devolve as rodadas como pares [casa, fora]. Fonte: best/t.java:746-879 (a(s, list, n))
 */
export function rodadasRoundRobin(times: readonly number[], turnos: number, rng: Rng): [number, number][][] {
  const arr: (number | null)[] = [...times]
  rng.shuffle(arr)
  // ponytail: com número ímpar o original usa tabelas fixas por tamanho (t.java 3/5/9/11/19/25 times);
  // aqui é o mesmo círculo com folga (o laço do original, com o tamanho ímpar, repetiria times)
  if (arr.length % 2 === 1) arr.push(null)
  const n = arr.length
  const mesas = n / 2
  const base: (number | null)[][][] = []
  for (let r = 0; r < n - 1; r++) {
    const rodada: (number | null)[][] = []
    for (let k = 0; k < mesas; k++) {
      const casa = arr[(r + k) % (n - 1)]!
      const fora = k === 0 ? arr[n - 1]! : arr[(n - 1 - k + r) % (n - 1)]!
      rodada.push([casa, fora])
    }
    base.push(rodada)
  }
  // intercala: rodadas pares vêm da 1ª metade, ímpares da 2ª; nas ímpares a mesa 0 inverte o mando
  const turno: (number | null)[][][] = []
  let frente = 0, tras = n / 2
  for (let i = 0; i < base.length; i++) turno.push(i % 2 === 0 ? base[frente++]! : base[tras++]!)
  for (let i = 1; i < turno.length; i += 2) turno[i]![0]!.reverse()
  const returno = turno.map((r) => r.map(([a, b]) => [b, a]))
  const seq = [turno, returno, turno, returno].slice(0, Math.max(1, Math.min(4, turnos)))
  return seq.flat().map((r) => r.filter((m): m is [number, number] => m[0] !== null && m[1] !== null))
}

/** Nº de turnos de uma liga ou grupo. Fonte: f/s.java:632-663 */
export function nTurnos(tipo: number, nTimes: number, opcoes: { doisTurnos: boolean; grupos: number; formato: number; numeroTurnos: number }): number {
  let dois = opcoes.doisTurnos
  if (tipo !== TIPO.liga) return dois ? 2 : 1
  dois = nTimes !== 30 && nTimes !== 26 && nTimes !== 28 && nTimes !== 36
  const g = opcoes.grupos
  if (nTimes === 20 && opcoes.formato === 1020) return 1
  if (nTimes === 8 && g === 0) return 4
  if (nTimes === 10 && g === 0) return opcoes.numeroTurnos === 2 ? 2 : opcoes.numeroTurnos === 3 ? 3 : 4
  if ((nTimes === 12 || nTimes === 14) && g === 0) return opcoes.numeroTurnos === 2 ? 2 : 3
  return dois ? 2 : 1
}

/** Datas ainda livres de um tipo a partir de `desde` (a.a(tipo, false), best/a.java:171). */
function proximasDatas(mundo: Mundo, tipo: number, desde: number): number[] {
  return datas(mundo.calendario, tipo).filter((d) => d >= desde)
}

function agendar(rodadas: [number, number][][], dias: number[], jogos: Jogo[]): void {
  rodadas.forEach((r, i) => {
    const dia = dias[i]
    if (dia === undefined) throw new Error(`faltam datas: rodada ${i + 1} de ${rodadas.length}`)
    for (const [casa, fora] of r) jogos.push({ dia, casa, fora })
  })
}

// ── Fases ─────────────────────────────────────────────────────────────────

export interface OpcoesLiga {
  grupos: number
  /** grupos em blocos seguidos (true) ou distribuídos um a um, como potes (false). Fonte: f/s.java:540 (j) */
  gruposEmBloco: boolean
  avancam: number
  doisTurnos: boolean
  numeroTurnos: number
  idaVolta: boolean[]
  formato: number
  /** grupos jogam contra os outros grupos, não entre si (estaduais 7 e 10: jogosDentroGrupo falso) */
  cruzados?: boolean
}

// Tabelas fixas dos grupos cruzados: [grupo, posição, grupo, posição] (1-based), uma linha por rodada.
// Fonte: best/t.java:14-15 (cY: 4×4, cZ: 4×5), usadas por t.java:908 e :943
const cY = [[[4, 4, 2, 2], [4, 1, 2, 4], [4, 3, 2, 1], [3, 2, 1, 1], [3, 4, 1, 2], [4, 2, 2, 3], [3, 3, 1, 3], [3, 1, 1, 4]], [[2, 3, 4, 4], [2, 4, 4, 3], [1, 2, 3, 3], [1, 3, 3, 2], [2, 1, 4, 2], [2, 2, 4, 1], [1, 1, 3, 1], [1, 4, 3, 4]], [[4, 4, 2, 4], [1, 2, 3, 1], [3, 2, 1, 4], [1, 1, 4, 3], [4, 2, 2, 2], [2, 1, 4, 1], [2, 3, 3, 3], [1, 3, 3, 4]], [[2, 4, 4, 2], [4, 4, 2, 1], [4, 1, 1, 2], [2, 2, 3, 2], [4, 3, 2, 3], [3, 1, 1, 3], [3, 4, 1, 1], [3, 3, 1, 4]], [[2, 4, 3, 4], [1, 2, 3, 2], [1, 3, 4, 4], [2, 2, 4, 3], [2, 3, 3, 1], [2, 1, 3, 3], [1, 1, 4, 1], [1, 4, 4, 2]], [[3, 1, 2, 4], [3, 2, 2, 1], [4, 4, 1, 1], [4, 2, 1, 2], [3, 3, 2, 2], [3, 4, 2, 3], [4, 1, 1, 3], [4, 3, 1, 4]], [[2, 3, 3, 2], [2, 4, 3, 3], [1, 2, 4, 4], [1, 3, 4, 3], [2, 1, 3, 4], [2, 2, 3, 1], [1, 1, 4, 2], [1, 4, 4, 1]], [[3, 2, 2, 4], [4, 3, 1, 2], [1, 4, 4, 4], [3, 1, 2, 1], [3, 4, 2, 2], [3, 3, 1, 1], [4, 2, 1, 3], [4, 1, 2, 3]], [[4, 4, 3, 2], [2, 4, 1, 3], [2, 1, 1, 2], [4, 3, 3, 1], [2, 2, 1, 1], [2, 3, 1, 4], [4, 2, 3, 3], [4, 1, 3, 4]], [[1, 1, 2, 4], [1, 2, 2, 3], [3, 2, 4, 2], [3, 4, 4, 4], [3, 3, 4, 3], [1, 3, 2, 2], [1, 4, 2, 1], [3, 1, 4, 1]], [[2, 4, 1, 2], [3, 3, 4, 4], [3, 2, 4, 1], [3, 4, 4, 3], [2, 2, 1, 4], [2, 3, 1, 1], [2, 1, 1, 3], [3, 1, 4, 2]], [[4, 3, 3, 2], [1, 4, 2, 4], [1, 2, 2, 2], [4, 4, 3, 1], [1, 3, 2, 3], [1, 1, 2, 1], [4, 1, 3, 3], [4, 2, 3, 4]]] as const
const cZ = [[[4, 3, 1, 1], [4, 1, 1, 5], [4, 2, 1, 4], [4, 5, 1, 3], [4, 4, 1, 2], [2, 3, 3, 1], [2, 4, 3, 3], [2, 2, 3, 4], [2, 1, 3, 2], [2, 5, 3, 5]], [[1, 1, 4, 5], [1, 5, 4, 4], [1, 3, 4, 3], [1, 4, 4, 1], [1, 2, 4, 2], [3, 1, 2, 5], [3, 4, 2, 3], [3, 5, 2, 4], [3, 2, 2, 2], [3, 3, 2, 1]], [[1, 1, 4, 2], [1, 2, 4, 5], [4, 1, 1, 3], [4, 3, 1, 5], [1, 4, 4, 4], [3, 1, 2, 1], [3, 4, 2, 5], [2, 3, 3, 5], [2, 4, 3, 2], [2, 2, 3, 3]], [[4, 1, 1, 1], [4, 2, 1, 5], [4, 5, 1, 4], [4, 3, 1, 2], [4, 4, 1, 3], [3, 1, 2, 2], [2, 1, 3, 5], [2, 5, 3, 2], [2, 3, 3, 3], [3, 4, 2, 4]], [[4, 4, 1, 1], [1, 4, 4, 3], [1, 3, 4, 2], [1, 5, 4, 5], [1, 2, 4, 1], [2, 4, 3, 1], [3, 5, 2, 2], [2, 1, 3, 4], [3, 3, 2, 5], [3, 2, 2, 3]], [[1, 1, 2, 3], [2, 2, 1, 4], [1, 3, 2, 4], [1, 5, 2, 1], [2, 5, 1, 2], [4, 3, 3, 1], [3, 4, 4, 4], [3, 3, 4, 2], [3, 5, 4, 1], [4, 5, 3, 2]], [[2, 2, 1, 1], [2, 3, 1, 2], [2, 5, 1, 3], [2, 4, 1, 5], [2, 1, 1, 4], [3, 1, 4, 5], [4, 2, 3, 4], [3, 2, 4, 3], [4, 4, 3, 5], [4, 1, 3, 3]], [[1, 1, 2, 1], [1, 2, 2, 4], [1, 3, 2, 3], [1, 4, 2, 5], [1, 5, 2, 2], [3, 1, 4, 4], [3, 2, 4, 2], [3, 4, 4, 1], [3, 5, 4, 3], [3, 3, 4, 5]], [[1, 1, 2, 4], [2, 5, 1, 5], [2, 1, 1, 2], [2, 2, 1, 3], [2, 3, 1, 4], [4, 1, 3, 1], [4, 3, 3, 3], [4, 4, 3, 2], [4, 2, 3, 5], [4, 5, 3, 4]], [[2, 5, 1, 1], [2, 1, 1, 3], [1, 2, 2, 2], [1, 5, 2, 3], [2, 4, 1, 4], [3, 1, 4, 2], [3, 2, 4, 1], [3, 4, 4, 3], [3, 5, 4, 5], [3, 3, 4, 4]], [[1, 1, 3, 2], [1, 3, 3, 4], [1, 5, 3, 3], [1, 2, 3, 1], [1, 4, 3, 5], [4, 1, 2, 3], [4, 3, 2, 2], [4, 2, 2, 4], [4, 5, 2, 1], [4, 4, 2, 5]], [[3, 1, 1, 1], [3, 2, 1, 3], [3, 5, 1, 2], [3, 3, 1, 4], [3, 4, 1, 5], [2, 5, 4, 1], [2, 3, 4, 5], [2, 2, 4, 2], [2, 4, 4, 4], [2, 1, 4, 3]], [[1, 1, 3, 3], [1, 5, 3, 5], [1, 3, 3, 1], [1, 2, 3, 4], [1, 4, 3, 2], [4, 1, 2, 4], [4, 4, 2, 1], [4, 2, 2, 5], [4, 3, 2, 3], [4, 5, 2, 2]], [[3, 4, 1, 1], [3, 3, 1, 2], [3, 2, 1, 5], [3, 5, 1, 3], [3, 1, 1, 4], [2, 1, 4, 1], [2, 5, 4, 3], [2, 3, 4, 2], [2, 2, 4, 4], [2, 4, 4, 5]], [[1, 1, 3, 5], [1, 5, 3, 1], [1, 4, 3, 4], [1, 2, 3, 2], [1, 3, 3, 3], [4, 1, 2, 2], [4, 3, 2, 4], [4, 2, 2, 1], [4, 5, 2, 5], [4, 4, 2, 3]]] as const

/** Cria uma fase de liga/grupos. Fonte: f/s.java:396-449 (construtor) e :540-602 (j) */
export function criarFaseLiga(mundo: Mundo, c: Competicao, times: number[], o: OpcoesLiga, desde: number, rng: Rng): FaseLiga {
  const fase: FaseLiga = { tipo: 'liga', times: [...times], grupos: [], linhas: {}, jogos: [], avancam: o.avancam, idaVolta: o.idaVolta, formato: o.formato }
  for (const t of times) fase.linhas[t] = linhaVazia()
  const dias = proximasDatas(mundo, c.tipo, desde)
  const turnos = (n: number) => nTurnos(c.tipo, n, { doisTurnos: o.doisTurnos, grupos: o.grupos, formato: o.formato, numeroTurnos: o.numeroTurnos })
  if (o.grupos <= 1) agendar(rodadasRoundRobin(times, turnos(times.length), rng), dias, fase.jogos)
  else {
    const porGrupo = times.length / o.grupos
    for (let g = 0; g < o.grupos; g++)
      fase.grupos.push(o.gruposEmBloco ? times.slice(g * porGrupo, (g + 1) * porGrupo) : times.filter((_, i) => i % o.grupos === g))
    if (o.cruzados) {
      const tab = porGrupo === 4 ? cY : cZ
      const g = fase.grupos
      agendar(tab.map((r) => r.map(([ga, pa, gb, pb]) => [g[ga - 1]![pa - 1]!, g[gb - 1]![pb - 1]!] as [number, number])), dias, fase.jogos)
    } else for (const g of fase.grupos) agendar(rodadasRoundRobin(g, turnos(g.length), rng), dias, fase.jogos)
  }
  return fase
}

/** Cria uma rodada de mata-mata com os pares em sequência. Fonte: f/g_0.java:44-75 (b) */
export function criarRodada(mundo: Mundo, c: Competicao, ordem: number[], idaVolta: boolean, desde: number, penaltis = true): RodadaMataMata {
  const dias = proximasDatas(mundo, c.tipo, desde)
  const r: RodadaMataMata = { idaVolta, penaltis, confrontos: [], jogos: [], vencedores: [] }
  for (let i = 0; i < ordem.length; i += 2) r.confrontos.push([ordem[i]!, ordem[i + 1]!])
  const n = idaVolta ? 2 : 1
  if (dias.length < n) throw new Error(`faltam datas para o mata-mata de ${c.id}`)
  for (const [a, b] of r.confrontos) r.jogos.push({ dia: dias[0]!, casa: a, fora: b })
  if (idaVolta) for (const [a, b] of r.confrontos) r.jogos.push({ dia: dias[1]!, casa: b, fora: a })
  return r
}

export function criarFaseMataMata(mundo: Mundo, c: Competicao, ordem: number[], idaVolta: boolean[], desde: number): FaseMataMata {
  return { tipo: 'mata', idaVolta, formato: -1, reservados: [], rodadas: [criarRodada(mundo, c, ordem, idaVolta[0] ?? true, desde)] }
}

/**
 * Vencedor do confronto: vitórias → saldo agregado → pênaltis do último jogo.
 * (Gol fora só nas continentais; o "senão" do original, `hc().lf() < hc().lf()`, dá sempre o 2º.)
 * Fonte: f/g_0.java:219-279 (b)
 */
function vencedor(r: RodadaMataMata, k: number): number {
  const [a, b] = r.confrontos[k]!
  const ida = r.jogos[k]!
  const volta = r.idaVolta ? r.jogos[r.confrontos.length + k]! : null
  let va = 0, vb = 0, ga = ida.gols![0], gb = ida.gols![1]
  if (ida.gols![0] > ida.gols![1]) va++
  else if (ida.gols![1] > ida.gols![0]) vb++
  if (volta) {
    const [gc, gf] = volta.gols!
    if (gf > gc) va++
    else if (gc > gf) vb++
    ga += gf
    gb += gc
  }
  if (va !== vb) return va > vb ? a : b
  if (ga !== gb) return ga > gb ? a : b
  const ultimo = volta ?? ida
  if (ultimo.penaltis !== undefined) return ultimo.penaltis === 0 ? ultimo.casa : ultimo.fora
  return b
}

// sementes do mata-mata a partir da classificação (f/s.java:83-245)
const ZM = [0, 1], ZN = [1, 0]
const ZO = [0, 3, 1, 2], ZP = [3, 0, 2, 1], ZQ = [0, 3, 2, 1], ZR = [3, 0, 1, 2]
const ZS = [0, 1, 2, 3, 4, 5, 6, 7], ZT = [1, 0, 3, 2, 5, 4, 7, 6]
const ZU = [1, 6, 3, 4, 0, 7, 2, 5], ZV = [6, 1, 4, 3, 7, 0, 5, 2]
const ZW = [0, 3, 4, 7, 8, 11, 12, 15, 2, 1, 6, 5, 10, 9, 14, 13], ZX = [3, 0, 7, 4, 11, 8, 15, 12, 1, 2, 5, 6, 9, 10, 13, 14]
const ZY = [7, 0, 2, 5, 3, 4, 6, 1, 15, 8, 10, 13, 11, 12, 14, 9, 23, 16, 18, 21, 19, 20, 22, 17, 31, 24, 26, 29, 27, 28, 30, 25]

/** Quem avança da fase de liga e em que ordem. Fonte: f/s.java:848-1004 (yP), ramo nacional/estadual */
function classificados(f: FaseLiga): number[] {
  const ida = f.idaVolta[0] ?? true
  const ordenar = (lista: number[], semente: number[] | null) => (semente ? semente.map((i) => lista[i]!) : lista)
  if (f.grupos.length > 0) {
    const lista = f.grupos.flatMap((g) => g.slice(0, f.avancam))
    const n = lista.length
    const s =
      f.formato === 7 || f.formato === 10 ? (ida ? ZT : ZS)
      : n === 32 ? ZY
      : n === 16 ? (ida ? ZX : ZW)
      : n === 8 ? (ida ? ZV : ZU)
      : n === 4 ? (ida ? ZR : ZQ)
      : n === 2 ? (ida ? ZN : ZM)
      : null
    return ordenar(lista, s)
  }
  const lista = f.times.slice(0, f.avancam)
  const n = lista.length
  const s = n === 16 ? ZW : n === 8 ? (ida ? ZV : ZU) : n === 4 ? (ida ? ZP : ZO) : n === 2 ? (ida ? ZN : ZM) : null
  return ordenar(lista, s)
}

/**
 * Colocação final: do último mata-mata para o primeiro (vencedor e vencido de cada confronto),
 * depois a tabela das fases de liga. Fonte: f/s.java:1564-1636 (za)
 */
export function classificacaoFinal(c: Competicao): number[] {
  const vistos: number[] = []
  const add = (t: number) => void (vistos.includes(t) || vistos.push(t))
  for (const f of [...c.fases].reverse()) {
    if (f.tipo === 'mata')
      for (const r of [...f.rodadas].reverse())
        r.confrontos.forEach(([a, b], k) => {
          const v = r.vencedores[k]
          if (v === undefined) return
          add(v)
          add(v === a ? b : a)
        })
    else f.times.forEach(add)
  }
  return vistos
}

/** Atualiza tabela e grupos com os jogos de hoje. Fonte: best/ah.java:1080-1105 + f/s.java:1006-1020 (pO) */
function atualizarTabela(f: FaseLiga, hoje: Jogo[]): void {
  for (const j of hoje) {
    const [gc, gf] = j.gols!
    for (const [t, pro, contra] of [[j.casa, gc, gf], [j.fora, gf, gc]] as const) {
      const l = f.linhas[t]!
      l.j++
      l.gp += pro
      l.gc += contra
      if (pro > contra) {
        l.v++
        l.pts += 3
      } else if (pro < contra) l.d++
      else {
        l.e++
        l.pts++
      }
    }
  }
  const cmp = (a: number, b: number) => compararLinha(f.linhas[a]!, f.linhas[b]!)
  f.times.sort(cmp)
  for (const g of f.grupos) g.sort(cmp)
}

/** Fecha a fase atual se acabou e abre a próxima. Fonte: f/s.java:1006-1090 (pO), f/z.java:115-145 (pO/zs) */
function avancarFase(mundo: Mundo, c: Competicao, desde: number, rng: Rng): void {
  const f = c.fases.at(-1)!
  if (f.tipo === 'liga') {
    if (!f.jogos.every((j) => j.gols)) return
    if (f.avancam === 0) {
      c.campeao = f.times[0]!
      c.vice = f.times[1]!
      registrarColocacoes(mundo, c)
      return
    }
    const ordem = classificados(f)
    if (f.formato === 1020) {
      // b_0.a (f/b_0.java:76): 2 grupos de 4 em dois turnos, o líder de cada um vai à final
      const o: OpcoesLiga = { grupos: 2, gruposEmBloco: true, avancam: 1, doisTurnos: true, numeroTurnos: 0, idaVolta: [true, true, true, true, true, true, true], formato: 1022 }
      c.fases.push(criarFaseLiga(mundo, c, ordem, o, desde, rng))
    } else c.fases.push(criarFaseMataMata(mundo, c, ordem, f.idaVolta, desde))
    return
  }
  const r = f.rodadas.at(-1)!
  if (!r.jogos.every((j) => j.gols)) return
  r.vencedores = r.confrontos.map((_, k) => vencedor(r, k))
  const nRodadas = Math.round(Math.log2(f.rodadas[0]!.confrontos.length * 2))
  for (const v of r.vencedores) premioFase(mundo.times[v]!, c, f.rodadas.length - 1, nRodadas)
  if (r.vencedores.length === 1) {
    const [a, b] = r.confrontos[0]!
    c.campeao = r.vencedores[0]!
    c.vice = c.campeao === a ? b : a
    registrarColocacoes(mundo, c)
    return
  }
  if (f.formato === 2029) return void f.rodadas.push(proximaRodadaCopa(mundo, c, f, desde, rng))
  f.rodadas.push(criarRodada(mundo, c, r.vencedores, f.idaVolta[f.rodadas.length] ?? true, desde))
}

// ── O dia ─────────────────────────────────────────────────────────────────

/** Jogos marcados para hoje e ainda não jogados. */
export function jogosDoDia(mundo: Mundo): { comp: Competicao; fase: Fase; jogo: Jogo; ctx: ContextoPartida }[] {
  const out: ReturnType<typeof jogosDoDia> = []
  for (const comp of mundo.competicoes) {
    const fase = comp.fases.at(-1)
    if (!fase) continue
    const jogos = fase.tipo === 'liga' ? fase.jogos : fase.rodadas.at(-1)!.jogos
    const r = fase.tipo === 'mata' ? fase.rodadas.at(-1)! : null
    jogos.forEach((jogo, i) => {
      if (jogo.dia !== mundo.dia || jogo.gols) return
      const ctx: ContextoPartida = { competicao: comp.id, tipoComp: comp.tipo, temporada: mundo.temporada }
      if (r) {
        const n = r.confrontos.length
        if (!r.idaVolta) ctx.mataMata = { golFora: false, penaltis: r.penaltis }
        else if (i >= n) {
          const ida = r.jogos[i - n]!.gols!
          ctx.mataMata = { ida: [ida[1], ida[0]], golFora: false, penaltis: true }
        }
      }
      out.push({ comp, fase, jogo, ctx })
    })
  }
  return out
}

/** Próximo dia com jogo marcado, ou null se a temporada acabou. */
export function proximoDiaDeJogo(mundo: Mundo): number | null {
  let min: number | null = null
  for (const comp of mundo.competicoes)
    for (const f of comp.fases)
      for (const j of f.tipo === 'liga' ? f.jogos : f.rodadas.flatMap((r) => r.jogos))
        if (!j.gols && (min === null || j.dia < min)) min = j.dia
  return min
}

/**
 * Joga o dia: escala a IA, simula, aplica o pós-jogo, atualiza tabelas e fases, recupera energia
 * e vai para o próximo dia de jogo. Devolve esse dia (ou null no fim da temporada).
 * Fonte: best/f_0.java:1378 (ap), :1486-1530 (as), :1531 (at), :1635 (ax)
 */
export function avancarDia(mundo: Mundo, seed = mundo.seed): number | null {
  const hoje = mundo.dia
  const jogos = jogosDoDia(mundo)
  const porFase = new Map<Fase, Jogo[]>()
  for (const { comp, fase, jogo, ctx } of jogos) {
    const rotulo = `partida:${comp.id}:${hoje}:${jogo.casa}`
    const rng = derivar(seed, rotulo)
    // ponytail: humano também escala pela IA até os comandos da W8
    const esc = [escalarIA(mundo, jogo.casa, comp.id, rng), escalarIA(mundo, jogo.fora, comp.id, rng)] as const
    const p = iniciarPartida(mundo, [jogo.casa, jogo.fora], [esc[0], esc[1]], ctx, rng)
    simularTempo(p, 1, derivar(seed, `${rotulo}:1T`))
    simularTempo(p, 2, derivar(seed, `${rotulo}:2T`))
    aplicarPosJogo(mundo, p, derivar(seed, `${rotulo}:pos`))
    // I.hf: bilheteria do mandante humano (nunca no Mundial nem em seleções)
    const casa = mundo.times[jogo.casa]!
    if (casa.financas && comp.tipo !== 5 && comp.tipo !== 7)
      receber(casa, publico(casa, mundo.times[jogo.fora]!, ctx, derivar(seed, `${rotulo}:publico`)).renda, 'bilheteria')
    jogo.gols = [...p.placar]
    if (p.penaltis) jogo.penaltis = p.penaltis.vencedor
    porFase.set(fase, [...(porFase.get(fase) ?? []), jogo])
  }
  if (jogos.length > 0) {
    // f_0.as(): recuperação de todos; juniores voltam a 100
    recuperarEnergia(mundo)
    for (const j of mundo.jogadores) if (j.juvenil) j.energia = 100
  }
  const rngFase = derivar(seed, `fases:${hoje}`)
  for (const comp of mundo.competicoes) {
    const fase = comp.fases.at(-1)
    if (!fase) continue
    const hojeDaFase = porFase.get(fase)
    if (!hojeDaFase) continue
    if (fase.tipo === 'liga') atualizarTabela(fase, hojeDaFase)
    avancarFase(mundo, comp, hoje + 1, rngFase)
  }
  // f_0.at → q(0): eventos de dia (salário, juros, obras) de todos os dias até hoje
  for (let d = mundo.diaEventos + 1; d <= hoje; d++) eventosEconomicos(mundo, d)
  mundo.diaEventos = Math.max(mundo.diaEventos, hoje)
  // f_0.ax → az() + q(1): eventos pós-jogo dos dias até o próximo dia de jogo. O cD (a.java:649-697)
  // está no 1º dia de liga, então a Série D e a Copa nascem antes da 1ª rodada, com a tabela ainda zerada.
  let prox = proximoDiaDeJogo(mundo)
  const cD = datas(mundo.calendario, TIPO.liga)[0]!
  if (hoje < cD && (prox === null || prox >= cD)) {
    eventoCD(mundo, cD, derivar(seed, `cD:${cD}`))
    prox = proximoDiaDeJogo(mundo)
  }
  if (prox !== null) mundo.dia = prox
  return prox
}
