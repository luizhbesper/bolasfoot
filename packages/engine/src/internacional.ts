// Competições internacionais de clubes: vagas por cota de país, sorteio de grupos e confrontos, as continentais das 6
// confederações, o Mundial, as Recopas e a Supercopa. Fontes: f/b.java (cotas), best/Z.java:372-407 (jd, a, je),
// components/aq.java (sorteio), f/r.java (Libertadores), f/H.java (Sul-Americana), f/v.java (Liga dos Campeões),
// f/x.java (Liga Europa), f/j_0.java (Conference), f/t.java, f/u.java, f/w.java, f/y.java (CAF, AFC, Concacaf, OFC),
// f/a_0.java (Mundial), f/e_0.java + f/d_0.java (Recopas), f/I.java (Supercopa), best/p_0.java:174-188 (novo jogo),
// best/f_0.java:957-1038 (ae: a temporada nova), :1219-1235 (ai: campeões que passam), :499-523 (Z: Supercopa).
import { datas, TIPO } from './calendario.ts'
import {
  classificacaoFinal, compararLinha, criarFaseLiga, criarFaseMataMata, criarRodada, ZW,
  type Competicao, type FaseLiga, type FaseMataMata, type OpcoesLiga,
} from './competicoes.ts'
import { porNivelReputacao } from './brasil.ts'
import type { Mundo } from './mundo.ts'
import { derivar, type Rng } from './rng.ts'

/** [país, vagas] (components.am). */
type Cota = readonly [number, number]

// países (best/ac.java); BRA repetido de mundo.ts porque os dois módulos se importam e as cotas são de topo
const BRA = 29, ARG = 11, FRA = 72, ALE = 3

// ── Cotas por competição (yo: direto aos grupos; yp: preliminares) ───────────

const c1 = (...paises: number[]): Cota[] => paises.map((p) => [p, 1] as const)
/** f/r.java:48-83. Com o Brasil na frente, o campeão da Copa entra primeiro (am com flag; o flag do b.a fica ligado). */
const LIB_GRUPOS: Cota[] = [[BRA, 5], [ARG, 5], [195, 2], [150, 2], [42, 2], [46, 2], [60, 2], [151, 2], [26, 2], [198, 2]]
const LIB_PRELIM = c1(26, 60, 150, 151, 195, 198, ARG, 26, BRA, BRA, 42, 42, 46, 46, 60, 150, 151, 195, 198)
/** f/H.java:28-48 */
const SUL_GRUPOS: Cota[] = [[BRA, 3], [BRA, 3], [ARG, 6]]
const SUL_PRELIM: Cota[] = [26, 42, 46, 60, 150, 151, 195, 198].map((p) => [p, 4] as const)
/** f/v.java:27-110 */
const UCL_GRUPOS = c1(97, 65, 104, ALE, FRA, 154, 85, 21, 15, 62, 193, 97, 65, 104, ALE, FRA, 154, 97, 65, 104, ALE, 97, 65, 104)
const UCL_PRELIM = c1(192, 54, 44, 171, 85, 21, 15, 62, FRA, 154, 159, 52, 180, 78, 103, 193, 192, 54, 44, 142, 179, 31, 160, 16, 40, 88, 25,
  152, 64, 63, 119, 120, 27, 100, 122, 12, 114, 2, 101, 76, 70, 134, 128, 92, 110, 216, 105, 145, 102, 66, 4, 164)
/** f/x.java:52-77 */
const UEL_GRUPOS = c1(97, 65, 104, ALE, FRA, 154, 85, FRA, 97, 65, 104)
const UEL_PRELIM = c1(21, 15, 62, 193, 192, 54, 44, 159, 171)
/** f/j_0.java:30-164 */
const UECL_PRELIM = c1(FRA, 97, 65, 104, ALE, 52, 180, 78, 85, 21, 15, 62, 193, 154, 103, 142, 179, 31, 160, 16, 40, 88, 25, 152, 64, 63,
  118, 119, 120, 27, 100, 122, 12, 114, 2, 171, 159, 52, 180, 78, 103, 142, 179, 31, 160, 16, 40, 88, 25, 192, 54, 44, 171, 159, 52, 180,
  78, 103, 142, 179, 31, 160, 16, 40, 88, 85, 21, 15, 62, 193, 192, 54, 44, 154, 101, 76, 70, 134, 128, 92, 110, 216, 105, 145, 102, 66, 4,
  164, 152, 64, 63, 119, 120, 27, 100, 122, 12, 114, 2, 101, 76, 70, 134, 128, 92, 110, 216, 105, 145, 102, 66, 4, 164, 25, 152, 64, 63,
  119, 120, 27, 100, 122, 12, 114, 2, 101, 76, 70, 134, 128, 92, 110, 216, 105)
/** f/t.java (CAF), f/u.java (AFC), f/w.java (Concacaf), f/y.java (OFC) */
const CAF_GRUPOS: Cota[] = [[190, 2], [10, 3], [57, 3], [129, 3], [1, 2], ...c1(47, 50, 75, 141, 127, 67, 36, 5, 157, 178, 201, 200, 81, 116, 169, 133, 194, 186)]
const AFC_GRUPOS: Cota[] = [[43, 2], [9, 3], [107, 3], [49, 3], [39, 3], [98, 3], [59, 3], [196, 2], [14, 2], ...c1(183, 199, 95, 87, 174, 96, 99, 124, 115, 182, 108, 173, 71, 48, 132)]
const CONCACAF_GRUPOS: Cota[] = [[139, 1], [131, 4], [68, 3], [38, 1], [51, 2], [86, 1], [79, 2], [147, 2], ...c1(58, 22, 189, 106, 84, 53, 158)]
const OFC_GRUPOS: Cota[] = [[143, 2], ...c1(148, 93, 184, 69, 197, 215)]

/** Bd() (f/v.java:113, f/x.java:79, f/j_0.java:168): na 3ª temporada algumas vagas trocam de país, e fica assim. */
function trocasDaTemporada3(m: Mundo, lista: Cota[], trocas: [number, number][]): Cota[] {
  if (m.temporada < 3) return lista
  const l = [...lista]
  for (const [i, pais] of trocas) l[i] = [pais, l[i]![1]]
  return l
}

// ── Escolha por cota (f/b.java, best/Z.java:372-407) ──────────────────────

interface Ctx {
  m: Mundo
  rng: Rng
  /** Z.hD: a fila de cada país nesta virada (Z.jy limpa todas antes de montar as continentais) */
  filas: Map<number, number[]>
  /** competições já montadas nesta virada (vêm antes das do ano velho na busca) */
  novas: Competicao[]
}

const pais = (x: Ctx, t: number) => x.m.times[t]!.pais
const achar = (x: Ctx, id: string) => x.novas.find((c) => c.id === id) ?? x.m.competicoes.find((c) => c.id === id)
const lista = (c: Competicao | undefined, k: string): number[] => c?.listas?.[k] ?? []

/** Z.je (Z.java:407): país sem liga sorteia a ordem — desempate novo, Nivel, e cada um entra com 85, 80 … 35, depois 20%. */
function filaSemLiga(x: Ctx, p: number): number[] {
  const times = x.m.times.filter((t) => t.pais === p)
  for (const t of times) t.desempate = x.rng.int(1000) + 1
  const ordem = times.sort((a, b) => b.nivel - a.nivel || b.desempate - a.desempate).map((t) => t.id)
  const PROB = [85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35]
  const sorteados = ordem.filter((_, i) => x.rng.int(100) + 1 <= (PROB[i] ?? 20))
  return [...sorteados, ...ordem.filter((t) => !sorteados.includes(t))]
}

/** Z.jd: a fila do país. Com liga (só o Brasil): Série A e Série B na ordem final (s.yV). */
function fila(x: Ctx, p: number): number[] {
  let f = x.filas.get(p)
  if (!f) {
    f = p === BRA ? ['BR-1', 'BR-2'].flatMap((id) => { const c = x.m.competicoes.find((k) => k.id === id); return c ? classificacaoFinal(c) : [] }) : filaSemLiga(x, p)
    x.filas.set(p, f)
  }
  return f
}

/** Z.bk(H-1): campeão da copa nacional da temporada passada (só o Brasil tem copa). */
function campeaoCopa(m: Mundo, p: number): number | null {
  if (p !== BRA) return null
  return m.historico.find((h) => h.competicao === 'CB' && h.temporada === m.temporada - 1)?.campeao ?? null
}

/** Z.a (Z.java:385): até n times do país que ainda não estão em `usados`, o campeão da copa primeiro se pedido. */
function doPais(x: Ctx, p: number, n: number, out: number[], usados: number[], comCampeao: boolean): void {
  const f = fila(x, p)
  const c = comCampeao ? campeaoCopa(x.m, p) : null
  if (c !== null && !usados.includes(c)) {
    out.push(c)
    usados.push(c)
    n--
  }
  for (const t of f) {
    if (n <= 0) break
    if (!usados.includes(t)) {
      out.push(t)
      usados.push(t)
      n--
    }
  }
}

/** b.a (f/b.java:14): cada cota na ordem. */
function cotas(x: Ctx, lista: readonly Cota[], out: number[], usados: number[], comCampeao = false): void {
  for (const [p, n] of lista) doPais(x, p, n, out, usados, comCampeao)
}

/** b.a (f/b.java:27): faltando times, mais um de cada país da lista, na ordem, até `alvo`. */
function completar(x: Ctx, out: number[], lista: readonly Cota[], alvo: number, usados: number[]): void {
  for (const [p] of lista) {
    if (out.length >= alvo) break
    doPais(x, p, 1, out, usados, false)
  }
}

// ── Sorteio (components/aq.java) ──────────────────────────────────────────

const temPais = (x: Ctx, g: number[], p: number) => g.some((t) => pais(x, t) === p)
/** aq.a(list, i): tira o i-ésimo da lista para o grupo. */
const tirar = (g: number[], l: number[], i: number) => void g.push(l.splice(i, 1)[0]!)
/** aq.ab: o 1º da lista de país que o grupo ainda não tem (ou o 1º). */
const livre = (x: Ctx, g: number[], l: number[]) => Math.max(0, l.findIndex((t) => !temPais(x, g, pais(x, t))))

/** n grupos, um de cada pote por vez (aq.a com 4 potes, aq.e com 2): o 1º pote na ordem, os outros evitando o país. */
function sortear(x: Ctx, n: number, potes: number[][], evitarPais = true): number[][] {
  const gs = Array.from({ length: n }, () => [] as number[])
  for (const g of gs) potes.forEach((pt, i) => tirar(g, pt, i === 0 || !evitarPais ? 0 : livre(x, g, pt)))
  return gs
}

/** aq.e com a ordem dos potes sorteada por grupo (random.nextBoolean, f/x.java:184, f/j_0.java:235). */
function sortearPares(x: Ctx, n: number, a: number[], b: number[]): number[][] {
  const gs: number[][] = []
  for (let i = 0; i < n; i++) gs.push(x.rng.int(2) === 0 ? sortear(x, 1, [a, b])[0]! : sortear(x, 1, [b, a])[0]!)
  return gs
}

/** aq.a(aq[]) (aq.java:44): o 1º repetido de país em cada grupo troca com o da mesma posição num grupo sem conflito. */
function corrigir(x: Ctx, gs: number[][]): number[][] {
  const marcas: [number, number][] = []
  gs.forEach((g, i) => {
    const k = g.findIndex((t, j) => g.some((u, l) => l !== j && pais(x, u) === pais(x, t)))
    if (k >= 0) marcas.push([i, k])
  })
  for (const [i, k] of marcas) {
    const p = pais(x, gs[i]![k]!)
    const j = gs.findIndex((g, j) => j !== i && !temPais(x, g, p) && !temPais(x, gs[i]!, pais(x, g[k]!)))
    if (j < 0) continue
    const t = gs[i]![k]!
    gs[i]![k] = gs[j]![k]!
    gs[j]![k] = t
  }
  return gs
}

const embaralhar = <T>(x: Ctx, l: T[]): T[] => x.rng.shuffle(l)
const abm = (x: Ctx, l: number[]) => l.sort(porNivelReputacao(x.m))
/** H.b (f/H.java:256): o bloco i de tamanho n, embaralhado. */
const bloco = (x: Ctx, l: number[], i: number, n: number) => embaralhar(x, l.slice(i * n, i * n + n))
const de = (l: number[], a: number, b: number) => {
  if (l.length <= b) throw new Error(`continental: lista curta (${l.length}, precisa do índice ${b})`)
  return l.slice(a, b + 1)
}

// ── Fases ─────────────────────────────────────────────────────────────────

const IDA = [true, true, true, true, true, true, true]
const ATE_SEMI = [true, true, true, false, false, false, false]

/** Mata-mata de uma rodada (preliminar: z com n4 = 1) ou de `rodadas`; no fim entrega à competição (fimDeFaseInternacional). */
function preliminar(m: Mundo, c: Competicao, codigo: number, ordem: number[], idaVolta: boolean, desde: number, nome: string, rodadas = 1, nomes?: string[]): void {
  const f: FaseMataMata = { tipo: 'mata', idaVolta: [idaVolta, idaVolta], formato: codigo, reservados: [], rodadasMax: rodadas, nomes: nomes ?? [nome], rodadas: [criarRodada(m, c, ordem, idaVolta, desde)] }
  c.fases.push(f)
}

/** Fase de grupos em blocos de `ordem` (s.j com bl = true), dois turnos. */
function grupos(m: Mundo, c: Competicao, ordem: number[], n: number, avancam: number, codigo: number, desde: number, rng: Rng, o: Partial<OpcoesLiga> = {}): void {
  c.colocacaoDesde = c.fases.length
  const opcoes: OpcoesLiga = { grupos: n, gruposEmBloco: true, avancam, doisTurnos: true, numeroTurnos: 0, idaVolta: IDA, formato: codigo, ...o }
  c.fases.push(criarFaseLiga(m, c, ordem, opcoes, desde, rng))
}

/** Mata-mata até o campeão. */
function chave(m: Mundo, c: Competicao, ordem: number[], idaVolta: boolean[], desde: number, nomes?: string[]): void {
  const f = criarFaseMataMata(m, c, ordem, idaVolta, desde)
  if (nomes) f.nomes = nomes
  c.fases.push(f)
}

const faseLiga = (c: Competicao | undefined, codigo: number) => c?.fases.find((f): f is FaseLiga => f.tipo === 'liga' && f.formato === codigo)
const posicao = (f: FaseLiga | undefined, k: number) => (f ? f.grupos.map((g) => g[k]!) : [])
const porLinha = (f: FaseLiga) => (a: number, b: number) => compararLinha(f.linhas[a]!, f.linhas[b]!)

function competicao(id: string, nome: string, tipo: number, confederacao: number): Competicao {
  return { id, nome, tipo, divisao: 0, fases: [], campeao: null, vice: null, confederacao, listas: {} }
}

// ── Sede rotativa das finais (mF) ─────────────────────────────────────────

/** País-sede e cidade da final, por temporada ((H()-1) % 10). Fontes: f/r.java:615-630, f/H.java:245-258,
 * f/v.java:562-575, f/x.java:430-443, f/j_0.java:713-726 (mF e yD) */
const SEDES: Record<string, { paises: number[]; cidades: string[] }> = {
  LIB: { paises: [42, 11, 29, 46, 150, 195, 26, 198, 60, 151], cidades: ['Santiago', 'Buenos Aires', 'Rio de Janeiro', 'Bogotá', 'Assunción', 'Montevidéu', 'La Paz', 'Caracas', 'Quito', 'Lima'] },
  SUL: { paises: [11, 29, 150, 42, 46, 151, 195, 26, 198, 60], cidades: ['Assunção', 'Lima', 'São Paulo', 'Caracas', 'Quito', 'Medellín', 'La Paz', 'Montevidéu', 'Santiago', 'Córdoba'] },
  UCL: { paises: [192, 162, 3, 104, 154, 97, 72, 152, 65, 52], cidades: ['Istambul', 'São Petersburgo', 'Munique', 'Roma', 'Lisboa', 'Londres', 'Paris', 'Varsóvia', 'Madrid', 'Zagreb'] },
  UEL: { paises: [152, 65, 52, 31, 21, 154, 3, 72, 162, 97], cidades: ['Gdansk', 'Sevilla', 'Zagreb', 'Sofia', 'Bruxelas', 'Porto', 'Frankfurt', 'Lyon', 'Moscou', 'Liverpool'] },
  UECL: { paises: [152, 65, 52, 31, 21, 154, 3, 72, 162, 97], cidades: ['Gdansk', 'Sevilla', 'Zagreb', 'Sofia', 'Bruxelas', 'Porto', 'Frankfurt', 'Lyon', 'Moscou', 'Liverpool'] },
}

/**
 * Sede da final das continentais (tipos 4/6/12 da UEFA e da CONMEBOL): o estádio de um clube do país-sede, entre os 6
 * maiores do país (SR.cc, por capacidade). Continental 2 (tipo 6): qualquer um dos 6; as outras: um dos 2 maiores.
 * Não é campo neutro: o mando continua. Sem clube no país, fica o estádio do mandante (null).
 * Fonte: best/I.java:187-197, best/Z.java:1295-1322 (C)
 */
export function sedeDaFinal(m: Mundo, c: Competicao): { cidade: string; time: number } | null {
  const s = SEDES[c.id]
  if (!s || (c.tipo !== TIPO.continental1 && c.tipo !== TIPO.continental2 && c.tipo !== TIPO.conference)) return null
  const k = (m.temporada - 1) % 10
  const cap = (id: number) => m.times[id]!.estadio.setores.reduce((a, b) => a + b, 0)
  const maiores = m.times.filter((t) => t.pais === s.paises[k]).map((t) => t.id).sort((a, b) => cap(b) - cap(a)).slice(0, 6)
  // um sorteio por final (ida e volta no mesmo estádio), do RNG do motor
  const rng = derivar(m.seed, `sede:${c.id}:${m.temporada}`)
  // Z.C(true): nextInt(2) fora da lista dá null no original (o get(0) é descartado); aqui, cai no maior
  const i = c.tipo === TIPO.continental2 ? (maiores.length ? rng.int(maiores.length) : 0) : rng.int(2)
  const time = maiores[i] ?? maiores[0]
  return time === undefined ? null : { cidade: s.cidades[k]!, time }
}

/** Avisa o técnico humano de cada time (os `as` do original). */
function avisar(m: Mundo, times: number[], texto: (nome: string) => string): void {
  for (const id of times) {
    const t = m.times[id]!, tc = m.tecnicos[t.tecnico]
    if (t.humano && tc?.humano && tc.time === id) m.avisos.push({ tecnico: tc.id, dia: m.dia, texto: texto(t.nome), tipo: 'competicao' })
  }
}

/** Detentor brasileiro de uma continental (Z.y, Z.java:290-300), ou nada. */
export function detentorBR(m: Mundo, k: string): number | null {
  const t = detentor(m, k)
  return t !== null && m.times[t]!.pais === BRA ? t : null
}

const detentores = (m: Mundo) => (m.detentores ??= {})
const detentor = (m: Mundo, k: string): number | null => detentores(m)[k] ?? null
function setDetentor(m: Mundo, k: string, t: number | null): void {
  if (t === null) delete detentores(m)[k]
  else detentores(m)[k] = t
}

// ── Libertadores (f/r.java) ───────────────────────────────────────────────

function criarLibertadores(x: Ctx): Competicao {
  const { m } = x
  const c = competicao('LIB', 'Copa Libertadores', TIPO.continental1, 1)
  const YF: number[] = [], YS: number[] = [], extras: Cota[] = []
  const YT = detentor(m, 'LIB'), YU = detentor(m, 'LIB:SUL')
  // ys() :145: o detentor e o campeão da Sul-Americana entram direto; sem eles, mais um do Brasil e da Argentina
  if (YT === null) extras.push([BRA, 1])
  else YF.push(YT)
  if (YU === null) extras.push([ARG, 1])
  else if (YU !== YT) YF.push(YU)
  if (YT !== null && YT === YU) extras.push([m.times[YT]!.pais, 1])
  const usados = [...YF, ...YS]
  cotas(x, extras, YF, usados)
  cotas(x, LIB_GRUPOS, YF, usados, true)
  cotas(x, LIB_PRELIM, YS, usados, true)
  if (YF.length < 28) completar(x, YF, LIB_GRUPOS, 28, usados)
  if (YS.length < 19) completar(x, YS, LIB_PRELIM, 19, usados)
  abm(x, YF)
  c.listas = { YF, YS }
  if (YS.length === 19 && YF.length === 28) preliminar(m, c, 4101, embaralhar(x, YS.slice(0, 6)), true, m.dia, 'Preliminar Fase 1')
  return c
}

/** g (:239): 3 da 1ª preliminar + YS[6..18], potes de 8 por força. */
function libG(x: Ctx, c: Competicao, venc: number[], desde: number): void {
  const todos = abm(x, [...de(lista(c, 'YS'), 6, 18), ...venc])
  const gs = corrigir(x, sortear(x, 8, [embaralhar(x, todos.slice(0, 8)), embaralhar(x, todos.slice(8, 16))]))
  preliminar(x.m, c, 4102, gs.flat(), true, desde, 'Preliminar Fase 2')
}

/** i (:356): os 4 eliminados vão à Sul-Americana; grupos com potes de 8 (os 4 da preliminar no último). */
function libI(x: Ctx, c: Competicao, venc: number[], perd: number[], desde: number): void {
  const sul = achar(x, 'SUL')
  if (sul?.listas) sul.listas.aao = [...(sul.listas.aao ?? []), ...perd]
  avisar(x.m, perd, (n) => `${n} caiu na preliminar da Libertadores e vai para a fase de grupos da Copa Sul-Americana.`)
  const YF = lista(c, 'YF')
  const potes = [de(YF, 0, 7), de(YF, 8, 15), de(YF, 16, 23), [...de(YF, 24, 27), ...venc]].map((p) => embaralhar(x, p))
  const gs = embaralhar(x, corrigir(x, sortear(x, 8, potes)))
  grupos(x.m, c, gs.flat(), 8, 2, 4104, desde, x.rng, { idaVolta: ATE_SEMI })
}

/** yt (:442): 2º × 1º nas oitavas, sorteados; os 3ºs vão à Sul-Americana (H.yt). */
function libYt(x: Ctx, c: Competicao, f: FaseLiga, desde: number): void {
  avisar(x.m, posicao(f, 2), (n) => `${n} terminou em 3º no grupo da Libertadores e vai para as oitavas da Copa Sul-Americana.`)
  const segundos = embaralhar(x, posicao(f, 1)), primeiros = embaralhar(x, posicao(f, 0))
  chave(x.m, c, segundos.flatMap((t, i) => [t, primeiros[i]!]), ATE_SEMI, desde)
}

// ── Sul-Americana (f/H.java) ──────────────────────────────────────────────

function criarSulAmericana(x: Ctx): Competicao {
  const { m } = x
  const c = competicao('SUL', 'Copa Sul-Americana', TIPO.continental2, 1)
  const lib = achar(x, 'LIB')
  const YF: number[] = [], YS: number[] = []
  const usados = [...lista(lib, 'YF'), ...lista(lib, 'YS')]
  cotas(x, SUL_GRUPOS, YF, usados)
  cotas(x, SUL_PRELIM, YS, usados)
  if (YF.length < 12) completar(x, YF, SUL_GRUPOS, 12, usados)
  if (YF.length < 12) completar(x, YF, SUL_GRUPOS, 12, usados)
  if (YS.length < 32) completar(x, YS, SUL_PRELIM, 32, usados)
  if (YS.length < 32) completar(x, YS, SUL_GRUPOS, 32, usados)
  abm(x, YF)
  c.listas = { YF, YS, aao: [] }
  if (YS.length === 32 && YF.length === 12) preliminar(m, c, 6100, Array.from({ length: 8 }, (_, i) => bloco(x, YS, i, 4)).flat(), true, m.dia, 'Pré-qualificatório')
  return c
}

/** o (:112): 4 da Libertadores + 16 da preliminar + 12 diretos, potes de 8 por força; só o 1º avança. */
function sulO(x: Ctx, c: Competicao, venc: number[], desde: number): void {
  const todos = abm(x, [...lista(c, 'aao'), ...venc, ...lista(c, 'YF')])
  const gs = corrigir(x, sortear(x, 8, [0, 1, 2, 3].map((i) => bloco(x, todos, i, 8))))
  if (gs.flat().length === 32) grupos(x.m, c, gs.flat(), 8, 1, 6105, desde, x.rng, { idaVolta: ATE_SEMI })
}

/** yt (:184): 1º de cada grupo × 3º de um grupo da Libertadores. */
function sulYt(x: Ctx, c: Competicao, f: FaseLiga, desde: number): void {
  const primeiros = embaralhar(x, posicao(f, 0)), terceiros = embaralhar(x, posicao(faseLiga(achar(x, 'LIB'), 4104), 2))
  chave(x.m, c, primeiros.flatMap((t, i) => [t, terceiros[i]!]), ATE_SEMI, desde)
}

// ── Liga dos Campeões (f/v.java) ──────────────────────────────────────────

function criarLigaCampeoes(x: Ctx): Competicao {
  const { m } = x
  const c = competicao('UCL', 'Liga dos Campeões', TIPO.continental1, 0)
  const YF: number[] = [], YS: number[] = [], extras: Cota[] = []
  const YT = detentor(m, 'UCL'), ZC = detentor(m, 'UCL:UEL'), ago = detentor(m, 'UEL:UECL')
  if (YT === null) extras.push([FRA, 1])
  else YF.push(YT)
  if (ZC === null) extras.push([ALE, 1])
  else if (ZC !== YT) YF.push(ZC)
  if (YT !== null && YT === ZC) extras.push([m.times[YT]!.pais, 1])
  const usados = [...YF, ...YS]
  cotas(x, extras, YF, usados)
  const grupos = trocasDaTemporada3(m, UCL_GRUPOS, [[8, 192]])
  const prelim = trocasDaTemporada3(m, UCL_PRELIM, [[0, 15], [43, 102], [48, 92], [2, 162]])
  cotas(x, grupos, YF, usados)
  // o campeão da Conference tem vaga na Liga Europa: não entra na preliminar daqui
  if (m.temporada > 1 && ago !== null) usados.push(ago)
  cotas(x, prelim, YS, usados)
  if (YF.length < 26) completar(x, YF, grupos, 26, usados)
  if (YS.length < 52) completar(x, YS, prelim, 52, usados)
  abm(x, YF)
  c.listas = { YF, YS }
  if (YF.length === 26 && YS.length === 52)
    preliminar(m, c, 4000, embaralhar(x, de(YS, 48, 51)), false, m.dia, '', 2, ['Pré-Preliminar R1', 'Pré-Preliminar R2'])
  return c
}

/** aj (:166): os 3 que caíram na pré-preliminar vão à Conference; YS[19..33] × YS[34..47] + o vencedor. */
function uclAj(x: Ctx, c: Competicao, venc: number[], desde: number): void {
  const YS = lista(c, 'YS')
  paraZE(x, 'UECL', de(YS, 48, 51).filter((t) => !venc.includes(t)))
  const a = embaralhar(x, de(YS, 19, 33)), b = embaralhar(x, [...de(YS, 34, 47), venc[0]!])
  const ordem = a.flatMap((t, i) => (x.rng.int(2) === 0 ? [t, b[i]!] : [b[i]!, t]))
  preliminar(x.m, c, 4001, ordem, true, desde, 'Preliminar 1')
}

/** g (:204): eliminados à Conference; YS[10..14] + 15 vencedores, YS[15..18]. */
function uclG(x: Ctx, c: Competicao, venc: number[], perd: number[], desde: number): void {
  paraZE(x, 'UECL', perd)
  const YS = lista(c, 'YS')
  preliminar(x.m, c, 4002, [...embaralhar(x, [...de(YS, 10, 14), ...venc]), ...embaralhar(x, de(YS, 15, 18))], true, desde, 'Preliminar 2')
}

/** h (:228): os 12 eliminados abrem a Liga Europa (x.aj); vencedores + YS[2..9]. */
function uclH(x: Ctx, c: Competicao, venc: number[], perd: number[], desde: number): void {
  const YS = lista(c, 'YS')
  const caiu = [...embaralhar(x, perd.slice(0, 10)), ...perd.slice(10, 12)]
  const uel = achar(x, 'UEL')
  if (uel) uelAj(x, uel, caiu, desde)
  const a = embaralhar(x, [...venc.slice(0, 10), ...de(YS, 2, 3)]), b = embaralhar(x, [...de(YS, 4, 9), ...venc.slice(10, 12)])
  preliminar(x.m, c, 4003, [...a, ...b], true, desde, 'Preliminar 3')
}

/** j (:277): eliminados à Liga Europa; vencedores + YS[0..1]. */
function uclJ(x: Ctx, c: Competicao, venc: number[], perd: number[], desde: number): void {
  paraZE(x, 'UEL', perd)
  const YS = lista(c, 'YS')
  preliminar(x.m, c, 4004, [...embaralhar(x, [...venc.slice(0, 6), ...de(YS, 0, 1)]), ...embaralhar(x, venc.slice(6, 10))], true, desde, 'Preliminar 4')
}

/** k (:306): eliminados à Liga Europa; grupos com potes de 8 (os 6 da preliminar no último), grupos embaralhados. */
function uclK(x: Ctx, c: Competicao, venc: number[], perd: number[], desde: number): void {
  paraZE(x, 'UEL', perd)
  const YF = lista(c, 'YF')
  const potes = [de(YF, 0, 7), de(YF, 8, 15), de(YF, 16, 23), [...de(YF, 24, 25), ...venc]].map((p) => embaralhar(x, p))
  const gs = embaralhar(x, corrigir(x, sortear(x, 8, potes)))
  grupos(x.m, c, gs.flat(), 8, 2, 4005, desde, x.rng, { idaVolta: ATE_SEMI })
}

/** yt (:443): 2º × 1º evitando o mesmo país; os 3ºs vão à Liga Europa (x.Be). */
function uclYt(x: Ctx, c: Competicao, f: FaseLiga, desde: number): void {
  const gs = corrigir(x, sortear(x, 8, [embaralhar(x, posicao(f, 1)), embaralhar(x, posicao(f, 0))]))
  chave(x.m, c, gs.flat(), ATE_SEMI, desde)
}

/** zo().addAll: quem cai de uma competição e entra noutra mais tarde (ZE). */
function paraZE(x: Ctx, id: string, times: number[]): void {
  const c = achar(x, id)
  if (c?.listas) c.listas.ZE = [...(c.listas.ZE ?? []), ...times]
}

// ── Liga Europa (f/x.java) ────────────────────────────────────────────────

function criarLigaEuropa(x: Ctx): Competicao {
  const { m } = x
  const c = competicao('UEL', 'Liga Europa', TIPO.continental2, 0)
  const ucl = achar(x, 'UCL')
  const YF: number[] = [], YS: number[] = [], extras: Cota[] = []
  const usados = [...lista(ucl, 'YF'), ...lista(ucl, 'YS')]
  const ago = detentor(m, 'UEL:UECL')
  if (m.temporada > 1 && ago !== null && !usados.includes(ago)) {
    YF.push(ago)
    usados.push(ago)
  } else extras.push([ALE, 1])
  cotas(x, extras, YF, usados)
  const prelim = trocasDaTemporada3(m, UEL_PRELIM, [[6, 162]])
  cotas(x, UEL_GRUPOS, YF, usados)
  cotas(x, prelim, YS, usados)
  if (YF.length < 12) completar(x, YF, UEL_GRUPOS, 12, usados)
  if (YS.length < 9) completar(x, YS, prelim, 9, usados)
  abm(x, YF)
  c.listas = { YF, YS, ZE: [] }
  return c
}

/** aj (:112): os 12 eliminados da Preliminar 2 da Liga dos Campeões + YS[7..8]. */
function uelAj(x: Ctx, c: Competicao, caiu: number[], desde: number): void {
  const YS = lista(c, 'YS')
  avisar(x.m, caiu, (n) => `${n} caiu na preliminar da Liga dos Campeões e vai para a Liga Europa.`)
  preliminar(x.m, c, 6001, [...embaralhar(x, caiu.slice(0, 10)), ...embaralhar(x, [...caiu.slice(10, 12), ...de(YS, 7, 8)])], true, desde, 'Qualificatório 1')
}

/** g (:136): eliminados à Conference; YS[0..6] + ZE[0..5] + 7 vencedores, em pares sorteados. */
function uelG(x: Ctx, c: Competicao, venc: number[], perd: number[], desde: number): void {
  paraZE(x, 'UECL', perd)
  const todos = embaralhar(x, [...de(lista(c, 'YS'), 0, 6), ...de(lista(c, 'ZE'), 0, 5), ...venc])
  preliminar(x.m, c, 6002, sortearPares(x, 10, todos.slice(0, 10), todos.slice(10, 20)).flat(), true, desde, 'Qualificatório 2')
}

/** m (:204): eliminados à Conference; ZE[6..15] + 10 vencedores + YF, potes de 8 por força. */
function uelM(x: Ctx, c: Competicao, venc: number[], perd: number[], desde: number): void {
  paraZE(x, 'UECL', perd)
  const todos = abm(x, [...de(lista(c, 'ZE'), 6, 15), ...venc, ...lista(c, 'YF')])
  const potes = [0, 1, 2, 3].map((i) => embaralhar(x, todos.slice(i * 8, i * 8 + 8)))
  const gs = corrigir(x, sortear(x, 8, potes))
  if (gs.flat().length === 32) grupos(x.m, c, gs.flat(), 8, 2, 6005, desde, x.rng, { idaVolta: [true, true, true, true, false, false, false] })
}

/** Be (:308) / l (:351): 2ºs × 3ºs da competição de cima numa pré-oitavas; depois 1ºs × vencedores. */
function preOitavas(x: Ctx, c: Competicao, f: FaseLiga, de: string, codigoDeCima: number, codigo: number, desde: number): void {
  const gs = corrigir(x, sortear(x, 8, [embaralhar(x, posicao(f, 1)), embaralhar(x, posicao(faseLiga(achar(x, de), codigoDeCima), 2))]))
  preliminar(x.m, c, codigo, gs.flat(), true, desde, 'Pré-Oitavas')
}
function oitavas(x: Ctx, c: Competicao, codigoGrupos: number, venc: number[], desde: number): void {
  const gs = corrigir(x, sortear(x, 8, [embaralhar(x, posicao(faseLiga(c, codigoGrupos), 0)), embaralhar(x, [...venc])]))
  chave(x.m, c, gs.flat(), ATE_SEMI, desde)
}

// ── Conference (f/j_0.java) ───────────────────────────────────────────────

function criarConference(x: Ctx): Competicao {
  const { m } = x
  const c = competicao('UECL', 'Conference League', TIPO.conference, 0)
  const ucl = achar(x, 'UCL'), uel = achar(x, 'UEL')
  const YS: number[] = []
  const usados = [...lista(ucl, 'YF'), ...lista(ucl, 'YS'), ...lista(uel, 'YF'), ...lista(uel, 'YS')]
  const prelim = trocasDaTemporada3(m, UECL_PRELIM, [[40, 162], [87, 162]])
  cotas(x, prelim, YS, usados)
  if (YS.length < 134) completar(x, YS, prelim, 134, usados)
  c.listas = { YF: [], YS, ZE: [] }
  if (YS.length === 134) preliminar(m, c, 12001, embaralhar(x, de(YS, 74, 133)), true, m.dia, 'Qualificatório 1')
  return c
}

/** g (:186): ZE[0..15] em pares + YS[14..58] × YS[59..73] e os 30 vencedores. */
function ueclG(x: Ctx, c: Competicao, venc: number[], desde: number): void {
  const YS = lista(c, 'YS'), ZE = lista(c, 'ZE')
  const a = embaralhar(x, de(ZE, 0, 7)), b = embaralhar(x, de(ZE, 8, 15))
  const p = embaralhar(x, de(YS, 14, 58)), q = embaralhar(x, [...de(YS, 59, 73), ...venc])
  preliminar(x.m, c, 12002, [...sortearPares(x, 8, a, b), ...sortearPares(x, 45, p, q)].flat(), true, desde, 'Qualificatório 2')
}

/** h (:259) */
function ueclH(x: Ctx, c: Competicao, venc: number[], desde: number): void {
  const YS = lista(c, 'YS'), ZE = lista(c, 'ZE')
  const a = embaralhar(x, de(venc, 0, 4)), b = embaralhar(x, [...de(venc, 5, 7), ...de(ZE, 16, 17)])
  const p = embaralhar(x, [...de(YS, 5, 13), ...de(venc, 8, 25)]), q = embaralhar(x, de(venc, 26, 52))
  preliminar(x.m, c, 12003, [...sortearPares(x, 5, a, b), ...sortearPares(x, 27, p, q)].flat(), true, desde, 'Qualificatório 3')
}

/** j (:340) */
function ueclJ(x: Ctx, c: Competicao, venc: number[], desde: number): void {
  const YS = lista(c, 'YS'), ZE = lista(c, 'ZE')
  const a = embaralhar(x, de(venc, 0, 4)), b = embaralhar(x, de(ZE, 18, 22))
  const p = embaralhar(x, [...de(YS, 0, 4), ...de(venc, 5, 16)]), q = embaralhar(x, [...de(venc, 17, 31), ...de(ZE, 23, 24)])
  preliminar(x.m, c, 12004, [...sortearPares(x, 5, a, b), ...sortearPares(x, 17, p, q)].flat(), true, desde, 'Qualificatório 4')
}

/** m (:420): ZE[25..34] + 22 vencedores, potes de 8 por força. */
function ueclM(x: Ctx, c: Competicao, venc: number[], desde: number): void {
  const todos = abm(x, [...de(lista(c, 'ZE'), 25, 34), ...venc, ...lista(c, 'YF')])
  const potes = [0, 1, 2, 3].map((i) => embaralhar(x, todos.slice(i * 8, i * 8 + 8)))
  const gs = corrigir(x, sortear(x, 8, potes))
  if (gs.flat().length === 32) grupos(x.m, c, gs.flat(), 8, 2, 12005, desde, x.rng, { idaVolta: [true, true, true, true, false, false, false] })
}

// ── CAF, AFC, Concacaf, OFC (f/t, f/u, f/w, f/y) ─────────────────────────

/** yq das 4: o detentor (ZA) entra direto (a OFC não), cotas, potes pela ordem de força e grupos em blocos. */
function criarConfederacao(x: Ctx, id: string, nome: string, conf: number, cotasConf: Cota[], alvo: number, posicoes: number[], nGrupos: number, avancam: number, codigo: number): Competicao {
  const { m } = x
  const c = competicao(id, nome, TIPO.continental1, conf)
  const YF: number[] = []
  const ZA = id === 'OFC' ? null : detentor(m, id)
  if (ZA !== null) YF.push(ZA)
  const usados = [...YF]
  cotas(x, cotasConf, YF, usados)
  if (YF.length < alvo) completar(x, YF, cotasConf, alvo, usados)
  abm(x, YF)
  c.listas = { YF }
  if (YF.length >= alvo) grupos(m, c, posicoes.map((i) => YF[i]!), nGrupos, avancam, codigo, m.dia, x.rng, { pulaDuas: true })
  return c
}

const CAF_POS = [0, 15, 23, 31, 3, 14, 22, 29, 5, 13, 21, 27, 7, 12, 20, 25, 1, 11, 19, 30, 2, 10, 18, 28, 4, 9, 17, 26, 6, 8, 16, 24]
const AFC_POS = Array.from({ length: 10 }, (_, k) => [k, 10 + k, 20 + k, 30 + k]).flat()
const CONCACAF_POS = [0, 15, 23, 4, 14, 22, 6, 13, 21, 2, 11, 20, 1, 12, 19, 5, 10, 18, 7, 9, 17, 3, 8, 16]
const OFC_POS = [0, 2, 4, 6, 1, 3, 5, 7]

/** s.yP, ramo continental (f/s.java:862-930): CAF (e AFC/Libertadores) ordena 1ºs e 2ºs pela campanha e cruza. */
function cafKO(x: Ctx, c: Competicao, f: FaseLiga, desde: number): void {
  const cmp = porLinha(f)
  const primeiros = posicao(f, 0).sort(cmp), segundos = posicao(f, 1).sort(cmp)
  const P = [0, 7, 3, 4, 1, 6, 2, 5], S = [7, 0, 4, 3, 6, 1, 5, 2]
  chave(x.m, c, primeiros.flatMap((_, i) => [segundos[S[i]!]!, primeiros[P[i]!]!]), IDA, desde)
}

/** s.yO (f/s.java:763): AFC, os 10 líderes e os 6 melhores 2ºs. */
function afcKO(x: Ctx, c: Competicao, f: FaseLiga, desde: number): void {
  const lista = [...posicao(f, 0), ...posicao(f, 1).sort(porLinha(f)).slice(0, 6)]
  chave(x.m, c, ZW.map((i) => lista[i]!), IDA, desde)
}

// ── Mundial, Recopas e Supercopa ──────────────────────────────────────────

/** Último dia de continental 1: depois dos jogos dele roda o evento cw (p_0.java:181, f_0.java:1015). */
export function diaDoMundial(m: Mundo): number | undefined {
  return datas(m.calendario, TIPO.continental1).at(-1)
}

/**
 * Evento cw (a_0.zC, f/a_0.java:41): os campeões viram detentores; com os 6, quartas entre CAF, AFC, OFC e Concacaf.
 */
export function eventoCW(m: Mundo, desde: number, rng: Rng): void {
  const camp = (id: string) => m.competicoes.find((c) => c.id === id)?.campeao ?? null
  const ZO = camp('UCL'), ZP = camp('LIB'), ZQ = camp('CAF'), ZR = camp('AFC'), ZS = camp('OFC'), ZT = camp('CONCACAF')
  setDetentor(m, 'UCL', ZO)
  setDetentor(m, 'LIB', ZP)
  setDetentor(m, 'CAF', ZQ)
  setDetentor(m, 'AFC', ZR)
  setDetentor(m, 'OFC', ZS)
  setDetentor(m, 'CONCACAF', ZT)
  // ponytail: o original troca o campeão mexicano (país 131, convidado) da Libertadores; aqui o México não tem vaga
  if (ZO === null || ZP === null || ZQ === null || ZR === null || ZS === null || ZT === null) return
  const quatro = [ZQ, ZR, ZS, ZT]
  const PERM = [[2, 0, 3, 1], [3, 2, 1, 0], [0, 2, 3, 1]][rng.int(3)]!
  const c = competicao('MUN', 'Mundial Clubes', TIPO.mundial, 7)
  c.listas = { semi: [ZP, ZO] }
  preliminar(m, c, 150, PERM.map((i) => quatro[i]!), false, desde, 'Fase Preliminar')
  m.competicoes.push(c)
}

/** al (:95): campeão da Libertadores × vencedor 1, da Liga dos Campeões × vencedor 2; final e 3º lugar. */
function munAl(x: Ctx, c: Competicao, venc: number[], desde: number): void {
  const [ZP, ZO] = lista(c, 'semi')
  if (venc.length !== 2 || ZP === undefined || ZO === undefined) return
  c.colocacaoDesde = c.fases.length
  const f = criarFaseMataMata(x.m, c, [ZP, venc[0]!, ZO, venc[1]!], [false, false], desde)
  f.terceiro = true
  f.nomes = ['Semifinal', 'Final']
  c.fases.push(f)
}

/** Recopa: detentor da continental 2 recebe o da continental 1, ida e volta (f/e_0.java:29, f/d_0.java:29). */
function criarRecopa(m: Mundo, id: string, nome: string, conf: number, c1: string, c2: string): Competicao | null {
  const a = detentor(m, c1), b = detentor(m, c2)
  if (a === null || b === null || a === b) return null
  const c = competicao(id, nome, TIPO.recopa, conf)
  chave(m, c, [b, a], IDA, m.dia)
  return c
}

/** Supercopa (f/I.java:37, f_0.Z): campeão da Série A × campeão da Copa (ou o vice, se for o mesmo), jogo único. */
function criarSupercopa(m: Mundo): Competicao | null {
  const h = (id: string) => m.historico.find((x) => x.competicao === id && x.temporada === m.temporada - 1)
  const liga = h('BR-1')?.campeao ?? null, copa = h('CB')
  if (liga === null || !copa || copa.campeao === null) return null
  const outro = copa.campeao !== liga ? copa.campeao : copa.vice
  if (outro === null) return null
  const c = competicao('SUP-BRA', 'Supercopa - Brasil', TIPO.supercopa, BRA)
  chave(m, c, [liga, outro], [false], m.dia)
  return c
}

// ── Criação e despacho ────────────────────────────────────────────────────

/** As continentais da temporada, na ordem do p_0 (novo jogo) e do f_0.ae (virada): w, r, v, u, t, y, H, x, j_0. */
export function criarContinentais(m: Mundo, rng: Rng): Competicao[] {
  const x: Ctx = { m, rng, filas: new Map(), novas: [] }
  const add = (c: Competicao) => void x.novas.push(c)
  add(criarConfederacao(x, 'CONCACAF', 'Liga Campeões Concacaf', 4, CONCACAF_GRUPOS, 24, CONCACAF_POS, 8, 1, 4404))
  add(criarLibertadores(x))
  add(criarLigaCampeoes(x))
  add(criarConfederacao(x, 'AFC', 'Liga Campeões AFC', 3, AFC_GRUPOS, 40, AFC_POS, 10, 1, 1403))
  add(criarConfederacao(x, 'CAF', 'Liga Campeões CAF', 2, CAF_GRUPOS, 32, CAF_POS, 8, 2, 4204))
  add(criarConfederacao(x, 'OFC', 'Liga Campeões OFC', 5, OFC_GRUPOS, 8, OFC_POS, 2, 2, 4504))
  add(criarSulAmericana(x))
  add(criarLigaEuropa(x))
  add(criarConference(x))
  return x.novas
}

/**
 * Virada: os campeões que passam (f_0.ai), as continentais novas e as Recopas (f_0.ae), a Supercopa (f_0.Z). Chamada
 * depois do calendário novo e antes do acesso, com as competições do ano velho ainda em `m.competicoes`.
 */
export function competicoesInternacionaisDaVirada(m: Mundo, rng: Rng): Competicao[] {
  const camp = (id: string) => m.competicoes.find((c) => c.id === id)?.campeao ?? null
  // ai (:1219): campeão da Liga Europa → Liga dos Campeões; da Sul-Americana → Libertadores; da Conference → Liga Europa
  setDetentor(m, 'UCL:UEL', camp('UEL'))
  setDetentor(m, 'UEL', camp('UEL'))
  setDetentor(m, 'LIB:SUL', camp('SUL'))
  setDetentor(m, 'SUL', camp('SUL'))
  setDetentor(m, 'UEL:UECL', camp('UECL'))
  const novas = criarContinentais(m, rng)
  for (const c of [criarRecopa(m, 'RECOPA', 'Recopa Sul-Americana', 1, 'LIB', 'SUL'), criarRecopa(m, 'RECOPA-E', 'Recopa Europeia', 0, 'UCL', 'UEL'), criarSupercopa(m)])
    if (c) novas.push(c)
  return novas
}

type Mata = (x: Ctx, c: Competicao, venc: number[], perd: number[], desde: number) => void
type Grupos = (x: Ctx, c: Competicao, f: FaseLiga, desde: number) => void

const MATA: Record<number, Mata> = {
  4101: (x, c, v, _, d) => libG(x, c, v, d), 4102: (x, c, v, _, d) => preliminar(x.m, c, 4103, v, true, d, 'Preliminar Fase 3'), 4103: libI,
  6100: (x, c, v, _, d) => sulO(x, c, v, d),
  4000: (x, c, v, _, d) => uclAj(x, c, v, d), 4001: uclG, 4002: uclH, 4003: uclJ, 4004: uclK,
  6001: uelG, 6002: uelM,
  6006: (x, c, v, _, d) => oitavas(x, c, 6005, v, d),
  12001: (x, c, v, _, d) => ueclG(x, c, v, d), 12002: (x, c, v, _, d) => ueclH(x, c, v, d), 12003: (x, c, v, _, d) => ueclJ(x, c, v, d),
  12004: (x, c, v, _, d) => ueclM(x, c, v, d),
  12006: (x, c, v, _, d) => oitavas(x, c, 12005, v, d),
  150: (x, c, v, _, d) => munAl(x, c, v, d),
}
const GRUPOS: Record<number, Grupos> = {
  4104: libYt, 6105: sulYt, 4005: uclYt, 4204: cafKO, 1403: afcKO,
  6005: (x, c, f, d) => preOitavas(x, c, f, 'UCL', 4005, 6006, d),
  12005: (x, c, f, d) => preOitavas(x, c, f, 'UEL', 6005, 12006, d),
}

/**
 * Fim de uma fase das continentais com regra própria (os despachos por código de f/s.java:1040-1085 e f/g_0.java:345-410).
 * Devolve falso se a fase segue a regra genérica.
 */
export function fimDeFaseInternacional(m: Mundo, c: Competicao, f: FaseLiga | FaseMataMata, desde: number, rng: Rng): boolean {
  const x: Ctx = { m, rng, filas: new Map(), novas: [] }
  if (f.tipo === 'liga') {
    const h = GRUPOS[f.formato]
    if (!h) return false
    h(x, c, f, desde)
    return true
  }
  const h = MATA[f.formato]
  if (!h) return false
  // g_0.b: vencedores (aak) e perdedores (aal) da última rodada, na ordem dos confrontos
  const r = f.rodadas.at(-1)!
  h(x, c, [...r.vencedores], r.confrontos.map(([a, b], k) => (r.vencedores[k] === a ? b : a)), desde)
  return true
}
