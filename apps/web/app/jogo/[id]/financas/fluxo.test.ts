import { criarCalendario, diaAbsoluto, domingo, parcelaPrice, taxaJuros, type Mundo, type TimeM } from '@bolasfoot/engine'
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

test('projeção de 6 meses: salário semanal e as parcelas do dia 2', () => {
  const hoje = diaAbsoluto(2026, 3, 10)
  const m = {
    dia: hoje, diaEventos: hoje - 1, temporada: 1, opcoes: { salarioMensal: false }, calendario: criarCalendario(2026),
    competicoes: [], jogadores: [{ salario: 1_000, valor: 10_000_000 }],
  } as unknown as Mundo
  const parcela = parcelaPrice(600_000, 0.02, 6)
  const t = {
    id: 0, jogadores: [0], juniores: [], divisao: 1, pais: 29, estadio: { setores: [0, 0, 0, 0] },
    financas: { caixa: 1_000_000, emprestimo: 600_000, lancamentos: [],
      contratos: [{ id: 1, valor: 600_000, parcelas: 6, restantes: 6, taxa: 0.02, parcela, saldo: 600_000, dia: hoje }] },
  } as unknown as TimeM
  const fim = diaAbsoluto(2026, 9, 10)
  let domingos = 0
  for (let d = hoje; d <= fim; d++) if (domingo(d)) domingos++
  const { pontos, meses } = projetar(m, t)
  // dia 2 de abr a set: as 6 parcelas (a última fecha o saldo, diferença de arredondamento)
  const banco = 1_000_000 - domingos * 1_000 - pontos.at(-1)![1]
  expect(Math.abs(banco - 6 * parcela)).toBeLessThanOrEqual(6)
  expect(banco).toBeGreaterThan(600_000)
  expect(meses.map((x) => x.mes)).toEqual([3, 4, 5, 6, 7, 8, 9])
  // quitar tira as parcelas; um novo de 500 mil em 36x entra hoje e cobra 6 parcelas na janela
  expect(projetar(m, t, { pedido: 600_000, quitar: [1] }).pontos.at(-1)![1]).toBe(400_000 - domingos * 1_000)
  const novo = projetar(m, t, { pedido: -500_000, quitar: [1], novos: [{ valor: 500_000, parcelas: 36 }] }).pontos.at(-1)![1]
  expect(1_500_000 - domingos * 1_000 - novo).toBe(6 * parcelaPrice(500_000, taxaJuros(500_000, 3_000_000, 36), 36))
})
