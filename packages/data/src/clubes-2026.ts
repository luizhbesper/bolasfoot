// B2 (docs/fase7.md): o mapa dos clubes da base 2026 → packages/data/clubes-2026.json, para revisar à mão.
// Brasil: Séries A–D, Copa do Brasil e a 1ª divisão dos 27 estaduais de 2026. Estrangeiros: as ligas de LIGAS, com no
// máximo o número de times que o original tem no país, mais os de Libertadores, Sul-Americana e Recopa. País sem liga
// aqui fica com os times do original (`mantidos`).
// Clube que já existe no original mantém o fileRef (escudo, escolha de time, GRUPOS_SP); ver MANUAL para as correções.
import { readFileSync, writeFileSync } from 'node:fs'
import { norm, paisDoTm, tm } from './tm.ts'
import type { Base, Time } from './types.ts'

const BASE: Base = JSON.parse(readFileSync(new URL('../base.json', import.meta.url), 'utf8'))
const OUT = new URL('../clubes-2026.json', import.meta.url)
const BRA = 29
/** O TM chama a temporada brasileira de 2026 de "2025", como a europeia 25/26. */
const TEMPORADA = 2025

const SERIES = ['BRA1', 'BRA2', 'BRA3', 'BRA4']
const ESTADUAIS: Record<string, string> = {
  AC: 'BRAC', AL: 'BRAL', AM: 'BRAM', AP: 'BRAP', BA: 'BRCB', CE: 'BRCE', DF: 'BRDF', ES: 'BRES', GO: 'BRGO',
  MA: 'BRMA', MG: 'BRCM', MS: 'BRMT', MT: 'BRMS', PA: 'BRPA', PB: 'BRPB', PE: 'BRPE', PI: 'BRPI', PR: 'BRPR',
  RJ: 'BRCG', RN: 'BRRN', RO: 'BRRD', RR: 'BRRR', RS: 'BRRS', SC: 'BRSC', SE: 'BRSE', SP: 'BCP1', TO: 'BRTO',
}
const CONTINENTAIS = ['CLI', 'CS', 'RECO']
/** 1ª divisão de cada país (sem a Espanha, fora desde a F0). */
const LIGAS = [
  'ARG1', 'COL1', 'CLPD', 'URU1', 'PR1A', 'TDeA', 'EC1N', 'BO1A', 'VZ1A', 'MEX1', 'MLS1',
  'GB1', 'IT1', 'L1', 'FR1', 'PO1', 'NL1', 'BE1', 'TR1', 'SC1', 'A1', 'C1', 'DK1', 'NO1', 'SE1', 'PL1', 'TS1',
  'GR1', 'KR1', 'SER1', 'RO1', 'RU1', 'UKR1', 'SA1', 'JAP1', 'RSK1', 'AUS1',
]

/** id do TM → fileRef do original (ou null: clube novo), quando o casamento por nome erra. */
const MANUAL: Record<string, string | null> = { 46: 'inter_it', 10560: 'brasilpelotas_bra', 60520: 'operariovg_mt', 96024: 'sinop_mt' }
/** nome curto do TM → fileRef do original, para os nomes que o original traduziu (vale só no mesmo país). */
const MANUAL_NOME: Record<string, string> = {
  'Bayern Munich': 'bayern_ale', Leverkusen: 'bayerleverkusen_ale', 'Rapid Vienna': 'rapidviena_aut', Copenhagen: 'copenhague_din',
  'AEK Athens': 'aek_gre', 'Bodø/Glimt': 'bodoglimt_nor', 'Viking FK': 'viking_nor', Braga: 'sportingbraga_por',
  'Slavia Prague': 'slavia_cze', 'Sparta Praha': 'sparta_tch', FCSB: 'steua_bucaresti_rom', 'Red Star': 'estrelavermelha_ser',
  'Dynamo Kyiv': 'dinamokiev_ucr', 'Barcelona SC': 'barcelona_equ', 'Uni. Católica': 'univcatolicaquito_equ',
  'U. de Chile': 'universidadchile_chi', 'Junior FC': 'junior_col', 'Ind. Petrolero': 'indeppetro_ba_bol',
  'Liverpool FC': 'liverpool_uru', 'Mvd City Torque': 'montevideotorque_uru',
}
/** id do TM → nome, quando o nome curto do TM confunde. */
const NOME_MANUAL: Record<string, string> = { 616: 'Inter-SM' }
/** id do TM → UF, para clube novo fora dos estaduais. */
const UF_MANUAL: Record<string, string> = { 46022: 'AM', 94182: 'AM', 55335: 'SP' }

const SEM_VALOR = new Set(['ec', 'se', 'sc', 'cr', 'ca', 'aa', 'fc', 'ac', 'ad', 'ae', 'ge', 'ser', 'fbc', 'clube', 'club', 'esporte', 'futebol', 'de', 'do', 'da'])
/** Nome sem prefixos de tipo de clube, sem "de/do/da" e sem a UF entre parênteses: "EC Bahia" = "Bahia". */
const SIGLAS = new Set(BASE.ufs.map((u) => u.sigla))
/** UF no fim do nome: "Água Santa-SP", "Ituano (SP)". */
const ufDoNome = (s: string) => { const m = s.match(/(?:-|\()([A-Z]{2})\)?$/); return m && SIGLAS.has(m[1]!) ? m[1]! : null }
const limpo = (s: string) => {
  const r = s.replace(/(?:-|\s*\()([A-Z]{2})\)?$/, (x, uf: string) => (SIGLAS.has(uf) ? '' : x)).replace(/\bAtl\./g, 'Atlético').replace(/\s*\(\w\w\)$/, '').split(/[\s-]+/).filter((w) => !SEM_VALOR.has(norm(w))).map(norm).join('')
  return r || norm(s)
}

interface Perfil {
  id: string; name: string; shortName?: string; officialName?: string; currentMarketValue?: number
  addressLine2?: string; stadium?: { addressLine2?: string }; league?: { countryName?: string }
}
export interface Clube {
  tm: string
  nome: string
  fileRef: string
  /** não existe no original */
  novo: boolean
  pais: number
  uf: string | null
  /** 1–4 = Série A–D; 0 = fora das séries */
  divisao: number
  /** id do TM do estadual (1ª divisão) */
  estadual: string | null
  copa: boolean
  continentais: string[]
  /** valor de mercado do elenco hoje, em euros (só para ordenar) */
  valor: number
}

const clubesDe = async (comp: string): Promise<string[]> =>
  (await tm<{ clubs: { id: string }[] }>(`/competitions/${comp}/clubs?season_id=${TEMPORADA}`)).clubs.map((c) => c.id)

const paisDe = paisDoTm(BASE.paises)
const ufPorNome = new Map(BASE.ufs.map((u) => [norm(u.nome), u.sigla]))
const ufDoEndereco = (p: Perfil) => {
  const txt = norm(`${p.stadium?.addressLine2 ?? ''} ${p.addressLine2 ?? ''}`)
  return [...ufPorNome].find(([nome]) => txt.includes(nome))?.[1] ?? null
}

/** Fora dos estaduais: a UF do time do original com o mesmo nome. */
const ufDoOriginal = (p: Perfil) => {
  const sufixo = ufDoNome(p.shortName ?? p.name) ?? ufDoNome(p.name)
  if (sufixo) return sufixo
  const t = p.id in MANUAL ? BASE.times.find((x) => x.fileRef === MANUAL[p.id]) : BASE.times.find((x) => x.pais === BRA && limpo(x.nome) === limpo(p.shortName ?? p.name))
  return t ? BASE.ufs[t.uf!]!.sigla : (UF_MANUAL[p.id] ?? null)
}

// --- quem entra --------------------------------------------------------------------------------------------------------
const ids = new Set<string>()
const divisao = new Map<string, number>()
const estadual = new Map<string, [string, string]>() // id → [uf, comp]
const copa = new Set(await clubesDe('BRC'))
const continentais = new Map<string, string[]>()
for (const [i, s] of SERIES.entries()) for (const id of await clubesDe(s)) { divisao.set(id, i + 1); ids.add(id) }
for (const [uf, comp] of Object.entries(ESTADUAIS)) for (const id of await clubesDe(comp)) { estadual.set(id, [uf, comp]); ids.add(id) }
for (const id of copa) ids.add(id)
for (const c of CONTINENTAIS) for (const id of await clubesDe(c)) { continentais.set(id, [...(continentais.get(id) ?? []), c]); ids.add(id) }
const daLiga = new Map<string, string>()
for (const l of LIGAS) for (const id of await clubesDe(l)) daLiga.set(id, l)
const paisDaLiga = new Map<string, string>() // perfil sem liga (ex.: Mazatlán) usa o país dos outros da mesma liga

const perfis = new Map<string, Perfil>()
for (const id of new Set([...ids, ...daLiga.keys()])) {
  const p = await tm<Perfil>(`/clubs/${id}/profile`)
  perfis.set(id, p)
  const l = daLiga.get(id)
  if (l && p.league?.countryName) paisDaLiga.set(l, p.league.countryName)
}

// --- país, UF e casamento com o original --------------------------------------------------------------------------------
const problemas: string[] = []
const originais = new Map<number, Time[]>()
for (const t of BASE.times) originais.set(t.pais, [...(originais.get(t.pais) ?? []), t])
const usados = new Set<string>()

function casar(p: Perfil, pais: number, uf: string | null): Time | undefined {
  if (p.id in MANUAL) return BASE.times.find((t) => t.fileRef === MANUAL[p.id])
  const porNome = BASE.times.find((t) => t.fileRef === MANUAL_NOME[p.shortName ?? ''] && t.pais === pais)
  if (porNome) return porNome
  const cands = (originais.get(pais) ?? []).filter((t) => !usados.has(t.fileRef) && (uf === null || BASE.ufs[t.uf!]!.sigla === uf))
  const curto = norm(p.shortName ?? p.name)
  const longos = [p.name, p.officialName ?? ''].map(norm)
  const exato = cands.filter((t) => norm(t.nome) === curto || limpo(t.nome) === limpo(p.shortName ?? p.name))
  if (exato.length === 1) return exato[0]
  const parecidos = cands.filter((t) => {
    const n = norm(t.nome)
    return n.length >= 3 && (curto.startsWith(n) || n.startsWith(curto) || (n.length >= 6 && longos.some((l) => l.includes(n))))
  })
  if (parecidos.length === 1) return parecidos[0]
  if (parecidos.length > 1) problemas.push(`ambíguo: ${p.id} ${p.name} → ${parecidos.map((t) => t.fileRef).join(', ')}`)
  return undefined
}

const slug = (p: Perfil, pais: number, uf: string | null) =>
  norm(NOME_MANUAL[p.id] ?? p.shortName ?? p.name) + '_' + (uf ? uf.toLowerCase() : BASE.paises[pais]!.codigo.toLowerCase())

function clube(id: string): Clube | undefined {
  const p = perfis.get(id)!
  const pais = paisDe(p.league?.countryName ?? paisDaLiga.get(daLiga.get(id) ?? '') ?? '') ?? (ids.has(id) && !continentais.has(id) ? BRA : undefined)
  if (pais === undefined) { problemas.push(`sem país: ${id} ${p.name} (${p.league?.countryName})`); return undefined }
  const uf = pais === BRA ? (estadual.get(id)?.[0] ?? ufDoOriginal(p) ?? ufDoEndereco(p)) : null
  if (pais === BRA && !uf) problemas.push(`sem UF: ${id} ${p.name}`)
  const orig = casar(p, pais, uf)
  if (orig) usados.add(orig.fileRef)
  return {
    tm: id, nome: NOME_MANUAL[id] ?? orig?.nome ?? p.shortName ?? p.name, fileRef: orig?.fileRef ?? slug(p, pais, uf), novo: !orig, pais, uf,
    divisao: divisao.get(id) ?? 0, estadual: estadual.get(id)?.[1] ?? null, copa: copa.has(id),
    continentais: continentais.get(id) ?? [], valor: p.currentMarketValue ?? 0,
  }
}

// Brasileiros e participantes continentais entram todos; das ligas, o top por valor até a cota do original no país.
const clubes = [...ids].map(clube).filter((c) => c !== undefined)
const porPais = new Map<number, Clube[]>()
for (const id of daLiga.keys()) {
  if (ids.has(id)) continue
  const c = clube(id)
  if (c) porPais.set(c.pais, [...(porPais.get(c.pais) ?? []), c])
}
for (const [pais, cs] of porPais) {
  const cota = Math.max(0, (originais.get(pais)?.length ?? 0) - clubes.filter((c) => c.pais === pais).length)
  for (const c of cs.sort((a, b) => b.valor - a.valor).slice(0, cota)) clubes.push(c)
  for (const c of cs.slice(cota)) if (!c.novo) usados.delete(c.fileRef) // ficou de fora: o original não foi usado
}
const cobertos = new Set(clubes.map((c) => c.pais))
const mantidos = BASE.times.filter((t) => t.pais !== BRA && !cobertos.has(t.pais)).map((t) => t.fileRef)

const repetidos = clubes.filter((c, i) => clubes.findIndex((x) => x.fileRef === c.fileRef) !== i)
for (const c of repetidos) problemas.push(`fileRef repetido: ${c.fileRef} (${c.tm})`)
clubes.sort((a, b) => a.pais - b.pais || (a.uf ?? '').localeCompare(b.uf ?? '') || a.fileRef.localeCompare(b.fileRef))
writeFileSync(OUT, JSON.stringify({ clubes, mantidos }, null, 1) + '\n')

const br = clubes.filter((c) => c.pais === BRA)
console.log(`clubes-2026.json: ${clubes.length} clubes (${br.length} BR, ${br.filter((c) => c.novo).length} novos), ${mantidos.length} estrangeiros mantidos do original`)
console.log(`séries: ${[1, 2, 3, 4].map((d) => br.filter((c) => c.divisao === d).length).join('/')}; copa ${br.filter((c) => c.copa).length}; continentais ${clubes.filter((c) => c.continentais.length).length}`)
for (const p of problemas) console.log(p)
for (const c of br.filter((c) => c.novo)) console.log(`novo: ${c.tm} ${c.nome} ${c.uf} → ${c.fileRef}`)
for (const t of BASE.times.filter((t) => t.pais === BRA && !usados.has(t.fileRef))) console.log(`original fora: ${t.fileRef} ${t.nome} ${BASE.ufs[t.uf!]!.sigla} nivel ${t.nivel}`)
