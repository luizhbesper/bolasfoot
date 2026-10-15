import { criarCalendario, diaAbsoluto, domingo, type Mundo, type TimeM } from '@bolasfoot/engine'
import { expect, test } from 'vitest'
import { porDia, porMes, projetar } from './fluxo.ts'

test('extrato por dia fecha com o caixa e soma os meses', () => {
  // 2026-01-02 = dia 20455; 2026-02-02 = 20486
  const f = {
    caixa: 1_000,
    lancamentos: [
      { dia: 20486, cat: 'salarios' as const, valor: -300 },
      { dia: 20455, cat: 'patrocinio' as const, valor: 500 },
      { dia: 20455, cat: 'compras' as const, valor: -100 },
    ],
  }
  const { inicial, dias } = porDia(f)
  expect(inicial).toBe(900)
  expect(dias.map((d) => [d.dia, d.saldo])).toEqual([[20455, 1_300], [20486, 1_000]])
  expect(dias[0]!.itens.map((l) => l.cat)).toEqual(['patrocinio', 'compras']) // a ordem do dia fica
  expect(porMes(dias)).toEqual([{ ano: 2026, mes: 1, entrou: 500, saiu: 100 }, { ano: 2026, mes: 2, entrou: 0, saiu: 300 }])
})

test('projeção de 6 meses: salário semanal e juros do dia 2 sobre a dívida', () => {
  const hoje = diaAbsoluto(2026, 3, 10)
  const m = {
    dia: hoje, diaEventos: hoje - 1, temporada: 1, opcoes: { salarioMensal: false }, calendario: criarCalendario(2026),
    competicoes: [], jogadores: [{ salario: 1_000, valor: 10_000_000 }],
  } as unknown as Mundo
  const t = {
    id: 0, jogadores: [0], juniores: [], divisao: 1, pais: 29, estadio: { setores: [0, 0, 0, 0] },
    financas: { caixa: 1_000_000, emprestimo: 1_000_000, lancamentos: [] },
  } as unknown as TimeM
  const fim = diaAbsoluto(2026, 9, 10)
  let domingos = 0
  for (let d = hoje; d <= fim; d++) if (domingo(d)) domingos++
  const juros = Math.floor(1_000_000 * (0.01 + 0.04 / 3)) // limite = 30% de 10 mi
  const { pontos, meses } = projetar(m, t)
  expect(pontos.at(-1)).toEqual([fim, 1_000_000 - domingos * 1_000 - 6 * juros]) // dia 2 de abr a set
  expect(meses.map((x) => x.mes)).toEqual([3, 4, 5, 6, 7, 8, 9])
  expect(meses.reduce((x, y) => x + y.saiuProj!, 0)).toBe(domingos * 1_000 + 6 * juros)
  // o pedido da rodada (pegar 500 mil) entra hoje e sobe os juros
  expect(projetar(m, t, { pedido: -500_000, divida: 1_500_000 }).pontos.at(-1)![1]).toBe(1_500_000 - domingos * 1_000 - 6 * Math.floor(1_500_000 * 0.03))
})
