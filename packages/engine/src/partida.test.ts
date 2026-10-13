import { expect, test } from 'vitest'
import type { Base } from '@bolasfoot/data'
import baseJson from '@bolasfoot/data/base.json' with { type: 'json' }
import { escalarIA, escolherParaSlot, FORMACOES } from './escalacao.ts'
import { mundoSintetico } from './fixtures.ts'
import { novoJogo } from './mundo.ts'
import { ataque, defesa, goleiro, iniciarPartida, meio, simularTempo, valorJogo, type ContextoPartida, type Partida } from './partida.ts'
import { criarRng, derivar, Rng } from './rng.ts'

const liga: ContextoPartida = { competicao: 'serieA', tipoComp: 1, temporada: 1 }

function partidaSintetica(ctx: ContextoPartida, seed: string, forca = 50): Partida {
  const m = mundoSintetico(forca)
  const rng = derivar(seed, 'pre')
  return iniciarPartida(m, [0, 1], [escalarIA(m, 0, ctx.competicao, rng, 4), escalarIA(m, 1, ctx.competicao, rng, 4)], ctx, rng)
}

test('escalação da IA preenche a formação com quem joga na posição', () => {
  const m = mundoSintetico()
  const e = escalarIA(m, 0, 'x', criarRng('e'), 4)
  expect(e.titulares.map((t) => t.slot)).toEqual(FORMACOES[4])
  for (const { id, slot } of e.titulares) {
    const pos = m.jogadores[id]!.posicao
    expect(slot === 1 ? pos === 0 : slot <= 9 ? pos === 1 || pos === 2 : slot <= 17 ? pos === 3 : pos === 4).toBe(true)
  }
  expect(e.banco.length).toBeGreaterThan(0)
  // sem goleiro elegível, o slot 1 cai para a próxima posição da fila (sH)
  expect(escolherParaSlot([{ posicao: 2, lado: 0, ex: 0 }], 1)).toEqual({ posicao: 2, lado: 0, ex: 0 })
})

test('setores com escalação fixa (c/b.java:173-282)', () => {
  const p = partidaSintetica({ ...liga, tipoComp: 0 }, 's')
  p.lados[0].tatica.marcacao = 0
  // 4-4-2: meio 11,13,14,16; defesa 2,9,3,5; ataque 22,24; B = 50/10 = 5
  expect(valorJogo(p, p.jogadores[p.lados[0].emCampo[0]!]!)).toBe(5)
  expect(meio(p, 0)).toBe(4)
  expect(defesa(p, 0)).toBe(4)
  expect(ataque(p, 0)).toBeCloseTo(10 / 3)
  expect(goleiro(p, 0)).toBe(5)
  p.lados[0].tatica.marcacao = 1
  expect(meio(p, 0)).toBeCloseTo(20.04 / 5)
})

test('B(): redutores por competição e reputação', () => {
  const p = partidaSintetica(liga, 's')
  const j = p.jogadores[p.lados[0].emCampo[0]!]!
  expect(valorJogo(p, j)).toBe(5)
  p.lados[0].reputacao = 2
  expect(valorJogo(p, j)).toBe(4.3) // round(50·0.85)
  j.slot = 22 // goleiro de atacante: ×0.5
  expect(valorJogo(p, j)).toBe(2.1)
})

test('times iguais em campo neutro: ≈10% dos chutes viram gol', () => {
  let gols = 0, chutes = 0
  for (let i = 0; i < 3000; i++) {
    const p = partidaSintetica({ ...liga, tipoComp: 0, neutro: true }, `n${i}`)
    simularTempo(p, 1, derivar(`n${i}`, '1T'))
    simularTempo(p, 2, derivar(`n${i}`, '2T'))
    gols += p.placar[0] + p.placar[1]
    chutes += p.lados[0].chutes + p.lados[1].chutes
  }
  expect(gols / chutes).toBeGreaterThan(0.09)
  expect(gols / chutes).toBeLessThan(0.104)
})

test('determinismo e segmentação no intervalo', () => {
  const base = baseJson as Base
  const m = novoJogo(base, { habilidadeIndividual: false }, 'seg')
  const [a, b] = m.times.filter((t) => t.divisao === 1)
  const jogo = () => {
    const rng = derivar('seg', 'pre')
    return iniciarPartida(m, [a!.id, b!.id], [escalarIA(m, a!.id, 'serieA', rng), escalarIA(m, b!.id, 'serieA', rng)], liga, rng)
  }
  const continuo = jogo()
  simularTempo(continuo, 1, derivar('seg', '1T'))
  simularTempo(continuo, 2, derivar('seg', '2T'))

  const r1 = derivar('seg', '1T')
  const meio1 = simularTempo(jogo(), 1, r1)
  const retomado: Partida = JSON.parse(JSON.stringify(meio1))
  simularTempo(retomado, 2, new Rng(JSON.parse(JSON.stringify(derivar('seg', '2T').estado()))))
  expect(retomado).toEqual(continuo)
  expect(continuo.lados[0].chutes + continuo.lados[1].chutes).toBeGreaterThan(0)
  expect(() => simularTempo(continuo, 2, r1)).toThrow()
})
