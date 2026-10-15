import base from '@bolasfoot/data/base.json' with { type: 'json' }
import type { Base } from '@bolasfoot/data'
import { describe, expect, it } from 'vitest'
import { avancarDia } from './competicoes.ts'
import { abrirCaixa } from './economia.ts'
import { mundoSintetico } from './fixtures.ts'
import {
  aceitaIr, anunciar, darLance, encerrarEmprestimo, janelaIA, listarIA, mercadoAntesDosJogos, mercadoDepoisDosJogos,
  pedirEmprestado, porPosicao, precoVendaIA, promoverJunior, proporCompra, renovarContrato, venderAgora,
} from './mercado.ts'
import { novoJogo, type Mundo } from './mundo.ts'
import { derivar } from './rng.ts'

const rng = () => derivar('teste', 'mercado')

/** Sintético com o time 0 humano (caixa de Série A) e valores fixos. Elenco: 2 GOL, 4 LAT, 5 ZAG, 6 MEI, 5 ATA. */
function mundo(): Mundo {
  const m = mundoSintetico()
  for (const j of m.jogadores) {
    j.valor = 1_000_000
    j.preco = j.valor
    j.salario = 100_000
    j.contratoAte = 200
  }
  m.times[0]!.humano = true
  abrirCaixa(m, 0)
  return m
}
const doTime = (m: Mundo, t: number, pos: number) => m.times[t]!.jogadores.map((id) => m.jogadores[id]!).filter((j) => j.posicao === pos)

describe('IA', () => {
  it('lista só sobras, sem titulares e estrelas, pelo valor (kp)', () => {
    const m = novoJogo(base as Base, { habilidadeIndividual: false }, 'lista')
    const listados = m.jogadores.filter((j) => j.aVenda)
    expect(listados.length).toBeGreaterThan(300)
    for (const j of listados) {
      expect(j.titular || j.estrela).toBe(false)
      expect(j.preco).toBe(j.valor)
    }
    for (const j of m.jogadores.filter((j) => j.paraEmprestimo)) expect(j.aVenda && j.forca < 42).toBe(true)
    const t = m.times[0]!
    t.jogadores.forEach((id) => (m.jogadores[id]!.titular = true))
    listarIA(m, t, rng())
    expect(t.jogadores.some((id) => m.jogadores[id]!.aVenda)).toBe(false)
  })

  it('preço de venda conforme o elenco (l.a)', () => {
    const m = mundo()
    const [gol] = doTime(m, 1, 0), [lat] = doTime(m, 1, 1), [ata] = doTime(m, 1, 4)
    expect(precoVendaIA(m, gol!)).toBe(2_000_000) // 2 goleiros: ×2
    expect(precoVendaIA(m, lat!)).toBe(1_200_000) // sobra: +20%
    expect(precoVendaIA(m, ata!)).toBe(1_500_000) // sobra de atacante: +50%
    ata!.forca = 20
    expect(precoVendaIA(m, ata!)).toBe(900_000) // fraco: −10%
    m.times[1]!.jogadores = m.times[1]!.jogadores.filter((id) => id !== doTime(m, 1, 0)[1]!.id)
    expect(precoVendaIA(m, gol!)).toBe(2_500_000) // o último goleiro: ×2,5
  })

  it('o jogador aceita conforme as reputações (l.c)', () => {
    const m = mundo()
    const j = doTime(m, 1, 3)[0]!
    expect(aceitaIr(m, j, m.times[0]!)).toBe(0)
    m.times[1]!.reputacao = 4
    m.times[0]!.reputacao = 2
    expect(aceitaIr(m, j, m.times[0]!)).toBe(1)
    m.times[1]!.continente = 0
    Object.assign(m.times[0]!, { reputacao: 3, divisao: 2 })
    expect(aceitaIr(m, j, m.times[0]!)).toBe(2) // europeu grande: só com salário dobrado
  })
})

describe('humano compra', () => {
  it('oferta abaixo do pedido vira contraproposta; aceitar fecha e move dinheiro e jogador', () => {
    const m = mundo()
    const j = doTime(m, 1, 1)[0]!
    expect(proporCompra(m, 0, j.id, 1_000_000, rng())).toEqual({ tipo: 'contraproposta', valor: 1_200_000, salario: 0 })
    expect(j.time).toBe(1)
    expect(proporCompra(m, 0, j.id, 1_000_000, rng(), true)).toEqual({ tipo: 'fechada', valor: 1_200_000 })
    expect(j.time).toBe(0)
    expect(m.times[0]!.jogadores).toContain(j.id)
    expect(m.times[1]!.jogadores).not.toContain(j.id)
    expect(m.times[0]!.financas!.despesas.compras).toBe(1_200_000)
    expect(j.contratoAte).toBe(m.dia + 180)
    expect(j.timeAnterior).toBe(1)
    expect(m.transferencias).toEqual([{ dia: m.dia, jogador: j.id, de: 1, para: 0, valor: 1_200_000 }])
  })

  it('listado sai pelo preço pedido; sem caixa ou do próprio time, recusa', () => {
    const m = mundo()
    const j = doTime(m, 1, 3)[0]!
    j.aVenda = true
    j.preco = 700_000
    expect(proporCompra(m, 0, j.id, 800_000, rng())).toEqual({ tipo: 'fechada', valor: 700_000 })
    expect(proporCompra(m, 0, j.id, 800_000, rng()).tipo).toBe('recusada')
    expect(proporCompra(m, 0, doTime(m, 1, 3)[0]!.id, 99_000_000, rng())).toEqual({ tipo: 'recusada', motivo: 'valor maior que o caixa' })
  })
})

describe('humano vende', () => {
  it('venda imediata para a IA, com multa de rescisão pelos dias de contrato', () => {
    const m = mundo()
    const j = doTime(m, 0, 3)[0]!
    j.contratoAte = m.dia + 45 // 31..60 dias: 20%
    expect(venderAgora(m, j.id, 1_050_000, rng())).toEqual({ comprador: 1, valor: 1_050_000 })
    const f = m.times[0]!.financas!
    expect(f.receitas.vendas).toBe(1_050_000)
    expect(f.despesas.comissoes).toBe(210_000)
    expect(venderAgora(m, doTime(m, 0, 3)[0]!.id, 5_000_000, rng())).toBeNull() // acima da tolerância
  })

  it('a IA compra os listados depois das rodadas', () => {
    const m = mundo()
    const j = doTime(m, 0, 3)[0]!
    anunciar(m, j.id, j.valor)
    for (let d = 0; d < 20 && j.time === 0; d++) mercadoDepoisDosJogos(m, [], derivar('dia', String(d)))
    expect(j.time).toBe(1)
  })
})

describe('empréstimo', () => {
  it('pede, devolve no fim e respeita o limite de quatro', () => {
    const m = mundo()
    const js = doTime(m, 1, 3)
    js.forEach((j) => (j.paraEmprestimo = true))
    expect(pedirEmprestado(m, 0, doTime(m, 1, 0)[0]!.id)).toBe('não está disponível para empréstimo')
    for (const j of js.slice(0, 4)) expect(pedirEmprestado(m, 0, j.id)).toBeNull()
    expect(pedirEmprestado(m, 0, js[4]!.id)).toBe('limite de quatro emprestados')
    expect(js[0]!.emprestado).toBe(true)
    expect(js[0]!.contratoAte).toBe(m.dia + 365)
    expect(m.times[0]!.financas!.despesas.compras).toBe(0)
    expect(encerrarEmprestimo(m, js[0]!.id)).toBeNull()
    expect(js[0]!.time).toBe(1)
    expect(js[0]!.emprestado).toBe(false)
    m.dia += 367
    mercadoDepoisDosJogos(m, [], rng())
    expect(m.emprestimos).toEqual([])
    expect(js.every((j) => j.time === 1)).toBe(true)
  })
})

describe('leilão', () => {
  const abrir = (m: Mundo) => {
    const j = doTime(m, 1, 3)[0]!
    m.leiloes.push({ jogador: j.id, vendedor: 1, compradorIA: null, minimo: 500_000, lances: [] })
    return j
  }
  it('lance de 2,5× o mínimo leva sempre; abaixo do mínimo não leva', () => {
    const m = mundo()
    const j = abrir(m)
    expect(darLance(m, 0, j.id, 99_000_000)).toBe('oferta maior que seu dinheiro em caixa')
    expect(darLance(m, 0, j.id, 1_250_000)).toBeNull()
    mercadoAntesDosJogos(m, rng())
    expect(j.time).toBe(0)
    expect(m.leiloes).toEqual([])
    const k = abrir(m)
    darLance(m, 0, k.id, 400_000)
    mercadoAntesDosJogos(m, rng())
    expect(k.time).toBe(1)
  })
})

describe('juniores e contrato', () => {
  it('promove junior: força = potencial com progresso 0, contrato de 180 dias', () => {
    const m = mundo()
    const j = doTime(m, 1, 3)[0]!
    m.times[1]!.jogadores = m.times[1]!.jogadores.filter((id) => id !== j.id)
    m.times[1]!.juniores.push(j.id)
    Object.assign(j, { juvenil: true, potencial: 5, estrela: false })
    expect(promoverJunior(m, j.id, rng())).toBeNull()
    expect(j.forca).toBe(5)
    expect(j.juvenil).toBe(false)
    expect(m.times[1]!.jogadores).toContain(j.id)
    expect(j.contratoAte).toBe(m.dia + 180)
    expect(j.valor).toBeGreaterThan(0)
  })

  it('renovação: teto de 25% do valor e contraproposta com o mínimo', () => {
    const m = mundo()
    const j = doTime(m, 0, 3)[0]!
    expect(renovarContrato(m, j.id, 250_000, 0).tipo).toBe('recusada')
    // faltam 200 dias (> 60): mínimo = salário + 10%
    expect(renovarContrato(m, j.id, 105_000, 0)).toEqual({ tipo: 'contraproposta', valor: 0, salario: 110_000 })
    expect(renovarContrato(m, j.id, 0, 0, true)).toEqual({ tipo: 'fechada', valor: 110_000 })
    expect(j.contratoAte).toBe(380)
    // uma renovação por temporada
    expect(renovarContrato(m, j.id, 0, 0, true)).toEqual({ tipo: 'recusada', motivo: 'já renovou nesta temporada' })
    m.temporada++
    expect(renovarContrato(m, j.id, 0, 0, true).tipo).toBe('fechada')
  })
})

describe('temporada', () => {
  it('sem vendedor na posição, a IA promove um junior novo (l.java:727)', () => {
    const m = mundoSintetico()
    const t = m.times[0]!
    t.jogadores = t.jogadores.filter((id) => m.jogadores[id]!.posicao !== 0)
    janelaIA(m, base as Base, rng())
    const goleiros = t.jogadores.map((id) => m.jogadores[id]!).filter((j) => j.posicao === 0)
    expect(goleiros.length).toBe(1) // uma reposição por posição na janela (ah.ku)
    expect(goleiros.every((j) => !j.juvenil && j.time === 0 && j.promovidoEm === 1)).toBe(true)
  })

  it('humano vende pela lista; janela da IA mantém elencos coerentes', () => {
    const m = novoJogo(base as Base, { habilidadeIndividual: false }, 'mercado')
    const id = m.times.find((t) => t.divisao === 1)!.id
    m.times[id]!.humano = true
    abrirCaixa(m, id)
    const vendidos = m.times[id]!.jogadores.slice(0, 3)
    for (const j of vendidos) anunciar(m, j, m.jogadores[j]!.valor)
    while (avancarDia(m) !== null);
    expect(vendidos.every((j) => m.jogadores[j]!.time !== id)).toBe(true)
    expect(m.transferencias.length).toBeGreaterThan(20) // leilões
    janelaIA(m, base as Base, derivar('mercado', 'janela'))
    const vistos = new Set<number>()
    for (const t of m.times) {
      expect(t.jogadores.length).toBeLessThanOrEqual(35)
      expect(porPosicao(m, t, true).reduce((a, b) => a + b)).toBe(t.jogadores.length)
      for (const j of [...t.jogadores, ...t.juniores]) {
        expect(m.jogadores[j]!.time).toBe(t.id)
        expect(vistos.has(j)).toBe(false)
        vistos.add(j)
      }
    }
  })
})
