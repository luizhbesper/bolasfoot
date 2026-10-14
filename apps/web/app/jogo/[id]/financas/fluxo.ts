// Contas da tela de Finanças a partir do extrato (lançamentos com dia): a série do caixa, os meses e o próximo salário.
import { data, diaDePagamento, domingo, jogaNoMes, type Financas, type Lancamento, type Mundo, type TimeM } from '@bolasfoot/engine'

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

export type Mes = { ano: number; mes: number; entrou: number; saiu: number }

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

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
