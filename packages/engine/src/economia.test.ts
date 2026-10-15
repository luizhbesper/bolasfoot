import base from '@bolasfoot/data/base.json' with { type: 'json' }
import type { Base } from '@bolasfoot/data'
import { describe, expect, it } from 'vitest'
import { datas, TIPO } from './calendario.ts'
import { avancarDia, type FaseLiga } from './competicoes.ts'
import { abrirCaixa, iniciarObra, lancamentos, limiteEmprestimo, orcamentoObra, pagarEmprestimo, pegarEmprestimo, salarioJogador, taxaJuros, tetoEstadio, valorJogador } from './economia.ts'
import { mundoSintetico } from './fixtures.ts'
import { novoJogo } from './mundo.ts'

const meia = { forca: 50, idade: 25, posicao: 3, estrela: false, craque: false, titular: true, juvenil: false, potencial: 5 } as const
const timeA = { nivel: 20, divisao: 1, pais: 29 }

describe('jogador', () => {
  it('valor (F.fK)', () => {
    // mult 600, titular +20% = 720, idade 25: +7×22 = 874; (2·50)² × 874
    expect(valorJogador(meia, timeA, 1)).toBe(8_740_000)
    // estrela fora da Europa: ×1.7; atacante ×1.3; 33 anos: +(34−33)×10
    expect(valorJogador({ ...meia, estrela: true, posicao: 4, idade: 33, titular: false }, timeA, 1)).toBe(100 * 100 * (Math.round(1.3 * Math.round(1.7 * 600)) + 10))
    // juvenil: 3% × potencial
    expect(valorJogador({ ...meia, juvenil: true, titular: false, idade: 18 }, timeA, 1)).toBe(Math.round(100 * 100 * (600 + 14 * 27) * 0.03) * 5)
    // recém-promovido: 18% (até o preço pedido) na temporada, 35% na seguinte
    expect(valorJogador({ ...meia, promovidoEm: 3, preco: 1_000_000 }, timeA, 1, 3)).toBe(1_000_000)
    expect(valorJogador({ ...meia, promovidoEm: 3 }, timeA, 1, 4)).toBe(Math.round(8_740_000 * 0.35))
  })

  it('salário (F.fJ)', () => {
    // base 600 (Série A, BR) → round(0.5·600) = 300; 50·2·300 = 30 mil por semana, ×4 no mensal
    expect(salarioJogador(meia, timeA, false)).toBe(30_000)
    expect(salarioJogador(meia, timeA, true)).toBe(120_000)
    // goleiro (−70), 34 anos (−2·300), craque ×1.4
    expect(salarioJogador({ ...meia, posicao: 0, idade: 34, craque: true, estrela: true }, timeA, false)).toBe(Math.round((50 * 2 * Math.round(0.5 * 530) - 600 + 50 * 250) * 1.4))
    expect(salarioJogador({ ...meia, forca: 1, idade: 40 }, timeA, false)).toBe(500) // piso
  })

  it('o mundo nasce com valor, salário e contrato de 210 a 239 dias', () => {
    const m = novoJogo(base as Base, { habilidadeIndividual: false }, 'eco')
    for (const j of m.jogadores) {
      expect(j.valor).toBeGreaterThan(0)
      expect(j.salario).toBeGreaterThanOrEqual(j.juvenil ? 0 : 2000)
      expect(j.contratoAte - m.dia).toBeGreaterThanOrEqual(210)
      expect(j.contratoAte - m.dia).toBeLessThan(240)
    }
  })
})

describe('caixa', () => {
  it('empréstimo: limite de 30% do elenco, valor em passos de 100 mil, juros progressivos', () => {
    const m = mundoSintetico()
    const t = m.times[0]!
    const f = abrirCaixa(m, 0)
    expect(f.caixa).toBe(15_000_000)
    const elenco = t.jogadores.reduce((s, id) => s + m.jogadores[id]!.valor, 0)
    const limite = limiteEmprestimo(m, t)
    expect(limite).toBe(Math.max(500_000, Math.floor((elenco * 0.3) / 100_000) * 100_000))
    expect(pegarEmprestimo(m, t, 150_000, m.dia)).toBe(false) // fora do passo
    expect(pegarEmprestimo(m, t, limite + 100_000, m.dia)).toBe(false)
    expect(pegarEmprestimo(m, t, limite, m.dia)).toBe(true)
    expect(f.emprestimo).toBe(limite)
    expect(f.juros).toBe(Math.floor(limite * 0.05)) // dívida no limite: 5%
    expect(pagarEmprestimo(m, t, limite + 100_000, m.dia)).toBe(false) // mais que a dívida
    expect(pagarEmprestimo(m, t, limite, m.dia)).toBe(true)
    expect(f.juros).toBe(0)
    expect(taxaJuros(0, limite)).toBe(0.01)
    expect(taxaJuros(limite / 2, limite)).toBeCloseTo(0.03)
    // o empréstimo entra no extrato: caixa = saldo inicial + lançamentos
    expect(f.caixa - lancamentos(f).reduce((s, l) => s + l.valor, 0)).toBe(15_000_000 - f.receitas.patrocinio)
  })

  it('obra: custo por faixa, prazo e teto por temporada (bug do pa[1] corrigido)', () => {
    const m = mundoSintetico()
    const t = m.times[0]!
    abrirCaixa(m, 0)
    // geral 6000 → 6500: faixa ≤ 10000 → 500/lugar; + 100 mil fixos
    expect(orcamentoObra(t, [500, 0, 0, 0])).toEqual({ custo: 3 * (100_000 + 500 * 500), dias: 30 })
    expect(tetoEstadio(1)).toEqual([18000, 80000, 9000, 700])
    expect(tetoEstadio(6)).toEqual([22000, 110000, 10000, 900])
    expect(tetoEstadio(10)).toEqual([25000, 120000, 10000, 1200])
    expect(iniciarObra(m, 0, [0, 0, 0, 400])).toBe('acima do teto do setor')
    expect(iniciarObra(m, 0, [500, 0, 0, 0])).toBeNull()
    expect(t.financas!.caixa).toBe(15_000_000 - 3 * 350_000)
    expect(iniciarObra(m, 0, [10, 0, 0, 0])).toBe('já há uma obra em andamento')
    // terminou: só na temporada seguinte; o histórico fica
    t.financas!.obra = null
    expect(iniciarObra(m, 0, [10, 0, 0, 0])).toBe('só uma reforma por temporada')
    m.temporada++
    expect(iniciarObra(m, 0, [10, 0, 0, 0])).toBeNull()
    expect(t.financas!.obras!.map((o) => o.setores[0])).toEqual([500, 10])
  })
})

describe('temporada com um humano', () => {
  const m = novoJogo(base as Base, { habilidadeIndividual: false }, 'eco-humano')
  const id = m.times.find((t) => t.divisao === 1)!.id
  const t = m.times[id]!
  t.humano = true
  const f = abrirCaixa(m, id)
  const inicial = f.caixa
  while (avancarDia(m) !== null);

  it('paga salário nos meses com jogo, recebe bilheteria e prêmio', () => {
    const folhaMes = [...t.jogadores, ...t.juniores].reduce((s, j) => s + m.jogadores[j]!.salario, 0)
    expect(f.despesas.salarios % folhaMes).toBe(0)
    const meses = f.despesas.salarios / folhaMes
    expect(meses).toBeGreaterThanOrEqual(9)
    expect(meses).toBeLessThanOrEqual(12)
    expect(f.receitas.bilheteria).toBeGreaterThan(0)
    expect(f.caixa).toBe(inicial + Object.values(f.receitas).reduce((a, b) => a + b, 0) - f.receitas.patrocinio - Object.values(f.despesas).reduce((a, b) => a + b, 0))
  })

  it('o extrato fecha com o caixa, lançamento a lançamento', () => {
    const l = lancamentos(f)
    // o 1º lançamento é o patrocínio que já veio no caixa inicial
    expect(inicial - l[0]!.valor + l.reduce((s, x) => s + x.valor, 0)).toBe(f.caixa)
    expect(l.filter((x) => x.cat === 'salarios').length).toBe(f.despesas.salarios / l.find((x) => x.cat === 'salarios')!.valor * -1)
  })

  it('Série D e Copa começam no 1º dia de liga, com a tabela zerada', () => {
    const d = m.competicoes.find((c) => c.id === 'BR-4')!.fases[0] as FaseLiga
    expect(Math.min(...d.jogos.map((j) => j.dia))).toBe(datas(m.calendario, TIPO.liga)[0])
  })
})
