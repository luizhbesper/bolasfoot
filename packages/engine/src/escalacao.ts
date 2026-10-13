// Slots do campo, formações e escalação da IA.
import type { JogadorM, Mundo, Tatica } from './mundo.ts'
import type { Rng } from './rng.ts'

/** [posição, lado, ex] por slot; -1 = qualquer. Fonte: best/aq.java:660-725 (sE) */
export const SLOTS: readonly (readonly [number, number, number])[] = [
  [0, -1, -1], [0, -1, -1], [1, 1, -1], [2, 1, -1], [2, -1, -1], [2, 0, -1], [2, 1, -1], [2, -1, -1], [2, 0, -1],
  [1, 0, -1], [1, 1, 1], [3, 1, 0], [3, -1, 0], [3, 0, 0], [3, 1, 1], [3, -1, 1], [3, 0, 1], [1, 1, 0],
  [4, 1, 2], [4, 1, -1], [4, -1, -1], [4, 0, -1], [4, 1, -1], [4, -1, -1], [4, 0, -1], [4, 0, 2],
]

/** Ordem de posições alternativas. Fonte: best/aq.java:741-772 (sH) */
const FALLBACK_POS = [[0, 2, 1, 3, 4], [1, 3, 2, 4, 0], [2, 1, 3, 4, 0], [3, 1, 2, 4, 0], [4, 3, 1, 2, 0]] as const

/** Slots do banco. Fonte: best/aq.java:773 (sI) */
export const BANCO = [1, 1, 2, 4, 4, 12, 15, 15, 20, 20, 23] as const

/** Slots de cada formação; a linha 0 duplica a 1. Fonte: best/aq.java:774 (sJ) */
export const FORMACOES: readonly (readonly number[])[] = [
  [1, 20, 11, 13, 14, 16, 2, 9, 6, 4, 8],
  [1, 20, 11, 13, 14, 16, 2, 9, 6, 4, 8],
  [1, 22, 24, 12, 14, 16, 2, 9, 6, 4, 8],
  [1, 23, 11, 13, 15, 2, 9, 6, 8, 10, 17],
  [1, 22, 24, 11, 13, 14, 16, 2, 9, 3, 5],
  [1, 19, 21, 11, 12, 13, 15, 2, 9, 6, 8],
  [1, 22, 24, 12, 14, 15, 16, 2, 9, 6, 8],
  [1, 22, 23, 24, 12, 14, 16, 2, 9, 6, 8],
  [1, 19, 20, 21, 11, 13, 15, 2, 9, 6, 8],
  [1, 22, 24, 11, 13, 15, 4, 6, 8, 10, 17],
  [1, 18, 25, 23, 11, 13, 4, 6, 8, 10, 17],
  [1, 23, 14, 16, 15, 13, 11, 2, 9, 6, 8],
  [1, 20, 10, 17, 15, 13, 11, 2, 9, 6, 8],
]
export const NOMES_FORMACAO = ['5-4-1', '5-4-1', '5-3-2', '4-5-1', '4-4-2', '4-4-2 def', '4-4-2 ofen', '4-3-3', '4-3-3 def', '3-5-2', '3-4-3', '4-2-3-1', '4-2-3-1 alas']

/** Fonte: best/F.java:2908-2923 (gF) */
export function foraDePosicao(posicao: number, slot: number): boolean {
  return slot <= 0 || (slot <= 25 && SLOTS[slot]![0] !== posicao)
}

type Escalavel = Pick<JogadorM, 'posicao' | 'lado' | 'ex'>

/**
 * Melhor jogador da lista (já ordenada) para o slot. Os valores de lado/ex sobrescritos nos
 * passes 2/3 "vazam" para a posição alternativa seguinte, como no original.
 * Fonte: best/ah.java:626-683
 */
export function escolherParaSlot<T extends Escalavel>(lista: readonly T[], slot: number): T | null {
  const [pos] = SLOTS[slot]!
  let [, lado, ex] = SLOTS[slot]!
  const ladoLivre = lado === -1
  const exLivre = ex === -1
  if (slot >= 18) ex = -1
  for (const p of FALLBACK_POS[pos]!) {
    for (let passe = 1; passe <= 3; passe++) {
      for (const j of lista) {
        if (ladoLivre) lado = j.lado
        if (exLivre) ex = j.ex
        if (passe === 2) lado = j.lado
        if (passe === 3) {
          lado = j.lado
          ex = j.ex
        }
        if (p === j.posicao && lado === j.lado && ex === j.ex) return j
      }
    }
  }
  return null
}

export interface Escalacao {
  /** em ordem de slot da formação */
  titulares: { id: number; slot: number }[]
  banco: number[]
  tatica: Tatica
}

export function disponivel(j: JogadorM, competicao: string, dia: number): boolean {
  const s = j.suspensoes[competicao]
  return j.lesaoAte <= dia && !(s && (s.amarelos >= 3 || s.jogos >= 1))
}

/** Força desc, energia desc. Fonte: h/b_0.java (abh) */
export const porForca = (a: JogadorM, b: JogadorM) => b.forca - a.forca || b.energia - a.energia

const FAIXAS_FORMACAO: [number, number][] = [[2, 1], [4, 2], [7, 3], [38, 4], [49, 5], [60, 6], [65, 7], [72, 8], [90, 9], [92, 10], [101, 11]]

/** Escalação e tática da IA. Fonte: best/ah.java:404-498 */
export function escalarIA(mundo: Mundo, timeId: number, competicao: string, rng: Rng, formacaoFixa?: number): Escalacao {
  const time = mundo.times[timeId]!
  const elegiveis = time.jogadores.map((id) => mundo.jogadores[id]!).filter((j) => disponivel(j, competicao, mundo.dia)).sort(porForca)
  const r = rng.int(100) + 1
  const formacao = formacaoFixa ?? FAIXAS_FORMACAO.find(([max]) => r <= max)![1]
  const titulares: Escalacao['titulares'] = []
  for (const slot of FORMACOES[formacao]!) {
    const j = escolherParaSlot(elegiveis, slot)
    if (!j) continue
    titulares.push({ id: j.id, slot })
    elegiveis.splice(elegiveis.indexOf(j), 1)
  }
  const banco: number[] = []
  for (const slot of BANCO) {
    const j = escolherParaSlot(elegiveis, slot)
    if (!j) continue
    banco.push(j.id)
    elegiveis.splice(elegiveis.indexOf(j), 1)
  }
  const e = rng.int(100) + 1
  const m = rng.int(100) + 1
  const jg = rng.int(100) + 1
  return {
    titulares,
    banco,
    tatica: { formacao, estilo: e <= 70 ? 0 : e <= 80 ? 1 : 2, marcacao: m <= 5 ? 2 : m <= 70 ? 0 : 1, jogada: jg <= 70 ? 0 : 1 },
  }
}
