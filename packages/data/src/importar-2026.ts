// B3 (docs/fase7.md): base 2026 = os elencos de 15/01/2026 do Transfermarkt no contrato de types.ts → base-2026.json.
// Entrada: clubes-2026.json (B2), o transfermarkt-api local (tm.ts) e o dataset dcaribou em data-cache/tm-datasets
// (avaliações datadas). O que o TM não tem é calibrado pela própria base 2022 (distribuições de nivel, reputação,
// potencial e características), para o motor ver números da mesma faixa. Escreve também data-cache/diff-2026.md.
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import type { Clube } from './clubes-2026.ts'
import { paisDoTm, tm } from './tm.ts'
import { novoJogo } from '../../engine/src/mundo.ts'
import type { Base, Jogador, Posicao, Time } from './types.ts'

const DATA = new URL('../', import.meta.url)
const CACHE = new URL('../../../data-cache/', import.meta.url)
const BASE: Base = JSON.parse(readFileSync(new URL('base.json', DATA), 'utf8'))
const { clubes, mantidos }: { clubes: Clube[]; mantidos: string[] } = JSON.parse(readFileSync(new URL('clubes-2026.json', DATA), 'utf8'))
const BRA = 29
const DIA = '2026-01-15'
const TEMPORADA = 2025 // ver clubes-2026.ts
const MIN_ELENCO = 18

/** Sorteio determinístico por chave: o mesmo arquivo sai igual a cada execução (diff limpo). */
const sorte = (k: string) => {
  let x = 2166136261
  for (let i = 0; i < k.length; i++) x = Math.imul(x ^ k.charCodeAt(i), 16777619)
  x ^= x >>> 15; x = Math.imul(x, 2246822507); x ^= x >>> 13
  return (x >>> 0) / 2 ** 32
}
/** Quantil: a i-ésima de n posições (0 = maior) na distribuição `ref` ordenada do maior para o menor. */
const quantil = <T>(ref: T[], i: number, n: number) => ref[Math.min(ref.length - 1, Math.floor((i * ref.length) / n))]!

// --- valor de mercado em 15/01/2026 --------------------------------------------------------------------------------------
const valorDataset = new Map<string, [string, number]>()
for (const l of gunzipSync(readFileSync(new URL('tm-datasets/player_valuations.csv.gz', CACHE))).toString().split('\n').slice(1)) {
  const [id, data, v] = l.replaceAll('"', '').split(',', 3)
  if (!id || !data || data > DIA) continue
  const atual = valorDataset.get(id)
  if (!atual || atual[0] < data) valorDataset.set(id, [data, Number(v)])
}

// --- posição, lado e características -------------------------------------------------------------------------------------
/** posição do TM → [posicao, lado (0 direito, 1 esquerdo, null = sorteio), características preferidas] */
const POS: Record<string, [Posicao, number | null, number[]]> = {
  Goalkeeper: [0, null, []], 'Centre-Back': [2, null, [5, 10]], 'Left-Back': [1, 1, [6, 13]], 'Right-Back': [1, 0, [6, 13]],
  'Defensive Midfield': [3, null, [7, 10]], 'Central Midfield': [3, null, [11, 4]], 'Attacking Midfield': [3, null, [4, 8]],
  'Left Midfield': [3, 1, [6, 13]], 'Right Midfield': [3, 0, [6, 13]], 'Left Winger': [4, 1, [8, 13]], 'Right Winger': [4, 0, [8, 13]],
  'Second Striker': [4, null, [8, 9]], 'Centre-Forward': [4, null, [9, 5]], Defender: [2, null, []], Midfield: [3, null, []], Attack: [4, null, []],
}
const todos2022 = BASE.times.flatMap((t) => t.jogadores)
/** pares (cr1, cr2) do original por posição, com a frequência */
const PARES = ([0, 1, 2, 3, 4] as const).map((p) => {
  const m = new Map<string, number>()
  for (const j of todos2022) if (j.posicao === p) m.set(`${j.cr1},${j.cr2}`, (m.get(`${j.cr1},${j.cr2}`) ?? 0) + 1)
  return [...m].map(([k, n]) => [...k.split(',').map(Number), n] as [number, number, number])
})
function caracteristicas(posicao: Posicao, pref: number[], k: string): [number, number] {
  const peso = PARES[posicao]!.map(([a, b, n]) => n * (1 + 3 * +pref.includes(a) + +pref.includes(b)))
  let r = sorte(k) * peso.reduce((s, x) => s + x, 0)
  for (const [i, w] of peso.entries()) if ((r -= w) < 0) return [PARES[posicao]![i]![0], PARES[posicao]![i]![1]]
  return [PARES[posicao]![0]![0], PARES[posicao]![0]![1]]
}
const POTENCIAL_2022 = todos2022.map((j) => j.potencial).sort((a, b) => b - a)

// --- elencos -----------------------------------------------------------------------------------------------------------
interface JogadorTm {
  id: string; name: string; position?: string; dateOfBirth?: string | null; nationality?: string[]; height?: number | null
  joinedOn?: string | null; marketValue?: number | null
}
const paisDe = paisDoTm(BASE.paises)
const original = new Map(BASE.times.map((t) => [t.fileRef, t]))
const idade = (nasc: string | null | undefined) => {
  const i = nasc ? 2025 - Number(nasc.slice(0, 4)) + +(nasc.slice(5) <= '01-01') : NaN
  return i >= 15 && i <= 45 ? i : 25 // sem data ou data errada no TM
}

interface Bruto extends Jogador { valor: number; id: string }
const avisos: string[] = []

async function elenco(c: Clube): Promise<Bruto[]> {
  const lista = async (q: string) => (await tm<{ players: JogadorTm[] }>(`/clubs/${c.tm}/players${q}`).catch(() => ({ players: [] }))).players
  const atual = new Map((await lista('')).map((j) => [j.id, j]))
  const daTemporada = await lista(`?season_id=${TEMPORADA}`)
  const base = (daTemporada.length ? daTemporada : [...atual.values()]).filter((j) => !j.joinedOn || j.joinedOn <= DIA)
  const js: Bruto[] = base.map((j) => {
    const [posicao, lado, pref] = POS[j.position ?? ''] ?? POS.Midfield!
    const [cr1, cr2] = caracteristicas(posicao, (j.height ?? 0) >= 188 && posicao !== 0 ? [...pref, 5] : pref, j.id)
    return {
      id: j.id, nome: j.name.normalize('NFC'), pais: paisDe(j.nationality?.[0] ?? '') ?? c.pais, idade: idade(j.dateOfBirth),
      posicao, lado: lado ?? +(sorte(j.id + 'lado') < 0.5), cr1, cr2, estrela: false, craque: false, potencial: 0, titular: false,
      valor: valorDataset.get(j.id)?.[1] ?? atual.get(j.id)?.marketValue ?? 0,
    }
  })
  // valor desconhecido: metade do menor valor conhecido do elenco
  const minimo = Math.min(...js.map((j) => j.valor).filter((v) => v > 0), 50_000)
  for (const j of js) if (!j.valor) j.valor = minimo / 2
  completar(c, js)
  return js
}

/** Elenco curto (clube pequeno sem dados no TM): primeiro os do elenco do original que não estão na lista, depois
 *  jogadores gerados com os nomes do país, como o original faz. */
function completar(c: Clube, js: Bruto[]) {
  const doTm = js.length
  const minimo0 = Math.min(...js.map((j) => j.valor), 50_000) / 2
  const temNome = new Set(js.map((j) => j.nome))
  for (const [i, j] of (original.get(c.fileRef)?.jogadores ?? []).entries()) {
    if (js.length >= MIN_ELENCO && js.filter((x) => x.posicao === 0).length >= 2) break
    if (!temNome.has(j.nome) && (js.length < MIN_ELENCO || j.posicao === 0)) js.push({ ...j, idade: j.idade + 3, id: `${c.tm}:original:${i}`, valor: minimo0 })
  }
  const nomes = BASE.nomes[BASE.paises[c.pais]!.codigo] ?? BASE.nomes.BRA!
  const precisa = (p: Posicao) => js.filter((j) => j.posicao === p).length
  const FORMA: Posicao[] = [0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 1, 2, 3]
  const geradosAntes = js.length
  for (let i = 0; js.length < MIN_ELENCO || precisa(0) < 2; i++) {
    const posicao = precisa(0) < 2 ? 0 : FORMA[i % FORMA.length]!
    const k = `${c.tm}:gerado:${i}`
    const pick = (l: string[], s: string) => l[Math.floor(sorte(k + s) * l.length)]!
    const [cr1, cr2] = caracteristicas(posicao, [], k)
    js.push({
      id: k, nome: `${pick(nomes.nomes, 'n')} ${pick(nomes.sobrenomes, 's')}`, pais: c.pais, idade: 18 + Math.floor(sorte(k + 'i') * 15),
      posicao, lado: +(sorte(k + 'l') < 0.5), cr1, cr2, estrela: false, craque: false, potencial: 0, titular: false,
      valor: Math.min(...js.map((j) => j.valor), 50_000) / 2,
    })
  }
  if (js.length > doTm) avisos.push(`${c.fileRef}: ${geradosAntes - doTm} do original e ${js.length - geradosAntes} gerados (${doTm} do TM)`)
}

/** Os 11 de maior valor numa formação 1-2-2-4-2 (sobra vai para o melhor de linha). */
function titulares(js: Bruto[]) {
  const vagas = [1, 2, 2, 4, 2]
  const ordem = [...js].sort((a, b) => b.valor - a.valor)
  let n = 0
  for (const j of ordem) if (vagas[j.posicao]! > 0) { vagas[j.posicao]!--; j.titular = true; n++ }
  for (const j of ordem) if (n < 11 && !j.titular && j.posicao !== 0) { j.titular = true; n++ }
}

// --- times ------------------------------------------------------------------------------------------------------------
const perfil = (c: Clube) => tm<{ stadiumName?: string; stadiumSeats?: number; coach?: { name?: string } }>(`/clubs/${c.tm}/profile`)
const ufIdx = new Map(BASE.ufs.map((u, i) => [u.sigla, i]))
const PALETA = ['#d32f2f', '#1565c0', '#2e7d32', '#000000', '#ffffff', '#f9a825', '#6a1b9a', '#ef6c00', '#00838f', '#5d4037']

// Baixa tudo antes, 6 por vez (sequencial, as ~1000 listas levariam horas); depois o cache responde.
const fila = clubes.flatMap((c) => [`/clubs/${c.tm}/players`, `/clubs/${c.tm}/players?season_id=${TEMPORADA}`, `/clubs/${c.tm}/profile`])
await Promise.all(Array.from({ length: 6 }, async () => {
  for (let p = fila.shift(); p; p = fila.shift()) await tm(p).catch(() => undefined)
}))

const brutos = new Map<Clube, Bruto[]>()
for (const c of clubes) brutos.set(c, await elenco(c))

// estrela: os de maior valor no mundo, na mesma quantidade do original (craque fica falso, como no original)
const nEstrelas = todos2022.filter((j) => j.estrela).length
for (const j of [...brutos.values()].flat().sort((a, b) => b.valor - a.valor).slice(0, nEstrelas)) j.estrela = true
// potencial: quantil do valor entre os da mesma faixa de idade, na distribuição do original
const faixa = (i: number) => (i <= 20 ? 0 : i <= 23 ? 1 : i <= 26 ? 2 : i <= 29 ? 3 : 4)
for (let f = 0; f < 5; f++) {
  const grupo = [...brutos.values()].flat().filter((j) => faixa(j.idade) === f).sort((a, b) => b.valor - a.valor)
  grupo.forEach((j, i) => { j.potencial = quantil(POTENCIAL_2022, i, grupo.length) })
}
for (const js of brutos.values()) titulares(js)

// força (B4): ranking do valor ajustado pela idade (o veterano vale menos com a mesma bola), no mundo inteiro,
// casado com a distribuição de força que o novoJogo dá aos profissionais na base 2022.
// ponytail: fatores de idade no olho; calibrar contra notas reais se a força dos veteranos destoar.
const FATOR_IDADE = (i: number) => (i <= 19 ? 0.5 : i <= 21 ? 0.65 : i <= 23 ? 0.85 : i <= 28 ? 1 : i <= 30 ? 1.3 : i <= 32 ? 1.8 : 2.5)
const FORCA_2022 = novoJogo(BASE, { habilidadeIndividual: false }, 'calibragem-2026').jogadores
  .filter((j) => !j.juvenil).map((j) => j.forca).sort((a, b) => b - a)
const porQualidade = [...brutos.values()].flat().sort((a, b) => b.valor * FATOR_IDADE(b.idade) - a.valor * FATOR_IDADE(a.idade))
porQualidade.forEach((j, i) => { j.forca = quantil(FORCA_2022, i, porQualidade.length) })

// nivel e reputação: quantil do valor do elenco dentro do país, na distribuição do original no mesmo país
const valorElenco = (c: Clube) => brutos.get(c)!.reduce((s, j) => s + j.valor, 0)
const nivel = new Map<Clube, [number, number]>()
for (const pais of new Set(clubes.map((c) => c.pais))) {
  const doPais = clubes.filter((c) => c.pais === pais).sort((a, b) => valorElenco(b) - valorElenco(a))
  const ref = BASE.times.filter((t) => t.pais === pais)
  const niveis = ref.map((t) => t.nivel).sort((a, b) => b - a), reps = ref.map((t) => t.reputacao).sort((a, b) => b - a)
  doPais.forEach((c, i) => nivel.set(c, [quantil(niveis, i, doPais.length), quantil(reps, i, doPais.length)]))
}

const times: Time[] = []
for (const c of clubes) {
  const o = original.get(c.fileRef)
  const p = await perfil(c)
  const cor = Math.floor(sorte(c.tm + 'cor') * PALETA.length)
  times.push({
    fileRef: c.fileRef, nome: c.nome, estadio: p.stadiumName ?? o?.estadio ?? '', capacidade: p.stadiumSeats ?? o?.capacidade ?? 10000,
    // ponytail: clube novo ganha cores sorteadas; B8 tira do escudo
    cor1: o?.cor1 ?? PALETA[cor]!, cor2: o?.cor2 ?? PALETA[(cor + 3) % PALETA.length]!, corBase: o?.corBase ?? 0,
    pais: c.pais, uf: c.uf === null ? null : ufIdx.get(c.uf)!, nivel: nivel.get(c)![0], reputacao: nivel.get(c)![1],
    tecnico: p.coach?.name ?? o?.tecnico ?? '', tecNac: c.pais,
    jogadores: brutos.get(c)!.sort((a, b) => a.posicao - b.posicao || b.valor - a.valor).map((j): Jogador => { const { id, valor, ...resto } = j; void id; void valor; return resto }),
    juniores: [],
  })
}
for (const f of mantidos) times.push(original.get(f)!)
times.sort((a, b) => a.fileRef.localeCompare(b.fileRef))

const base: Base = { ...BASE, times }
writeFileSync(new URL('base-2026.json', DATA), JSON.stringify(base))

// --- diff contra a 2022, para revisar ----------------------------------------------------------------------------------
const linhas = ['# Base 2026 × 2022', '']
for (const t of times.filter((t) => t.pais === BRA)) {
  const o = original.get(t.fileRef)
  const novos = t.jogadores.map((j) => j.nome)
  if (!o) { linhas.push(`## ${t.nome} (${t.fileRef}) — novo, nivel ${t.nivel}`, novos.join(', '), ''); continue }
  const velhos = new Set(o.jogadores.map((j) => j.nome))
  const ficaram = novos.filter((n) => velhos.has(n))
  linhas.push(`## ${t.nome} — nivel ${o.nivel} → ${t.nivel}, reputação ${o.reputacao} → ${t.reputacao}`,
    `entraram: ${novos.filter((n) => !velhos.has(n)).join(', ')}`, `saíram: ${[...velhos].filter((n) => !novos.includes(n)).join(', ')}`,
    `ficaram: ${ficaram.length}`, '')
}
writeFileSync(new URL('diff-2026.md', CACHE), linhas.join('\n'))

const br = times.filter((t) => t.pais === BRA)
const media = (xs: number[]) => (xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(1)
console.log(`base-2026.json: ${times.length} times (${br.length} BR), ${times.reduce((s, t) => s + t.jogadores.length, 0)} jogadores`)
console.log(`por time ${media(times.map((t) => t.jogadores.length))}; idade ${media(times.flatMap((t) => t.jogadores.map((j) => j.idade)))}; estrelas: ${times.flatMap((t) => t.jogadores.filter((j) => j.estrela).map((j) => `${j.nome} (${t.nome})`)).join(', ')}`)
console.log(`força: top ${porQualidade.slice(0, 8).map((j) => `${j.nome} ${j.forca}`).join(', ')}`)
for (const nome of ['Flamengo', 'Palmeiras', 'Remo', 'Real Madrid', 'Manchester City']) {
  const t = times.find((x) => x.nome === nome)
  if (t) console.log(`${nome}: 11 melhores ${media(t.jogadores.map((j) => j.forca!).sort((a, b) => b - a).slice(0, 11))}`)
}
console.log(`Série A por nivel: ${br.sort((a, b) => b.nivel - a.nivel).slice(0, 20).map((t) => `${t.nome} ${t.nivel}`).join(', ')}`)
for (const a of avisos) console.log(a)
