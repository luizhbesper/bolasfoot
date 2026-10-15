import base from '@bolasfoot/data/base.json' with { type: 'json' }
import type { Base } from '@bolasfoot/data'
import { describe, expect, it } from 'vitest'
import { contratarTecnicoHumano } from './carreira.ts'
import { jogosDoDia } from './competicoes.ts'
import { FORMACOES } from './escalacao.ts'
import { novoJogo, type Mundo } from './mundo.ts'
import { criarRng } from './rng.ts'
import { avancarRodada, continuarRodada, contratosDoDia, tecnicosEmCampo, validar, type Comando } from './rodada.ts'

const B = base as Base

/** Mundo com dois humanos na Série A. */
function mundo(seed = 'rodada'): { m: Mundo; a: number; b: number } {
  const m = novoJogo(B, { habilidadeIndividual: false }, seed)
  const [ta, tb] = m.times.filter((t) => t.divisao === 1)
  const a = contratarTecnicoHumano(m, 'Ana', 29, ta!.id).id
  const b = contratarTecnicoHumano(m, 'Bia', 29, tb!.id).id
  return { m, a, b }
}
const timeDe = (m: Mundo, tc: number) => m.times[m.tecnicos[tc]!.time!]!
const humanoEmCampo = (m: Mundo) => jogosDoDia(m).some(({ jogo }) => m.times[jogo.casa]!.humano || m.times[jogo.fora]!.humano)

describe('rodada', () => {
  it('para no próximo dia com humano em campo e vira a temporada no fim', () => {
    const { m } = mundo()
    let rodadas = 0, virou = false
    while (!virou) {
      const r = avancarRodada(m, B, [], `r${rodadas++}`)
      virou = r.virou
      if (!virou) expect(humanoEmCampo(m) || m.ofertas.length > 0).toBe(true)
    }
    expect(m.temporada).toBe(2)
    // cada humano empregado recebe o resumo da temporada na caixa
    const empregados = m.tecnicos.filter((c) => c.humano && c.time !== null)
    expect(m.avisos.filter((x) => x.tipo === 'temporada').map((x) => x.tecnico).sort()).toEqual(empregados.map((c) => c.id).sort())
    expect(m.avisos.find((x) => x.tipo === 'temporada')!.texto).toMatch(/^Fim da temporada 2026\. .+ (terminou em \d+º|não disputou)/)
    // liga (38) + estadual + copa: bem menos rodadas que dias de jogo da temporada (~80)
    expect(rodadas).toBeGreaterThan(38)
    expect(rodadas).toBeLessThan(80)
  }, 20_000)

  it('usa a escalação salva e troca quem não pode jogar', () => {
    const { m, a } = mundo()
    while (!jogosDoDia(m).some(({ jogo }) => [jogo.casa, jogo.fora].includes(timeDe(m, a).id))) avancarRodada(m, B, [], 'x')
    const t = timeDe(m, a)
    const elenco = t.jogadores.map((id) => m.jogadores[id]!).filter((j) => j.lesaoAte <= m.dia)
    const gol = elenco.filter((j) => j.posicao === 0), linha = elenco.filter((j) => j.posicao !== 0)
    const slots = FORMACOES[7]!
    const titulares = [gol[0]!, ...linha.slice(-10)].map((j, i) => ({ id: j.id, slot: slots[i]! }))
    m.jogadores[titulares[5]!.id]!.lesaoAte = m.dia + 10 // lesionado depois de escalado
    const r = avancarRodada(m, B, [{ tecnico: a, comando: { tipo: 'escalar', formacao: 7, titulares, banco: [] } }], 's')
    expect(r.resultados[0]!.erro).toBeNull()
    const lado = r.partidas.flatMap((p) => p.lados).find((l) => l.time === t.id)!
    expect(lado.titulares).toHaveLength(11)
    expect(lado.titulares).not.toContain(titulares[5]!.id)
    expect(lado.titulares.filter((id) => titulares.some((x) => x.id === id))).toHaveLength(10)
    expect(lado.tatica.formacao).toBe(7)
  })

  it('intervalo: só tática e substituição; o 2º tempo usa a troca', () => {
    const { m, a } = mundo()
    while (!jogosDoDia(m).some(({ jogo }) => [jogo.casa, jogo.fora].includes(timeDe(m, a).id))) avancarRodada(m, B, [], 'x')
    expect(tecnicosEmCampo(m)).toContain(a)
    const r1 = avancarRodada(m, B, [], 'i', true)
    expect(r1.fase).toBe('intervalo')
    expect(tecnicosEmCampo(m)).toEqual(r1.partidas.flatMap((x) => x.lados).filter((x) => m.times[x.time]!.humano).map((x) => m.times[x.time]!.tecnico))
    const p = r1.partidas.find((x) => x.lados.some((l) => l.time === timeDe(m, a).id))!
    expect(p.tempo).toBe(1)
    const l = p.lados.find((x) => x.time === timeDe(m, a).id)!
    expect(validar(m, a, { tipo: 'treino', foco: 0, auxiliar: true })).toMatch(/intervalo/)
    expect(() => avancarRodada(m, B, [], 'i')).toThrow()
    const sai = l.emCampo.find((id) => p.jogadores[id]!.posicao !== 0)!, entra = l.banco[0]!
    const r2 = continuarRodada(m, B, [{ tecnico: a, comando: { tipo: 'substituir', sai, entra } }, { tecnico: a, comando: { tipo: 'mudarTatica', estilo: 2 } }], 'i')
    expect(r2.resultados.map((x) => x.erro)).toEqual([null, null])
    const p2 = r2.partidas.find((x) => x.lados.some((y) => y.time === timeDe(m, a).id))!
    expect(p2.tempo).toBe(2)
    expect(p2.eventos.some((e) => e.tipo === 6 && e.jogador === sai && e.jogador2 === entra)).toBe(true)
    expect(m.emJogo).toBeNull()
  })

  it('validar: dono, formato e momento', () => {
    const { m, a, b } = mundo()
    const deB = timeDe(m, b).jogadores[0]!
    const casos: [Comando, RegExp | null][] = [
      [{ tipo: 'anunciar', jogador: deB, preco: 10 }, /fora do elenco/],
      [{ tipo: 'escalar', formacao: 99, titulares: [], banco: [] }, /formação/],
      [{ tipo: 'tatica', estilo: 7 }, /tática/],
      [{ tipo: 'hackear' } as unknown as Comando, /comando inválido/],
      [null as unknown as Comando, /comando inválido/],
      [{ tipo: 'substituir', sai: 1, entra: 2 }, /fora do intervalo/],
      [{ tipo: 'comprar', jogador: timeDe(m, a).jogadores[0]!, valor: 1 }, /seu time/],
      [{ tipo: 'comprar', jogador: deB, valor: 1000 }, null],
      [{ tipo: 'aceitarOferta', time: 0 }, /proposta/],
      [{ tipo: 'banco', acao: 'pegar', valor: 150_000 }, /valor inválido/],
      [{ tipo: 'banco', acao: 'pagar', valor: 200_000 }, null],
    ]
    for (const [c, erro] of casos) {
      const r = validar(m, a, c)
      if (erro) expect(r).toMatch(erro)
      else expect(r).toBeNull()
    }
    expect(validar(m, 0, { tipo: 'pedirDemissao' })).toMatch(/técnico/)
  })

  it('proposta entre humanos: aviso ao dono, aceita na rodada seguinte; sem resposta, recusada', () => {
    const { m, a, b } = mundo()
    const [j1, j2] = timeDe(m, b).jogadores.slice(-2)
    timeDe(m, a).financas!.caixa = 50_000_000
    avancarRodada(m, B, [{ tecnico: a, comando: { tipo: 'comprar', jogador: j1!, valor: 1_000_000 } }, { tecnico: a, comando: { tipo: 'comprar', jogador: j2!, valor: 1_000_000 } }], 'p1')
    expect(m.propostasHumanas).toHaveLength(2)
    expect(m.avisos.filter((x) => x.tecnico === b && /oferece R\$ 1 mi/.test(x.texto))).toHaveLength(2)
    expect(m.avisos.filter((x) => x.tecnico === b && x.tipo === 'proposta').map((x) => x.ref)).toEqual(m.propostasHumanas.map((p) => p.id))
    const caixaB = timeDe(m, b).financas!.caixa
    const r = avancarRodada(m, B, [{ tecnico: b, comando: { tipo: 'responderProposta', proposta: m.propostasHumanas[0]!.id, aceitar: true } }], 'p2')
    expect(r.resultados[0]!.erro).toBeNull()
    expect(m.jogadores[j1!]!.time).toBe(timeDe(m, a).id)
    expect(timeDe(m, b).financas!.caixa).toBeGreaterThanOrEqual(caixaB + 1_000_000 - 5_000_000) // + venda, − salários do período
    expect(m.jogadores[j2!]!.time).toBe(timeDe(m, b).id)
    expect(m.propostasHumanas).toHaveLength(0)
    expect(m.avisos.some((x) => x.tecnico === a && /Sem resposta/.test(x.texto))).toBe(true)
    expect(m.historicoPropostas!.map((h) => [h.jogador, h.status])).toEqual([[j1, 'aceita'], [j2, 'expirada']])
  })

  it('dois humanos no mesmo jogador da IA: a maior oferta leva', () => {
    const { m, a, b } = mundo()
    const alvo = m.jogadores.find((j) => j.time >= 0 && !m.times[j.time]!.humano && !j.juvenil && m.times[j.time]!.divisao === 1)!
    for (const tc of [a, b]) timeDe(m, tc).financas!.caixa = 10 * alvo.valor
    const r = avancarRodada(m, B, [
      { tecnico: a, comando: { tipo: 'comprar', jogador: alvo.id, valor: 3 * alvo.valor } },
      { tecnico: b, comando: { tipo: 'comprar', jogador: alvo.id, valor: 4 * alvo.valor } },
    ], 'c')
    const [ra, rb] = r.resultados
    if (rb!.erro === null) {
      expect(alvo.time).toBe(timeDe(m, b).id)
      expect(ra!.erro).toMatch(/já negociado/)
    } else expect(rb!.erro).toMatch(/não deseja/) // o jogador pode recusar o time
  })

  it('determinística: mesmos comandos e seeds, mesmo mundo', () => {
    const hash = () => {
      const { m, a } = mundo('det')
      for (let i = 0; i < 8; i++) avancarRodada(m, B, [{ tecnico: a, comando: { tipo: 'anunciar', jogador: timeDe(m, a).jogadores[i]!, preco: 1 } }], `d${i}`)
      return criarRng(JSON.stringify(m)).int(1e9)
    }
    expect(hash()).toBe(hash())
  })
})

describe('contratos dos humanos', () => {
  it('perto do fim: avisa uma vez; com renovação automática, renova 1 ano', () => {
    const { m, a, b } = mundo()
    const [ja, jb] = [timeDe(m, a), timeDe(m, b)].map((t) => m.jogadores[t.jogadores[0]!]!)
    ja!.contratoAte = jb!.contratoAte = m.dia + 30
    timeDe(m, b).config = { renovarAuto: true }
    contratosDoDia(m, m.dia)
    contratosDoDia(m, m.dia)
    const avisos = (tc: number) => m.avisos.filter((x) => x.tipo === 'contrato' && x.tecnico === tc)
    expect(avisos(a)).toHaveLength(1)
    expect(ja!.contratoAte).toBe(m.dia + 30)
    expect(avisos(b)).toHaveLength(1)
    expect(avisos(b)[0]!.texto).toContain('renovou automaticamente')
    expect(jb!.contratoAte).toBe(m.dia + 30 + 365)
    expect(jb!.renovadoEm).toBe(m.temporada)
  })
})
