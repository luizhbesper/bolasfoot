import base from '@bolasfoot/data/base.json' with { type: 'json' }
import type { Base } from '@bolasfoot/data'
import { describe, expect, it } from 'vitest'
import { formatarData } from './calendario.ts'
import { avancarDia, compararLinha, nTurnos, rodadasRoundRobin, type Competicao, type FaseLiga, type FaseMataMata } from './competicoes.ts'
import { novoJogo } from './mundo.ts'
import { criarRng } from './rng.ts'

describe('tabela de jogos', () => {
  it('20 times, dois turnos: 38 rodadas, todos contra todos em casa e fora, 1 jogo por rodada', () => {
    const times = Array.from({ length: 20 }, (_, i) => i)
    const rodadas = rodadasRoundRobin(times, 2, criarRng('t'))
    expect(rodadas).toHaveLength(38)
    const pares = new Set<string>()
    for (const r of rodadas) {
      expect(r).toHaveLength(10)
      expect(new Set(r.flat()).size).toBe(20)
      for (const [a, b] of r) pares.add(`${a}-${b}`)
    }
    expect(pares.size).toBe(380)
    // mando equilibrado: cada time tem 19 jogos em casa
    for (const t of times) expect(rodadas.flat().filter(([a]) => a === t)).toHaveLength(19)
  })

  it('ímpar: um folga por rodada', () => {
    const rodadas = rodadasRoundRobin([1, 2, 3, 4, 5], 1, criarRng('t'))
    expect(rodadas).toHaveLength(5)
    expect(new Set(rodadas.flat().map(([a, b]) => [a, b].sort().join())).size).toBe(10)
  })

  it('turnos por tamanho (s.java:632-663)', () => {
    const o = { doisTurnos: false, grupos: 0, formato: -1, numeroTurnos: 0 }
    expect(nTurnos(1, 20, o)).toBe(2)
    expect(nTurnos(1, 20, { ...o, formato: 1020 })).toBe(1)
    expect(nTurnos(1, 8, o)).toBe(4)
    expect(nTurnos(1, 30, o)).toBe(1)
    expect(nTurnos(3, 8, { ...o, doisTurnos: true })).toBe(2)
  })

  it('desempate: pontos, vitórias, saldo, gols pró', () => {
    const l = (pts: number, v: number, gp: number, gc: number) => ({ pts, j: 0, v, e: 0, d: 0, gp, gc })
    expect(compararLinha(l(10, 3, 5, 5), l(10, 2, 9, 0))).toBeLessThan(0)
    expect(compararLinha(l(10, 3, 5, 5), l(10, 3, 6, 5))).toBeGreaterThan(0)
    expect(compararLinha(l(10, 3, 6, 4), l(10, 3, 5, 3))).toBeLessThan(0)
  })
})

describe('temporada BR só com IA', () => {
  const mundo = novoJogo(base as Base, { habilidadeIndividual: false }, 'temporada')
  const comp = (id: string) => mundo.competicoes.find((c) => c.id === id)!
  const dias: number[] = []
  for (let d: number | null = mundo.dia; d !== null; d = avancarDia(mundo)) dias.push(d)
  const jogos = (c: Competicao) => c.fases.flatMap((f) => (f.tipo === 'liga' ? f.jogos : f.rodadas.flatMap((r) => r.jogos)))

  it('Séries A e B: 38 rodadas, 380 jogos, campeão = líder', () => {
    for (const id of ['BR-1', 'BR-2']) {
      const c = comp(id)
      const f = c.fases[0] as FaseLiga
      expect(c.fases).toHaveLength(1)
      expect(f.jogos).toHaveLength(380)
      expect(new Set(f.jogos.map((j) => j.dia)).size).toBe(38)
      expect(Object.values(f.linhas).every((l) => l.j === 38)).toBe(true)
      expect(c.campeao).toBe(f.times[0])
    }
  })

  it('Série C: 19 rodadas, grupos de 4 (2º/7º/4º/5º e 1º/8º/3º/6º) e final em ida e volta', () => {
    const c = comp('BR-3')
    const [f1, f2, f3] = c.fases as [FaseLiga, FaseLiga, FaseMataMata]
    expect(f1.jogos).toHaveLength(190)
    const t = f1.times
    expect(f2.grupos.map((g) => [...g].sort())).toEqual([[t[1], t[6], t[3], t[4]].sort(), [t[0], t[7], t[2], t[5]].sort()])
    expect(f2.jogos).toHaveLength(24)
    expect(f3.rodadas).toHaveLength(1)
    expect(f3.rodadas[0]!.jogos).toHaveLength(2)
    expect(c.campeao).toBe(f3.rodadas[0]!.vencedores[0])
    expect([f2.grupos[0]![0], f2.grupos[1]![0]]).toContain(c.campeao)
    // fases em sequência no calendário
    expect(Math.min(...f2.jogos.map((j) => j.dia))).toBeGreaterThan(Math.max(...f1.jogos.map((j) => j.dia)))
  })

  it('estaduais: 18 estados, Paulistão com os grupos reais e grupos cruzados', () => {
    const est = mundo.competicoes.filter((c) => c.tipo === 3)
    expect(est).toHaveLength(18)
    for (const c of est) expect(c.campeao).not.toBeNull()
    const sp = comp('EST-SP-1')
    const f = sp.fases[0] as FaseLiga
    expect(f.grupos).toHaveLength(4)
    expect(f.jogos).toHaveLength(96) // 16 times × 12 adversários dos outros grupos / 2
    for (const j of f.jogos) expect(f.grupos.findIndex((g) => g.includes(j.casa))).not.toBe(f.grupos.findIndex((g) => g.includes(j.fora)))
    expect((sp.fases[1] as FaseMataMata).rodadas).toHaveLength(3)
  })

  it('regionais: Nordeste e Verde, 4 grupos de 4 e mata-mata de 8', () => {
    for (const id of ['REG-2', 'REG-3']) {
      const c = comp(id)
      expect((c.fases[0] as FaseLiga).jogos).toHaveLength(48)
      expect((c.fases[1] as FaseMataMata).rodadas).toHaveLength(3)
      expect(c.campeao).not.toBeNull()
    }
    expect(mundo.competicoes.find((c) => c.id === 'REG-0')).toBeUndefined()
  })

  it('Série D: 64 times de fora das séries, 8 grupos, mata-mata de 32 em jogo único', () => {
    const c = comp('BR-4')
    const [g, mm] = c.fases as [FaseLiga, FaseMataMata]
    expect(g.times).toHaveLength(64)
    expect(g.grupos).toHaveLength(8)
    expect(g.jogos).toHaveLength(8 * 56)
    for (const t of g.times) expect(mundo.times[t]!.divisao).toBe(4)
    expect(mm.rodadas.map((r) => r.confrontos.length)).toEqual([16, 8, 4, 2, 1])
    expect(mm.rodadas.every((r) => !r.idaVolta)).toBe(true)
  })

  it('Copa do Brasil (formato novo): 80 na 1ª fase, 12 entram na 3ª, campeão Nordeste/Verde entre eles', () => {
    const c = comp('CB')
    const f = c.fases[0] as FaseMataMata
    expect(f.rodadas.map((r) => r.confrontos.length)).toEqual([40, 20, 16, 8, 4, 2, 1])
    expect(f.rodadas.map((r) => r.idaVolta)).toEqual([false, false, true, true, true, true, true])
    expect(f.reservados).toHaveLength(12)
    expect(f.reservados).toContain(comp('REG-2').campeao)
    expect(c.campeao).not.toBeNull()
  })

  it('tudo jogado, dias em ordem, dentro de 2026', () => {
    for (const c of mundo.competicoes) expect(jogos(c).every((j) => j.gols)).toBe(true)
    expect(dias).toEqual([...dias].sort((a, b) => a - b))
    expect(formatarData(dias.at(-1)!).endsWith('/2026')).toBe(true)
  })

  it('determinístico', () => {
    const m2 = novoJogo(base as Base, { habilidadeIndividual: false }, 'temporada')
    while (avancarDia(m2) !== null);
    expect(m2.competicoes.map((c) => c.campeao)).toEqual(mundo.competicoes.map((c) => c.campeao))
  })
})

describe('temporada sem estaduais', () => {
  it('nenhum estadual; Série D com 64 e Copa no formato novo, tudo jogado', () => {
    const m = novoJogo(base as Base, { habilidadeIndividual: false, jogaEstadual: false }, 'sem-estaduais')
    expect(m.competicoes.some((c) => c.tipo === 3)).toBe(false)
    while (avancarDia(m) !== null);
    const d = m.competicoes.find((c) => c.id === 'BR-4')!
    expect((d.fases[0] as FaseLiga).times).toHaveLength(64)
    const cb = m.competicoes.find((c) => c.id === 'CB')!
    expect((cb.fases[0] as FaseMataMata).rodadas[0]!.confrontos).toHaveLength(40)
    expect([d.campeao, cb.campeao]).not.toContain(null)
  })
})
