// Contas da tela de Finanças a partir do extrato (lançamentos com dia): a série do caixa, os meses, o próximo salário e
// a projeção dos próximos 6 meses.
import {
  data, diaAbsoluto, diaDePagamento, domingo, folha, jogaNoMes, jurosDoMes, limiteEmprestimo, precoPadrao, valorPatrocinio,
  type Financas, type Lancamento, type Mundo, type TimeM,
} from '@bolasfoot/engine'

export type Dia = { dia: number; itens: Lancamento[]; saldo: number }

/** Lançamentos por dia em ordem (o sort é estável: a ordem dentro do dia fica), com o saldo ao fim de cada dia. */
export function porDia(f: Pick<Financas, 'caixa' | 'lancamentos'>): { inicial: number; dias: Dia[] } {
  const lista = [...(f.lancamentos ?? [])].sort((a, b) => a.dia - b.dia)
  const inicial = f.caixa - lista.reduce((s, l) => s + l.valor, 0)
  let saldo = inicial
  const dias: Dia[] = []
  for (const l of lista) {
    saldo += l.valor
    const d = dias.at(-1)
    if (d?.dia === l.dia) {
      d.itens.push(l)
      d.saldo = saldo
    } else dias.push({ dia: l.dia, itens: [l], saldo })
  }
  return { inicial, dias }
}

/** `entrouProj`/`saiuProj`: a parte projetada do mês (só nos meses de hoje em diante). */
export type Mes = { ano: number; mes: number; entrou: number; saiu: number; entrouProj?: number; saiuProj?: number }

/** Entradas e saídas somadas por mês, em ordem. */
export function porMes(dias: Dia[]): Mes[] {
  const meses: Mes[] = []
  for (const d of dias) {
    const { ano, mes } = data(d.dia)
    let x = meses.at(-1)
    if (x?.ano !== ano || x.mes !== mes) meses.push((x = { ano, mes, entrou: 0, saiu: 0 }))
    for (const l of d.itens) {
      if (l.valor > 0) x.entrou += l.valor
      else x.saiu -= l.valor
    }
  }
  return meses
}

/** Próximo dia de salário ainda não processado e se ele cobra (no mensal, só em mês com jogo). */
export function proximaFolha(m: Mundo, t: TimeM): { dia: number; cobra: boolean } {
  const mensal = m.opcoes.salarioMensal ?? true
  let dia = m.diaEventos + 1
  while (!(mensal ? diaDePagamento(dia) : domingo(dia))) dia++
  const { ano, mes } = data(dia)
  return { dia, cobra: !mensal || jogaNoMes(m, t.id, ano, mes) }
}

/**
 * Caixa dia a dia de hoje até 6 meses à frente: o pedido da rodada (`pedido`, + sai do caixa), salários pela regra do
 * motor (eventosEconomicos), juros do dia 2 sobre `divida` (já com o pedido do banco), bilheteria dos jogos em casa e o
 * patrocínio da virada. Depois do fim do calendário não há jogos marcados: o salário é cobrado todo mês.
 */
export function projetar(m: Mundo, t: TimeM, { pedido = 0, divida = t.financas?.emprestimo ?? 0 } = {}): { pontos: [number, number][]; meses: Mes[] } {
  const mensal = m.opcoes.salarioMensal ?? true
  const { ano, mes, dia } = data(m.dia)
  const fim = diaAbsoluto(ano + Math.floor((mes + 5) / 12), ((mes + 5) % 12) + 1, Math.min(dia, 28))
  const virada = m.calendario.inicio + m.calendario.tipos.length
  const valorFolha = folha(m, t), juros = jurosDoMes(divida, limiteEmprestimo(m, t))
  // ponytail: bilheteria por média histórica, não publico() com RNG
  const rendas = (t.financas?.lancamentos ?? []).filter((l) => l.cat === 'bilheteria' && l.valor > 0)
  const renda = rendas.length
    ? Math.round(rendas.reduce((x, l) => x + l.valor, 0) / rendas.length)
    : Math.round(t.estadio.setores.reduce((x, n, k) => x + (n / 2) * precoPadrao(1, t)[k]!, 0)) // sem histórico: meia casa
  const emCasa = new Map<number, number>()
  for (const c of m.competicoes) {
    if (c.tipo === 5 || c.tipo === 7) continue // sem bilheteria no Mundial e em seleções
    for (const f of c.fases)
      for (const j of f.tipo === 'liga' ? f.jogos : f.rodadas.flatMap((r) => r.jogos))
        if (j.casa === t.id && !j.gols && j.dia >= m.dia && j.dia <= fim) emCasa.set(j.dia, (emCasa.get(j.dia) ?? 0) + 1)
  }
  let saldo = t.financas?.caixa ?? 0
  const pontos: [number, number][] = [[m.dia, saldo]]
  const meses: Mes[] = []
  const lancar = (d: number, v: number) => {
    if (!v) return
    const x = data(d)
    let mm = meses.at(-1)
    if (mm?.ano !== x.ano || mm.mes !== x.mes) meses.push((mm = { ano: x.ano, mes: x.mes, entrou: 0, saiu: 0, entrouProj: 0, saiuProj: 0 }))
    if (v > 0) mm.entrouProj! += v
    else mm.saiuProj! -= v
    saldo += v
  }
  lancar(m.dia, -pedido)
  for (let d = Math.min(m.diaEventos + 1, m.dia); d <= fim; d++) {
    const x = data(d)
    if (d === virada) lancar(d, valorPatrocinio(m, t))
    lancar(d, (emCasa.get(d) ?? 0) * renda)
    if (d > m.diaEventos) {
      if ((mensal ? diaDePagamento(d) : domingo(d)) && (d >= virada || !mensal || jogaNoMes(m, t.id, x.ano, x.mes))) lancar(d, -valorFolha)
      if (diaDePagamento(d)) lancar(d, -juros)
    }
    if (saldo !== pontos.at(-1)![1]) pontos.push([Math.max(d, m.dia), saldo])
  }
  pontos.push([fim, saldo])
  return { pontos, meses }
}

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
