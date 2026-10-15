import { expect, test } from 'vitest'
import type { Base } from '@bolasfoot/data'
import baseJson from '@bolasfoot/data/base.json' with { type: 'json' }
import { escalarIA, escolherParaSlot, FORMACOES } from './escalacao.ts'
import { mundoSintetico } from './fixtures.ts'
import { novoJogo } from './mundo.ts'
import { ataque, confrontoEmpatado, defesa, duracaoLesao, goleiro, iniciarPartida, meio, simularTempo, substituir, valorJogo, type ContextoPartida, type Partida } from './partida.ts'
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

// ── M4 ──

function rodada(n: number, ctx: ContextoPartida = liga, seed = 'm4') {
  const base = baseJson as Base
  const m = novoJogo(base, { habilidadeIndividual: false }, seed)
  const serieA = m.times.filter((t) => t.divisao === 1)
  const jogos: Partida[] = []
  for (let i = 0; i < n; i++) {
    const rng = derivar(seed, `pre${i}`)
    const a = serieA[rng.int(20)]!
    let b = serieA[rng.int(20)]!
    if (b === a) b = serieA[(a.id + 1) % 20] ?? serieA[0]!
    const p = iniciarPartida(m, [a.id, b.id], [escalarIA(m, a.id, ctx.competicao, rng), escalarIA(m, b.id, ctx.competicao, rng)], ctx, rng)
    simularTempo(p, 1, derivar(seed, `${i}:1T`))
    simularTempo(p, 2, derivar(seed, `${i}:2T`))
    jogos.push(p)
  }
  return jogos
}

test('incidentes e tipos de gol em 3000 jogos só da IA', () => {
  const jogos = rodada(3000)
  const ev = jogos.flatMap((p) => p.eventos)
  const conta = (f: (e: (typeof ev)[number]) => boolean) => ev.filter(f).length / jogos.length
  expect(conta((e) => e.tipo === 2)).toBeGreaterThan(1)
  expect(conta((e) => e.tipo === 2)).toBeLessThan(6)
  expect(conta((e) => e.tipo === 3 || e.tipo === 4)).toBeLessThan(0.6)
  expect(conta((e) => e.tipo === 5)).toBeGreaterThan(0.05)
  expect(conta((e) => e.tipo === 5)).toBeLessThan(1.5)
  expect(conta((e) => e.tipo === 6)).toBeGreaterThan(1)
  expect(jogos.every((p) => p.lados.every((l) => l.subs >= 0 && l.emCampo.length <= 11))).toBe(true)
  const golsEv = ev.filter((e) => e.tipo === 1)
  const frac = (t: number) => golsEv.filter((e) => e.subtipo === t).length / golsEv.length
  expect(frac(1)).toBeGreaterThan(0.88)
  expect(frac(3)).toBeGreaterThan(0.04)
  expect(frac(3)).toBeLessThan(0.06)
  expect(frac(4)).toBeGreaterThan(0.02)
  expect(frac(4)).toBeLessThan(0.04)
  expect(frac(2)).toBeLessThan(0.016)
  expect(frac(5)).toBeLessThan(0.009)
  // placar = gols nos eventos
  for (const p of jogos) expect(p.placar[0] + p.placar[1]).toBe(p.eventos.filter((e) => e.tipo === 1).length)
})

test('pênaltis só da IA: mandante vence ≈57% (28/49)', () => {
  const jogos = rodada(1500, { ...liga, tipoComp: 2, mataMata: { penaltis: true, golFora: false } }, 'pen')
  const disputas = jogos.filter((p) => p.penaltis)
  expect(disputas.length).toBe(jogos.filter((p) => p.placar[0] === p.placar[1]).length)
  const casa = disputas.filter((p) => p.penaltis!.vencedor === 0).length / disputas.length
  expect(casa).toBeGreaterThan(0.5)
  expect(casa).toBeLessThan(0.64)
})

test('confronto de ida e volta com gol fora', () => {
  const p = partidaSintetica({ ...liga, mataMata: { ida: [1, 1], golFora: true, penaltis: true } }, 'cf')
  p.placar = [1, 1]
  expect(confrontoEmpatado(p)).toBe(true)
  p.placar = [2, 2] // mandante de hoje fez 1 fora na ida; visitante faz 2 fora hoje
  expect(confrontoEmpatado(p)).toBe(false)
  p.placar = [0, 1]
  p.ctx.mataMata!.ida = [1, 0]
  expect(confrontoEmpatado(p)).toBe(true) // cada um venceu um jogo, agregado 1×1, gols fora 1×1
})

test('duração da lesão (F.java:2116)', () => {
  const zeros = { int: () => 0 } as unknown as Rng
  expect(duracaoLesao({ idade: 19, energia: 5, forca: 50 }, zeros)).toBe(40) // r==0 cai no +40
  const j = { idade: 36, energia: 40, forca: 3 }
  const max = { int: (n: number) => n - 1 } as Rng
  expect(duracaoLesao(j, max)).toBe(1 + 13 + 5 + 19) // ≤45: e+a+5+rand(20); r=99 → nada
  expect(j.forca).toBe(1)
})

test('substituição manual: válida e inválidas', () => {
  const p = partidaSintetica(liga, 'sub')
  simularTempo(p, 1, derivar('sub', '1T'))
  const sai = p.lados[0].emCampo[1]!
  const entra = p.lados[0].banco[0]!
  const antes = p.lados[0].subs
  expect(() => substituir(p, 0, entra, sai)).toThrow()
  substituir(p, 0, sai, entra)
  expect(p.lados[0].emCampo).toContain(entra)
  expect(p.lados[0].subs).toBe(antes - 1)
  expect(() => substituir(p, 0, sai, p.lados[0].banco[0]!)).toThrow()
  expect(p.eventos.at(-1)).toMatchObject({ tipo: 6, tempo: 2, minuto: 0, jogador: sai, jogador2: entra })
})

test('com humano, só troca no intervalo; no 2º tempo, só o lesionado sai na hora (dos dois lados)', () => {
  let lesoes2T = 0
  for (let i = 0; i < 60; i++) {
    const p = partidaSintetica(liga, `h${i}`)
    p.lados[0].humano = true
    simularTempo(p, 1, derivar(`h${i}`, '1T'))
    simularTempo(p, 2, derivar(`h${i}`, '2T'))
    expect(p.eventos.filter((e) => e.tipo === 6 && e.tempo === 1)).toEqual([])
    // toda troca com a bola rolando é logo depois de uma lesão no mesmo minuto e lado, e tira o lesionado
    for (const e of p.eventos.filter((e) => e.tipo === 6 && e.minuto > 0)) {
      expect(p.eventos.some((x) => x.tipo === 5 && x.tempo === 2 && x.minuto === e.minuto && x.lado === e.lado && x.jogador === e.jogador)).toBe(true)
      lesoes2T++
    }
  }
  expect(lesoes2T).toBeGreaterThan(0)
})

test('humano com energia mínima: sai sozinho quem cai abaixo dela; sem ela, ninguém', () => {
  for (const energiaMin of [0, 80]) {
    const p = partidaSintetica(liga, 'cansaco')
    p.lados[0].humano = true
    if (energiaMin) p.lados[0].energiaMin = energiaMin
    const alvo = p.jogadores[p.lados[0].emCampo.find((id) => p.jogadores[id]!.slot !== 1)!]!
    alvo.energia = 50
    simularTempo(p, 1, derivar('cansaco', '1T'))
    const saiu = p.eventos.some((e) => e.tipo === 6 && e.lado === 0 && e.jogador === alvo.id && e.tempo === 1 && e.minuto === 0)
    expect(saiu).toBe(energiaMin > 0)
  }
})
