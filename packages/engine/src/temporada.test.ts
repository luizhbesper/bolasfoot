import base from '@bolasfoot/data/base.json' with { type: 'json' }
import type { Base } from '@bolasfoot/data'
import { beforeAll, describe, expect, it } from 'vitest'
import { formatarData } from './calendario.ts'
import { avancarDia, type FaseLiga } from './competicoes.ts'
import { abrirCaixa } from './economia.ts'
import { novoJogo, type Mundo } from './mundo.ts'
import { criarRng } from './rng.ts'
import { caem, fimDeTemporada, sobem } from './temporada.ts'

const B = base as Base
let m: Mundo
let antes: { divisao: number[]; elenco: number; humano: number }
const comp = (id: string) => m.competicoes.find((c) => c.id === id)!

beforeAll(() => {
  m = novoJogo(B, { habilidadeIndividual: false }, 'virada')
  const humano = m.times.find((t) => t.divisao === 2)!.id
  m.times[humano]!.humano = true
  abrirCaixa(m, humano)
  while (avancarDia(m) !== null);
  antes = { divisao: m.times.map((t) => t.divisao), elenco: m.jogadores.length, humano }
  fimDeTemporada(m, B)
})

describe('fim de temporada', () => {
  it('acesso e rebaixamento: 4 trocas entre A/B, B/C e C/D; a D volta para fora das séries', () => {
    const h = (id: string) => m.historico.find((x) => x.competicao === id && x.temporada === 1)!
    for (const [cima, baixo] of [['BR-1', 'BR-2'], ['BR-2', 'BR-3'], ['BR-3', 'BR-4']] as const) {
      expect(h(cima).cairam).toHaveLength(4)
      expect(h(baixo).subiram).toHaveLength(4)
    }
    const d = (n: number) => m.times.filter((t) => t.divisao === n).length
    expect([d(1), d(2), d(3), d(4)]).toEqual([20, 20, 20, 0])
    for (const t of h('BR-1').cairam) expect(m.times[t]!.divisao).toBe(2)
    for (const t of h('BR-2').subiram) expect(m.times[t]!.divisao).toBe(1)
    for (const t of h('BR-4').subiram) expect(antes.divisao[t]).toBe(4)
    expect(m.rebaixadosC).toEqual(h('BR-3').cairam)
    // Série D: campeão, vice e os outros dois semifinalistas
    expect([...h('BR-4').subiram].sort()).toEqual(h('BR-4').classificacao.slice(0, 4).sort())
  })

  it('sobem/caem: liga sem mata-mata pega as pontas da tabela', () => {
    const f = { tipo: 'liga', times: [5, 6, 7, 8], grupos: [], linhas: {}, jogos: [], avancam: 0, idaVolta: [], formato: 0 } as FaseLiga
    const c = { id: 'x', nome: 'x', tipo: 1, divisao: 1, fases: [f], campeao: null, vice: null }
    expect(sobem(c, 2)).toEqual([5, 6])
    expect(caem(c, 2)).toEqual([8, 7])
  })

  it('ano novo: calendário de 2027, competições recriadas, extrato zerado e patrocínio pago', () => {
    expect(m.temporada).toBe(2)
    expect(formatarData(m.dia).endsWith('/2027')).toBe(true)
    expect(comp('BR-1').fases[0]!.tipo).toBe('liga')
    expect(comp('BR-4').fases).toHaveLength(0)
    expect(m.competicoes.some((c) => c.id === 'CB')).toBe(false)
    expect(m.reservadosCopa).toHaveLength(12)
    const f = m.times[antes.humano]!.financas!
    expect(f.receitas.patrocinio).toBeGreaterThan(0)
    expect(f.receitas.bilheteria).toBe(0)
  })

  it('elencos coerentes, envelhecimento e juniores novos', () => {
    expect(m.jogadores.length).toBeGreaterThan(antes.elenco)
    for (const t of m.times) {
      expect(t.jogadores.length).toBeGreaterThanOrEqual(11)
      for (const id of [...t.jogadores, ...t.juniores]) expect(m.jogadores[id]!.time).toBe(t.id)
    }
    expect(m.hallDaFama.length).toBeGreaterThan(0)
  })

  it('a 2ª temporada joga inteira e vira de novo (golden)', () => {
    while (avancarDia(m) !== null);
    expect(comp('CB').campeao).not.toBeNull()
    expect((comp('BR-4').fases[0] as FaseLiga).times).toEqual(expect.arrayContaining(m.historico.filter((x) => x.competicao === 'BR-3')[0]!.cairam))
    fimDeTemporada(m, B)
    expect(m.temporada).toBe(3)
    expect(criarRng(JSON.stringify(m)).int(1e9)).toMatchInlineSnapshot(`532944838`)
  }, 20_000)
})
