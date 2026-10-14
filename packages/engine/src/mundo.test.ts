import { expect, test } from 'vitest'
import type { Base } from '@bolasfoot/data'
import baseJson from '@bolasfoot/data/base.json' with { type: 'json' }
import base2026 from '@bolasfoot/data/base-2026.json' with { type: 'json' }
import { forcaInicial, habilidadesIniciais, novoJogo, setoresEstadio, subperfil, BRA } from './mundo.ts'
import type { Rng } from './rng.ts'

const base = baseJson as Base
const maxRng = { int: (n: number) => n - 1 } as Rng
const minRng = { int: () => 0 } as unknown as Rng
const jog = { titular: false, estrela: false, craque: false, juvenil: false }
const serieA = { ligaNacional: true, divisao: 1, reputacao: 5, nivel: 20 }

test('força: titular de Série A nível 20 (F.java:538)', () => {
  // n7 = 25, base 20, +rand(3), titular +8+rand(2)
  expect(forcaInicial({ ...jog, titular: true }, serieA, 20, minRng).forca).toBe(53)
  expect(forcaInicial({ ...jog, titular: true }, serieA, 20, maxRng).forca).toBe(56)
  expect(forcaInicial({ ...jog, titular: true, estrela: true }, serieA, 20, maxRng).forca).toBe(67)
  expect(forcaInicial(jog, serieA, 20, minRng)).toEqual({ forca: 45, n8: 21, n6: 7 })
})

test('força: país fraco, sem liga e juvenil', () => {
  const estrangeiro = { ligaNacional: false, divisao: 0, reputacao: 3, nivel: 8 }
  expect(forcaInicial(jog, estrangeiro, 10, minRng).forca).toBe(8) // (8+5)·0.65
  const fraco = { ligaNacional: false, divisao: 0, reputacao: 0, nivel: 6 }
  expect(forcaInicial({ ...jog, juvenil: true }, fraco, 20, minRng).forca).toBe(7) // 7−23 < 5 → 10, ·0.7
})

test('habilidades: limites e goleiro com força', () => {
  const h = habilidadesIniciais({ posicao: 0, cr1: 1, cr2: 0, ex: 0, forca: 60 }, 21, 7, maxRng)
  expect(h.gol).toBe(60 + 1 + 1 + 2) // força+R(2), cr1 DPe +1+R(3)
  for (const pos of [1, 2, 3, 4] as const)
    for (const v of Object.values(habilidadesIniciais({ posicao: pos, cr1: 9, cr2: 13, ex: 1, forca: 99 }, 26, 7, maxRng)))
      expect(v).toBeLessThanOrEqual(100)
})

test('subperfil e estádio', () => {
  expect(subperfil(4, 8, 0)).toBe(2)
  expect(subperfil(3, 10, 0)).toBe(0)
  expect(subperfil(2, 9, 9)).toBe(0)
  expect(setoresEstadio(50000)).toEqual([7500, 37550, 4500, 450])
  expect(setoresEstadio(500).reduce((a, b) => a + b)).toBe(10000)
})

test('novoJogo: divisões, carga e determinismo', () => {
  const m = novoJogo(base, { habilidadeIndividual: true }, 'seed-teste')
  const br = m.times.filter((t) => t.pais === BRA)
  expect(br).toHaveLength(196)
  for (const d of [1, 2, 3]) expect(br.filter((t) => t.divisao === d)).toHaveLength(20)
  expect(br.filter((t) => t.divisao === 1).every((t) => t.nivel >= 16)).toBe(true)
  const porPais = new Map<number, number>()
  for (const t of m.times) porPais.set(t.pais, (porPais.get(t.pais) ?? 0) + 1)
  for (const [pais, n] of porPais) if (pais !== BRA) expect(n).toBeLessThanOrEqual(15)
  for (const j of m.jogadores) {
    expect(j.forca).toBeGreaterThan(0)
    expect(j.forca).toBeLessThanOrEqual(100)
    expect(j.habilidades).not.toBeNull()
  }
  for (const t of m.times) expect(t.jogadores.every((id) => m.jogadores[id]!.time === t.id)).toBe(true)
  expect(JSON.stringify(novoJogo(base, { habilidadeIndividual: true }, 'seed-teste'))).toBe(JSON.stringify(m))
  expect(novoJogo(base, { habilidadeIndividual: false }, 'outra').jogadores[0]!.habilidades).toBeNull()
})

test('novoJogo: base 2026 (mod) nasce com as Séries A–C reais pelo Nivel', () => {
  const b = base2026 as Base
  const m = novoJogo(b, { habilidadeIndividual: false }, 's')
  const serie = (d: number) => m.times.filter((t) => t.pais === BRA && t.divisao === d).map((t) => t.nome)
  for (const d of [1, 2, 3]) expect(serie(d)).toHaveLength(20)
  expect(serie(1)).toEqual(expect.arrayContaining(['Flamengo', 'Palmeiras', 'Remo', 'Chapecoense', 'Mirassol']))
  expect(serie(1)).not.toContain('América Mineiro')
  expect(serie(2)).toEqual(expect.arrayContaining(['América Mineiro', 'Fortaleza', 'Sport Recife']))
})

