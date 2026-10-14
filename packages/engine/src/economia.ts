// Economia: valor, salário e contrato dos jogadores; caixa dos times humanos (a IA não tem caixa).
// Fontes: best/F.java:914-1022 (fJ salário, fK valor), best/ah.java:1671-1730 (caixa, folha),
// best/C.java (extrato, empréstimo, juros), best/a.java:687-717 (eventos ds/dJ), a/cq_0.java (obras),
// best/f_0.java:1613 (aw: fim das obras), best/I.java:383 (hf: bilheteria), best/ah.java:813 (prêmios de liga),
// f/g_0.java:93-140 + :438 (prêmios por fase de copa).
import { data, diaDaSemana, diaDePagamento } from './calendario.ts'
import type { Competicao, FaseMataMata } from './competicoes.ts'
import type { JogadorM, Mundo, TimeM } from './mundo.ts'

export interface Financas {
  caixa: number
  /** saldo do empréstimo (C.dW) */
  emprestimo: number
  /** juros do mês: 3% do saldo (C.dX) */
  juros: number
  /** extrato da temporada (C: dN, dM, dL, dO, dP / dR, dT, dQ, dV, dS, dU) */
  receitas: { bilheteria: number; premios: number; vendas: number; patrocinio: number; multas: number }
  despesas: { compras: number; juros: number; obras: number; comissoes: number; salarios: number; outras: number }
  /** obra em andamento: lugares a mais por setor e dia em que termina */
  obra: { setores: [number, number, number, number]; fim: number } | null
}

// ── Jogador ───────────────────────────────────────────────────────────────

type JogadorEco = Pick<JogadorM, 'forca' | 'idade' | 'posicao' | 'estrela' | 'craque' | 'titular' | 'juvenil' | 'potencial'> &
  Partial<Pick<JogadorM, 'promovidoEm' | 'preco'>>
type TimeEco = Pick<TimeM, 'nivel' | 'divisao' | 'pais'>

/** Países "ricos" (aq.rW, best/aq.java:553): salário-base maior. */
const RICOS = [3, 72, 104, 97, 65]

/**
 * Valor de mercado. `continentePais` = continente do país do jogador (ac.gg(): 0 Europa).
 * O junior promovido vale 18% na temporada em que subiu (no máximo o preço pedido), 35% na seguinte e 65% na outra.
 * Fonte: best/F.java:975-1022 (fK).
 */
export function valorJogador(j: JogadorEco, time: TimeEco | null, continentePais: number, temporada = 0): number {
  const nivel = time?.nivel ?? 10
  const europa = continentePais === 0
  let mult = nivel >= 21 ? 750 : nivel >= 20 ? 600 : nivel >= 18 ? 500 : nivel >= 12 ? 400 : 366
  if (j.estrela) mult = nivel >= 22 && europa ? mult * 3 : nivel >= 21 && europa ? mult * 2 : Math.round(1.7 * mult)
  if (j.craque) mult = Math.round(1.6 * mult)
  if (j.posicao === 4) mult = Math.round(1.3 * mult)
  if (j.titular) mult = Math.round(mult + 0.2 * mult)
  const i = Math.max(j.idade, 16)
  mult += i < 20 ? (32 - i) * 27 : i <= 25 ? (32 - i) * 22 : i < 32 ? (32 - i) * 15 : i < 34 ? (34 - i) * 10 : -(i - 34) * 50
  if (mult <= 0) mult = 60
  let v = 2 * j.forca * (2 * j.forca) * mult
  const p = j.promovidoEm ?? 0
  if (j.juvenil) v = Math.round(v * 0.03) * j.potencial
  else if (p > 0 && temporada === p) {
    v = Math.round(v * 0.18)
    if (v > (j.preco ?? 0) && (j.preco ?? 0) > 0) v = j.preco!
  } else if (p > 0 && temporada - 1 === p) v = Math.round(v * 0.35)
  else if (p > 0 && temporada - 2 === p) v = Math.round(v * 0.65)
  if (j.juvenil && j.potencial === 10) v = Math.round(v * 1.5)
  return v
}

/** Salário (semanal; ×4 se o salário é mensal). Fonte: best/F.java:914-972 (fJ) */
export function salarioJogador(j: JogadorEco, time: TimeEco | null, mensal: boolean): number {
  let base = 350
  if (time) {
    const d = time.divisao
    if (RICOS.includes(time.pais)) base = d === 1 ? 750 : d === 2 ? 550 : d === 3 ? 500 : d === 4 || d === 5 ? 450 : 350
    else base = d === 1 ? 600 : d === 2 ? 500 : d === 3 ? 450 : d === 4 || d === 5 ? 400 : 350
    if (time.nivel > 20) base += 50
  }
  base -= [70, 30, 40, 0, 50][j.posicao]!
  base = Math.round(0.5 * base)
  const bruto = j.forca * 2 * base
  const extra = j.estrela ? j.forca * 250 : 0
  let s = j.idade < 32 ? bruto + extra : bruto - (j.idade - 32) * 300 + extra
  if (s < 500) s = 500
  if (j.craque) s = Math.round(s * 1.4)
  if (j.juvenil) s = Math.round(s * 0.1)
  return mensal ? s * 4 : s
}

/** Recalcula valor e salário de todos (criação do mundo e virada da temporada). Fonte: best/f_0.java:1104-1108 */
export function atualizarValores(mundo: Mundo, continentes: (pais: number) => number): void {
  for (const j of mundo.jogadores) {
    const t = mundo.times[j.time] ?? null
    j.valor = valorJogador(j, t, continentes(j.pais), mundo.temporada)
    j.salario = salarioJogador(j, t, mundo.opcoes.salarioMensal ?? true)
  }
}

/** Folha do elenco + juniores. Fonte: best/ah.java:1720-1733 (kK) */
export function folha(mundo: Mundo, t: TimeM): number {
  return [...t.jogadores, ...t.juniores].reduce((s, id) => s + mundo.jogadores[id]!.salario, 0)
}

// ── Caixa ─────────────────────────────────────────────────────────────────

/** Caixa inicial e patrocínio anual por divisão (0 = fora das séries). Fonte: best/aq.java:658-659 (sC, sD) */
const CAIXA_INICIAL = [3_500_000, 15_000_000, 12_000_000, 10_000_000, 3_500_000]
const PATROCINIO = [3_500_000, 6_000_000, 4_500_000, 2_500_000, 2_000_000]
/** Limite do empréstimo por divisão. Fonte: best/C.java:229 (m) */
const LIMITE_EMPRESTIMO = [1_000_000, 5_000_000, 3_000_000, 2_000_000, 1_500_000]
const BLOCO = 500_000

const div = (t: TimeM) => (t.divisao >= 0 && t.divisao <= 4 ? t.divisao : 0)

/**
 * O time passa a ter caixa (técnico humano assumiu). O patrocínio do 1º ano já está no caixa inicial.
 * Fonte: best/ah.java:1700-1707 (kH), :2138 (lg)
 */
export function abrirCaixa(mundo: Mundo, timeId: number): Financas {
  const t = mundo.times[timeId]!
  let caixa = CAIXA_INICIAL[div(t)]!
  // estrangeiro com estaduais ligados: +3,2 folhas (ah.java:1702)
  if (t.pais !== 29) caixa = Math.round(caixa + 3.2 * folha(mundo, t))
  t.financas = {
    caixa,
    emprestimo: 0,
    juros: 0,
    receitas: { bilheteria: 0, premios: 0, vendas: 0, patrocinio: PATROCINIO[div(t)]!, multas: 0 },
    despesas: { compras: 0, juros: 0, obras: 0, comissoes: 0, salarios: 0, outras: 0 },
    obra: null,
  }
  return t.financas
}

export function receber(t: TimeM, valor: number, cat: keyof Financas['receitas']): void {
  if (!t.financas) return
  t.financas.caixa += valor
  t.financas.receitas[cat] += valor
}

export function pagar(t: TimeM, valor: number, cat: keyof Financas['despesas']): void {
  if (!t.financas) return
  t.financas.caixa -= valor
  t.financas.despesas[cat] += valor
}

/** Patrocínio anual, pago na virada da temporada (W7). Fonte: best/ah.java:1692-1698 (kG) */
export function receberPatrocinio(mundo: Mundo, t: TimeM): void {
  if (!t.financas) return
  if (t.pais !== 29) t.financas.caixa = Math.round(t.financas.caixa + 3.2 * folha(mundo, t))
  receber(t, PATROCINIO[div(t)]!, 'patrocinio')
}

/** Zera o extrato da temporada (ah.kI → C.eA). */
export function zerarExtrato(t: TimeM): void {
  if (!t.financas) return
  for (const k of Object.keys(t.financas.receitas) as (keyof Financas['receitas'])[]) t.financas.receitas[k] = 0
  for (const k of Object.keys(t.financas.despesas) as (keyof Financas['despesas'])[]) t.financas.despesas[k] = 0
}

/** Até quanto o time pode dever (por divisão) e o tamanho de cada parcela. */
export const limiteEmprestimo = (t: TimeM) => LIMITE_EMPRESTIMO[div(t)]!
export const PARCELA_EMPRESTIMO = BLOCO

const atualizarJuros = (f: Financas) => (f.juros = f.emprestimo > 0 ? Math.floor((f.emprestimo * 3) / 100) : 0)

/** Pega 500 mil, até o limite da divisão. Fonte: best/C.java:228-238 (m) */
export function pegarEmprestimo(t: TimeM): boolean {
  const f = t.financas
  if (!f || f.emprestimo >= LIMITE_EMPRESTIMO[div(t)]!) return false
  f.emprestimo += BLOCO
  f.caixa += BLOCO
  atualizarJuros(f)
  return true
}

/** Devolve 500 mil, se houver dívida e caixa. Fonte: best/C.java:218-226 (l) */
export function pagarEmprestimo(t: TimeM): boolean {
  const f = t.financas
  if (!f || f.emprestimo <= 0 || f.caixa < BLOCO) return false
  f.emprestimo -= BLOCO
  f.caixa -= BLOCO
  atualizarJuros(f)
  return true
}

/** O time tem jogo marcado no mês (ah.bY, best/ah.java:2228). */
function jogaNoMes(mundo: Mundo, timeId: number, ano: number, mes: number): boolean {
  for (const c of mundo.competicoes)
    for (const f of c.fases)
      for (const j of f.tipo === 'liga' ? f.jogos : f.rodadas.flatMap((r) => r.jogos))
        if ((j.casa === timeId || j.fora === timeId) && data(j.dia).mes === mes && data(j.dia).ano === ano) return true
  return false
}

/**
 * Eventos de dinheiro de um dia, na ordem do f_0.aS (salário, depois juros), e o fim das obras.
 * Fonte: best/f_0.java:1951-1970 (aS), best/a.java:687-717 (n, o), best/f_0.java:1613 (aw)
 */
export function eventosEconomicos(mundo: Mundo, dia: number): void {
  const humanos = mundo.times.filter((t) => t.financas)
  if (humanos.length === 0) return
  const { ano, mes } = data(dia)
  const pagaSalario = (mundo.opcoes.salarioMensal ?? true) ? diaDePagamento(dia) : diaDaSemana(dia) === 1
  for (const t of humanos) {
    const f = t.financas!
    if (pagaSalario && jogaNoMes(mundo, t.id, ano, mes)) pagar(t, folha(mundo, t), 'salarios')
    if (diaDePagamento(dia) && f.juros > 0) pagar(t, f.juros, 'juros')
    if (f.obra && f.obra.fim < dia) {
      f.obra.setores.forEach((n, k) => (t.estadio.setores[k] = t.estadio.setores[k]! + n))
      f.obra = null
    }
  }
}

// ── Estádio ───────────────────────────────────────────────────────────────

/** Teto por setor conforme a temporada. Fonte: best/aq.java:107 (pa) */
const TETO_ESTADIO = [[18000, 80000, 9000, 700], [20000, 100000, 10000, 800], [22000, 110000, 10000, 900], [25000, 120000, 10000, 1200]]
/** Preço por lugar e faixas de capacidade final, por setor. Fonte: a/cq_0.java:175-189 (I) */
const PRECO_LUGAR = [[80, 160, 240, 500, 700], [120, 380, 640, 700, 1400], [300, 600, 750, 800, 1200], [1500, 3500, 4000, 6000, 6400]]
const FAIXA_LUGAR = [[1000, 2500, 3500, 10000, 18000], [5000, 15000, 30000, 60000, 80000], [1000, 2000, 3000, 5000, 9000], [100, 200, 500, 600, 700]]

/**
 * Teto de cada setor. O original testa `H >= 2` antes de `>= 6` e `>= 10`, então fica sempre em pa[1]
 * a partir da 2ª temporada; aqui as faixas valem como pretendido. Fonte: a/cq_0.java:71-78
 */
export const tetoEstadio = (temporada: number) => TETO_ESTADIO[temporada >= 10 ? 3 : temporada >= 6 ? 2 : temporada >= 2 ? 1 : 0]!

/** Custo e duração de uma ampliação. Fonte: a/cq_0.java:117-139 (oH), :160-189 (cZ, I) */
export function orcamentoObra(t: TimeM, mais: readonly number[]): { custo: number; dias: number } {
  let custo = 100_000, total = 0
  mais.forEach((n, k) => {
    const final = t.estadio.setores[k]! + n
    const faixa = FAIXA_LUGAR[k]!.findIndex((lim) => final <= lim)
    custo += PRECO_LUGAR[k]![faixa === -1 ? 4 : faixa]! * n
    total += n
  })
  return { custo, dias: total < 1000 ? 15 : total < 10000 ? 20 : total < 30000 ? 30 : 40 }
}

/** Começa uma obra: paga à vista. Fonte: a/cq_0.java:141-156 (oI) */
export function iniciarObra(mundo: Mundo, timeId: number, mais: [number, number, number, number]): string | null {
  const t = mundo.times[timeId]!
  const f = t.financas
  if (!f) return 'time sem caixa'
  if (f.obra) return 'já há uma obra em andamento'
  const teto = tetoEstadio(mundo.temporada)
  if (mais.some((n, k) => n < 0 || t.estadio.setores[k]! + n > teto[k]!)) return 'acima do teto do setor'
  if (mais.every((n) => n === 0)) return 'nada a construir'
  const { custo, dias } = orcamentoObra(t, mais)
  if (f.caixa < custo) return 'sem dinheiro para essa expansão'
  pagar(t, custo, 'obras')
  f.obra = { setores: [...mais], fim: mundo.dia + dias }
  return null
}

// ── Prêmios ───────────────────────────────────────────────────────────────

/** Liga, top 6 por divisão; estadual (1ª divisão), top 4. Fonte: best/aq.java:573, :576 (sr, su) */
const PREMIO_LIGA = [[], [5_000_000, 3_500_000, 2_000_000, 1_500_000, 1_000_000, 500_000], [2_500_000, 2_000_000, 1_000_000, 500_000, 250_000, 100_000], [1_500_000, 1_000_000, 500_000, 300_000, 150_000, 75_000], [750_000, 500_000, 300_000, 200_000, 100_000, 50_000]]
const PREMIO_ESTADUAL = [700_000, 500_000, 300_000, 100_000]
/** Copa nacional por fase vencida (índice a partir da final) e regionais. Fonte: best/aq.java:574, :577 (ss, sv) */
const PREMIO_COPA = [1_000_000, 2_000_000, 4_000_000, 5_000_000, 7_000_000, 15_000_000, 20_000_000, 25_000_000]
const PREMIO_REGIONAL = [100_000, 100_000, 400_000]

/** Prêmio pela colocação final, só humanos. Fonte: best/ah.java:813-829 (c) */
export function premioColocacao(t: TimeM, c: Competicao, pos: number): void {
  let v = 0
  if (c.tipo === 1) v = PREMIO_LIGA[div(t)]?.[pos - 1] ?? 0
  else if (c.tipo === 3 && c.divisao === 1) v = PREMIO_ESTADUAL[pos - 1] ?? 0
  if (v > 0) receber(t, v, 'premios')
}

/** Continental 1 por fase vencida, por confederação (0 UEFA … 5 OFC). Fonte: best/aq.java:578-621 (sw) */
const PREMIO_CONT1 = [
  [2_000_000, 5_000_000, 7_000_000, 25_000_000, 30_000_000], [2_000_000, 3_500_000, 5_000_000, 20_000_000, 40_000_000],
  [500_000, 1_500_000, 2_000_000, 4_000_000, 40_000_000], [500_000, 1_500_000, 2_000_000, 4_000_000, 40_000_000],
  [500_000, 1_500_000, 2_000_000, 4_000_000, 40_000_000], [200_000, 500_000, 1_000_000, 2_000_000, 20_000_000],
]
/** Continental 2 e Conference (0 UEFA, 1 o resto), Mundial. Fonte: best/aq.java:622-656 (sx, sy, aeG) */
const PREMIO_CONT2 = [[500_000, 700_000, 2_000_000, 2_500_000, 7_000_000], [500_000, 1_000_000, 1_500_000, 5_000_000, 5_000_000]]
const PREMIO_MUNDIAL = [2_000_000, 5_000_000, 7_000_000]

/**
 * Prêmio por fase de mata-mata vencida, só humanos. `rodada` = índice da rodada na fase; `nRodadas` = rodadas do
 * chaveamento. Nas continentais as preliminares (código da fase) pagam fixo. Fonte: f/g_0.java:93-162 (c), :438-447 (V)
 */
export function premioFase(t: TimeM, c: Competicao, f: FaseMataMata, rodada: number, nRodadas: number): void {
  let v = 0
  const cod = f.formato, conf = c.confederacao ?? 1
  if (c.tipo === 2) v = PREMIO_COPA[rodada + PREMIO_COPA.length - nRodadas] ?? 0
  else if (c.tipo === 10) v = PREMIO_REGIONAL[rodada] ?? 0
  else if (c.tipo === 4) v = cod >= 4101 && cod <= 4103 ? 500_000 : cod >= 4000 && cod <= 4004 ? 1_000_000 : PREMIO_CONT1[conf < 0 ? 1 : conf]?.[rodada] ?? 0
  else if (c.tipo === 6 || c.tipo === 12) v = cod === 6100 ? 300_000 : cod >= 6000 && cod <= 6004 ? 500_000 : PREMIO_CONT2[conf === 0 ? 0 : 1]![rodada] ?? 0
  else if (c.tipo === 5) v = PREMIO_MUNDIAL[rodada] ?? 0
  else if (c.tipo === 8 || c.tipo === 11) v = 1_000_000
  if (v > 0) receber(t, v, 'premios')
}
