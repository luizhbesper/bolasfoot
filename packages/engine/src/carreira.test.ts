import base from '@bolasfoot/data/base.json' with { type: 'json' }
import type { Base } from '@bolasfoot/data'
import { describe, expect, it } from 'vitest'
import {
  aceitarOferta, aposentar, atualizarReputacoes, colocacaoTecnico, contratarTecnicoHumano, envelhecer, evolucaoSemanal, gerarJunior,
  gerarNome, iniciarJunior, pedirDemissao, posJogoTecnicos,
} from './carreira.ts'
import { avancarDia, type Competicao, type FaseLiga } from './competicoes.ts'
import { mundoSintetico } from './fixtures.ts'
import { novoJogo, novoTecnico, type Mundo } from './mundo.ts'
import { derivar } from './rng.ts'

const B = base as Base
const rng = () => derivar('teste', 'carreira')

/** Liga de dois times (0 líder) para os testes do técnico. */
function liga(m: Mundo): Competicao {
  const fase: FaseLiga = { tipo: 'liga', times: [0, 1], grupos: [], linhas: {}, jogos: [], avancam: 0, idaVolta: [], formato: 0 }
  const c: Competicao = { id: 'L', nome: 'Liga', tipo: 1, divisao: 1, fases: [fase], campeao: null, vice: null, rebaixados: 0 }
  m.competicoes = [c]
  return c
}

describe('jogadores', () => {
  it('junior: progresso pela idade e potencial estimado ±1 (ga, fZ)', () => {
    const j = mundoSintetico().jogadores[0]!
    Object.assign(j, { idade: 18, potencial: 5 })
    iniciarJunior(j, rng())
    expect(j.progresso).toBeGreaterThanOrEqual(55 + 1 + 5)
    expect(j.progresso).toBeLessThanOrEqual(55 + 5 + 5)
    expect(Math.abs(j.potencialEstimado - 5)).toBeLessThanOrEqual(1)
    expect(gerarNome(B, 29, rng()).length).toBeGreaterThan(2)
  })

  it('evolução semanal: jovem cresce até o teto, veterano cai, junior progride', () => {
    const m = mundoSintetico(40)
    const [jovem, velho, noTeto, junior] = m.times[0]!.jogadores.slice(0, 4).map((id) => m.jogadores[id]!)
    Object.assign(jovem!, { idade: 19 })
    Object.assign(velho!, { idade: 36, forca: 60 })
    Object.assign(noTeto!, { idade: 22, forca: 90 }) // Série A, reputação 5: teto 90 no Brasil
    Object.assign(junior!, { idade: 17, juvenil: true, progresso: 40, potencial: 10 })
    for (let s = 0; s < 20; s++) evolucaoSemanal(m, derivar('semana', String(s)))
    expect(jovem!.forca).toBeGreaterThan(40)
    expect(velho!.forca).toBeLessThan(60)
    expect(noTeto!.forca).toBe(90)
    expect(junior!.progresso).toBe(40 + Math.floor(20 * (0.5 + 0.11)))
    expect(junior!.forca).toBe(40)
  })

  it('aposentadoria: sai do elenco, a IA ganha um junior; com 49+ anos é certa', () => {
    const m = novoJogo(B, { habilidadeIndividual: false }, 'apos')
    const t = m.times.find((x) => x.divisao === 1)!
    const j = m.jogadores[t.jogadores[0]!]!
    j.idade = 49
    envelhecer(m, B, rng())
    expect(j.time).toBe(-1)
    expect(j.idade).toBe(50)
    expect(t.jogadores).not.toContain(j.id)
    const novo = gerarJunior(m, B, t, 2, rng())
    expect(novo).toMatchObject({ juvenil: true, posicao: 2, time: t.id })
    expect(novo.idade).toBeGreaterThanOrEqual(16)
    expect(novo.idade).toBeLessThanOrEqual(19)
    aposentar(m, B, t.jogadores[0]!, rng())
    expect(m.jogadores.filter((x) => x.time === -1).length).toBeGreaterThanOrEqual(2)
  })
})

describe('técnico', () => {
  it('diretoria e torcida depois do jogo de liga (al.a)', () => {
    const m = mundoSintetico()
    const c = liga(m)
    for (const t of m.tecnicos) Object.assign(t, { diretoria: 50, torcida: 85 })
    posJogoTecnicos(m, c, { dia: 0, casa: 0, fora: 1, gols: [2, 1] }, false)
    // líder vence em casa: +5; torcida +3
    expect(m.tecnicos[0]).toMatchObject({ diretoria: 55, torcida: 88, jogos: 1, vitorias: 1, pontos: 4 })
    // 2º de 2 perde fora para igual: −1 da base, −1 da tabela; torcida −4
    expect(m.tecnicos[1]).toMatchObject({ diretoria: 48, torcida: 81, derrotas: 1, pontos: 0 })
  })

  it('título: reputação de time e técnico, pontos e festa (b, q)', () => {
    const m = mundoSintetico()
    const c = liga(m)
    const tc = m.tecnicos[0]!
    Object.assign(tc, { diretoria: 50, torcida: 50 })
    colocacaoTecnico(m, c, 0, 1)
    expect(m.times[0]!.pontosReputacao).toBe(500)
    expect(tc).toMatchObject({ pontosReputacao: 600, pontos: 25, torcida: 90, diretoria: 80 })
    expect(tc.titulos).toEqual([{ temporada: 1, competicao: 'L', time: 0 }])
    tc.pontosReputacao = 1001
    tc.reputacao = 0
    m.times[0]!.reputacao = 5
    atualizarReputacoes(m)
    expect(tc.reputacao).toBe(3)
    expect(m.times[0]!.pontosReputacao).toBe(500 - 6000)
  })

  it('humano: assume, pede demissão (há substituto), recebe e aceita proposta', () => {
    const m = novoJogo(B, { habilidadeIndividual: false }, 'tec')
    const t = m.times.find((x) => x.divisao === 2)!
    const h = contratarTecnicoHumano(m, 'Eu', 29, t.id)
    expect(t).toMatchObject({ humano: true, tecnico: h.id })
    expect(t.financas).not.toBeNull()
    expect(m.tecnicos.filter((c) => c.time === null)).toHaveLength(1) // o da IA ficou livre
    expect(pedirDemissao(m, h.id, rng())).toBeNull()
    expect(h.time).toBeNull()
    expect(t).toMatchObject({ humano: false, financas: null })
    expect(m.trocasDeTecnico.at(-1)).toMatchObject({ time: t.id, saiu: h.id, motivo: 0 })
    m.ofertas = [{ tecnico: h.id, dia: m.dia, times: [m.times.find((x) => x.divisao === 3)!.id] }]
    const novo = m.ofertas[0]!.times[0]!
    expect(aceitarOferta(m, h.id, novo, rng())).toBeNull()
    expect(h.time).toBe(novo)
    expect(m.times[novo]!.humano).toBe(true)
    expect(h.diretoria).toBe(95)
  })

  it('sem técnico livre, o humano não consegue sair', () => {
    const m = mundoSintetico()
    m.tecnicos.push(novoTecnico(2, 'Eu', 29, true, 0, 5))
    m.times[0]!.tecnico = 2
    m.tecnicos[0]!.time = null
    m.tecnicos[0]!.humano = true // ninguém da IA livre
    expect(pedirDemissao(m, 2, rng())).toBe('a diretoria ainda não achou um técnico à sua altura')
  })
})

describe('temporada', () => {
  it('com um técnico humano: campanha, satisfação nos limites e propostas', () => {
    const m = novoJogo(B, { habilidadeIndividual: true }, 'carreira')
    const h = contratarTecnicoHumano(m, 'Eu', 29, m.times.find((x) => x.divisao === 2)!.id)
    const forca0 = m.jogadores.map((j) => j.forca)
    while (avancarDia(m) !== null);
    expect(h.jogos).toBeGreaterThan(30)
    expect(h.campanhas).toHaveLength(1)
    for (const c of m.tecnicos) {
      expect(c.diretoria).toBeGreaterThanOrEqual(0)
      expect(c.diretoria).toBeLessThanOrEqual(100)
    }
    expect(m.jogadores.filter((j, i) => j.forca !== forca0[i]).length).toBeGreaterThan(5000)
    expect(m.trocasDeTecnico.length).toBeGreaterThan(0)
  })
})
