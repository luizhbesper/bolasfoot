import { expect, test } from 'vitest'
import { porDia, porMes } from './fluxo.ts'

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
