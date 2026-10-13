import { expect, test } from 'vitest'
import { criarRng, derivar, Rng } from './rng.ts'

test('sfc32: vetor conhecido', () => {
  // calculado à mão a partir do estado (0,0,0,1)
  const r = new Rng([0, 0, 0, 1])
  expect([r.next(), r.next(), r.next()]).toEqual([1, 2, 12])
})

test('mesma seed → mesma sequência; seeds diferentes divergem', () => {
  const seq = (s: string) => {
    const r = criarRng(s)
    return Array.from({ length: 20 }, () => r.int(1000))
  }
  expect(seq('abc')).toEqual(seq('abc'))
  expect(seq('abc')).not.toEqual(seq('abd'))
})

test('derivar dá streams independentes e estáveis', () => {
  expect(derivar('g', 'x').next()).toBe(derivar('g', 'x').next())
  expect(derivar('g', 'x').next()).not.toBe(derivar('g', 'y').next())
})

test('int(n) uniforme e float em [0,1)', () => {
  const r = criarRng('uniforme')
  const n = 10, N = 100_000
  const c = new Array<number>(n).fill(0)
  for (let i = 0; i < N; i++) c[r.int(n)]!++
  const chi = c.reduce((s, x) => s + (x - N / n) ** 2 / (N / n), 0)
  expect(chi).toBeLessThan(27.9) // p = 0.001, 9 g.l.
  for (let i = 0; i < 1000; i++) {
    const f = r.float()
    expect(f >= 0 && f < 1).toBe(true)
  }
  expect(() => r.int(0)).toThrow()
})

test('ponderado segue os pesos', () => {
  const r = criarRng('peso')
  const c = [0, 0, 0]
  for (let i = 0; i < 30_000; i++) c[r.ponderado([1, 2], [1, 1.5])]!++
  expect(c[2]).toBe(0)
  expect(c[1]! / c[0]!).toBeGreaterThan(2.8)
  expect(c[1]! / c[0]!).toBeLessThan(3.2)
})

test('estado/restaurar continua a mesma sequência', () => {
  const r = criarRng('s')
  r.int(10)
  const copia = new Rng(JSON.parse(JSON.stringify(r.estado())))
  expect(Array.from({ length: 5 }, () => copia.next())).toEqual(Array.from({ length: 5 }, () => r.next()))
})
