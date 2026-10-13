// Calendário da temporada. Datas são dias absolutos (dias desde 1970-01-01), sem Date.
// Fonte: best/a.java (um objeto por dia, tipo de competição em `w`), best/f_0.java:1929-1970 (r, aS).

/** Ano da 1ª temporada (o original usa 2022, `f_0.rM`); temporada n = ANO_INICIAL + n − 1 (f_0.java:1215). */
export const ANO_INICIAL = 2026

/** Tipos de dia (a.java:37-61; aq.tz). 100 e 200 = datas de amistoso de clube e de seleção. */
export const TIPO = {
  liga: 1, copa: 2, estadual: 3, continental1: 4, mundial: 5, continental2: 6, selecoes: 7, recopa: 8,
  eliminatorias: 9, regional: 10, supercopa: 11, conference: 12, finalissima: 13, ligaNacoes: 14,
  preTemporada: 15, amistosoClube: 100, amistosoSelecao: 200,
} as const

export interface Calendario {
  ano: number
  /** dia absoluto de 1º de janeiro */
  inicio: number
  /** tipo de cada dia do ano (0 = livre), índice = dia − inicio */
  tipos: number[]
}

/** Dias desde 1970-01-01 (algoritmo days_from_civil de H. Hinnant). mes 1..12 */
export function diaAbsoluto(ano: number, mes: number, dia: number): number {
  const y = mes <= 2 ? ano - 1 : ano
  const era = Math.floor(y / 400)
  const yoe = y - era * 400
  const doy = Math.floor((153 * (mes + (mes > 2 ? -3 : 9)) + 2) / 5) + dia - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

/** Inverso de diaAbsoluto (civil_from_days). */
export function data(n: number): { ano: number; mes: number; dia: number } {
  const z = n + 719468
  const era = Math.floor(z / 146097)
  const doe = z - era * 146097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const mes = mp < 10 ? mp + 3 : mp - 9
  return { ano: yoe + era * 400 + (mes <= 2 ? 1 : 0), mes, dia: doy - Math.floor((153 * mp + 2) / 5) + 1 }
}

/** Dia da semana como Calendar.DAY_OF_WEEK do Java: 1 = domingo … 7 = sábado (1970-01-01 foi quinta). */
export const diaDaSemana = (n: number) => ((((n + 4) % 7) + 7) % 7) + 1

export const formatarData = (n: number) => {
  const d = data(n)
  return `${String(d.dia).padStart(2, '0')}/${String(d.mes).padStart(2, '0')}/${d.ano}`
}

/** Sequência fixa (diaDaSemana, tipo) que aloca as datas do ano. Fonte: best/a.java:249-499 (g) */
// prettier-ignore
const SEQUENCIA: readonly (readonly [number, number])[] = [
  [1,100],[2,15],[3,15],[4,10],[5,10],[6,15],[7,10],[1,10],[2,10],[3,10],[4,10],[5,10],[6,15],[7,10],[1,15],[2,10],[3,100],[4,10],[5,100],[6,10],[7,100],
  [1,3],[3,3],[5,3],[1,3],[3,3],[5,3],[7,11],[1,3],[3,3],[5,3],[7,200],[1,3],[3,3],[5,3],[1,3],[3,3],[5,3],[1,3],[3,3],[4,4],[5,3],[1,3],[3,3],[5,4],
  [1,3],[3,3],[5,4],[1,3],[3,100],[4,4],[5,200],[1,1],[2,100],[4,4],[6,12],[1,1],[2,200],[4,4],[1,1],[2,9],[4,4],[6,9],[1,1],[2,14],[4,4],[5,14],[6,12],
  [7,200],[1,1],[2,14],[3,2],[5,4],[6,12],[1,1],[4,2],[6,12],[1,1],[2,9],[4,4],[5,6],[1,1],[4,4],[5,6],[7,200],[1,1],[2,9],[4,4],[5,12],[6,9],[1,1],[3,2],
  [4,4],[5,6],[6,14],[1,1],[2,14],[3,2],[5,6],[6,12],[7,14],[1,1],[3,100],[4,4],[5,6],[1,1],[2,9],[4,4],[5,6],[7,200],[1,1],[2,9],[4,2],[5,12],[6,9],[1,1],
  [2,12],[3,2],[4,4],[5,6],[7,200],[1,1],[2,9],[3,4],[4,6],[5,7],[7,7],[2,7],[4,7],[6,7],[1,7],[4,7],[1,7],[4,1],[6,12],[1,1],[2,13],[3,100],[4,4],[5,6],
  [1,1],[2,9],[3,2],[5,6],[6,12],[7,200],[1,1],[2,9],[3,2],[5,6],[6,12],[7,9],[1,1],[2,9],[4,4],[5,6],[6,9],[7,200],[1,1],[2,13],[4,4],[5,9],[6,12],[7,9],
  [1,1],[2,9],[3,100],[4,4],[5,1],[6,9],[1,1],[2,14],[3,2],[4,4],[5,6],[6,14],[1,1],[2,9],[3,2],[4,4],[5,6],[6,9],[1,1],[2,9],[4,2],[5,6],[6,12],[7,200],
  [1,1],[2,12],[4,2],[5,6],[6,12],[1,1],[2,12],[4,2],[2,14],[6,12],[7,14],[1,1],[2,9],[4,2],[5,6],[6,12],[1,1],[2,9],[3,8],[4,12],[5,1],[6,9],[1,1],[3,8],
  [4,6],[5,1],[6,12],[7,200],[1,1],[2,9],[3,100],[4,6],[5,1],[6,9],[1,1],[2,9],[3,100],[4,6],[5,1],[6,12],[1,1],[2,12],[3,1],[4,9],[5,1],[6,12],[7,1],
  [1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,5],[7,5],[2,5],
]

/** Índice (no ano) do 1º domingo de janeiro: o dia corrente ao criar o calendário (f_0.java:1941, `l(n5)`). */
export const primeiroDomingo = (inicio: number) => (8 - diaDaSemana(inicio)) % 7

/** Cria o calendário do ano. Fonte: best/f_0.java:1929 (r) + best/a.java:249 (g) */
export function criarCalendario(ano: number): Calendario {
  const inicio = diaAbsoluto(ano, 1, 1)
  const tipos = new Array<number>(diaAbsoluto(ano + 1, 1, 1) - inicio).fill(0)
  const atual = primeiroDomingo(inicio)
  for (const [dow, tipo] of SEQUENCIA) {
    // a.java:222 (b): parte do último dia já alocado (o laço não olha o índice 0) ou do dia corrente,
    // e pega o 1º dia livre com esse dia da semana; sem vaga, a data é descartada
    let ultimo = 0
    for (let i = tipos.length - 1; i > 0; i--) if (tipos[i]! > 0) { ultimo = i; break }
    for (let i = Math.max(ultimo, atual); i < tipos.length; i++)
      if (tipos[i] === 0 && diaDaSemana(inicio + i) === dow) {
        if (i > 0) tipos[i] = tipo
        break
      }
  }
  return { ano, inicio, tipos }
}

/** Dias absolutos das datas de um tipo, em ordem: a rodada k vai na k-ésima. Fonte: best/a.java:171 (a(int, boolean)) */
export const datas = (c: Calendario, tipo: number) => c.tipos.flatMap((t, i) => (t === tipo ? [c.inicio + i] : []))

/** Dia de salário mensal e juros: dia 2 do mês (f_0.java:1951 aS, `a.d()`). */
export const diaDePagamento = (n: number) => data(n).dia === 2

/** Domingo: evolução semanal e salário semanal (f_0.java:1951 aS, `a.c(1)`). */
export const domingo = (n: number) => diaDaSemana(n) === 1
