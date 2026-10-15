import { expect, test } from 'vitest'
import { escalarIA } from './escalacao.ts'
import { mundoSintetico } from './fixtures.ts'
import type { TimeM } from './mundo.ts'
import { iniciarPartida, type ContextoPartida, type JogadorPartida, type Partida } from './partida.ts'
import { aplicarPosJogo, ganchoVermelho, nota, publico, recuperarEnergia } from './posjogo.ts'
import { criarRng, derivar, type Rng } from './rng.ts'

const liga: ContextoPartida = { competicao: 'serieA', tipoComp: 1, temporada: 1 }
const zeros = { int: () => 0 } as unknown as Rng

function preparar(): { p: Partida; m: ReturnType<typeof mundoSintetico> } {
  const m = mundoSintetico()
  const rng = derivar('pj', 'pre')
  const p = iniciarPartida(m, [0, 1], [escalarIA(m, 0, 'serieA', rng, 4), escalarIA(m, 1, 'serieA', rng, 4)], liga, rng)
  return { p, m }
}
const noSlot = (p: Partida, slot: number) => p.jogadores[p.lados[0].emCampo.find((id) => p.jogadores[id]!.slot === slot)!]!

test('nota do goleiro numa vitória por 1×0 sem sofrer gol', () => {
  const { p } = preparar()
  p.placar = [1, 0]
  p.lados[0].desarmes = 10
  p.lados[1].noAlvo = 3
  p.lados[1].chutes = 8
  // 6.0 + desarmes 0.6 − 0.8 + 3·0.2 + sem sofrer 1.0 + defesa zerada 0.5
  expect(nota(p, noSlot(p, 1), zeros)).toBeCloseTo(7.9)
})

test('nota de atacante com gol e de reserva que entrou tarde', () => {
  const { p } = preparar()
  p.placar = [1, 0]
  const at = noSlot(p, 22)
  at.e.gols = 1
  at.e.noAlvo = 1
  expect(nota(p, at, zeros)).toBeCloseTo(7.2) // 6.0 + 0.9 (uma vez só) + 0.3
  const reserva = p.lados[0].banco.map((id) => p.jogadores[id]!).find((j) => j.posicao === 4)!
  reserva.slot = 24
  p.eventos.push({ tipo: 6, tempo: 2, minuto: 30, lado: 0, jogador: noSlot(p, 24).id, jogador2: reserva.id })
  expect(nota(p, reserva, zeros)).toBeCloseTo(4.5) // 20 min: −1.5
  at.e.gols = 0
  p.eventos.push({ tipo: 1, tempo: 1, minuto: 10, lado: 0, jogador: at.id, subtipo: 1 })
  expect(nota(p, at, zeros)).toBeCloseTo(6.3) // evento de gol não muda os minutos (bug corrigido)
})

test('público e renda (v_0.java:90)', () => {
  const m = mundoSintetico()
  const casa: TimeM = { ...m.times[0]!, reputacao: 5, divisao: 1, estadio: { nome: '', setores: [7500, 37550, 4500, 450], precoAuto: true, precos: null } }
  expect(publico(casa, { reputacao: 3 }, liga, zeros)).toEqual({ setores: [5546, 37550, 4500, 450], renda: 767210 })
  casa.estadio = { ...casa.estadio, precoAuto: false, precos: [20, 25, 35, 90] }
  expect(publico(casa, { reputacao: 3 }, liga, zeros)).toEqual({ setores: [3886, 27447, 3670, 335], renda: 922495 })
})

test('gancho por vermelho: 70/20/7/2.1/0.9%', () => {
  const r = criarRng('gancho')
  const c: Record<number, number> = {}
  for (let i = 0; i < 100_000; i++) {
    const g = ganchoVermelho(r)
    c[g] = (c[g] ?? 0) + 1
  }
  const t = Object.values(c).reduce((a, b) => a + b)
  expect(c[1]! / t).toBeCloseTo(0.7, 1)
  expect(c[2]! / t).toBeCloseTo(0.2, 1)
  expect(c[10]! / t).toBeLessThan(0.012)
})

test('aplicarPosJogo cumpre a suspensão antes de lançar os cartões desta partida', () => {
  const { p, m } = preparar()
  const [a, b, c] = p.lados[0].titulares
  m.jogadores[a!]!.suspensoes.serieA = { amarelos: 3, jogos: 0 }
  m.jogadores[b!]!.suspensoes.serieA = { amarelos: 0, jogos: 1 }
  p.eventos.push({ tipo: 2, tempo: 1, minuto: 5, lado: 0, jogador: a! })
  p.eventos.push({ tipo: 4, tempo: 1, minuto: 9, lado: 0, jogador: b! })
  p.jogadores[c!]!.lesao = 12
  p.jogadores[c!]!.energia = 70
  m.dia = 100
  const { notas } = aplicarPosJogo(m, p, criarRng('x'))
  expect(m.jogadores[a!]!.suspensoes.serieA).toEqual({ amarelos: 1, jogos: 0 })
  expect(m.jogadores[b!]!.suspensoes.serieA!.jogos).toBeGreaterThanOrEqual(1)
  expect(m.jogadores[c!]!).toMatchObject({ lesaoAte: 112, energia: 70, jogou: true })
  expect(Object.keys(notas)).toHaveLength(22)
  recuperarEnergia(m, new Set([m.jogadores[c!]!.time]))
  expect(m.jogadores[c!]!.energia).toBe(100) // 26 anos, jogou, IA: +50
})

test('aplicarPosJogo soma as estatísticas da temporada na competição', () => {
  const { p, m } = preparar()
  const [at, meia] = p.lados[0].emCampo.slice(-2).map((id) => p.jogadores[id]!) as [JogadorPartida, JogadorPartida]
  p.eventos.push({ tipo: 1, tempo: 1, minuto: 10, lado: 0, jogador: at.id, subtipo: 1, jogador2: meia.id })
  p.eventos.push({ tipo: 8, tempo: 1, minuto: 10, lado: 0, jogador: meia.id })
  p.eventos.push({ tipo: 3, tempo: 2, minuto: 20, lado: 0, jogador: meia.id })
  const { notas } = aplicarPosJogo(m, p, criarRng('e'))
  const [j, g, a, ca, cv, n] = m.jogadores[at.id]!.estatisticas!.serieA!
  expect([j, g, a, ca, cv]).toEqual([1, 1, 0, 0, 0])
  expect(n).toBeCloseTo(notas[at.id]!)
  expect(m.jogadores[meia.id]!.estatisticas!.serieA!.slice(0, 5)).toEqual([1, 0, 1, 1, 1])
})

test('aplicarPosJogo avisa o técnico humano de quem pegou gancho', () => {
  const { p, m } = preparar()
  const t = m.times[p.lados[0].time]!
  t.humano = true
  const [a] = p.lados[0].titulares
  m.jogadores[a!]!.suspensoes.serieA = { amarelos: 0, jogos: 1 }
  p.eventos.push({ tipo: 4, tempo: 1, minuto: 9, lado: 0, jogador: a! })
  aplicarPosJogo(m, p, criarRng('x'))
  const n = m.jogadores[a!]!.suspensoes.serieA!.jogos
  expect(m.avisos).toEqual([expect.objectContaining({ tecnico: t.tecnico, tipo: 'suspensao', ref: a, texto: expect.stringContaining(`${n} jogo`) })])
})
