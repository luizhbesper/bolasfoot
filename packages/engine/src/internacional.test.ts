import base from '@bolasfoot/data/base.json' with { type: 'json' }
import type { Base } from '@bolasfoot/data'
import { beforeAll, describe, expect, it } from 'vitest'
import { avancarDia, type Competicao, type FaseLiga, type FaseMataMata } from './competicoes.ts'
import { sedeDaFinal } from './internacional.ts'
import { BRA, novoJogo, type Mundo } from './mundo.ts'
import { fimDeTemporada } from './temporada.ts'

const B = base as unknown as Base
const comp = (m: Mundo, id: string) => m.competicoes.find((c) => c.id === id)!
const grupos = (c: Competicao) => c.fases.find((f): f is FaseLiga => f.tipo === 'liga')!
const chave = (c: Competicao) => c.fases.at(-1) as FaseMataMata

describe('continentais', () => {
  let m: Mundo
  let inicio: Mundo
  beforeAll(() => {
    m = novoJogo(B, { habilidadeIndividual: false }, 'continentais')
    inicio = structuredClone(m)
    while (avancarDia(m) !== null);
  })

  it('a Libertadores nasce com 28 nos grupos e 19 nas preliminares, sem repetir na Sul-Americana', () => {
    const lib = comp(inicio, 'LIB'), sul = comp(inicio, 'SUL')
    expect(lib.listas!.YF!).toHaveLength(28)
    expect(lib.listas!.YS!).toHaveLength(19)
    expect(lib.listas!.YF!.filter((t) => inicio.times[t]!.pais === BRA)).toHaveLength(6)
    expect(sul.listas!.YF!).toHaveLength(12)
    expect(sul.listas!.YS!).toHaveLength(32)
    const naLib = new Set([...lib.listas!.YF!, ...lib.listas!.YS!])
    expect([...sul.listas!.YF!, ...sul.listas!.YS!].filter((t) => naLib.has(t))).toEqual([])
    // f/f_0.java:90: na 1ª Copa do Brasil os brasileiros da Libertadores entram direto na 3ª fase
    const reservados = (comp(m, 'CB').fases[0] as FaseMataMata).reservados
    expect(reservados).toHaveLength(12)
    expect(lib.listas!.YF!.filter((t) => inicio.times[t]!.pais === BRA).every((t) => reservados.includes(t))).toBe(true)
  })

  it('final em sede rotativa (mF): 1ª temporada da Libertadores no Chile, num dos 2 maiores estádios', () => {
    const lib = comp(m, 'LIB')
    const s = sedeDaFinal(m, lib)!
    expect(s.cidade).toBe('Santiago')
    const cap = (id: number) => m.times[id]!.estadio.setores.reduce((a, b) => a + b, 0)
    const chilenos = m.times.filter((t) => t.pais === 42).map((t) => t.id).sort((a, b) => cap(b) - cap(a))
    expect(chilenos.slice(0, 2)).toContain(s.time)
    expect(sedeDaFinal(m, comp(m, 'MUN'))).toBeNull()
    // a final é a rodada de um confronto só (jogosDoDia põe a sede no ctx)
    for (const id of ['LIB', 'SUL', 'UCL', 'UEL', 'UECL']) expect(chave(comp(m, id)).rodadas.at(-1)!.confrontos, id).toHaveLength(1)
  })

  it('a Europa monta as três com as vagas cheias', () => {
    expect(comp(inicio, 'UCL').listas!.YF!).toHaveLength(26)
    expect(comp(inicio, 'UCL').listas!.YS!).toHaveLength(52)
    expect(comp(inicio, 'UEL').listas!.YF!).toHaveLength(12)
    expect(comp(inicio, 'UECL').listas!.YS!).toHaveLength(134)
  })

  it('grupos de 4 e quem cai de uma vai para a outra', () => {
    const lib = comp(m, 'LIB'), sul = comp(m, 'SUL')
    expect(grupos(lib).grupos.map((g) => g.length)).toEqual(Array(8).fill(4))
    expect(chave(lib).rodadas.map((r) => r.confrontos.length)).toEqual([8, 4, 2, 1])
    expect(chave(lib).rodadas.map((r) => r.jogos.length)).toEqual([16, 8, 4, 1])
    // os 4 eliminados da 3ª preliminar da Libertadores vão aos grupos da Sul-Americana
    const fase3 = lib.fases[2] as FaseMataMata
    const caiu = fase3.rodadas[0]!.confrontos.flat().filter((t) => !fase3.rodadas[0]!.vencedores.includes(t))
    expect(caiu.every((t) => grupos(sul).times.includes(t))).toBe(true)
    // os 3ºs dos grupos da Libertadores jogam as oitavas da Sul-Americana
    const terceiros = grupos(lib).grupos.map((g) => g[2]!)
    expect(terceiros.every((t) => chave(sul).rodadas[0]!.confrontos.flat().includes(t))).toBe(true)
    expect(grupos(sul).avancam).toBe(1)
  })

  it('todas terminam com campeão e o Mundial junta os 6', () => {
    for (const id of ['LIB', 'SUL', 'UCL', 'UEL', 'UECL', 'CAF', 'AFC', 'CONCACAF', 'OFC', 'MUN']) expect(comp(m, id).campeao, id).not.toBeNull()
    const mun = comp(m, 'MUN')
    expect((mun.fases[0] as FaseMataMata).rodadas[0]!.confrontos).toHaveLength(2)
    const final = chave(mun).rodadas.at(-1)!
    expect(final.terceiro).toBe(true)
    expect(final.confrontos).toHaveLength(2)
    expect([comp(m, 'LIB').campeao, comp(m, 'UCL').campeao].some((t) => chave(mun).rodadas[0]!.confrontos.flat().includes(t!))).toBe(true)
  })

  it('a virada traz Recopa e Supercopa e o campeão da Sul-Americana entra direto na Libertadores', () => {
    const v = structuredClone(m)
    const campSul = comp(v, 'SUL').campeao!
    fimDeTemporada(v, B)
    const lib = comp(v, 'LIB')
    expect(lib.listas!.YF!).toContain(campSul)
    expect(comp(v, 'RECOPA').fases[0]!.tipo).toBe('mata')
    expect(comp(v, 'SUP-BRA').fases).toHaveLength(1)
  })
})
