// Competições do Brasil: Séries A–D, estaduais, regionais e Copa do Brasil.
// Fontes: best/Z.java:112 (Ar), best/w.java (estaduais), f/F.java + best/p_0.java:195-269 (regionais),
// best/a.java:649-697 (evento cD), best/w.java:444-560 (eh/Q), f/f_0.java (Copa do Brasil).
import type { Base, ConfigLiga } from '@bolasfoot/data'
import { TIPO } from './calendario.ts'
import {
  classificacaoFinal, criarFaseLiga, criarFaseMataMata, criarRodada,
  type Competicao, type FaseMataMata, type OpcoesLiga, type RodadaMataMata,
} from './competicoes.ts'
import { premioColocacao } from './economia.ts'
import { colocacaoTecnico } from './carreira.ts'
import { BRA, type Mundo, type TimeM } from './mundo.ts'
import type { Rng } from './rng.ts'

/** Colocação de um time fora das séries A–C num estadual (components/ad_0, lista SR.bx()). */
export interface ColocacaoEstadual {
  uf: number
  divisao: number
  time: number
  pos: number
}

const TODAS_IDA_VOLTA = [true, true, true, true, true, true, true]

/** a_0.cN: Nivel desc, desempate desc (h/d_0.java) */
const porNivel = (m: Mundo) => (a: number, b: number) => m.times[b]!.nivel - m.times[a]!.nivel || m.times[b]!.desempate - m.times[a]!.desempate
/** a_0.abm: Nivel desc, reputação desc, desempate desc (h/j_0.java) */
export const porNivelReputacao = (m: Mundo) => (a: number, b: number) => {
  const x = m.times[a]!, y = m.times[b]!
  return y.nivel - x.nivel || y.reputacao - x.reputacao || y.desempate - x.desempate
}

const timesBR = (m: Mundo) => m.times.filter((t) => t.pais === BRA)
/** Times da 1ª fase de uma série, na ordem da tabela (b_0.yi().yK()). */
const tabelaSerie = (m: Mundo, div: number) => {
  const f = m.competicoes.find((c) => c.id === `BR-${div}`)?.fases[0]
  return f?.tipo === 'liga' ? f.times : []
}
const timesDaLiga = (m: Mundo) => [1, 2, 3, 4].flatMap((d) => tabelaSerie(m, d))

// ── Séries ────────────────────────────────────────────────────────────────

function opcoesDaConfig(cfg: ConfigLiga): OpcoesLiga {
  return {
    grupos: cfg.nGrupos,
    gruposEmBloco: false,
    avancam: cfg.numeroTimesMataMata === 1020 ? 8 : cfg.numeroTimesMataMata,
    doisTurnos: cfg.doisTurnos,
    numeroTurnos: cfg.formula,
    idaVolta: cfg.duasVoltasMataMata,
    formato: cfg.numeroTimesMataMata === 1020 ? 1020 : -1,
  }
}

// ── Estaduais ─────────────────────────────────────────────────────────────

/** Fórmulas: [times, grupos, vão ao mata-mata, dois turnos, rebaixados]. Fonte: best/aq.java:776-836 (sL) */
const FORMULAS = [
  [6, 0, 2, 1, 2], [8, 0, 4, 1, 2], [10, 0, 4, 0, 2], [11, 0, 4, 0, 2], [12, 0, 4, 0, 2], [12, 0, 8, 0, 2],
  [14, 0, 8, 0, 2], [16, 4, 2, 0, 2], [16, 0, 4, 0, 2], [16, 0, 8, 0, 2], [20, 4, 2, 0, 4],
] as const

const SP = 25
/** Grupos "reais" do Paulistão (usaGrupoPadraoEstadual), em blocos de 4. Fonte: best/aq.java:839 (sO) */
const GRUPOS_SP = ['corinthians_bra', 'santoandre_sp', 'interlimeirasp_bra', 'botafogosp_bra', 'saopaulo_bra', 'ferroviaria_sp', 'pontepreta_bra', 'saobento_bra', 'bragantino_bra', 'palmeiras', 'ituano_sp', 'novorinzontino_sp', 'miirassol_sp', 'santos', 'guaranisp_bra', 'saocaetano_bra']

/**
 * Estaduais de todo estado com 6+ times, até 4 divisões. Na 1ª temporada as divisões saem do Nivel e o resto vira a fila
 * de acesso (w.dt); depois vêm de `divisoes` (acesso e rebaixamento, w.ee). Fonte: best/w.java:57-150 (dY), :175-193 (dZ)
 */
function criarEstaduais(mundo: Mundo, base: Base, rng: Rng, divisoes?: Map<number, number[][]>): Competicao[] {
  const comps: Competicao[] = []
  const porUf = new Map<number, number[]>()
  for (const t of timesBR(mundo)) if (t.uf !== null) porUf.set(t.uf, [...(porUf.get(t.uf) ?? []), t.id])
  for (const [uf, todos] of [...porUf].sort((a, b) => a[0] - b[0])) {
    if (todos.length < 6) continue
    const dadas = divisoes?.get(uf)
    const resto = [...todos].sort(porNivel(mundo))
    const total = resto.length
    for (let div = 1; dadas ? div <= dadas.length : div <= 4 && resto.length >= 6; div++) {
      const cfg = base.estaduais.find((e) => e.uf === uf && e.divisao === div)
      // sem configuração, ou fórmula maior que o estado (compara com o total, não com o que sobrou): 6 times em dois turnos
      const f = cfg && FORMULAS[cfg.formula]![0] <= total ? cfg.formula : null
      const [n, grupos, avancam, dois] = f === null ? [6, 0, 2, 1] : FORMULAS[f]!
      const opcoes: OpcoesLiga = {
        grupos, gruposEmBloco: false, avancam, doisTurnos: dois === 1, numeroTurnos: 0,
        idaVolta: cfg && f !== null ? cfg.finaisIdaVolta : TODAS_IDA_VOLTA, formato: f ?? 0, cruzados: f === 7 || f === 10,
      }
      let times = dadas ? dadas[div - 1]! : resto.slice(0, n)
      if (f === 7 && div === 1 && uf === SP && base.opcoes.usaGrupoPadraoEstadual) {
        const reais = GRUPOS_SP.flatMap((ref) => (dadas ? times : resto).filter((id) => mundo.times[id]!.fileRef === ref))
        if (reais.length === 16) {
          times = reais
          opcoes.gruposEmBloco = true
        }
      }
      const nome = base.ufs[uf]!.gentilico + (div > 1 ? ` - ${div}ª divisão` : '')
      const c: Competicao = { id: `EST-${base.ufs[uf]!.sigla}-${div}`, nome, tipo: TIPO.estadual, divisao: div, uf, fases: [], campeao: null, vice: null, rebaixados: f === null ? 0 : cfg!.nRebaixados }
      c.fases.push(criarFaseLiga(mundo, c, times, opcoes, mundo.dia, rng))
      comps.push(c)
      for (const t of times) if (resto.includes(t)) resto.splice(resto.indexOf(t), 1)
    }
    if (!dadas) mundo.filasEstaduais[uf] = resto
  }
  return comps
}

// ── Regionais ─────────────────────────────────────────────────────────────

/** Estados de cada região. Fonte: f/F.java:52 (an) e best/p_0.java:199 */
const REGIOES = [[18, 25], [10, 17, 22, 23], [1, 4, 5, 9, 14, 15, 16, 19, 24], [0, 2, 3, 6, 7, 8, 11, 12, 13, 20, 21, 26]]
const NOMES_REGIONAIS = ['Rio-SP', 'Sul-Minas', 'Copa do Nordeste', 'Copa Verde'] // aq.pY

/** Embaralha 4 potes de 4 e intercala [pote 0, pote 2, pote 1, pote 3]. Fonte: h/a_0.java:211 (ad) */
function potes4x4(rng: Rng): number[] {
  const pote = (i: number) => {
    const p = [0, 1, 2, 3].map((k) => i * 4 + k)
    rng.shuffle(p)
    return p
  }
  const [a, b, c, d] = [pote(0), pote(1), pote(2), pote(3)]
  return [0, 1, 2, 3].flatMap((k) => [a[k]!, c[k]!, b[k]!, d[k]!])
}

/**
 * Regionais ativos (jogaRegionaisTodos) com 16+ times: 4 grupos de 4, 2 por grupo, mata-mata em ida e volta.
 * Fonte: best/p_0.java:195-269 (dh, di), f/F.java:41-90 (an)
 */
function criarRegionais(mundo: Mundo, base: Base, rng: Rng): Competicao[] {
  const ativos = (base.opcoes.jogaRegionaisTodos as boolean[] | undefined) ?? [false, false, true, true]
  // di(): times das séries na ordem da tabela, depois os outros BR embaralhados
  const lista = timesDaLiga(mundo)
  const outros = timesBR(mundo).map((t) => t.id).filter((id) => !lista.includes(id))
  rng.shuffle(outros)
  lista.push(...outros)
  const comps: Competicao[] = []
  REGIOES.forEach((estados, r) => {
    const daRegiao = lista.filter((id) => estados.includes(mundo.times[id]!.uf ?? -1))
    if (!ativos[r] || daRegiao.length < 16) return
    const top = daRegiao.slice(0, 16).sort(porNivelReputacao(mundo))
    const times = potes4x4(rng).map((i) => top[i]!)
    const c: Competicao = { id: `REG-${r}`, nome: NOMES_REGIONAIS[r]!, tipo: TIPO.regional, divisao: 0, uf: r, fases: [], campeao: null, vice: null }
    const o: OpcoesLiga = { grupos: 4, gruposEmBloco: true, avancam: 2, doisTurnos: true, numeroTurnos: 0, idaVolta: [true, true, true, false, false, false, false], formato: -1 }
    c.fases.push(criarFaseLiga(mundo, c, times, o, mundo.dia, rng))
    comps.push(c)
  })
  return comps
}

// ── Criação da temporada ──────────────────────────────────────────────────

/**
 * Séries A–C, estaduais e regionais. A Série D (pelos estaduais) e a Copa do Brasil
 * nascem no evento cD, no 1º dia da liga. Fonte: best/Z.java:112-228 (Ar), best/p_0.java:130-150 (dg)
 */
export function criarCompeticoesBR(mundo: Mundo, base: Base, rng: Rng, estaduais?: Map<number, number[][]>, series?: Map<number, number[]>): Competicao[] {
  const comps: Competicao[] = []
  for (const cfg of base.ligas) {
    const c: Competicao = { id: `BR-${cfg.divisao}`, nome: `${cfg.nome} ${cfg.nomeDivisao}`, tipo: TIPO.liga, divisao: cfg.divisao, fases: [], campeao: null, vice: null, rebaixados: cfg.nRebaixados }
    if (cfg.divisao === 4) c.opcoes = opcoesDaConfig(cfg)
    else {
      // 1ª temporada pelo Nivel; depois, a ordem da tabela velha (Z.ee: remove quem caiu, quem subiu vai para o fim)
      const times = series?.get(cfg.divisao) ?? timesBR(mundo).filter((t) => t.divisao === cfg.divisao).map((t) => t.id).sort(porNivel(mundo))
      c.fases.push(criarFaseLiga(mundo, c, times, opcoesDaConfig(cfg), mundo.dia, rng))
    }
    comps.push(c)
  }
  mundo.competicoes = comps
  // sem estaduais também sem regionais (Nordeste, Copa Verde…)
  if (mundo.opcoes.jogaEstadual !== false) comps.push(...criarEstaduais(mundo, base, rng, estaduais), ...criarRegionais(mundo, base, rng))
  return comps
}

/**
 * Fim de uma competição: prêmio de colocação dos humanos e, nos estaduais, a colocação de quem
 * está fora das séries (vai para a Série D e a Copa). Fonte: f/s.java:1564-1636 (za)
 */
export function registrarColocacoes(mundo: Mundo, c: Competicao): void {
  classificacaoFinal(c).forEach((time, i) => {
    const t = mundo.times[time]!
    // ah.a → c (ah.java:803): prêmio de colocação de liga e estadual para humanos
    if (t.financas) premioColocacao(t, c, i + 1, mundo.dia)
    // ah.a → b + al.b: reputação, pontos de carreira e títulos
    colocacaoTecnico(mundo, c, time, i + 1)
    if (c.tipo === TIPO.estadual && t.divisao === 0) mundo.colocacoesEstaduais.push({ uf: c.uf!, divisao: c.divisao, time, pos: i + 1 })
  })
}

// ── Evento cD: Série D e Copa do Brasil ───────────────────────────────────

/** Prioridade dos estados nas vagas (aq.sb..sf). Fonte: best/aq.java:559-569 */
const SB = [25, 18, 10, 22], SC = [17, 23, 4, 15, 5], SD = [8, 1, 13, 11, 9, 19, 14], SE = [24, 0, 16, 12, 2, 6], SF = [7, 26, 20, 3, 21]

/** Para cada estado, o mais bem colocado que ainda não está na lista. Fonte: best/w.java:446-458 (a) */
function porEstado(col: ColocacaoEstadual[], estados: readonly number[], lista: number[]): void {
  for (const uf of estados) {
    const c = col.find((x) => x.uf === uf && !lista.includes(x.time))
    if (c) lista.push(c.time)
  }
}

/** Colocações ordenadas por estado, divisão e posição (best/x_0.java). */
const ordenarColocacoes = (m: Mundo) => [...m.colocacoesEstaduais].sort((a, b) => a.uf - b.uf || a.divisao - b.divisao || a.pos - b.pos)

/** Índice de região para ordenar a Série D (ah.jX, best/ah.java:237) */
const REGIAO_D = [[18, 25, 17, 22, 23], [10], [1, 4, 5, 9, 14, 15, 16, 19, 24], [6, 7, 8, 11, 12, 26], [0, 2, 3, 13, 20, 21]]
const regiaoD = (t: TimeM) => REGIAO_D.findIndex((r) => r.includes(t.uf ?? -1))

/** Os n da Série D a partir dos estaduais. Fonte: best/w.java:465-549 (Q) */
function timesSerieD(mundo: Mundo, n: number): number[] {
  const col = ordenarColocacoes(mundo)
  // os rebaixados da Série C (SR.bY) entram primeiro
  const lista = mundo.rebaixadosC.filter((t) => mundo.times[t]!.divisao === 0)
  for (const e of [SB, SC, SD, SE, SF, SB, SB, SB, SC, SC, SD, SE, SB, SB, SB, SC, SC, SD, SE]) porEstado(col, e, lista)
  // ponytail: o original completa na ordem de Z.hv (lista de times do país); aqui, a ordem do mundo.
  // Sem estaduais a D inteira sai daqui, por Nivel (best/Z.java:177)
  const resto = timesBR(mundo).map((t) => t.id)
  if (mundo.opcoes.jogaEstadual === false) resto.sort(porNivel(mundo))
  for (const t of resto) if (lista.length < n && mundo.times[t]!.divisao === 0 && !lista.includes(t)) lista.push(t)
  return lista.slice(0, n).sort((a, b) => regiaoD(mundo.times[a]!) - regiaoD(mundo.times[b]!))
}

/** Times dos estaduais para a Copa, por prioridade de estado. Fonte: best/w.java:403-444 (eh) */
function timesCopaEstaduais(mundo: Mundo): number[] {
  const col = ordenarColocacoes(mundo)
  const lista: number[] = []
  for (const e of [SB, SC, SD, SE, SF, SB, SC, SD, SB, SC, SD, SB, SC, SD]) porEstado(col, e, lista)
  if (lista.length < 128) for (const e of [SE, SF, SB, SC, SD, SE, SF, SB, SC, SD, SE, SF, SB, SC, SD, SE, SF, SB, SC, SD]) porEstado(col, e, lista)
  return lista
}

/** Evento cD: Série D pelos estaduais e Copa do Brasil. Fonte: best/a.java:649-697 (m) */
export function eventoCD(mundo: Mundo, desde: number, rng: Rng): void {
  const d = mundo.competicoes.find((c) => c.id === 'BR-4')
  if (d?.opcoes && d.fases.length === 0) {
    const times = timesSerieD(mundo, 64)
    for (const t of times) mundo.times[t]!.divisao = 4
    d.fases.push(criarFaseLiga(mundo, d, times, d.opcoes, desde, rng))
  }
  // sem estaduais: todos os brasileiros por Nivel (criaCopaBRAposRegionais, best/a.java:649-657)
  const lista = mundo.opcoes.jogaEstadual === false ? timesBR(mundo).map((t) => t.id).sort(porNivel(mundo)) : [1, 2, 3].flatMap((div) => tabelaSerie(mundo, div))
  for (const t of timesCopaEstaduais(mundo)) if (!lista.includes(t)) lista.push(t)
  mundo.competicoes.push(criarCopa(mundo, lista, desde, rng))
  mundo.colocacoesEstaduais = []
}

/** Copa do Brasil. Fonte: f/f_0.java:46-185 (a: formato antigo, b: formato novo) */
function criarCopa(mundo: Mundo, lista: number[], desde: number, rng: Rng): Competicao {
  const c: Competicao = { id: 'CB', nome: 'Copa do Brasil', tipo: TIPO.copa, divisao: 0, fases: [], campeao: null, vice: null }
  if (lista.length < 91) {
    // formato antigo: maior potência de 2, metade de cima × metade de baixo
    const n = lista.length >= 128 ? 128 : lista.length >= 64 ? 64 : lista.length >= 32 ? 32 : lista.length >= 16 ? 16 : 8
    const cima = lista.slice(0, n / 2), baixo = lista.slice(n / 2, n)
    rng.shuffle(cima)
    rng.shuffle(baixo)
    c.fases.push(criarFaseMataMata(mundo, c, cima.flatMap((t, i) => [baixo[i]!, t]), TODAS_IDA_VOLTA, desde))
    return c
  }
  // 12 entram na 3ª fase. Na 1ª temporada (f/f_0.java:90-118): os brasileiros da Libertadores (YF, depois YS) e os 13
  // primeiros da lista; da 2ª em diante, os 12 do Z.y (reservadosCopa). Os campeões da Copa Verde e do Nordeste
  // vão para a frente (Bg) e corta em 12 (Bf).
  const lib = mundo.competicoes.find((x) => x.id === 'LIB')?.listas
  const daLib = [...(lib?.YF ?? []), ...(lib?.YS ?? [])].filter((t) => mundo.times[t]!.pais === BRA)
  let reservados = mundo.reservadosCopa.length > 0 ? [...mundo.reservadosCopa] : [...new Set([...daLib, ...lista.slice(0, 13)])]
  for (const r of ['REG-2', 'REG-3']) {
    const campeao = mundo.competicoes.find((x) => x.id === r)?.campeao
    if (campeao == null) continue
    reservados = [campeao, ...reservados.filter((t) => t !== campeao)]
  }
  reservados = reservados.slice(0, 12)
  const resto = lista.filter((t) => !reservados.includes(t))
  const potes = Array.from({ length: 8 }, (_, p) => {
    const pote = resto.slice(p * 10, p * 10 + 10)
    rng.shuffle(pote)
    return pote
  })
  const ordem = Array.from({ length: 10 }, (_, i) => [4, 0, 7, 3, 5, 1, 6, 2].map((p) => potes[p]![i]!)).flat()
  const idaVolta = [false, false, true, true, true, true, true, true]
  const f: FaseMataMata = { tipo: 'mata', idaVolta, formato: 2029, reservados, rodadas: [criarRodada(mundo, c, ordem, false, desde, false)] }
  c.fases.push(f)
  return c
}

/** Próxima fase da Copa no formato novo. Fonte: f/f_0.java:187-292 (ad, ao, as, at, au, av) */
export function proximaRodadaCopa(mundo: Mundo, c: Competicao, f: FaseMataMata, desde: number, rng: Rng): RodadaMataMata {
  const k = f.rodadas.length
  const vencedores = [...f.rodadas.at(-1)!.vencedores]
  if (k === 1 || k === 2) {
    // 2ª fase: 20 melhores × 20 piores, jogo único (o pior manda). 3ª: + 12 reservados, 16 × 16, ida e volta
    const todos = (k === 2 ? [...vencedores, ...f.reservados] : vencedores).sort(porNivelReputacao(mundo))
    const metade = todos.length / 2
    const cima = todos.slice(0, metade), baixo = todos.slice(metade)
    rng.shuffle(cima)
    rng.shuffle(baixo)
    const ordem = cima.flatMap((t, i) => (k === 1 ? [baixo[i]!, t] : [t, baixo[i]!]))
    return criarRodada(mundo, c, ordem, f.idaVolta[k]!, desde)
  }
  rng.shuffle(vencedores)
  return criarRodada(mundo, c, vencedores, f.idaVolta[k] ?? true, desde)
}

