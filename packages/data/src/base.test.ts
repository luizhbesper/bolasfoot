import { expect, test } from 'vitest'
import type { Base } from './types.ts'
import base from '../base.json' with { type: 'json' }

const { times, paises, nomes, ligas, estaduais, ufs } = base as Base
const BRA = 29
const SULAMERICA = ['ARG', 'BOL', 'CHI', 'COL', 'EQU', 'PAR', 'PER', 'URU', 'VEN']
const porPais = (codigo: string) => times.filter((t) => paises[t.pais]!.codigo === codigo)

test('contagens', () => {
  expect(times).toHaveLength(657)
  expect(porPais('BRA')).toHaveLength(196)
  expect(porPais('ESP')).toHaveLength(0)
  expect(SULAMERICA.flatMap(porPais)).toHaveLength(79)
  expect(times.reduce((n, t) => n + t.jogadores.length, 0)).toBeGreaterThan(13000)
})

test('países e UFs', () => {
  expect(paises).toHaveLength(224)
  expect(paises[BRA]).toMatchObject({ codigo: 'BRA', nome: 'Brasil', continente: 1, nivel: 20 })
  expect(ufs).toHaveLength(27)
  expect(ufs[25]!.sigla).toBe('SP')
})

test('times', () => {
  expect(new Set(times.map((t) => t.fileRef)).size).toBe(times.length)
  for (const t of times) {
    expect(t.jogadores.length, t.fileRef).toBeGreaterThanOrEqual(11)
    expect(t.nivel).toBeGreaterThanOrEqual(1)
    expect(t.nivel).toBeLessThanOrEqual(20)
    if (t.pais === BRA) expect(ufs[t.uf!], t.fileRef).toBeDefined()
    else expect(t.uf).toBeNull()
  }
  // Série A = 20 times de Nivel ≥ 16 (divisão derivada do Nivel, best/Z.java:112-228)
  expect(porPais('BRA').filter((t) => t.nivel >= 16)).toHaveLength(20)
})

test('ligas, estaduais e nomes', () => {
  expect(ligas.map((l) => l.nTimes)).toEqual([20, 20, 20, 64])
  expect(new Set(estaduais.map((e) => e.uf)).size).toBe(25)
  expect(nomes.BRA!.nomes.length).toBeGreaterThan(1000)
  for (const t of times) expect(nomes[paises[t.pais]!.codigo], t.fileRef).toBeDefined()
})
