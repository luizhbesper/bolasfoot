// Fim de temporada: histórico, acesso e rebaixamento, novo calendário, envelhecimento, janela da IA e a temporada nova.
// Fontes: best/f_0.java:524 (aa: a ordem), :1207 (ah: novo calendário), :1184 (ag), :1303 (am), :1259 (ak);
// best/Z.java:454 (ee: acesso e rebaixamento nacional), :270 (y: reservados da Copa); best/w.java:265 (ee: estaduais);
// f/s.java:1185 (l: quem sobe, lido do bytecode: o decompilador perde o ramo do mata-mata), :1303 (fG: quem cai).
import type { Base } from '@bolasfoot/data'
import { ANO_INICIAL, TIPO, criarCalendario, data, primeiroDomingo } from './calendario.ts'
import { atualizarReputacoes, demissoesFimDeTemporada, envelhecer } from './carreira.ts'
import { classificacaoFinal, compararLinha, type Competicao } from './competicoes.ts'
import { criarCompeticoesBR } from './brasil.ts'
import { receberPatrocinio, zerarExtrato } from './economia.ts'
import { porForca } from './escalacao.ts'
import { batedorFalta, type Historico, type JogadorM, type Mundo } from './mundo.ts'
import { janelaIA, listarIA } from './mercado.ts'
import { derivar } from './rng.ts'

/** Quem sobe de uma divisão: os n primeiros, com os do mata-mata na frente. Fonte: f/s.java:1185 (l) */
export function sobem(c: Competicao, n: number): number[] {
  const f0 = c.fases[0]
  if (!f0 || f0.tipo !== 'liga' || n <= 0) return []
  if (f0.avancam === 0) return f0.times.slice(0, n)
  const lista: number[] = []
  const add = (t: number) => void (lista.length < n && !lista.includes(t) && lista.push(t))
  if (f0.formato === 1020) {
    // Série C: campeão e vice da final, depois todos os segundos dos grupos (abn), e só então o resto dos grupos
    const [, grupos, final] = c.fases
    const r = final?.tipo === 'mata' ? final.rodadas[0] : undefined
    if (r?.vencedores[0] !== undefined) {
      add(r.vencedores[0])
      r.confrontos[0]!.forEach(add)
    }
    if (grupos?.tipo !== 'liga') return lista
    const cmp = (a: number, b: number) => compararLinha(grupos.linhas[a]!, grupos.linhas[b]!)
    for (const t of grupos.grupos.map((g) => g[1]!).sort(cmp)) if (!lista.includes(t)) lista.push(t)
    for (const t of grupos.grupos.flat().filter((t) => !lista.includes(t)).sort(cmp)) add(t)
    return lista
  }
  // mata-mata: os vencedores da última rodada para a primeira (na Série D, campeão, vice e os semifinalistas)
  const mm = c.fases.find((f) => f.tipo === 'mata')
  if (mm?.tipo === 'mata') for (const r of [...mm.rodadas].reverse()) r.vencedores.forEach(add)
  f0.times.forEach(add)
  return lista
}

/** Quem cai: os n últimos da 1ª fase, do último para cima. Fonte: f/s.java:1303 (fG) */
export function caem(c: Competicao, n: number): number[] {
  const f0 = c.fases[0]
  return f0?.tipo === 'liga' && n > 0 ? f0.times.slice(-n).reverse() : []
}

/**
 * Troca quem cai de uma divisão com quem sobe da seguinte (só se as listas têm o mesmo tamanho) e registra no histórico.
 * Devolve os times de cada divisão depois da troca. Fonte: best/Z.java:454-535, best/w.java:265-303 (ee)
 */
function trocarDivisoes(divs: Competicao[], hist: Map<Competicao, Historico>, aoCair?: (i: number, t: number) => void): number[][] {
  const listas = divs.map((c) => (c.fases[0]?.tipo === 'liga' ? [...c.fases[0].times] : []))
  for (let i = 0; i + 1 < divs.length; i++) {
    const n = divs[i]!.rebaixados ?? 0
    const desce = caem(divs[i]!, n), sobe = sobem(divs[i + 1]!, n)
    if (desce.length !== sobe.length) continue
    listas[i] = [...listas[i]!.filter((t) => !desce.includes(t)), ...sobe]
    listas[i + 1] = [...listas[i + 1]!.filter((t) => !sobe.includes(t)), ...desce]
    hist.get(divs[i]!)?.cairam.push(...desce)
    hist.get(divs[i + 1]!)?.subiram.push(...sobe)
    for (const t of desce) aoCair?.(i, t)
  }
  return listas
}

/**
 * Séries A–D. A Série D inteira volta para fora das divisões (vem dos estaduais, Z.java:591); os rebaixados da C ficam
 * guardados para entrar primeiro nela (SR.bY). Fonte: best/f_0.java:1303 (am), best/Z.java:454 (ee)
 */
function acessoNacional(m: Mundo, hist: Map<Competicao, Historico>): void {
  const divs = [1, 2, 3, 4].map((d) => m.competicoes.find((c) => c.id === `BR-${d}`)).filter((c) => c !== undefined)
  m.rebaixadosC = []
  const listas = trocarDivisoes(divs, hist, (i, t) => i === 2 && m.rebaixadosC.push(t))
  // s.yI: a divisão de cada time; s.yJ: a última volta ao pool
  listas.forEach((l, i) => l.forEach((t) => (m.times[t]!.divisao = i + 1 < divs.length ? i + 1 : 0)))
}

/**
 * Estaduais: troca entre divisões e, na última, com a fila do estado (sai o 1º da fila, o rebaixado vai para o fim).
 * Devolve as divisões novas de cada estado. Fonte: best/w.java:265 (ee)
 */
function acessoEstadual(m: Mundo, hist: Map<Competicao, Historico>): Map<number, number[][]> {
  const porUf = new Map<number, Competicao[]>()
  for (const c of m.competicoes) if (c.tipo === TIPO.estadual) porUf.set(c.uf!, [...(porUf.get(c.uf!) ?? []), c])
  const novas = new Map<number, number[][]>()
  for (const [uf, divs] of porUf) {
    divs.sort((a, b) => a.divisao - b.divisao)
    const listas = trocarDivisoes(divs, hist)
    const ultima = divs.at(-1)!
    const fila = m.filasEstaduais[uf] ?? []
    const n = Math.min(ultima.rebaixados ?? 0, fila.length)
    const desce = caem(ultima, n), sobe = fila.slice(0, n)
    if (n > 0 && desce.length === n) {
      listas[listas.length - 1] = [...listas.at(-1)!.filter((t) => !desce.includes(t)), ...sobe]
      m.filasEstaduais[uf] = [...fila.slice(n), ...desce]
      hist.get(ultima)?.cairam.push(...desce)
    }
    novas.set(uf, listas)
  }
  return novas
}

/**
 * Os 12 que entram direto na 3ª fase da próxima Copa: Série A e B pela colocação, com o campeão da B e o da Copa na
 * frente. Fonte: best/Z.java:270 (y), chamado por f_0.Y
 * ponytail: os campeões continentais brasileiros também vão para a frente (Fase 6)
 */
function reservadosCopa(m: Mundo): number[] {
  const a = m.competicoes.find((c) => c.id === 'BR-1'), b = m.competicoes.find((c) => c.id === 'BR-2')
  const lista = [...(a ? classificacaoFinal(a) : []), ...(b ? classificacaoFinal(b) : [])]
  const frente = (t: number | null | undefined) => {
    if (t == null) return
    if (lista.includes(t)) lista.splice(lista.indexOf(t), 1)
    lista.unshift(t)
  }
  frente(b && classificacaoFinal(b)[0])
  frente(m.competicoes.find((c) => c.id === 'CB')?.campeao)
  return lista.length >= 12 ? lista.slice(0, 12) : []
}

/** a_0.abh (força, energia) e depois ai/nJ (força, idade), como o kA e o kz deixam o elenco. */
const porForcaIdade = (a: JogadorM, b: JogadorM) => b.forca - a.forca || b.idade - a.idade

/**
 * Vira o ano depois que `avancarDia` devolve null. Na ordem do original (f_0.aa): histórico; extrato zerado; calendário
 * novo; reputações, lista da IA e patrocínio; acesso e rebaixamento; envelhecimento; janela da IA e demissões; as
 * competições do ano novo. Fonte: best/f_0.java:524 (aa)
 * ponytail: continentais, seleções, Supercopa (f.I) e torneio amistoso entram na Fase 6
 */
export function fimDeTemporada(m: Mundo, base: Base, seed = m.seed): void {
  const acabou = m.temporada
  const rng = (r: string) => derivar(seed, `temporada:${acabou}:${r}`)

  // histórico de cada competição encerrada
  const hist = new Map<Competicao, Historico>()
  for (const c of m.competicoes) {
    const h: Historico = { temporada: acabou, competicao: c.id, nome: c.nome, campeao: c.campeao, vice: c.vice, classificacao: classificacaoFinal(c), subiram: [], cairam: [] }
    hist.set(c, h)
    m.historico.push(h)
  }
  // artilheiro de cada competição; as estatísticas da temporada zeram
  const artilheiros = new Map<string, NonNullable<Historico['artilheiro']> & { jogos: number }>()
  for (const j of m.jogadores) {
    for (const [comp, [jogos, gols]] of Object.entries(j.estatisticas ?? {})) {
      const a = artilheiros.get(comp)
      if (gols > 0 && (!a || gols > a.gols || (gols === a.gols && jogos < a.jogos)))
        artilheiros.set(comp, { jogador: j.id, nome: j.nome, time: j.time, gols, jogos })
    }
    delete j.estatisticas
  }
  for (const h of hist.values()) {
    const a = artilheiros.get(h.competicao)
    if (a) h.artilheiro = { jogador: a.jogador, nome: a.nome, time: a.time, gols: a.gols }
  }
  // ah.kI: extrato da temporada zerado
  for (const t of m.times) if (t.humano) zerarExtrato(t)

  // ah(): temporada e calendário novos (o dia corrente é o 1º domingo de janeiro)
  m.temporada++
  m.calendario = criarCalendario(ANO_INICIAL + m.temporada - 1)
  m.dia = m.calendario.inicio + primeiroDomingo(m.calendario.inicio)
  m.diaEventos = m.dia - 1

  // ag() + iZ(): reputação de times e técnicos; a IA lista sobras e escolhe batedores; +50 de diretoria e torcida;
  // patrocínio dos humanos (ainda pela divisão velha)
  atualizarReputacoes(m)
  const rngIA = rng('ia')
  for (const t of m.times) {
    if (!t.humano) {
      listarIA(m, t, rngIA)
      t.jogadores.sort((a, b) => porForca(m.jogadores[a]!, m.jogadores[b]!))
      t.batedores.falta = batedorFalta(t.jogadores.map((id) => m.jogadores[id]!))
      t.jogadores.sort((a, b) => porForcaIdade(m.jogadores[a]!, m.jogadores[b]!))
    }
    const c = m.tecnicos[t.tecnico]
    if (c?.time === t.id) {
      c.diretoria = Math.min(c.diretoria + 50, 100)
      c.torcida = Math.min(c.torcida + 50, 100)
    }
    if (t.humano) receberPatrocinio(m, t)
  }

  // Y() + am() + ak(): reservados da Copa, acesso e rebaixamento nacional e estadual
  m.reservadosCopa = reservadosCopa(m)
  acessoNacional(m, hist)
  const estaduais = acessoEstadual(m, hist)

  // af(): aniversário, aposentadoria, juniores
  m.queremParar = envelhecer(m, base, rng('envelhecer')).queremParar
  // W(): transferências com mais de 10 anos saem do histórico
  const ano = ANO_INICIAL + m.temporada - 1
  if (m.temporada >= 5) m.transferencias = m.transferencias.filter((x) => data(x.dia).ano + 10 >= ano - 1)

  // ag.jO + ag.jQ: janela da IA (pela classificação que acabou) e demissões
  janelaIA(m, base, rng('janela'))
  demissoesFimDeTemporada(m, acabou, rng('demissoes'))

  // competições do ano novo: séries pelas divisões novas, estaduais pelas trocas, regionais pela ordem das séries
  // ponytail: o original mantém as séries na ordem da tabela velha (com quem subiu no fim); aqui, pelo Nivel
  m.colocacoesEstaduais = []
  m.competicoes = criarCompeticoesBR(m, base, rng('competicoes'), estaduais)
}
