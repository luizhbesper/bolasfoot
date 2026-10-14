// Rodada: a função que a máquina de estados do servidor chama. Aplica os comandos dos humanos, joga o dia em que algum
// humano joga (com intervalo opcional) e segue sozinha pelos dias seguintes até o próximo jogo de humano, uma proposta
// de emprego ou o fim da temporada. Fonte: n/a (multiplayer); o "pare quando um humano decide" vem de f_0.ay().
import type { Base } from '@bolasfoot/data'
import { aceitarOferta, aposentar, definirTreino, MOTIVOS_DEMISSAO, pedirDemissao } from './carreira.ts'
import { comecarDia, jogosDoDia, terminarDia, type Competicao, type DiaEmJogo, type PartidaDoDia } from './competicoes.ts'
import { iniciarObra, pagarEmprestimo, pegarEmprestimo } from './economia.ts'
import { BANCO, FORMACOES } from './escalacao.ts'
import {
  anunciar, comprarEmprestado, darLance, disponibilizarEmprestimo, dispensarJunior, encerrarEmprestimo, pedirEmprestado,
  promoverJunior, proporCompra, renovarContrato, retirarDaLista, transferir, venderAgora, type Proposta,
} from './mercado.ts'
import type { Mundo, Tatica, TimeM, TipoAviso } from './mundo.ts'
import { ANO_INICIAL } from './calendario.ts'
import { mudarTatica, substituir, type Partida } from './partida.ts'
import { derivar, type Rng } from './rng.ts'
import { fimDeTemporada } from './temporada.ts'

type Setores = [number, number, number, number]

/** Tudo o que um técnico humano pode mandar. Os dois últimos só valem no intervalo. */
export type Comando =
  | { tipo: 'escalar'; formacao: number; titulares: { id: number; slot: number }[]; banco: number[] }
  | { tipo: 'tatica'; estilo?: number; marcacao?: number; jogada?: number }
  | { tipo: 'batedores'; falta: number | null; escanteio: number | null }
  | { tipo: 'treino'; foco: 0 | 1; auxiliar: boolean }
  | { tipo: 'ingresso'; precos: Setores | null }
  | { tipo: 'banco'; acao: 'pegar' | 'pagar' }
  | { tipo: 'obra'; mais: Setores }
  | { tipo: 'comprar'; jogador: number; valor: number; aceitarContraproposta?: boolean }
  | { tipo: 'responderProposta'; proposta: number; aceitar: boolean }
  | { tipo: 'anunciar'; jogador: number; preco: number }
  | { tipo: 'retirarDaLista'; jogador: number }
  | { tipo: 'venderAgora'; jogador: number; preco: number }
  | { tipo: 'paraEmprestimo'; jogador: number; sim: boolean }
  | { tipo: 'pedirEmprestado'; jogador: number }
  | { tipo: 'encerrarEmprestimo'; jogador: number }
  | { tipo: 'comprarEmprestado'; jogador: number }
  | { tipo: 'lance'; jogador: number; valor: number }
  | { tipo: 'promoverJunior'; jogador: number }
  | { tipo: 'dispensarJunior'; jogador: number }
  | { tipo: 'renovar'; jogador: number; salario: number; duracao: 0 | 1 | 2 | 3; aceitarContraproposta?: boolean }
  | { tipo: 'aposentar'; jogador: number }
  | { tipo: 'aceitarOferta'; time: number }
  | { tipo: 'pedirDemissao' }
  | { tipo: 'substituir'; sai: number; entra: number; slot?: number }
  | { tipo: 'mudarTatica'; estilo?: number; marcacao?: number; jogada?: number }

export interface ComandoDe {
  tecnico: number
  comando: Comando
}

export interface ResultadoComando extends ComandoDe {
  /** null = aplicado */
  erro: string | null
  /** resposta de compra e renovação (contraproposta: mande de novo com `aceitarContraproposta`) */
  proposta?: Proposta
}

export interface Rodada {
  /** 'intervalo': chame `continuarRodada` com os comandos do intervalo; 'planejamento': a rodada acabou */
  fase: 'intervalo' | 'planejamento'
  resultados: ResultadoComando[]
  /** partidas do dia com humano (a do intervalo só com o 1º tempo) */
  partidas: Partida[]
  /** todas as partidas desse dia, de todas as competições (a tela da partida mostra a rodada inteira) */
  todas: PartidaDoDia[]
  /** dias jogados nesta rodada */
  dias: number[]
  /** a temporada virou nesta rodada */
  virou: boolean
  /** na virada: as competições da temporada que acabou (tabelas finais) */
  encerradas?: Competicao[]
}

const INTERVALO = new Set<Comando['tipo']>(['substituir', 'mudarTatica'])
const TIPOS = new Set<string>([
  'escalar', 'tatica', 'batedores', 'treino', 'ingresso', 'banco', 'obra', 'comprar', 'responderProposta', 'anunciar',
  'retirarDaLista', 'venderAgora', 'paraEmprestimo', 'pedirEmprestado', 'encerrarEmprestimo', 'comprarEmprestado', 'lance',
  'promoverJunior', 'dispensarJunior', 'renovar', 'aposentar', 'aceitarOferta', 'pedirDemissao', 'substituir', 'mudarTatica',
] satisfies Comando['tipo'][])
const inteiro = (n: unknown, min = 0) => typeof n === 'number' && Number.isInteger(n) && n >= min

/** Técnicos humanos com time em campo agora: no intervalo, os das partidas em jogo; senão, os dos jogos do dia. */
export function tecnicosEmCampo(m: Mundo): number[] {
  const times = m.emJogo ? m.emJogo.partidas.flatMap(({ partida: p }) => [p.lados[0].time, p.lados[1].time])
    : jogosDoDia(m).flatMap(({ jogo }) => [jogo.casa, jogo.fora])
  return times.filter((t) => m.times[t]!.humano).map((t) => m.times[t]!.tecnico)
}

const humanoJoga = (m: Mundo) => tecnicosEmCampo(m).length > 0

/** Partida e lado do time do técnico no intervalo. */
function noIntervalo(m: Mundo, timeId: number): { p: Partida; l: 0 | 1 } | null {
  for (const { partida: p } of m.emJogo?.partidas ?? []) {
    const l = p.lados[0].time === timeId ? 0 : p.lados[1].time === timeId ? 1 : -1
    if (l >= 0) return { p, l: l as 0 | 1 }
  }
  return null
}

const taticaOk = (c: { estilo?: number; marcacao?: number; jogada?: number }) =>
  (c.estilo === undefined || [0, 1, 2].includes(c.estilo)) &&
  (c.marcacao === undefined || [0, 1, 2].includes(c.marcacao)) &&
  (c.jogada === undefined || [0, 1].includes(c.jogada))

/**
 * O comando é aceitável agora? Confere quem manda, o que é dele e o formato. As regras de negócio (caixa, elenco
 * cheio, o jogador aceita…) ficam com a função que executa, que devolve o motivo. Roda igual no navegador.
 */
export function validar(m: Mundo, tecnicoId: number, c: Comando): string | null {
  if (typeof c !== 'object' || c === null || !TIPOS.has(c.tipo)) return 'comando inválido'
  const tc = m.tecnicos[tecnicoId]
  if (!tc?.humano) return 'técnico inválido'
  if (INTERVALO.has(c.tipo) !== (m.emJogo !== null)) return m.emJogo ? 'só substituições e tática no intervalo' : 'fora do intervalo'
  if (c.tipo === 'aceitarOferta') return m.ofertas.some((o) => o.tecnico === tecnicoId && o.times.includes(c.time)) ? null : 'proposta não encontrada'
  if (tc.time === null) return 'sem time'
  const t = m.times[tc.time]!
  const meu = (id: unknown) => inteiro(id) && t.jogadores.includes(id as number)
  const jogador = 'jogador' in c ? m.jogadores[c.jogador] : undefined
  if ('jogador' in c && !jogador) return 'jogador inválido'
  switch (c.tipo) {
    case 'escalar': {
      const slots = FORMACOES[c.formacao]
      if (!inteiro(c.formacao, 1) || !slots) return 'formação inválida'
      const ids = c.titulares.map((x) => x.id)
      if (c.titulares.length < 1 || c.titulares.length > 11) return 'escale de 1 a 11 titulares'
      if (!ids.every(meu) || !c.banco.every(meu)) return 'jogador fora do elenco'
      if (new Set([...ids, ...c.banco]).size !== ids.length + c.banco.length) return 'jogador repetido'
      if (c.banco.length > BANCO.length) return `no máximo ${BANCO.length} no banco`
      const usados = c.titulares.map((x) => x.slot)
      if (!usados.every((s) => slots.includes(s)) || new Set(usados).size !== usados.length) return 'posição fora da formação'
      return null
    }
    case 'tatica':
    case 'mudarTatica':
      if (!taticaOk(c)) return 'tática inválida'
      return c.tipo === 'mudarTatica' && !noIntervalo(m, t.id) ? 'seu time não está jogando' : null
    case 'substituir': {
      const x = noIntervalo(m, t.id)
      if (!x) return 'seu time não está jogando'
      const lado = x.p.lados[x.l]
      if (lado.subs <= 0) return 'sem substituições'
      if (!lado.emCampo.includes(c.sai)) return 'quem sai não está em campo'
      if (!lado.banco.includes(c.entra)) return 'quem entra não está no banco'
      return null
    }
    case 'batedores':
      return [c.falta, c.escanteio].every((id) => id === null || meu(id)) ? null : 'jogador fora do elenco'
    case 'treino':
      return [0, 1].includes(c.foco) && typeof c.auxiliar === 'boolean' ? null : 'treino inválido'
    case 'ingresso':
      return c.precos === null || (c.precos.length === 4 && c.precos.every((p) => inteiro(p))) ? null : 'preços inválidos'
    case 'banco':
      return c.acao === 'pegar' || c.acao === 'pagar' ? null : 'ação inválida'
    case 'obra':
      return c.mais.length === 4 && c.mais.every((n) => inteiro(n)) ? null : 'obra inválida'
    case 'comprar':
      if (!inteiro(c.valor, 1)) return 'valor inválido'
      return jogador!.time === t.id ? 'jogador do seu time' : jogador!.time < 0 ? 'jogador sem time' : null
    case 'responderProposta': {
      const p = m.propostasHumanas.find((x) => x.id === c.proposta)
      return p && t.jogadores.includes(p.jogador) ? null : 'proposta não encontrada'
    }
    case 'anunciar':
    case 'venderAgora':
      return !meu(c.jogador) ? 'jogador fora do elenco' : inteiro(c.preco) ? null : 'preço inválido'
    case 'retirarDaLista':
    case 'paraEmprestimo':
    case 'aposentar':
      if (!meu(c.jogador)) return 'jogador fora do elenco'
      return c.tipo === 'aposentar' && !m.queremParar.includes(c.jogador) ? 'o jogador não pediu para parar' : null
    case 'renovar':
      if (!meu(c.jogador)) return 'jogador fora do elenco'
      return inteiro(c.salario, 1) && [0, 1, 2, 3].includes(c.duracao) ? null : 'proposta inválida'
    case 'promoverJunior':
    case 'dispensarJunior':
      return t.juniores.includes(c.jogador) ? null : 'não é junior do time'
    case 'pedirEmprestado':
    case 'lance':
      if (c.tipo === 'lance' && !inteiro(c.valor, 1)) return 'valor inválido'
      return jogador!.time === t.id ? 'jogador do seu time' : null
    case 'encerrarEmprestimo': {
      const e = m.emprestimos.find((x) => x.jogador === c.jogador)
      return e && (e.origem === t.id || jogador!.time === t.id) ? null : 'não é um empréstimo seu'
    }
    case 'comprarEmprestado':
      return meu(c.jogador) ? null : 'não está no seu time'
    case 'pedirDemissao':
      return null
  }
}

const soTatica = (c: { estilo?: number; marcacao?: number; jogada?: number }): Partial<Pick<Tatica, 'estilo' | 'marcacao' | 'jogada'>> =>
  Object.fromEntries(Object.entries({ estilo: c.estilo, marcacao: c.marcacao, jogada: c.jogada }).filter(([, v]) => v !== undefined))

function avisar(m: Mundo, tecnico: number, tipo: TipoAviso, texto: string, ref?: number): void {
  m.avisos.push({ tecnico, dia: m.dia, texto, tipo, ...(ref === undefined ? {} : { ref }) })
}

/** 1_500_000 → "R$ 1,5 mi"; 80_000 → "R$ 80 mil" (texto dos avisos). */
const reais = (v: number) => (v >= 1e6 ? `R$ ${(Math.round(v / 1e5) / 10).toString().replace('.', ',')} mi` : `R$ ${Math.round(v / 1e3)} mil`)

/** Executa um comando já validado. */
function executar(m: Mundo, base: Base, tc: number, t: TimeM | null, c: Comando, rng: Rng): Omit<ResultadoComando, 'tecnico' | 'comando'> {
  const ok = (erro: string | null = null) => ({ erro })
  const id = t?.id ?? -1
  switch (c.tipo) {
    case 'escalar':
      t!.tatica.formacao = c.formacao
      t!.escalacao = { titulares: c.titulares.map((x) => ({ ...x })), banco: [...c.banco] }
      return ok()
    case 'tatica':
      Object.assign(t!.tatica, soTatica(c))
      return ok()
    case 'batedores':
      t!.batedores = { falta: c.falta, escanteio: c.escanteio }
      return ok()
    case 'treino':
      definirTreino(m, id, c.foco, c.auxiliar)
      return ok()
    case 'ingresso':
      t!.estadio.precoAuto = c.precos === null
      t!.estadio.precos = c.precos && [...c.precos]
      return ok()
    case 'banco':
      return ok((c.acao === 'pegar' ? pegarEmprestimo(t!, m.dia) : pagarEmprestimo(t!, m.dia)) ? null : c.acao === 'pegar' ? 'limite de empréstimo' : 'nada a pagar ou sem caixa')
    case 'obra':
      return ok(iniciarObra(m, id, c.mais))
    case 'comprar': {
      const j = m.jogadores[c.jogador]!
      const dono = m.times[j.time]!
      if (dono.humano) {
        if (!t!.financas || t!.financas.caixa < c.valor) return ok('valor maior que o caixa')
        const p = { id: (m.propostasHumanas.at(-1)?.id ?? 0) + 1, comprador: id, jogador: j.id, valor: c.valor, dia: m.dia }
        m.propostasHumanas.push(p)
        avisar(m, dono.tecnico, 'proposta', `${t!.nome} oferece ${reais(c.valor)} por ${j.nome}.`, p.id)
        return ok()
      }
      const proposta = proporCompra(m, id, j.id, c.valor, rng, c.aceitarContraproposta ?? false, base)
      return { erro: proposta.tipo === 'recusada' ? proposta.motivo : null, proposta }
    }
    case 'responderProposta': {
      const p = m.propostasHumanas.find((x) => x.id === c.proposta)!
      m.propostasHumanas = m.propostasHumanas.filter((x) => x !== p)
      const j = m.jogadores[p.jogador]!, comp = m.times[p.comprador]!
      const tecComp = comp.tecnico
      if (!c.aceitar) {
        avisar(m, tecComp, 'mercado', `${t!.nome} recusou a proposta por ${j.nome}.`, j.id)
        return ok()
      }
      if (!comp.humano || !comp.financas || comp.financas.caixa < p.valor) return ok('o comprador não tem mais o dinheiro')
      if (comp.jogadores.length >= 35) return ok('o elenco do comprador está cheio')
      transferir(m, j, comp.id, p.valor)
      avisar(m, tecComp, 'mercado', `${t!.nome} aceitou: ${j.nome} é seu por ${reais(p.valor)}.`, j.id)
      return ok()
    }
    case 'anunciar':
      return ok(anunciar(m, c.jogador, c.preco))
    case 'retirarDaLista':
      retirarDaLista(m, c.jogador)
      return ok()
    case 'venderAgora': {
      const r = venderAgora(m, c.jogador, c.preco, rng)
      return ok(r ? null : 'nenhum clube pagou esse preço')
    }
    case 'paraEmprestimo':
      return ok(disponibilizarEmprestimo(m, c.jogador, c.sim))
    case 'pedirEmprestado':
      return ok(pedirEmprestado(m, id, c.jogador))
    case 'encerrarEmprestimo':
      return ok(encerrarEmprestimo(m, c.jogador))
    case 'comprarEmprestado':
      return ok(comprarEmprestado(m, id, c.jogador))
    case 'lance':
      return ok(darLance(m, id, c.jogador, c.valor))
    case 'promoverJunior':
      return ok(promoverJunior(m, c.jogador, rng))
    case 'dispensarJunior':
      return ok(dispensarJunior(m, c.jogador))
    case 'renovar': {
      const proposta = renovarContrato(m, c.jogador, c.salario, c.duracao, c.aceitarContraproposta ?? false)
      return { erro: proposta.tipo === 'recusada' ? proposta.motivo : null, proposta }
    }
    case 'aposentar':
      aposentar(m, base, c.jogador, rng)
      m.queremParar = m.queremParar.filter((x) => x !== c.jogador)
      return ok()
    case 'aceitarOferta':
      return ok(aceitarOferta(m, tc, c.time, rng))
    case 'pedirDemissao':
      return ok(pedirDemissao(m, tc, rng))
    case 'substituir': {
      const x = noIntervalo(m, id)!
      substituir(x.p, x.l, c.sai, c.entra, c.slot)
      return ok()
    }
    case 'mudarTatica': {
      const x = noIntervalo(m, id)!
      mudarTatica(x.p, x.l, soTatica(c))
      return ok()
    }
  }
}

/**
 * Aplica os comandos na ordem de envio. As compras de jogadores da IA vêm por último, da maior oferta para a menor
 * (empate: a ordem em que chegam, hoje a do membro); a que chega depois de o jogador já ter mudado de time falha (plano §3.4).
 */
function aplicarComandos(m: Mundo, base: Base, comandos: readonly ComandoDe[], rng: Rng): ResultadoComando[] {
  const compraIA = (x: ComandoDe) => x.comando.tipo === 'comprar' && !m.times[m.jogadores[x.comando.jogador]?.time ?? -1]?.humano
  const valor = (x: ComandoDe) => (x.comando.tipo === 'comprar' ? x.comando.valor : 0)
  const ordem = [...comandos.filter((x) => !compraIA(x)), ...comandos.filter(compraIA).sort((a, b) => valor(b) - valor(a))]
  const timeNoInicio = new Map<number, number>()
  for (const { comando: c } of ordem) if (c.tipo === 'comprar' && !timeNoInicio.has(c.jogador)) timeNoInicio.set(c.jogador, m.jogadores[c.jogador]?.time ?? -1)
  const resultados = new Map<ComandoDe, ResultadoComando>()
  for (const x of ordem) {
    const c = x.comando
    let erro = validar(m, x.tecnico, c)
    if (!erro && c.tipo === 'comprar' && m.jogadores[c.jogador]!.time !== timeNoInicio.get(c.jogador)) erro = 'jogador já negociado nesta rodada'
    const tc = m.tecnicos[x.tecnico]
    const t = tc?.time != null ? m.times[tc.time]! : null
    resultados.set(x, erro ? { ...x, erro } : { ...x, ...executar(m, base, x.tecnico, t, c, rng) })
  }
  return comandos.map((x) => resultados.get(x)!)
}

/** Avisos do que aconteceu com os humanos no dia `d`. Devolve se algum recebeu proposta de emprego (para a rodada). */
function avisosDoDia(m: Mundo, d: number): boolean {
  const tecDe = (time: number) => (m.times[time]!.humano ? m.times[time]!.tecnico : null)
  for (const x of m.transferencias) {
    if (x.dia !== d || x.valor === 0) continue
    const nome = m.jogadores[x.jogador]!.nome, de = tecDe(x.de), para = tecDe(x.para)
    if (de !== null) avisar(m, de, 'mercado', `${nome} foi vendido ao ${m.times[x.para]!.nome} por ${reais(x.valor)}.`, x.jogador)
    if (para !== null && de === null) avisar(m, para, 'mercado', `${nome} chegou do ${m.times[x.de]!.nome} por ${reais(x.valor)}.`, x.jogador)
  }
  for (const x of m.trocasDeTecnico) {
    const saiu = x.saiu !== null ? m.tecnicos[x.saiu]! : null
    if (x.dia === d && saiu?.humano && x.motivo > 0) avisar(m, saiu.id, 'demissao', `Você foi demitido do ${m.times[x.time]!.nome}: ${MOTIVOS_DEMISSAO[x.motivo]}`)
  }
  const novas = m.ofertas.filter((o) => o.dia === d && m.tecnicos[o.tecnico]!.humano)
  for (const o of novas) avisar(m, o.tecnico, 'emprego', `Propostas de emprego: ${o.times.map((t) => m.times[t]!.nome).join(', ')}.`)
  return novas.length > 0
}

/** Na virada, um aviso por técnico humano: onde o time terminou na série e quem ganhou o quê. */
function resumoDaTemporada(m: Mundo): void {
  const hist = m.historico.filter((h) => h.temporada === m.temporada - 1)
  const campeoes = hist.filter((h) => h.campeao !== null && (h.competicao.startsWith('BR-') || ['CB', 'SUP-BRA', 'LIB', 'SUL', 'RECOPA', 'MUN'].includes(h.competicao)))
    .map((h) => `${h.nome}: ${m.times[h.campeao!]!.nome}`).join('; ')
  for (const tc of m.tecnicos) {
    if (!tc.humano || tc.time === null) continue
    const t = m.times[tc.time]!
    const serie = hist.find((h) => h.competicao.startsWith('BR-') && h.classificacao.includes(t.id))
    const titulos = hist.filter((h) => h.campeao === t.id).map((h) => h.nome)
    const partes = [
      serie ? `${t.nome} terminou em ${serie.classificacao.indexOf(t.id) + 1}º na ${serie.nome}${serie.subiram.includes(t.id) ? ' e subiu' : serie.cairam.includes(t.id) ? ' e caiu' : ''}.` : `${t.nome} não disputou as séries.`,
      titulos.length ? `Títulos: ${titulos.join(', ')}.` : '',
      campeoes ? `Campeões — ${campeoes}.` : '',
    ]
    avisar(m, tc.id, 'temporada', `Fim da temporada ${ANO_INICIAL + m.temporada - 2}. ${partes.filter(Boolean).join(' ')}`)
  }
}

/**
 * Depois do dia `jogado`: avisos e, sem parada (humano em campo, proposta de emprego), o próximo dia. Sem próximo dia,
 * vira a temporada e para.
 */
function seguir(m: Mundo, base: Base, seed: string, r: Rodada, jogado: number, prox: number | null): Rodada {
  for (;;) {
    const decisao = avisosDoDia(m, jogado)
    if (prox === null) {
      r.encerradas = m.competicoes
      fimDeTemporada(m, base, seed)
      resumoDaTemporada(m)
      for (const id of m.queremParar) {
        const j = m.jogadores[id]!
        avisar(m, m.times[j.time]!.tecnico, 'aposentadoria', `${j.nome} (${j.idade} anos) quer se aposentar.`, j.id)
      }
      r.virou = true
      return r
    }
    if (decisao || humanoJoga(m)) return r
    jogado = m.dia
    r.dias.push(jogado)
    prox = terminarDia(m, comecarDia(m, seed), seed)
  }
}

/**
 * A rodada: aplica os comandos e joga o dia corrente. Com `intervalo` e um humano em campo, para no intervalo
 * (`fase: 'intervalo'`, o dia fica em `mundo.emJogo`); senão o humano joga no piloto automático e a rodada segue até a
 * próxima parada. Propostas entre humanos sem resposta caem aqui (recusadas). Mesmo input → mesmo mundo.
 */
export function avancarRodada(m: Mundo, base: Base, comandos: readonly ComandoDe[], seed: string, intervalo = false): Rodada {
  if (m.emJogo) throw new Error('rodada no intervalo: use continuarRodada')
  m.avisos = m.avisos.filter((a) => a.dia >= m.dia - 365)
  const pendentes = new Set(m.propostasHumanas)
  const resultados = aplicarComandos(m, base, comandos, derivar(seed, 'comandos'))
  for (const p of m.propostasHumanas.filter((x) => pendentes.has(x)))
    avisar(m, m.times[p.comprador]!.tecnico, 'mercado', `Sem resposta pela proposta por ${m.jogadores[p.jogador]!.nome}: recusada.`, p.jogador)
  m.propostasHumanas = m.propostasHumanas.filter((x) => !pendentes.has(x))
  m.queremParar = m.queremParar.filter((id) => m.jogadores[id]!.time >= 0)
  const humano = humanoJoga(m)
  const dia = comecarDia(m, seed, !(intervalo && humano))
  const r: Rodada = { fase: 'planejamento', resultados, partidas: partidasHumanas(m, dia), todas: dia.partidas, dias: [dia.dia], virou: false }
  if (intervalo && humano) {
    m.emJogo = dia
    return { ...r, fase: 'intervalo' }
  }
  return seguir(m, base, seed, r, dia.dia, terminarDia(m, dia, seed))
}

/** Depois do intervalo: aplica substituições e tática, joga o 2º tempo e segue até a próxima parada. */
export function continuarRodada(m: Mundo, base: Base, comandos: readonly ComandoDe[], seed: string): Rodada {
  const dia = m.emJogo
  if (!dia) throw new Error('nenhuma rodada no intervalo')
  const resultados = aplicarComandos(m, base, comandos, derivar(seed, 'intervalo'))
  m.emJogo = null
  const prox = terminarDia(m, dia, seed)
  const r: Rodada = { fase: 'planejamento', resultados, partidas: partidasHumanas(m, dia), todas: dia.partidas, dias: [dia.dia], virou: false }
  return seguir(m, base, seed, r, dia.dia, prox)
}

const partidasHumanas = (m: Mundo, dia: DiaEmJogo) => dia.partidas.map((x) => x.partida).filter((p) => p.lados.some((l) => m.times[l.time]!.humano))

