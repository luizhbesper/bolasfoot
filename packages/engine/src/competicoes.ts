// Competições: fases de liga/grupos e de mata-mata, tabela, avanço de fase e o dia de jogos.
// Fontes: f/s.java (liga e grupos), f/z.java + f/g_0.java (mata-mata), best/t.java:746 (tabela de jogos),
// f/b_0.java (divisão nacional), best/Z.java:112 (Ar: divisões), best/f_0.java:1378-1694 (ap/at/ax: o dia).
import { datas, domingo, TIPO } from './calendario.ts'
import { disponivel, escalarIA, escolherParaSlot, porForca, type Escalacao } from './escalacao.ts'
import { eventoCD, proximaRodadaCopa, registrarColocacoes } from './brasil.ts'
import { diaDoMundial, eventoCW, fimDeFaseInternacional } from './internacional.ts'
import type { Mundo } from './mundo.ts'
import { iniciarPartida, simularTempo, type ContextoPartida, type Partida } from './partida.ts'
import { eventosEconomicos, premioFase, receber } from './economia.ts'
import { aplicarPosJogo, publico, recuperarEnergia } from './posjogo.ts'
import { mercadoAntesDosJogos, mercadoDepoisDosJogos } from './mercado.ts'
import { confrontoTecnicos, demissoesDoDia, diaDasPropostas, evolucaoSemanal, ofertasPromocao, posJogoTecnicos } from './carreira.ts'
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
  /** o 2º confronto é a decisão do 3º lugar (at.mq, g_0.java:69: os perdedores das semifinais) */
  terceiro?: boolean
}

export interface FaseMataMata {
  tipo: 'mata'
  rodadas: RodadaMataMata[]
  idaVolta: boolean[]
  /** z.Zg: 2029 = Copa do Brasil no formato novo (cada fase tem regra própria) */
  formato: number
  /** times que entram depois (Copa: f/f_0.afU) */
  reservados: number[]
  /** z.ZG + 1: depois de tantas rodadas a fase entrega vencedores e perdedores à competição (preliminares das
   * continentais, internacional.ts); sem ele, vai até o campeão */
  rodadasMax?: number
  /** nome de cada rodada (at.b(l_0)), quando não é o padrão Oitavas/Quartas/Semifinal/Final */
  nomes?: string[]
  /** a última rodada tem decisão de 3º lugar */
  terceiro?: boolean
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
  /** quantos caem (s.getnRebaixados): define a faixa da tabela para a diretoria */
  rebaixados?: number
  /** confederação (at.gg(): 0 UEFA, 1 CONMEBOL, 2 CAF, 3 AFC, 4 Concacaf, 5 OFC, 7 mundo): prêmios das continentais */
  confederacao?: number
  /** listas da temporada das continentais (YF: direto aos grupos, YS: preliminares, ZE/aao: quem vem de outra) */
  listas?: Record<string, number[]>
  /** 1ª fase que entra na colocação final (at.mr: as preliminares das continentais não contam) */
  colocacaoDesde?: number
}

const linhaVazia = (): Linha => ({ pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 })

/** Comparador a_0.abn: pontos → vitórias → saldo → gols pró. Fonte: h/k_0.java */
export function compararLinha(a: Linha, b: Linha): number {
  return b.pts - a.pts || b.v - a.v || b.gp - b.gc - (a.gp - a.gc) || b.gp - a.gp
}

// ── Tabelas fixas por tamanho ─────────────────────────────────────────────
// Rodadas → mesas → [casa, fora], índices 0-based na lista de times (dd e cX são 1-based no original).
type Mesas = number[][][]
// Fonte: best/t.java:31-40 (Jd)
const Jd: Mesas = [[[2,0]],[[1,2]],[[1,0]]]
// Fonte: best/t.java:41-56 (dc)
const dc: Mesas = [[[2,0]],[[1,2]],[[1,0]],[[0,2]],[[2,1]],[[0,1]]]
// Fonte: best/t.java:58-77 (Je)
const Je: Mesas = [[[0,1],[2,3]],[[0,2],[3,1]],[[3,0],[1,2]]]
// Fonte: best/t.java:78-129 (de)
const de: Mesas = [[[3,2],[1,0]],[[1,4],[0,2]],[[2,1],[4,3]],[[0,3],[2,4]],[[4,0],[3,1]],[[2,3],[0,1]],[[4,1],[2,0]],[[1,2],[3,4]],[[3,0],[4,2]],[[0,4],[1,3]]]
// Fonte: best/t.java:130-201 (Jf)
const Jf: Mesas = [[[2,1],[0,4],[5,3]],[[2,0],[5,1],[3,4]],[[2,5],[3,0],[4,1]],[[2,4],[1,3],[0,5]],[[2,3],[4,5],[1,0]],[[1,2],[4,0],[3,5]],[[0,2],[1,5],[4,3]],[[5,2],[0,3],[1,4]],[[4,2],[3,1],[5,0]],[[3,2],[5,4],[0,1]]]
// Fonte: best/t.java:57 (dd)
const dd: Mesas = [[[0,5],[1,6],[2,7],[3,8]],[[0,1],[2,5],[3,6],[4,7]],[[0,2],[3,1],[4,5],[8,7]],[[0,3],[4,2],[8,5],[7,6]],[[0,4],[8,2],[6,5],[7,1]],[[8,4],[7,3],[6,2],[5,1]],[[0,8],[6,4],[1,2],[5,3]],[[0,7],[6,8],[1,4],[2,3]],[[0,6],[5,7],[1,8],[3,4]]]
// Fonte: best/t.java:264-356 (dg)
const dg: Mesas = [[[6,4],[7,3],[8,2],[9,1],[10,0]],[[2,0],[3,10],[4,9],[5,8],[6,7]],[[7,5],[8,4],[9,3],[10,2],[0,1]],[[1,10],[2,9],[3,8],[4,7],[5,6]],[[3,1],[4,0],[5,10],[6,9],[7,8]],[[8,6],[9,5],[10,4],[0,3],[1,2]],[[4,2],[5,1],[6,0],[7,10],[8,9]],[[9,7],[10,6],[0,5],[1,4],[2,3]],[[5,3],[6,2],[7,1],[8,0],[9,10]],[[10,8],[0,7],[1,6],[2,5],[3,4]],[[0,9],[1,8],[2,7],[3,6],[4,5]]]
// Fonte: best/t.java:13 (cX)
const cX: Mesas = [[[0,1],[18,3],[17,4],[16,5],[15,6],[14,7],[13,8],[12,9],[11,10]],[[0,2],[1,3],[18,5],[17,6],[16,7],[15,8],[14,9],[13,10],[12,11]],[[0,3],[2,4],[1,5],[18,7],[17,8],[16,9],[15,10],[14,11],[13,12]],[[0,4],[3,5],[2,6],[1,7],[18,9],[17,10],[16,11],[15,12],[14,13]],[[0,5],[4,6],[3,7],[2,8],[1,9],[18,11],[17,12],[16,13],[15,14]],[[0,6],[5,7],[4,8],[3,9],[2,10],[1,11],[18,13],[17,14],[16,15]],[[0,7],[6,8],[5,9],[4,10],[3,11],[2,12],[1,13],[18,15],[17,16]],[[0,8],[7,9],[6,10],[5,11],[4,12],[3,13],[2,14],[1,15],[18,17]],[[0,9],[8,10],[7,11],[6,12],[5,13],[4,14],[3,15],[2,16],[1,17]],[[0,10],[9,11],[8,12],[7,13],[6,14],[5,15],[4,16],[3,17],[2,18]],[[0,11],[10,12],[9,13],[8,14],[7,15],[6,16],[5,17],[4,18],[2,1]],[[0,12],[11,13],[10,14],[9,15],[8,16],[7,17],[6,18],[4,1],[3,2]],[[0,13],[12,14],[11,15],[10,16],[9,17],[8,18],[6,1],[5,2],[4,3]],[[0,14],[13,15],[12,16],[11,17],[10,18],[8,1],[7,2],[6,3],[5,4]],[[0,15],[14,16],[13,17],[12,18],[10,1],[9,2],[8,3],[7,4],[6,5]],[[0,16],[15,17],[14,18],[12,1],[11,2],[10,3],[9,4],[8,5],[7,6]],[[0,17],[16,18],[14,1],[13,2],[12,3],[11,4],[10,5],[9,6],[8,7]],[[0,18],[16,1],[15,2],[14,3],[13,4],[12,5],[11,6],[10,7],[9,8]],[[18,1],[17,2],[16,3],[15,4],[14,5],[13,6],[12,7],[11,8],[10,9]]]
// Fonte: best/t.java:357-743 (dh)
const dh: Mesas = [[[1,24],[2,23],[3,22],[4,21],[5,20],[6,19],[7,18],[8,17],[9,16],[10,15],[11,14],[12,13]],[[14,12],[15,11],[16,10],[17,9],[18,8],[19,7],[20,6],[21,5],[22,4],[23,3],[24,2],[0,1]],[[2,0],[3,24],[4,23],[5,22],[6,21],[7,20],[8,19],[9,18],[10,17],[11,16],[12,15],[13,14]],[[15,13],[16,12],[17,11],[18,10],[19,9],[20,8],[21,7],[22,6],[23,5],[24,4],[0,3],[1,2]],[[3,1],[4,0],[5,24],[6,23],[7,22],[8,21],[9,20],[10,19],[11,18],[12,17],[13,16],[14,15]],[[16,14],[17,13],[18,12],[19,11],[20,10],[21,9],[22,8],[23,7],[24,6],[0,5],[1,4],[2,3]],[[4,2],[5,1],[6,0],[7,24],[8,23],[9,22],[10,21],[11,20],[12,19],[13,18],[14,17],[15,16]],[[17,15],[18,14],[19,13],[20,12],[21,11],[22,10],[23,9],[24,8],[0,7],[1,6],[2,5],[3,4]],[[5,3],[6,2],[7,1],[8,0],[9,24],[10,23],[11,22],[12,21],[13,20],[14,19],[15,18],[16,17]],[[18,16],[19,15],[20,14],[21,13],[22,12],[23,11],[24,10],[0,9],[1,8],[2,7],[3,6],[4,5]],[[6,4],[7,3],[8,2],[9,1],[10,0],[11,24],[12,23],[13,22],[14,21],[15,20],[16,19],[17,18]],[[19,17],[20,16],[21,15],[22,14],[23,13],[24,12],[0,11],[1,10],[2,9],[3,8],[4,7],[5,6]],[[7,5],[8,4],[9,3],[10,2],[11,1],[12,0],[13,24],[14,23],[15,22],[16,21],[17,20],[18,19]],[[20,18],[21,17],[22,16],[23,15],[24,14],[0,13],[1,12],[2,11],[3,10],[4,9],[5,8],[6,7]],[[8,6],[9,5],[10,4],[11,3],[12,2],[13,1],[14,0],[15,24],[16,23],[17,22],[18,21],[19,20]],[[21,19],[22,18],[23,17],[24,16],[0,15],[1,14],[2,13],[3,12],[4,11],[5,10],[6,9],[7,8]],[[9,7],[10,6],[11,5],[12,4],[13,3],[14,2],[15,1],[16,0],[17,24],[18,23],[19,22],[20,21]],[[22,20],[23,19],[24,18],[0,17],[1,16],[2,15],[3,14],[4,13],[5,12],[6,11],[7,10],[8,9]],[[10,8],[11,7],[12,6],[13,5],[14,4],[15,3],[16,2],[17,1],[18,0],[19,24],[20,23],[21,22]],[[23,21],[24,20],[0,19],[1,18],[2,17],[3,16],[4,15],[5,14],[6,13],[7,12],[8,11],[9,10]],[[11,9],[12,8],[13,7],[14,6],[15,5],[16,4],[17,3],[18,2],[19,1],[20,0],[21,24],[22,23]],[[24,22],[0,21],[1,20],[2,19],[3,18],[4,17],[5,16],[6,15],[7,14],[8,13],[9,12],[10,11]],[[12,10],[13,9],[14,8],[15,7],[16,6],[17,5],[18,4],[19,3],[20,2],[21,1],[22,0],[23,24]],[[0,23],[1,22],[2,21],[3,20],[4,19],[5,18],[6,17],[7,16],[8,15],[9,14],[10,13],[11,12]],[[13,11],[14,10],[15,9],[16,8],[17,7],[18,6],[19,5],[20,4],[21,3],[22,2],[23,1],[24,0]]]

/**
 * Tabelas fixas que o original usa no lugar do círculo, sem embaralhar a lista. null = usa o círculo.
 * Fonte: f/s.java:611-630 (despacho); best/t.java:985-1332 (montagem)
 */
export function tabelaFixa(times: readonly number[], doisTurnos: boolean, formato: number): [number, number][][] | null {
  const n = times.length
  const mapa = (tab: Mesas) => tab.map((r) => r.map(([a, b]) => [times[a!]!, times[b!]!] as [number, number]))
  const espelho = (tab: Mesas) => [...tab, ...tab.map((r) => r.map(([a, b]) => [b!, a!]))]
  if (n === 4 && formato === 7700) return mapa(Je)
  if (n === 3) return mapa(doisTurnos ? dc : Jd)
  if (n === 5) return mapa(doisTurnos ? de : de.slice(0, 5))
  if (n === 6 && doisTurnos) return mapa(Jf)
  if (n === 9) return mapa(espelho(dd)) // t.java:1041 com bl=true: sempre ida e volta
  if (n === 11) return mapa(dg)
  if (n === 19) return mapa(espelho(cX)) // t.java:1285: turno + returno invertido
  if (n === 25) return mapa(dh)
  return null
}

// ── Tabela de jogos ───────────────────────────────────────────────────────

/**
 * Pontos corridos pelo método do círculo, com `turnos` cópias (turno, returno espelhado, ...).
 * Devolve as rodadas como pares [casa, fora]. Fonte: best/t.java:746-879 (a(s, list, n))
 */
export function rodadasRoundRobin(times: readonly number[], turnos: number, rng: Rng): [number, number][][] {
  const arr: (number | null)[] = [...times]
  rng.shuffle(arr)
  // ímpar com tabela fixa não chega aqui (tabelaFixa); nos demais, círculo com folga
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
  /** pula as duas primeiras datas livres do tipo (s.pulaDuasDatas, s.java:676) */
  pulaDuas?: boolean
}

// Tabelas fixas dos grupos cruzados: [grupo, posição, grupo, posição] (1-based), uma linha por rodada.
// Fonte: best/t.java:14-15 (cY: 4×4, cZ: 4×5), usadas por t.java:908 e :943
const cY = [[[4, 4, 2, 2], [4, 1, 2, 4], [4, 3, 2, 1], [3, 2, 1, 1], [3, 4, 1, 2], [4, 2, 2, 3], [3, 3, 1, 3], [3, 1, 1, 4]], [[2, 3, 4, 4], [2, 4, 4, 3], [1, 2, 3, 3], [1, 3, 3, 2], [2, 1, 4, 2], [2, 2, 4, 1], [1, 1, 3, 1], [1, 4, 3, 4]], [[4, 4, 2, 4], [1, 2, 3, 1], [3, 2, 1, 4], [1, 1, 4, 3], [4, 2, 2, 2], [2, 1, 4, 1], [2, 3, 3, 3], [1, 3, 3, 4]], [[2, 4, 4, 2], [4, 4, 2, 1], [4, 1, 1, 2], [2, 2, 3, 2], [4, 3, 2, 3], [3, 1, 1, 3], [3, 4, 1, 1], [3, 3, 1, 4]], [[2, 4, 3, 4], [1, 2, 3, 2], [1, 3, 4, 4], [2, 2, 4, 3], [2, 3, 3, 1], [2, 1, 3, 3], [1, 1, 4, 1], [1, 4, 4, 2]], [[3, 1, 2, 4], [3, 2, 2, 1], [4, 4, 1, 1], [4, 2, 1, 2], [3, 3, 2, 2], [3, 4, 2, 3], [4, 1, 1, 3], [4, 3, 1, 4]], [[2, 3, 3, 2], [2, 4, 3, 3], [1, 2, 4, 4], [1, 3, 4, 3], [2, 1, 3, 4], [2, 2, 3, 1], [1, 1, 4, 2], [1, 4, 4, 1]], [[3, 2, 2, 4], [4, 3, 1, 2], [1, 4, 4, 4], [3, 1, 2, 1], [3, 4, 2, 2], [3, 3, 1, 1], [4, 2, 1, 3], [4, 1, 2, 3]], [[4, 4, 3, 2], [2, 4, 1, 3], [2, 1, 1, 2], [4, 3, 3, 1], [2, 2, 1, 1], [2, 3, 1, 4], [4, 2, 3, 3], [4, 1, 3, 4]], [[1, 1, 2, 4], [1, 2, 2, 3], [3, 2, 4, 2], [3, 4, 4, 4], [3, 3, 4, 3], [1, 3, 2, 2], [1, 4, 2, 1], [3, 1, 4, 1]], [[2, 4, 1, 2], [3, 3, 4, 4], [3, 2, 4, 1], [3, 4, 4, 3], [2, 2, 1, 4], [2, 3, 1, 1], [2, 1, 1, 3], [3, 1, 4, 2]], [[4, 3, 3, 2], [1, 4, 2, 4], [1, 2, 2, 2], [4, 4, 3, 1], [1, 3, 2, 3], [1, 1, 2, 1], [4, 1, 3, 3], [4, 2, 3, 4]]] as const
const cZ = [[[4, 3, 1, 1], [4, 1, 1, 5], [4, 2, 1, 4], [4, 5, 1, 3], [4, 4, 1, 2], [2, 3, 3, 1], [2, 4, 3, 3], [2, 2, 3, 4], [2, 1, 3, 2], [2, 5, 3, 5]], [[1, 1, 4, 5], [1, 5, 4, 4], [1, 3, 4, 3], [1, 4, 4, 1], [1, 2, 4, 2], [3, 1, 2, 5], [3, 4, 2, 3], [3, 5, 2, 4], [3, 2, 2, 2], [3, 3, 2, 1]], [[1, 1, 4, 2], [1, 2, 4, 5], [4, 1, 1, 3], [4, 3, 1, 5], [1, 4, 4, 4], [3, 1, 2, 1], [3, 4, 2, 5], [2, 3, 3, 5], [2, 4, 3, 2], [2, 2, 3, 3]], [[4, 1, 1, 1], [4, 2, 1, 5], [4, 5, 1, 4], [4, 3, 1, 2], [4, 4, 1, 3], [3, 1, 2, 2], [2, 1, 3, 5], [2, 5, 3, 2], [2, 3, 3, 3], [3, 4, 2, 4]], [[4, 4, 1, 1], [1, 4, 4, 3], [1, 3, 4, 2], [1, 5, 4, 5], [1, 2, 4, 1], [2, 4, 3, 1], [3, 5, 2, 2], [2, 1, 3, 4], [3, 3, 2, 5], [3, 2, 2, 3]], [[1, 1, 2, 3], [2, 2, 1, 4], [1, 3, 2, 4], [1, 5, 2, 1], [2, 5, 1, 2], [4, 3, 3, 1], [3, 4, 4, 4], [3, 3, 4, 2], [3, 5, 4, 1], [4, 5, 3, 2]], [[2, 2, 1, 1], [2, 3, 1, 2], [2, 5, 1, 3], [2, 4, 1, 5], [2, 1, 1, 4], [3, 1, 4, 5], [4, 2, 3, 4], [3, 2, 4, 3], [4, 4, 3, 5], [4, 1, 3, 3]], [[1, 1, 2, 1], [1, 2, 2, 4], [1, 3, 2, 3], [1, 4, 2, 5], [1, 5, 2, 2], [3, 1, 4, 4], [3, 2, 4, 2], [3, 4, 4, 1], [3, 5, 4, 3], [3, 3, 4, 5]], [[1, 1, 2, 4], [2, 5, 1, 5], [2, 1, 1, 2], [2, 2, 1, 3], [2, 3, 1, 4], [4, 1, 3, 1], [4, 3, 3, 3], [4, 4, 3, 2], [4, 2, 3, 5], [4, 5, 3, 4]], [[2, 5, 1, 1], [2, 1, 1, 3], [1, 2, 2, 2], [1, 5, 2, 3], [2, 4, 1, 4], [3, 1, 4, 2], [3, 2, 4, 1], [3, 4, 4, 3], [3, 5, 4, 5], [3, 3, 4, 4]], [[1, 1, 3, 2], [1, 3, 3, 4], [1, 5, 3, 3], [1, 2, 3, 1], [1, 4, 3, 5], [4, 1, 2, 3], [4, 3, 2, 2], [4, 2, 2, 4], [4, 5, 2, 1], [4, 4, 2, 5]], [[3, 1, 1, 1], [3, 2, 1, 3], [3, 5, 1, 2], [3, 3, 1, 4], [3, 4, 1, 5], [2, 5, 4, 1], [2, 3, 4, 5], [2, 2, 4, 2], [2, 4, 4, 4], [2, 1, 4, 3]], [[1, 1, 3, 3], [1, 5, 3, 5], [1, 3, 3, 1], [1, 2, 3, 4], [1, 4, 3, 2], [4, 1, 2, 4], [4, 4, 2, 1], [4, 2, 2, 5], [4, 3, 2, 3], [4, 5, 2, 2]], [[3, 4, 1, 1], [3, 3, 1, 2], [3, 2, 1, 5], [3, 5, 1, 3], [3, 1, 1, 4], [2, 1, 4, 1], [2, 5, 4, 3], [2, 3, 4, 2], [2, 2, 4, 4], [2, 4, 4, 5]], [[1, 1, 3, 5], [1, 5, 3, 1], [1, 4, 3, 4], [1, 2, 3, 2], [1, 3, 3, 3], [4, 1, 2, 2], [4, 3, 2, 4], [4, 2, 2, 1], [4, 5, 2, 5], [4, 4, 2, 3]]] as const

/** Cria uma fase de liga/grupos. Fonte: f/s.java:396-449 (construtor) e :540-602 (j) */
export function criarFaseLiga(mundo: Mundo, c: Competicao, times: number[], o: OpcoesLiga, desde: number, rng: Rng): FaseLiga {
  const fase: FaseLiga = { tipo: 'liga', times: [...times], grupos: [], linhas: {}, jogos: [], avancam: o.avancam, idaVolta: o.idaVolta, formato: o.formato }
  for (const t of times) fase.linhas[t] = linhaVazia()
  const dias = proximasDatas(mundo, c.tipo, desde).slice(o.pulaDuas ? 2 : 0)
  const turnos = (n: number) => nTurnos(c.tipo, n, { doisTurnos: o.doisTurnos, grupos: o.grupos, formato: o.formato, numeroTurnos: o.numeroTurnos })
  const tabela = (ts: number[]) => tabelaFixa(ts, o.doisTurnos, o.formato) ?? rodadasRoundRobin(ts, turnos(ts.length), rng)
  if (o.grupos <= 1) agendar(tabela(times), dias, fase.jogos)
  else {
    const porGrupo = times.length / o.grupos
    for (let g = 0; g < o.grupos; g++)
      fase.grupos.push(o.gruposEmBloco ? times.slice(g * porGrupo, (g + 1) * porGrupo) : times.filter((_, i) => i % o.grupos === g))
    if (o.cruzados) {
      const tab = porGrupo === 4 ? cY : cZ
      const g = fase.grupos
      agendar(tab.map((r) => r.map(([ga, pa, gb, pb]) => [g[ga - 1]![pa - 1]!, g[gb - 1]![pb - 1]!] as [number, number])), dias, fase.jogos)
    } else for (const g of fase.grupos) agendar(tabela(g), dias, fase.jogos)
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
export const ZW = [0, 3, 4, 7, 8, 11, 12, 15, 2, 1, 6, 5, 10, 9, 14, 13], ZX = [3, 0, 7, 4, 11, 8, 15, 12, 1, 2, 5, 6, 9, 10, 13, 14]
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
  for (const f of c.fases.slice(c.colocacaoDesde ?? 0).reverse()) {
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
    if (fimDeFaseInternacional(mundo, c, f, desde, rng)) return
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
  for (const v of r.vencedores) premioFase(mundo.times[v]!, c, f, f.rodadas.length - 1, nRodadas, mundo.dia)
  // g_0: o confronto vale para diretoria e torcida, avaliado no jogo decisivo
  const n = r.confrontos.length
  r.vencedores.forEach((v, k) => confrontoTecnicos(mundo, c, r.jogos[r.idaVolta ? k + n : k]!, v))
  if (f.rodadasMax !== undefined && f.rodadas.length === f.rodadasMax) return void fimDeFaseInternacional(mundo, c, f, desde, rng)
  if (r.vencedores.length === 1 || r.terceiro) {
    const [a, b] = r.confrontos[0]!
    c.campeao = r.vencedores[0]!
    c.vice = c.campeao === a ? b : a
    registrarColocacoes(mundo, c)
    return
  }
  if (f.formato === 2029) return void f.rodadas.push(proximaRodadaCopa(mundo, c, f, desde, rng))
  const prox = criarRodada(mundo, c, r.vencedores, f.idaVolta[f.rodadas.length] ?? true, desde)
  if (f.terceiro && r.vencedores.length === 2) {
    // g_0.java:69: na final entra a decisão do 3º lugar entre os perdedores das semifinais
    const perdedores = r.confrontos.map(([a, b], k) => (r.vencedores[k] === a ? b : a))
    const extra = criarRodada(mundo, c, perdedores, prox.idaVolta, desde)
    prox.confrontos.push(...extra.confrontos)
    prox.jogos.push(...extra.jogos)
    prox.terceiro = true
  }
  f.rodadas.push(prox)
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

/** Uma partida do dia em andamento: onde está o jogo (competição, fase, índice) e o estado da partida. */
export interface PartidaDoDia {
  comp: string
  fase: number
  jogo: number
  rotulo: string
  partida: Partida
}

/** O dia entre o 1º e o 2º tempo (serializável: o intervalo do modo live). */
export interface DiaEmJogo {
  dia: number
  partidas: PartidaDoDia[]
}

/**
 * Escalação de quem joga: a IA escolhe (ah.a); o humano usa a que salvou, trocando quem não pode jogar pelo melhor
 * disponível para o slot. Sem escalação salva, a IA escala por ele.
 */
function escalar(mundo: Mundo, timeId: number, comp: string, rng: Rng): Escalacao {
  const t = mundo.times[timeId]!
  if (!t.humano || !t.escalacao) return escalarIA(mundo, timeId, comp, rng)
  const ok = (id: number) => t.jogadores.includes(id) && disponivel(mundo.jogadores[id]!, comp, mundo.dia)
  const salvos = new Set(t.escalacao.titulares.map((x) => x.id).filter(ok))
  const resto = t.jogadores.filter((id) => ok(id) && !salvos.has(id)).map((id) => mundo.jogadores[id]!).sort(porForca)
  const titulares: Escalacao['titulares'] = []
  for (const { id, slot } of t.escalacao.titulares) {
    if (salvos.has(id)) titulares.push({ id, slot })
    else {
      const j = escolherParaSlot(resto, slot)
      if (!j) continue
      titulares.push({ id: j.id, slot })
      resto.splice(resto.indexOf(j), 1)
    }
  }
  const banco = t.escalacao.banco.filter((id) => ok(id) && resto.some((j) => j.id === id))
  return { titulares, banco, tatica: { ...t.tatica } }
}

/** Fase e jogo de uma partida do dia, para achar o Jogo de volta. */
function jogoDe(mundo: Mundo, x: Pick<PartidaDoDia, 'comp' | 'fase' | 'jogo'>): { comp: Competicao; fase: Fase; jogo: Jogo } {
  const comp = mundo.competicoes.find((c) => c.id === x.comp)!
  const fase = comp.fases[x.fase]!
  const jogo = (fase.tipo === 'liga' ? fase.jogos : fase.rodadas.at(-1)!.jogos)[x.jogo]!
  return { comp, fase, jogo }
}

/**
 * Começa o dia: fecha os leilões, escala e simula o 1º tempo de todos os jogos. `pilotoAutomatico`: o humano joga
 * com as regras da IA (substituições e pênaltis), como no modo sem intervalo. Fonte: best/f_0.java:1378 (ap)
 */
export function comecarDia(mundo: Mundo, seed = mundo.seed, pilotoAutomatico = true): DiaEmJogo {
  const hoje = mundo.dia
  mercadoAntesDosJogos(mundo, derivar(seed, `mercado:${hoje}:antes`))
  const partidas: PartidaDoDia[] = []
  for (const { comp, fase, jogo, ctx } of jogosDoDia(mundo)) {
    const rotulo = `partida:${comp.id}:${hoje}:${jogo.casa}`
    const rng = derivar(seed, rotulo)
    // f_0.ay + ah.kh: o humano escala (ou a IA por ele); a IA escala os outros
    const esc = [escalar(mundo, jogo.casa, comp.id, rng), escalar(mundo, jogo.fora, comp.id, rng)] as const
    const p = iniciarPartida(mundo, [jogo.casa, jogo.fora], [esc[0], esc[1]], ctx, rng)
    if (pilotoAutomatico) for (const l of p.lados) l.humano = false
    simularTempo(p, 1, derivar(seed, `${rotulo}:1T`))
    const lista = fase.tipo === 'liga' ? fase.jogos : fase.rodadas.at(-1)!.jogos
    partidas.push({ comp: comp.id, fase: comp.fases.indexOf(fase), jogo: lista.indexOf(jogo), rotulo, partida: p })
  }
  return { dia: hoje, partidas }
}

/**
 * Termina o dia: 2º tempo, pós-jogo, tabelas e fases, recuperação, eventos de dia e o próximo dia de jogo.
 * Devolve esse dia (ou null no fim da temporada). Fonte: best/f_0.java:1486-1530 (as), :1531 (at), :1635 (ax)
 */
export function terminarDia(mundo: Mundo, emJogo: DiaEmJogo, seed = mundo.seed): number | null {
  const hoje = emJogo.dia
  const porFase = new Map<Fase, Jogo[]>()
  for (const x of emJogo.partidas) {
    const { comp, fase, jogo } = jogoDe(mundo, x)
    const { rotulo, partida: p } = x
    const ctx = p.ctx
    simularTempo(p, 2, derivar(seed, `${rotulo}:2T`))
    aplicarPosJogo(mundo, p, derivar(seed, `${rotulo}:pos`))
    // I.hf: bilheteria do mandante humano (nunca no Mundial nem em seleções)
    // (v_0.java:172: o público cai com a torcida do técnico; 80 sem técnico)
    const casa = mundo.times[jogo.casa]!
    const torcida = mundo.tecnicos[casa.tecnico]?.time === casa.id ? mundo.tecnicos[casa.tecnico]!.torcida : 80
    if (casa.financas && comp.tipo !== 5 && comp.tipo !== 7)
      receber(casa, publico(casa, mundo.times[jogo.fora]!, ctx, derivar(seed, `${rotulo}:publico`), torcida).renda, 'bilheteria', jogo.dia, `× ${mundo.times[jogo.fora]!.nome}`)
    jogo.gols = [...p.placar]
    if (p.penaltis) jogo.penaltis = p.penaltis.vencedor
    // I.java:407-421: campanha, pontos, diretoria e torcida dos técnicos
    posJogoTecnicos(mundo, comp, jogo, ctx.mataMata !== undefined)
    porFase.set(fase, [...(porFase.get(fase) ?? []), jogo])
  }
  const jogos = emJogo.partidas.map((x) => jogoDe(mundo, x).comp)
  if (jogos.length > 0) {
    // f_0.as(): recuperação de todos; juniores voltam a 100
    recuperarEnergia(mundo)
    for (const j of mundo.jogadores) if (j.juvenil) j.energia = 100
    // f_0.ax: empréstimos, propostas da IA e leilões
    mercadoDepoisDosJogos(mundo, jogos.map((c) => c.tipo), derivar(seed, `mercado:${hoje}`))
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
  if (jogos.length > 0) {
    // f_0.ax → n(tipo do dia): demissões e propostas para desempregados; a.java:761: propostas na 20ª rodada da liga
    const rngCarreira = derivar(seed, `carreira:${hoje}`)
    demissoesDoDia(mundo, mundo.calendario.tipos[hoje - mundo.calendario.inicio] ?? 0, rngCarreira)
    if (hoje === diaDasPropostas(mundo)) ofertasPromocao(mundo, rngCarreira)
  }
  // f_0.at → q(0): eventos de dia (salário, juros, obras) de todos os dias até hoje
  // e, aos domingos (aj), a evolução semanal
  const cw = diaDoMundial(mundo)
  for (let d = mundo.diaEventos + 1; d <= hoje; d++) {
    eventosEconomicos(mundo, d)
    if (domingo(d)) evolucaoSemanal(mundo, derivar(seed, `semana:${d}`))
    // a.java:583 (cw): no último dia de continental 1, depois dos jogos, o Mundial é montado
    if (d === cw) eventoCW(mundo, hoje + 1, derivar(seed, `cw:${d}`))
  }
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

/** O dia inteiro, sem intervalo. */
export const avancarDia = (mundo: Mundo, seed = mundo.seed): number | null => terminarDia(mundo, comecarDia(mundo, seed), seed)
