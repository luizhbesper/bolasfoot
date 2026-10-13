// Mundo do jogo (serializável, JSON puro) e criação a partir da base do original.
import type { Base, Jogador, Time } from '@bolasfoot/data'
import { ANO_INICIAL, criarCalendario, primeiroDomingo, type Calendario } from './calendario.ts'
import { criarCompeticoesBR, type ColocacaoEstadual } from './brasil.ts'
import type { Competicao } from './competicoes.ts'
import { atualizarValores, type Financas } from './economia.ts'
import { derivar, type Rng } from './rng.ts'

export const BRA = 29

/** Skills da opção "habilidade individual" (F.java: eA..eG). */
export interface Habilidades {
  gol: number
  vel: number
  tec: number
  pas: number
  des: number
  arm: number
  fin: number
}

export interface Suspensao {
  /** h_0.ca */
  amarelos: number
  /** h_0.cb */
  jogos: number
}

export interface JogadorM extends Jogador {
  id: number
  /** índice em Mundo.times */
  time: number
  juvenil: boolean
  /** subperfil `ex` (F.java:513-525): L 0 defensivo/1 ofensivo; M 0 volante/1 meia; A 0/1/2 */
  ex: number
  forca: number
  energia: number
  habilidades: Habilidades | null
  /** por competição (h_0) */
  suspensoes: Record<string, Suspensao>
  /** Mundo.dia até o qual está lesionado (exclusivo); 0 = nunca */
  lesaoAte: number
  /** jogou desde a última evolução semanal (F.eL) */
  jogou: boolean
  /** F.eu: valor de mercado */
  valor: number
  /** F.et: salário (mensal ou semanal, conforme a opção) */
  salario: number
  /** F.eJ: dia em que o contrato acaba */
  contratoAte: number
}

export interface Tatica {
  /** linha de FORMACOES (aq.sJ) */
  formacao: number
  /** 0 Equilibrado, 1 Ataque total, 2 Contra-ataque (ignorado pelo motor, c/b.java:416) */
  estilo: number
  /** 0 Leve, 1 Pesada, 2 Muito pesada */
  marcacao: number
  /** 0 Pelo meio, 1 Pelas laterais (sem efeito no motor) */
  jogada: number
}

export interface Estadio {
  nome: string
  /** geral, arquibancada, cadeira, camarote (v_0.N) */
  setores: [number, number, number, number]
  precoAuto: boolean
  precos: [number, number, number, number] | null
}

export interface TimeM extends Omit<Time, 'jogadores' | 'juniores' | 'estadio'> {
  id: number
  /** 0 = fora das ligas; 1..3 = Série A..C (Série D vem dos estaduais, W2) */
  divisao: number
  /** ah.kn(): país com liga nacional (só BRA) */
  ligaNacional: boolean
  /** continente do país (ac.gg(): 0 Europa, 1 Am. Sul, ...) */
  continente: number
  /** ah.hr: desempate aleatório 1..1000 */
  desempate: number
  humano: boolean
  /** só times com técnico humano têm caixa (a IA não tem) */
  financas: Financas | null
  jogadores: number[]
  juniores: number[]
  tatica: Tatica
  /** batedor de faltas/pênaltis (ke) e de escanteios (lq): ids de jogador */
  batedores: { falta: number | null; escanteio: number | null }
  estadio: Estadio
}

export interface OpcoesJogo {
  habilidadeIndividual: boolean
  /** salário pago no dia 2 (padrão do original) ou todo domingo */
  salarioMensal?: boolean
}

export interface Mundo {
  seed: string
  /** a.SR.H(): nº da temporada, começa em 1 */
  temporada: number
  /** dia corrente, absoluto (calendario.ts) */
  dia: number
  /** último dia cujos eventos (salário, juros, obras…) já rodaram */
  diaEventos: number
  calendario: Calendario
  competicoes: Competicao[]
  /** colocações nos estaduais de quem está fora das séries (SR.bx): alimenta Série D e Copa no evento cD */
  colocacoesEstaduais: ColocacaoEstadual[]
  opcoes: OpcoesJogo
  times: TimeM[]
  jogadores: JogadorM[]
}

/** F.fG(): subperfil por posição e características. Fonte: best/F.java:513-525 */
export function subperfil(posicao: number, cr1: number, cr2: number): number {
  const [a, b] = [cr1, cr2]
  if (posicao === 1)
    // o original testa `cr2 == 13 || cr1 == 6` no 3º termo (typo mantido)
    return a === 13 || a === 6 ? 1 : a === 7 || a === 10 ? 0 : b === 13 || a === 6 ? 1 : b === 7 || b === 10 ? 0 : a === 8 || a === 9 || a === 11 || a === 4 ? 1 : 0
  if (posicao === 3)
    return a === 11 || a === 9 || a === 8 || a === 4 ? 1 : a === 7 || a === 10 ? 0 : b === 11 || b === 9 || b === 8 || b === 4 ? 1 : b === 7 || b === 10 ? 0 : 1
  if (posicao === 4) return a === 7 || a === 10 ? 0 : a === 8 || a === 13 || a === 6 ? 2 : 1
  return 0
}

const NIVEL_REMAP: Record<number, number> = { 16: 17, 17: 18, 18: 19, 19: 21, 20: 25, 21: 26, 22: 27, 23: 28, 24: 29, 25: 30 }

/** Base e "n6" da força. Fonte: best/F.java:546-589 */
function baseForca(time: Pick<TimeM, 'ligaNacional' | 'divisao' | 'reputacao'>): [number, number] {
  if (time.ligaNacional) return ({ 1: [20, 7], 2: [15, 3], 3: [5, 1] } as Record<number, [number, number]>)[time.divisao] ?? [1, 1]
  return ({ 5: [22, 7], 4: [15, 4], 3: [5, 1], 2: [5, 1], 1: [5, 1] } as Record<number, [number, number]>)[time.reputacao] ?? [1, 1]
}

type TimeForca = Pick<TimeM, 'ligaNacional' | 'divisao' | 'reputacao' | 'nivel'>
type JogadorForca = Pick<JogadorM, 'titular' | 'estrela' | 'craque' | 'juvenil'>

/** Força inicial. Fonte: best/F.java:538-682 (fI). Contrato/valor/salário ficam para a W3. */
export function forcaInicial(j: JogadorForca, time: TimeForca, paisNivel: number, rng: Rng): { forca: number; n8: number; n6: number } {
  const lvl = time.nivel
  const [b0, n6] = baseForca(time)
  let f = b0
  const n7 = lvl <= 15 ? lvl : (NIVEL_REMAP[lvl] ?? lvl)
  const n8 = n7 > 4 ? n7 - 4 : n7
  f = n7 + f + rng.int(3)
  if (j.titular) f = f + 8 + rng.int(2)
  if (j.estrela || j.craque) f = f + 9 + rng.int(3)
  if (j.juvenil && (f -= 23) < 5) f = 10
  if (paisNivel <= 13) f = Math.round(f * (lvl <= 5 ? 0.4 : lvl < 10 ? 0.65 : 0.75))
  else if (lvl < 10) f = Math.round(f * (lvl < 3 ? 0.5 : lvl < 5 ? 0.6 : 0.7))
  if (f > 100) f = 100
  return { forca: f, n8, n6 }
}

type JogadorHab = Pick<JogadorM, 'posicao' | 'cr1' | 'cr2' | 'ex' | 'forca'>

/** Semeadura das habilidades. a = n8, b = n6. Fonte: best/F.java:684-912 (j) */
export function habilidadesIniciais(j: JogadorHab, a: number, b: number, rng: Rng): Habilidades {
  const R = (n: number) => rng.int(n)
  const tem = (c: number) => j.cr1 === c || j.cr2 === c
  const c = Math.round(Math.trunc(a / 3))
  const q = j.forca
  const h: Habilidades = { gol: 0, vel: 0, tec: 0, pas: 0, des: 0, arm: 0, fin: 0 }
  if (j.posicao === 0) {
    h.gol = q + R(2)
    h.vel = a + R(7)
    h.tec = a + R(4)
    h.pas = a + R(4)
    h.des = b + R(3)
    h.arm = b + R(3)
    h.fin = b + R(3)
    if (j.cr1 === 0 || j.cr1 === 3) h.tec = h.tec + 2 + R(5)
    if (j.cr2 === 0 || j.cr2 === 3) h.tec += R(2)
    if (j.cr1 === 2) h.vel = h.vel + 2 + R(5)
    if (j.cr2 === 2) h.vel += R(2)
    if (j.cr1 === 1) h.gol = h.gol + 1 + R(3)
    if (j.cr2 === 1) h.gol += R(2)
  } else if (j.posicao === 1 || j.posicao === 3) {
    const lat = j.posicao === 1
    if (j.ex === 0) {
      h.des = Math.round(q * (lat ? 0.8 : 0.7)) + R(6)
      h.fin = (lat ? b : a) + R(4)
      h.pas = a + R(3)
      h.tec = a + R(7)
      h.arm = (lat ? b : a) + R(5)
      h.vel = a + b + R(6)
    } else {
      h.arm = lat ? Math.round(q * 0.5) + R(5) : q + R(2)
      h.fin = a + (lat ? b : c) + R(4)
      h.pas = a + (lat ? c : b) + R(3)
      h.tec = a + c + R(7)
      h.des = a + R(4)
      h.vel = a + (lat ? b : c) + R(4)
    }
    h.gol = 1 + R(4)
    if (tem(4)) {
      h.arm = h.arm + b + R(5)
      h.pas = h.pas + b + R(5)
    }
    if (tem(5)) {
      h.fin = h.fin + 2 + R(3)
      h.des = h.des + 2 + R(3)
    }
    if (tem(6)) h.pas = h.pas + 2 + R(3)
    if (tem(7)) h.des = h.des + b + R(3)
    if (tem(8)) h.tec = h.tec + b + R(3)
    if (tem(9)) h.fin = h.fin + b + R(3)
    if (tem(10)) h.des = h.des + (lat ? b + R(5) : 3 + R(3))
    if (tem(11)) h.pas = h.pas + b + R(2)
    if (tem(12)) h.des = h.des + 3 + R(3)
    if (tem(13)) h.vel = h.vel + a + R(3)
  } else if (j.posicao === 2) {
    h.des = Math.round(q * 0.9) + R(2)
    h.gol = 1 + R(7)
    h.vel = a + b + R(4)
    h.tec = a + b + R(7)
    h.pas = a + b + R(3)
    h.fin = b + R(6)
    h.arm = a + R(5)
    if (tem(4)) {
      h.arm = h.arm + b + R(5)
      h.pas = h.pas + b + R(5)
    }
    if (tem(5)) h.fin = h.fin + b + R(6)
    if (tem(6)) h.pas = h.pas + 2 + R(3)
    if (tem(7)) h.des = h.des + b + R(3)
    if (tem(8)) h.tec = h.tec + b + R(3)
    if (tem(9)) h.fin = h.fin + 3 + R(3)
    if (tem(10)) h.des = h.des + 3 + R(3)
    if (tem(11)) h.pas = h.pas + b + R(2)
    if (tem(12)) {
      h.des = h.des + 3 + R(3)
      h.fin += 2
    }
    if (tem(13)) h.vel = h.vel + a + R(3)
  } else {
    h.fin = Math.round(q * 0.8) + R(2)
    h.gol = 1 + R(6)
    h.vel = a + c + R(4)
    h.tec = a + c + R(7)
    h.pas = a + b + R(3)
    h.des = b + R(6)
    h.arm = b + a + R(5)
    if (tem(4)) {
      h.arm = h.arm + a + R(5)
      h.pas = h.pas + b + R(5)
    }
    if (tem(5)) h.fin = h.fin + 2 + R(3)
    if (tem(6)) h.pas = h.pas + 2 + R(3)
    if (tem(7)) h.des = h.des + b + R(3)
    if (tem(8)) h.tec = h.tec + b + R(3)
    if (tem(9)) h.fin = h.fin + 3 + R(3)
    if (tem(10)) h.des = h.des + 3 + R(3)
    if (tem(11)) h.pas = h.pas + a + R(2)
    if (tem(12)) {
      h.des = h.des + 3 + R(3)
      h.fin += 2
    }
    if (tem(13)) h.vel = h.vel + a + R(3)
  }
  for (const k of Object.keys(h) as (keyof Habilidades)[]) if (h[k] > 100) h[k] = 100
  return h
}

/** Setores do estádio. Fonte: best/v_0.java:79-88 */
export function setoresEstadio(capacidade: number): Estadio['setores'] {
  const cap = capacidade < 1000 || capacidade > 120000 ? 10000 : capacidade
  const g = Math.round(cap * 0.15), cd = Math.round(cap * 0.09), cm = Math.round(cap * 0.009)
  return [g, cap - g - cd - cm, cd, cm]
}

/** Batedor de faltas padrão. Fonte: best/ah.java:1453 (kA; no construtor a força ainda é 0, vale a ordem do elenco) */
function batedorFalta(js: JogadorM[]): number | null {
  return (
    js.find((j) => j.titular && j.cr1 === 9) ??
    js.find((j) => j.titular && j.posicao !== 0) ??
    js.find((j) => j.posicao !== 0)
  )?.id ?? null
}

const idade = (i: number, juvenil: boolean) => (juvenil ? (i >= 16 && i <= 20 ? i : 18) : i >= 16 && i <= 48 ? i : 35) // F.java:188-202

/**
 * Cria o mundo. Fontes: best/p_0.java:110-193 (carga), best/Z.java:112-228 (divisão BR),
 * best/f_0.java:2009 (aU: força de todos).
 */
export function novoJogo(base: Base, opcoes: OpcoesJogo, seed: string): Mundo {
  const rngDesempate = derivar(seed, 'novoJogo:desempate')
  const rngForca = derivar(seed, 'novoJogo:forca')
  const calendario = criarCalendario(ANO_INICIAL)
  const dia = calendario.inicio + primeiroDomingo(calendario.inicio)
  const mundo: Mundo = { seed, temporada: 1, dia, diaEventos: dia - 1, calendario, competicoes: [], colocacoesEstaduais: [], opcoes, times: [], jogadores: [] }

  // p_0.java:59 ordena por Nivel desc; p_0.java:110-128: país sem liga carrega só 15 times
  // ponytail: empate de Nivel segue a ordem do base.json (o original usa a ordem dos arquivos)
  const ordenados = base.times.map((t, i) => [t, i] as const).sort((x, y) => y[0].nivel - x[0].nivel || x[1] - y[1]).map(([t]) => t)
  const porPais = new Map<number, number>()
  for (const t of ordenados) {
    const n = porPais.get(t.pais) ?? 0
    if (t.pais !== BRA && n >= 15) continue
    porPais.set(t.pais, n + 1)
    const id = mundo.times.length
    const novo = (j: Jogador, juvenil: boolean): number => {
      const jm: JogadorM = {
        ...j,
        idade: idade(j.idade, juvenil),
        estrela: j.estrela || j.craque,
        potencial: (j.estrela || j.craque) && j.potencial > 8 ? 10 : j.potencial, // F.aq()
        id: mundo.jogadores.length,
        time: id,
        juvenil,
        ex: subperfil(j.posicao, j.cr1, j.cr2),
        forca: 0,
        energia: 100,
        habilidades: null,
        suspensoes: {},
        lesaoAte: 0,
        jogou: false,
        valor: 0,
        salario: 0,
        contratoAte: 0,
      }
      mundo.jogadores.push(jm)
      return jm.id
    }
    const { jogadores, juniores, estadio, ...resto } = t
    const tm: TimeM = {
      ...resto,
      nivel: t.nivel >= 1 && t.nivel <= 25 ? t.nivel : 10, // ah.java:356
      id,
      divisao: 0,
      ligaNacional: t.pais === BRA,
      continente: base.paises[t.pais]!.continente,
      desempate: rngDesempate.int(1000) + 1,
      humano: false,
      financas: null,
      jogadores: jogadores.map((j) => novo(j, false)),
      juniores: juniores.map((j) => novo(j, true)),
      tatica: { formacao: 4, estilo: 0, marcacao: 0, jogada: 0 },
      batedores: { falta: null, escanteio: null },
      estadio: { nome: estadio, setores: setoresEstadio(t.capacidade), precoAuto: true, precos: null },
    }
    tm.batedores.falta = batedorFalta(tm.jogadores.map((i) => mundo.jogadores[i]!))
    mundo.times.push(tm)
  }

  // Z.Ar(): ordena por Nivel e desempate, A/B/C = blocos de 20. A Série D vem dos estaduais (Z.java:177).
  const br = mundo.times.filter((t) => t.pais === BRA).sort((x, y) => y.nivel - x.nivel || y.desempate - x.desempate)
  br.forEach((t, i) => (t.divisao = i < 60 ? Math.floor(i / 20) + 1 : 0))

  // f_0.aU(): força de todos os jogadores, depois dos juniores (mesma ordem do original)
  const ordem = [...mundo.jogadores.filter((j) => !j.juvenil), ...mundo.jogadores.filter((j) => j.juvenil)]
  for (const j of ordem) {
    const t = mundo.times[j.time]!
    const { forca, n8, n6 } = forcaInicial(j, t, base.paises[t.pais]!.nivel, rngForca)
    j.forca = forca
    if (opcoes.habilidadeIndividual) j.habilidades = habilidadesIniciais(j, n8, n6, rngForca)
  }
  // ah.kp() (ah.java:1155, chamado no aU) embaralha o elenco: é o que desempata a escalação da IA
  // entre jogadores de mesma força. A lista de transferências do kp() fica para a W4.
  const rngElenco = derivar(seed, 'novoJogo:elenco')
  for (const t of mundo.times) rngElenco.shuffle(t.jogadores)
  // F.fI (F.java:674-680): contrato de 210 a 239 dias, depois valor e salário
  const rngContrato = derivar(seed, 'novoJogo:contrato')
  for (const j of ordem) j.contratoAte = mundo.dia + rngContrato.int(30) + 210
  atualizarValores(mundo, (pais) => base.paises[pais]?.continente ?? -1)
  mundo.competicoes = criarCompeticoesBR(mundo, base, derivar(seed, 'temporada:1:competicoes'))
  return mundo
}
