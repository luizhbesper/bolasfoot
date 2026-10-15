import type { JogadorM } from '@bolasfoot/engine'
import { expect, test } from 'vitest'
import { dentro } from './procura.tsx'

test('faixas: mín e máx inclusivos, na unidade mostrada; preço é o pedido de quem está à venda', () => {
  const j = { idade: 25, forca: 70, energia: 90, valor: 2_000_000, preco: 5_000_000, aVenda: false, salario: 40_000 } as JogadorM
  expect(dentro(j, {})).toBe(true)
  expect(dentro(j, { idade: { min: 25, max: 25 }, forca: { min: 70 }, salario: { max: 40 } })).toBe(true)
  expect(dentro(j, { energia: { min: 91 } })).toBe(false)
  expect(dentro(j, { preco: { max: 2 } })).toBe(true)
  expect(dentro({ ...j, aVenda: true }, { preco: { max: 2 } })).toBe(false)
  expect(dentro(j, { preco: { min: 2.5 } })).toBe(false)
})
