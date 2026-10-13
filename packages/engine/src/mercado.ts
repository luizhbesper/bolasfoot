// Mercado: lista de transferências, preço da IA, propostas, empréstimos, leilão, juniores e a janela da IA.
// Fontes: best/ah.java:1155 (kp), :1245-1290 (ku, kv), :2144-2190 (a/b: o time quer o jogador?);
// best/l.java (procura de comprador, preço da IA, empréstimo, reposição); best/F.java:2524-2617 (c/a: transferência);
// components/t_0.java + best/f_0.java:1545 (au: fim do empréstimo), :1599 (av: a IA compra os listados dos humanos);
// components/an.java + a/jc.java (venda imediata); a/cz_0.java (proposta); best/N.java + a/dz_0.java (leilão);
// best/k_0.java (junior promovido); a/fy_0.java (renovação); best/ag.java (janela da IA no fim da temporada).
//
// Mapa dos campos do F: ff() = estrela, gm() = craque, status 1 = titular, gl() = emprestado, ft() = à venda,
// fz() = para empréstimo, fk() = valor, fl() = preço pedido, fj() = salário, fi() = força.
import type { Base } from '@bolasfoot/data'
import { gerarJunior } from './carreira.ts'
import { classificacaoFinal } from './competicoes.ts'
import { pagar, receber, salarioJogador, valorJogador } from './economia.ts'
import { BRA, batedorFalta, habilidadesIniciais, type JogadorM, type Mundo, type TimeM } from './mundo.ts'
import type { Rng } from './rng.ts'

export interface Emprestimo {
  jogador: number
  /** time dono do jogador */
  origem: number
  /** dia em que acaba (366 dias depois) */
  fim: number
}

export interface Transferencia {
  dia: number
  jogador: number
  de: number
  para: number
  valor: number
}

export interface Leilao {
  jogador: number
  vendedor: number
  /** quem leva se nenhum humano cobrir (N.iz) */
  compradorIA: number | null
  /** lance mínimo: metade do valor */
  minimo: number
  lances: { time: number; valor: number }[]
}

/** Resposta a uma proposta: fechada, recusada ou com contraproposta (valor e salário pedido; 0 = mantém). */
export type Proposta =
  | { tipo: 'fechada'; valor: number }
  | { tipo: 'contraproposta'; valor: number; salario: number }
  | { tipo: 'recusada'; motivo: string }

const ELENCO_MAX = 35
const JUNIORES_MAX = 20
/** força mínima para o time querer o jogador: por divisão (liga nacional) ou reputação; máxima por reputação (aq.qg/qh/qi) */
const FORCA_MIN_DIV = [1, 40, 30, 20, 5]
const FORCA_MIN_REP = [1, 10, 20, 40, 50, 55]
const FORCA_MAX_REP = [20, 30, 45, 85, 100, 100]
/** divisões da liga BR (Z.js) */
const DIVISOES_BR = 4
const EUROPA = 0

const jog = (m: Mundo, id: number) => m.jogadores[id]!
const elenco = (m: Mundo, t: TimeM) => t.jogadores.map((id) => jog(m, id))

/** Jogadores por posição; sem os emprestados, como o J(false). Fonte: best/ah.java:1223 (J) */
export function porPosicao(m: Mundo, t: TimeM, comEmprestados = false): number[] {
  const n = [0, 0, 0, 0, 0]
  for (const j of elenco(m, t)) if (comEmprestados || !j.emprestado) n[j.posicao]!++
  return n
}

/** O time quer o jogador (força entre os limites; com `limitar`, sem excesso na posição). Fonte: best/ah.java:2144 (a) */
function quer(m: Mundo, t: TimeM, j: JogadorM, limitar: boolean): boolean {
  if (t.jogadores.length >= ELENCO_MAX) return false
  if (j.forca < (t.ligaNacional ? FORCA_MIN_DIV[t.divisao] ?? 1 : FORCA_MIN_REP[t.reputacao] ?? 1)) return false
  if (j.forca > (FORCA_MAX_REP[t.reputacao] ?? 100)) return false
  return !limitar || porPosicao(m, t)[j.posicao]! <= [3, 5, 5, 10, 5][j.posicao]!
}

/** Variante sem teto de força nem limite por posição. Fonte: best/ah.java:2179 (b) */
const aceitaSemTeto = (t: TimeM, j: JogadorM) =>
  t.jogadores.length < ELENCO_MAX && j.forca >= (t.ligaNacional ? FORCA_MIN_DIV[t.divisao] ?? 1 : FORCA_MIN_REP[t.reputacao] ?? 1)

/**
 * O jogador aceita ir para o time? 0 sim, 1 não, 2 só com o salário dobrado. Fonte: best/l.java:651 (c), :679 (d)
 */
export function aceitaIr(m: Mundo, j: JogadorM, destino: TimeM): 0 | 1 | 2 {
  const origem = m.times[j.time]!
  if (destino.continente === EUROPA) return 0
  if (origem.continente === EUROPA && origem.reputacao >= 4) {
    if (destino.reputacao >= 4 || destino.divisao === 1) return 0
    return destino.reputacao >= 3 ? 2 : 1
  }
  const ro = origem.reputacao, rd = destino.reputacao
  return (ro >= 3 && rd >= 3) || (ro === 3 && (rd === 2 || rd === 1)) || ro <= 2 ? 0 : 1
}

// ── Transferência ─────────────────────────────────────────────────────────

/** Multa de rescisão paga pelo vendedor, pelos dias que faltam de contrato. Fonte: best/F.java:2566-2569 */
const taxaMulta = (dias: number) => (dias <= 0 ? 0 : dias <= 30 ? 0.12 : dias <= 60 ? 0.2 : dias <= 90 ? 0.22 : dias <= 180 ? 0.25 : 0.3)

/**
 * Muda o jogador de time. `venda` = venda pela lista ou imediata (o vendedor paga a multa de rescisão);
 * `emprestimo` e `retorno` não envolvem dinheiro. Só os humanos movimentam caixa. Fonte: best/F.java:2551 (a)
 */
export function transferir(m: Mundo, j: JogadorM, destino: number, valor: number, modo: 'compra' | 'venda' | 'emprestimo' | 'retorno' = 'compra'): void {
  const de = m.times[j.time]!, para = m.times[destino]!
  if (de === para) return
  j.timeAnterior = de.id
  j.aVenda = false
  j.paraEmprestimo = false
  if (modo === 'emprestimo') j.emprestado = true
  if (modo === 'retorno') j.emprestado = false
  if (modo === 'compra' || modo === 'venda') {
    const multa = modo === 'venda' ? Math.round(valor * taxaMulta(j.contratoAte - m.dia)) : 0
    receber(de, valor, 'vendas')
    if (multa > 0) pagar(de, multa, 'comissoes')
    pagar(para, valor, 'compras')
  }
  j.contratoAte = m.dia + (modo === 'emprestimo' ? 365 : 180)
  j.preco = j.valor
  de.jogadores = de.jogadores.filter((id) => id !== j.id)
  para.jogadores.push(j.id)
  j.time = destino
  // ah.kA/kz: novos batedores. ponytail: o kA reordena o elenco por força antes; aqui vale a ordem atual
  if (de.batedores.falta === j.id) de.batedores.falta = batedorFalta(elenco(m, de))
  if (de.batedores.escanteio === j.id) de.batedores.escanteio = null
  m.transferencias.push({ dia: m.dia, jogador: j.id, de: de.id, para: destino, valor })
}

/** Junior muda de time e continua junior. Fonte: best/F.java:2524 (c) */
function transferirJunior(m: Mundo, j: JogadorM, destino: number, valor: number): void {
  const de = m.times[j.time]!, para = m.times[destino]!
  j.aVenda = false
  j.paraEmprestimo = false
  receber(de, valor, 'vendas')
  pagar(para, valor, 'compras')
  j.preco = valor
  de.juniores = de.juniores.filter((id) => id !== j.id)
  para.juniores.push(j.id)
  j.time = destino
  m.transferencias.push({ dia: m.dia, jogador: j.id, de: de.id, para: destino, valor })
}

// ── Procura de comprador (best.l) ─────────────────────────────────────────

/**
 * Procura um time da IA para comprar o jogador pelo `preco`. `cj` = venda pedida (elenco do comprador até 35, e não 32);
 * `cs` = 0 normal, 1 só times que aceitam sem teto (janela, liga BR), 2 grandes da Europa.
 * As listas de ligas europeias do original estão sempre vazias aqui (sem a Espanha não há liga na Europa): só a BR conta.
 * Fonte: best/l.java:35-209 (construtor), :211-257 (a), :264-336 (cH), :338-365 (cI), :367-436 (cJ), :438-519 (a(lista))
 */
export function acharComprador(m: Mundo, j: JogadorM, preco: number, cj: boolean, cs: 0 | 1 | 2, rng: Rng, soExterior = false): TimeM | null {
  const vend = m.times[j.time]!
  const cx = cj ? 35 : 32
  const iaVend = !vend.humano
  const livre = (t: TimeM, max = cx) => !t.humano && t !== vend && t.jogadores.length < max && t.id !== j.timeAnterior
  const mesmoPaisPrimeiro = () => {
    const c = m.continentes[j.pais]
    return (c === 1 || c === 4) && rng.int(100) > 15
  }
  // cn: a liga BR entra se o vendedor é dela (ou, com cs=1, se é sul-americano)
  const ligaBR = cs === 0 ? vend.ligaNacional : cs === 1 ? vend.ligaNacional || vend.continente === 1 : false

  const daLiga = (): TimeM | null => {
    if (!ligaBR) return null
    let min = vend.divisao === 1 ? 1 : vend.divisao - 1
    let max = vend.divisao + 1
    if (cs === 1) {
      min = 1
      max = vend.continente === EUROPA && vend.reputacao >= 4 && j.forca >= 40 ? 1 : 2
    }
    if (j.forca <= 20) [min, max] = [0, DIVISOES_BR]
    const lista = rng.shuffle(m.times.filter((t) => t.pais === BRA && livre(t) && t.divisao >= min && t.divisao <= max))
    if (cs === 1) return lista.find((t) => aceitaSemTeto(t, j)) ?? null
    if (cs === 2) return lista.find((t) => t.jogadores.length < ELENCO_MAX && t.reputacao >= 4) ?? null
    return lista.find((t) => quer(m, t, j, iaVend)) ?? null
  }
  // cH: times de fora das ligas nacionais
  const exterior = (): TimeM | null => {
    const lista = rng.shuffle(m.times.filter((t) => !t.ligaNacional && livre(t)))
    const mesmoPais = mesmoPaisPrimeiro()
    if (cs === 2) return lista.find((t) => t.jogadores.length < ELENCO_MAX && t.continente === EUROPA && t.reputacao >= 4) ?? null
    if (mesmoPais) {
      const t = lista.find((t) => t.pais === j.pais && quer(m, t, j, iaVend))
      if (t) return t
    }
    // o laço "qualquer time" do cH é inalcançável no original
    return lista.find((t) => t.continente === vend.continente && quer(m, t, j, iaVend)) ?? null
  }
  // cI: grandes da Europa, para craques
  const grandes = (): TimeM | null =>
    rng.shuffle(m.times.filter((t) => t.reputacao >= 4 && livre(t))).find((t) => t.continente === EUROPA && quer(m, t, j, iaVend)) ?? null
  // cJ: venda desesperada, qualquer um (a partir da 3ª temporada)
  const qualquer = (): TimeM | null => {
    const lista = rng.shuffle(m.times.filter((t) => livre(t, ELENCO_MAX)))
    const mesmoPais = mesmoPaisPrimeiro()
    return (
      (mesmoPais ? lista.find((t) => t.pais === j.pais && quer(m, t, j, false)) : undefined) ??
      lista.find((t) => t.continente === vend.continente && quer(m, t, j, false)) ??
      lista.find((t) => quer(m, t, j, false)) ??
      lista[0] ??
      null
    )
  }

  if (soExterior) return exterior()
  let liga = true
  if (j.forca > 30 && vend.humano && rng.int(100) > 60) liga = false
  if (j.estrela && vend.humano) liga = false
  if (j.craque) liga = false
  let c = liga ? daLiga() : ((j.craque ? grandes() : null) ?? daLiga())
  c ??= exterior()
  if (!c && m.temporada > 2 && cj && preco < j.valor) c = qualquer()
  return c
}

// ── IA: lista, preço e reposição ──────────────────────────────────────────

/**
 * Embaralha o elenco e põe na lista uma sobra por posição (50%), às vezes também para empréstimo.
 * Roda na criação do mundo e no começo da temporada (W7), só na IA. Fonte: best/ah.java:1155 (kp)
 */
export function listarIA(m: Mundo, t: TimeM, rng: Rng): void {
  const n = porPosicao(m, t)
  for (const j of elenco(m, t)) j.aVenda = j.paraEmprestimo = false
  rng.shuffle(t.jogadores)
  for (let p = 0; p <= 4; p++) {
    if (!(n[p]! > [2, 3, 3, 5, 4][p]! && rng.int(100) > 50)) continue
    const j = elenco(m, t).find((j) => j.posicao === p && !j.titular && !j.estrela && !j.craque && !j.emprestado)
    if (!j) continue
    j.preco = j.valor
    j.aVenda = true
    if (!(rng.int(100) <= 70 || j.forca >= 42)) j.paraEmprestimo = true
  }
}

/**
 * Quanto a IA pede pelo jogador: depende de quantos ela tem na posição. Fonte: best/l.java:582-602
 */
export function precoVendaIA(m: Mundo, j: JogadorM): number {
  const n = porPosicao(m, m.times[j.time]!)[j.posicao]!
  const p = j.posicao, v = j.valor
  if (n >= [3, 4, 4, 5, 4][p]!) {
    // fraco ou velho: desconto (divisão inteira do Java)
    if (j.forca < 30 || j.idade > 35) return v - Math.trunc((v * [15, 20, 20, 10, 10][p]!) / 100)
    return v + Math.round(v * [0.5, 0.2, 0.2, 0.2, 0.5][p]!)
  }
  if (n === 1) return v + Math.round(v * [1.5, 1.5, 1.5, 1.5, 2][p]!)
  return v + Math.round(v * [1, 1, 1, 1, 1.5][p]!)
}

/** Compra um jogador de força parecida de um time com sobra na posição. Fonte: best/l.java:710-790 (a(ah, int[]), a(lista, int[])) */
function reporPosicao(m: Mundo, base: Base | null, t: TimeM, posicao: number, forca: number, rng: Rng): void {
  const rep = t.reputacao
  const lista = t.ligaNacional
    ? m.times.filter((o) => o.pais === t.pais && !o.humano && o !== t && o.reputacao >= Math.max(rep - 2, 0) && o.reputacao <= rep + 1)
    : m.times.filter((o) => !o.humano && o !== t && o.continente === t.continente && o.reputacao >= Math.max(rep - 1, 0) && o.reputacao <= rep + 1)
  rng.shuffle(lista)
  const min = Math.max(forca - 5, 5), max = Math.min(forca + 5, 100)
  for (const o of lista) {
    const js = rng.shuffle(elenco(m, o))
    const alvo = js.find((j) => j.posicao === posicao && j.forca >= min && j.forca <= max && !j.estrela && !j.craque)
    if (alvo && js.filter((j) => j.posicao === posicao).length >= [3, 4, 4, 6, 4][posicao]!) {
      transferir(m, alvo, t.id, alvo.valor)
      return
    }
  }
  // sem vendedor: um junior novo da posição, promovido na hora (F.a + k_0.a)
  if (base) promoverJunior(m, gerarJunior(m, base, t, posicao, rng).id, rng)
}

/** Depois de vender ao humano, a IA repõe as posições abaixo do mínimo (com a posição do vendido, como no original). Fonte: best/l.java:697 */
function reporDepoisDeVender(m: Mundo, base: Base | null, t: TimeM, vendido: JogadorM, rng: Rng): void {
  const n = porPosicao(m, t)
  for (let p = 0; p <= 4; p++) if (n[p]! < [2, 3, 3, 5, 3][p]!) reporPosicao(m, base, t, vendido.posicao, vendido.forca, rng)
}

/** Completa as posições abaixo do mínimo. Fonte: best/ah.java:1245 (ku) */
function completarElenco(m: Mundo, base: Base, t: TimeM, rng: Rng): void {
  const n = porPosicao(m, t)
  const forca = t.ligaNacional ? FORCA_MIN_DIV[t.divisao] ?? 5 : FORCA_MIN_REP[t.reputacao] ?? 5
  for (let p = 0; p <= 4; p++) if (n[p]! < [2, 3, 3, 5, 3][p]!) reporPosicao(m, base, t, p, forca, rng)
}

// ── Humano compra ─────────────────────────────────────────────────────────

/**
 * Proposta de um humano por um jogador (ou junior) da IA. Com contraproposta (o clube pede mais ou o jogador quer o
 * salário dobrado), chame de novo com `aceitar` para fechar nos termos dela. Jogador listado com oferta ≥ preço pedido
 * sai pelo preço pedido. Fonte: a/iA.java:249 (sA), a/cz_0.java:93 (oL), best/l.java:567 (b), :578 (a(F, ah, int))
 */
export function proporCompra(m: Mundo, compradorId: number, jogadorId: number, oferta: number, rng: Rng, aceitar = false, base: Base | null = null): Proposta {
  const j = jog(m, jogadorId)
  const comp = m.times[compradorId]!
  const vend = m.times[j.time]
  const recusa = (motivo: string): Proposta => ({ tipo: 'recusada', motivo })
  if (!vend) return recusa('jogador sem time')
  if (!comp.financas) return recusa('time sem caixa')
  if (vend === comp) return recusa('jogador do seu time')
  // entre humanos, a proposta vai para a caixa do dono (rodada.ts)
  if (vend.humano) return recusa('o dono é humano')
  if (!Number.isInteger(oferta) || oferta <= 0) return recusa('valor inválido')
  if (comp.financas.caixa < oferta) return recusa('valor maior que o caixa')
  if (j.juvenil ? comp.juniores.length >= JUNIORES_MAX : comp.jogadores.length >= ELENCO_MAX) return recusa('elenco cheio')
  if (aceitaIr(m, j, comp) === 1) return recusa('não deseja jogar no seu time')

  const fechar = (valor: number, salario = 0): Proposta => {
    if (comp.financas!.caixa < valor) return recusa('valor maior que o caixa')
    if (salario > 0) j.salario = salario
    if (j.juvenil) transferirJunior(m, j, comp.id, valor)
    else {
      transferir(m, j, comp.id, valor)
      reporDepoisDeVender(m, base, vend, j, rng)
    }
    return { tipo: 'fechada', valor }
  }
  if (j.aVenda && oferta >= j.preco && !j.juvenil) return fechar(j.preco) // l.b: sem reposição

  const pedido = precoVendaIA(m, j)
  const quer = aceitaIr(m, j, comp)
  const salario = quer === 2 ? j.salario * 2 : 0
  if (oferta >= pedido) {
    if (quer === 0) return fechar(oferta)
    return aceitar ? fechar(oferta, salario) : { tipo: 'contraproposta', valor: oferta, salario }
  }
  if (comp.financas.caixa >= pedido) return aceitar ? fechar(pedido, salario) : { tipo: 'contraproposta', valor: pedido, salario }
  return recusa('oferta recusada')
}

// ── Humano vende ──────────────────────────────────────────────────────────

/** Põe o jogador na lista pelo preço pedido (a IA pode comprar depois de cada rodada). Fonte: a/jc.java:117 (dD) */
export function anunciar(m: Mundo, jogadorId: number, preco: number): string | null {
  const j = jog(m, jogadorId)
  if (!Number.isInteger(preco) || preco < 0) return 'preço inválido'
  if (j.emprestado) return 'jogador emprestado'
  j.aVenda = true
  j.preco = preco
  return null
}

export function retirarDaLista(m: Mundo, jogadorId: number): void {
  jog(m, jogadorId).aVenda = false
}

/** Disponibiliza (ou não) para empréstimo; no máximo 10 entre emprestados e disponíveis. Fonte: a/eg_0.java:843 (qE) */
export function disponibilizarEmprestimo(m: Mundo, jogadorId: number, sim: boolean): string | null {
  const j = jog(m, jogadorId)
  if (!sim) {
    j.paraEmprestimo = false
    return null
  }
  if (j.emprestado) return 'jogador emprestado'
  const t = m.times[j.time]!
  const fora = m.emprestimos.filter((e) => e.origem === t.id).length
  const disponiveis = elenco(m, t).filter((o) => !o.emprestado && o.paraEmprestimo).length
  if (fora + disponiveis >= 10) return 'limite de 10 jogadores emprestáveis'
  j.paraEmprestimo = true
  return null
}

/** `HL` do original: tolerância do preço sobre o valor (10%, às vezes 15%). Fonte: a/eg_0.java:483 (qs) */
const tolerancia = (rng: Rng) => (rng.int(100) > 80 ? 0.15 : 0.1)

/** A IA paga até valor + tolerância; acha o comprador e fecha. Fonte: components/an.java:22-62 */
function venderParaIA(m: Mundo, j: JogadorM, preco: number, hl: number, rng: Rng): TimeM | null {
  if (preco > j.valor + Math.round(j.valor * hl)) return null
  const c = acharComprador(m, j, preco, true, 0, rng)
  if (c) transferir(m, j, c.id, preco, 'venda')
  return c
}

/**
 * Venda imediata: se o preço está abaixo do valor, aceita até 10–15% de desconto.
 * ponytail: no original os outros humanos podem cobrir a oferta da IA na hora (a/iX); aqui só a IA compra
 * Fonte: a/jc.java:123 (dE)
 */
export function venderAgora(m: Mundo, jogadorId: number, preco: number, rng: Rng): { comprador: number; valor: number } | null {
  const j = jog(m, jogadorId)
  if (j.emprestado || !Number.isInteger(preco) || preco < 0) return null
  j.preco = preco
  let valor = preco
  if (preco < j.valor) valor = Math.max(preco, j.valor - Math.round(j.valor * (rng.int(100) > 50 ? 0.15 : 0.1)))
  const c = venderParaIA(m, j, valor, tolerancia(rng), rng)
  return c ? { comprador: c.id, valor } : null
}

/** Depois da rodada, 50%: a IA compra os listados dos humanos que pedem até valor + tolerância. Fonte: best/f_0.java:1599 (av) */
function propostasIA(m: Mundo, rng: Rng): void {
  const hl = tolerancia(rng)
  for (const t of m.times) {
    if (!t.humano) continue
    for (const j of elenco(m, t)) if (j.aVenda) venderParaIA(m, j, j.preco, hl, rng)
  }
}

// ── Empréstimo ────────────────────────────────────────────────────────────

/** O humano pede um jogador disponível para empréstimo (até 4 emprestados por time). Fonte: best/l.java:521 (a(F, ah)), best/F.java:2782 (q) */
export function pedirEmprestado(m: Mundo, tomadorId: number, jogadorId: number): string | null {
  const j = jog(m, jogadorId)
  const t = m.times[tomadorId]!
  if (!j.paraEmprestimo || j.juvenil) return 'não está disponível para empréstimo'
  if (j.time === t.id) return 'jogador do seu time'
  if (t.jogadores.length >= ELENCO_MAX) return 'elenco cheio'
  if (m.emprestimos.filter((e) => jog(m, e.jogador).time === t.id).length >= 4) return 'limite de quatro emprestados'
  if (aceitaIr(m, j, t) === 1) return 'não deseja jogar no seu time'
  m.emprestimos.push({ jogador: j.id, origem: j.time, fim: m.dia + 366 })
  transferir(m, j, t.id, 0, 'emprestimo')
  return null
}

/** Devolve ao dono, se houver vaga num dono humano. Fonte: components/t_0.java:38 (tN) */
function devolver(m: Mundo, e: Emprestimo): boolean {
  const origem = m.times[e.origem]!
  if (origem.humano && origem.jogadores.length >= ELENCO_MAX) return false
  transferir(m, jog(m, e.jogador), origem.id, 0, 'retorno')
  m.emprestimos = m.emprestimos.filter((x) => x !== e)
  return true
}

/** Encerra antes do prazo (quem pegou ou o dono). Fonte: a/eg_0.java:885 (qG) */
export function encerrarEmprestimo(m: Mundo, jogadorId: number): string | null {
  const e = m.emprestimos.find((x) => x.jogador === jogadorId)
  if (!e) return 'não está emprestado'
  return devolver(m, e) ? null : 'não há vagas no time de origem'
}

/** Compra o emprestado pelo valor, sem consultar o dono. Fonte: a/eg_0.java:862 (qF) */
export function comprarEmprestado(m: Mundo, compradorId: number, jogadorId: number): string | null {
  const j = jog(m, jogadorId)
  const t = m.times[compradorId]!
  const e = m.emprestimos.find((x) => x.jogador === jogadorId)
  if (!e || j.time !== t.id) return 'não está emprestado ao seu time'
  if (!t.financas || t.financas.caixa < j.valor) return 'sem dinheiro'
  transferir(m, j, e.origem, 0, 'retorno')
  m.emprestimos = m.emprestimos.filter((x) => x !== e)
  transferir(m, j, t.id, j.valor)
  return null
}

// ── Leilão ────────────────────────────────────────────────────────────────

/** Uma sobra da posição com excesso, sem emprestados nem estrelas. Fonte: best/ah.java:1260 (kv) */
function sobra(m: Mundo, t: TimeM, rng: Rng): JogadorM | null {
  const n = porPosicao(m, t)
  const pos = [0, 1, 2, 3, 4].filter((p) => n[p]! > [2, 3, 3, 5, 3][p]!)
  if (pos.length === 0) return null
  const p = rng.shuffle(pos)[0]!
  const cands = elenco(m, t).filter((j) => !j.emprestado && !j.estrela && j.posicao === p)
  return cands.length > 0 ? rng.shuffle(cands)[0]! : null
}

/** Abre de 0 a 3 leilões de sobras da IA. Fonte: a/hk_0.java:283-296, best/N.java */
function abrirLeiloes(m: Mundo, rng: Rng): void {
  const n = rng.int(4)
  for (let k = 0; k < n; k++) {
    let j: JogadorM | null = null
    for (const t of rng.shuffle(m.times.filter((t) => !t.humano && t.jogadores.length >= 21))) if ((j = sobra(m, t, rng))) break
    if (!j || m.leiloes.some((l) => l.jogador === j!.id)) continue
    const c = acharComprador(m, j, j.valor, true, 0, rng)
    m.leiloes.push({ jogador: j.id, vendedor: j.time, compradorIA: c?.id ?? null, minimo: Math.round(j.valor * 0.5), lances: [] })
  }
}

/** Lance de um humano num leilão aberto (substitui o anterior dele). Fonte: a/dz_0.java:211 (pR) */
export function darLance(m: Mundo, timeId: number, jogadorId: number, valor: number): string | null {
  const l = m.leiloes.find((x) => x.jogador === jogadorId)
  const t = m.times[timeId]!
  if (!l) return 'leilão não encontrado'
  if (!t.financas || !Number.isInteger(valor) || valor <= 0) return 'valor inválido'
  if (t.jogadores.length >= ELENCO_MAX) return 'não há vagas no time'
  if (valor >= t.financas.caixa) return 'oferta maior que seu dinheiro em caixa'
  l.lances = [...l.lances.filter((x) => x.time !== timeId), { time: timeId, valor }]
  return null
}

/**
 * Fecha os leilões: o maior lance (o primeiro, no empate) leva, mas abaixo de 2,5× o mínimo a IA cobre em 49% das vezes.
 * O `> 80 → 0,82` do original vem depois do `> 60` e nunca acontece; mantido assim. Fonte: a/dz_0.java:244 (pT)
 */
function resolverLeiloes(m: Mundo, rng: Rng): void {
  for (const l of m.leiloes) {
    const j = jog(m, l.jogador)
    if (j.time !== l.vendedor) continue
    let lance = 0, vencedor: number | null = null
    for (const x of l.lances) {
      const t = m.times[x.time]!
      if (t.financas && x.valor < t.financas.caixa && t.jogadores.length < ELENCO_MAX && x.valor > lance) [lance, vencedor] = [x.valor, x.time]
    }
    const r = rng.int(100)
    const ia = l.compradorIA !== null && m.times[l.compradorIA]!.jogadores.length < ELENCO_MAX ? l.compradorIA : null
    const lanceIA = Math.round(l.minimo * (r > 60 ? 0.62 : 0.45)) + lance + l.minimo
    if (lance < l.minimo || (lance < Math.round(l.minimo * 2.5) && r > 50 && ia !== null)) {
      if (ia !== null) transferir(m, j, ia, lanceIA)
    } else transferir(m, j, vencedor!, lance)
  }
  m.leiloes = []
}

// ── Juniores ──────────────────────────────────────────────────────────────

export function dispensarJunior(m: Mundo, jogadorId: number): string | null {
  const j = jog(m, jogadorId)
  const t = m.times[j.time]
  if (!t || !j.juvenil) return 'não é junior do time'
  t.juniores = t.juniores.filter((id) => id !== j.id)
  j.time = -1
  return null
}

/** Sobe o junior para o elenco: força = potencial + parte do progresso. Fonte: best/k_0.java:15-131 (a) */
export function promoverJunior(m: Mundo, jogadorId: number, rng: Rng): string | null {
  const j = jog(m, jogadorId)
  const t = m.times[j.time]
  if (!t || !j.juvenil) return 'não é junior do time'
  if (t.jogadores.length >= ELENCO_MAX) return 'elenco cheio'
  const rep = t.reputacao
  let base = t.ligaNacional ? (t.divisao < 1 ? 5 : ([0, 22, 17, 14][t.divisao] ?? 7)) : rep === 5 ? 20 : rep === 4 ? 15 : rep === 3 ? 12 : rep === 2 ? 7 : 5
  if (t.continente === EUROPA) base += 5
  base += rng.int(5)
  let forca = j.potencial + Math.round(base * (Math.min(j.progresso, 100) / 100))
  if (j.potencial >= 9) forca += rng.int(10)
  j.forca = forca
  if (m.opcoes.habilidadeIndividual) {
    const b = t.ligaNacional ? ([1, 7, 3, 1][t.divisao] ?? 1) : rep === 5 ? 7 : rep === 4 ? 4 : 1
    j.habilidades = habilidadesIniciais(j, Math.max(forca - 5, 5), b, rng)
  }
  j.juvenil = false
  j.promovidoEm = m.temporada
  j.evolucao = 0
  j.contratoAte = m.dia + 180
  if (j.estrela) {
    const r = rng.int(3)
    if (!j.craque) j.estrela = r === 1 // o craque continua estrela (F.a força ek com el)
  } else if (rng.int(200) === 1) j.estrela = true
  if (j.estrela && j.potencial < 8) j.potencial = 8
  j.valor = valorJogador(j, t, m.continentes[j.pais] ?? -1, m.temporada)
  j.salario = salarioJogador(j, t, m.opcoes.salarioMensal ?? true)
  t.juniores = t.juniores.filter((id) => id !== j.id)
  t.jogadores.push(j.id)
  return null
}

// ── Contrato ──────────────────────────────────────────────────────────────

/**
 * Renovação: duração 0..3 = 180/365/730/1095 dias somados ao fim atual. O salário tem teto de 25% do valor; o mínimo
 * aceito cai um pouco se faltam menos de 60 dias e sobe se faltam mais. Recusado, o jogador diz quanto quer (`aceitar`
 * fecha nesse valor). Fonte: a/fy_0.java:67 (rE), :87 (dq), :97 (dr)
 */
export function renovarContrato(m: Mundo, jogadorId: number, salario: number, duracao: 0 | 1 | 2 | 3, aceitar = false): Proposta {
  const j = jog(m, jogadorId)
  const teto = Math.round(j.valor * 0.25)
  const s = j.salario
  const min = j.contratoAte - m.dia < 60 ? s - Math.trunc((s * [1, 3, 5, 12][duracao]!) / 100) : s + Math.trunc((s * [10, 12, 15, 5][duracao]!) / 100)
  const pedido = Math.min(min, teto)
  const fechar = (valor: number): Proposta => {
    j.aVenda = false
    j.preco = j.valor
    j.contratoAte += [180, 365, 730, 1095][duracao]!
    j.salario = valor
    return { tipo: 'fechada', valor }
  }
  if (aceitar) return fechar(pedido)
  if (!Number.isInteger(salario) || salario <= 0) return { tipo: 'recusada', motivo: 'salário inválido' }
  if (salario >= teto) return { tipo: 'recusada', motivo: `salário acima do limite (${teto})` }
  return salario >= min ? fechar(salario) : { tipo: 'contraproposta', valor: 0, salario: pedido }
}

// ── Eventos ───────────────────────────────────────────────────────────────

/** Antes dos jogos do dia: fecha os leilões abertos na rodada anterior. */
export function mercadoAntesDosJogos(m: Mundo, rng: Rng): void {
  if (m.leiloes.length > 0) resolverLeiloes(m, rng)
}

/**
 * Depois dos jogos: fim dos empréstimos, 50% de propostas da IA pelos listados dos humanos e, depois de rodada de liga,
 * estadual ou regional com humanos no jogo, os leilões. Fonte: best/f_0.java:1640 (ax), a/hk_0.java:283
 */
export function mercadoDepoisDosJogos(m: Mundo, tiposDoDia: readonly number[], rng: Rng): void {
  for (const e of m.emprestimos.filter((e) => e.fim < m.dia)) devolver(m, e)
  if (rng.int(100) > 50) propostasIA(m, rng)
  if (m.times.some((t) => t.humano) && tiposDoDia.some((t) => t === 1 || t === 3 || t === 10)) abrirLeiloes(m, rng)
}

/**
 * Janela da IA no fim da temporada: cada time da liga BR (pela classificação) e de fora vende sobras, depois completa
 * as posições em falta, e os grandes da Europa levam estrelas dos outros. Fonte: best/ag.java:22 (jO: jS, jU, jR, jT)
 * ponytail: jP (elencos das seleções) entra com a Fase 6
 */
export function janelaIA(m: Mundo, base: Base, rng: Rng): void {
  // jS: liga BR, em ordem de classificação de cada divisão
  for (const c of m.competicoes)
    if (c.tipo === 1) classificacaoFinal(c).forEach((id, pos) => !m.times[id]!.humano && negociarSobras(m, m.times[id]!, pos, true, rng))
  // jU: times de fora das ligas nacionais, pela posição na lista geral
  m.times.forEach((t, i) => !t.ligaNacional && !t.humano && negociarSobras(m, t, i, false, rng))
  // jR
  for (const t of m.times) if (!t.humano) completarElenco(m, base, t, rng)
  // jT: estrelas fortes de times médios vão para os grandes da Europa
  const alvos: JogadorM[] = []
  for (const t of m.times) {
    if (t.humano || t.reputacao >= (t.continente === EUROPA ? 4 : 5)) continue
    for (const j of elenco(m, t)) if (j.forca > 50 && j.idade < 31 && j.estrela && rng.int(100) > 25) alvos.push(j)
  }
  // (o original tenta de novo só o cH, que repete o filtro da 1ª busca)
  for (const j of alvos) {
    const c = acharComprador(m, j, j.valor, false, 2, rng)
    if (c) transferir(m, j, c.id, j.valor)
  }
}

/** Rodadas de venda: 1 a 4 conforme a posição; primeiro de posições cheias, depois do que passa do mínimo. Fonte: best/ag.java:170 */
function negociarSobras(m: Mundo, t: TimeM, pos: number, ligaBR: boolean, rng: Rng): void {
  const n = pos <= 1 ? 1 : pos <= 5 ? 2 : pos <= 10 ? 3 : 4
  for (let k = 0; k < n; k++) venderSobra(m, t, ligaBR, true, rng)
  for (let k = 0; k < n; k++) venderSobra(m, t, ligaBR, false, rng)
}

/** Fonte: best/ag.java:184 (a(ah, bl, bl2)) */
function venderSobra(m: Mundo, t: TimeM, ligaBR: boolean, cheias: boolean, rng: Rng): void {
  const n = porPosicao(m, t, true)
  const ordem = rng.shuffle([0, 1, 2, 3, 4])
  const pos = cheias
    ? (ordem.find((p) => n[p]! >= [4, 5, 5, 10, 8][p]!) ?? ordem.find((p) => n[p]! >= [3, 4, 4, 8, 6][p]!))
    : ordem.find((p) => n[p]! > [3, 4, 4, 6, 4][p]!)
  const comEstrelas = rng.int(100) > 10
  if (pos === undefined) return
  const cands = elenco(m, t).filter((j) => j.posicao === pos && !j.emprestado && (comEstrelas || !j.estrela))
  if (cands.length === 0) return
  const j = rng.shuffle(cands)[0]!
  let completa = true, cs: 0 | 1 = 0
  if (ligaBR) {
    if (j.forca < 40 && rng.int(100) > 90) completa = false
  } else {
    completa = false
    const sorte = (lim: number) => rng.int(100) > lim
    if ((j.estrela && sorte(30)) || (j.forca >= 90 && sorte(30)) || (j.forca >= 80 && j.forca < 90 && sorte(35)) ||
      (j.forca >= 70 && j.forca < 80 && sorte(45)) || (j.forca >= 60 && j.forca < 70 && sorte(75)) || (j.forca < 60 && sorte(95))) {
      completa = true
      cs = 1
    }
  }
  const c = acharComprador(m, j, j.valor, false, cs, rng, !completa)
  if (c) transferir(m, j, c.id, j.valor)
}
