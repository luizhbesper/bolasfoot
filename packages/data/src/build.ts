// ETL: original/ (gerado por tools/extract.sh) → packages/data/base.json.
// Base 2026 (docs/fase7.md): `node src/build.ts <pasta com teams.jsonl do mod> base-2026.json` troca só os times;
// países, UFs, ligas, estaduais, opções e nomes vêm do original (o mod roda no mesmo motor do 22-23).
// Fica de fora: Espanha (liga não portada). Ficam todos os outros estrangeiros, porque o Mundial
// (f/a_0.java:41-79) precisa dos campeões das 6 confederações.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import type { Base, ConfigEstadual, ConfigLiga, Jogador, Pais, Time, Uf } from './types.ts'

const ORIG = new URL('../../../original/', import.meta.url)
const [MOD, SAIDA = 'base.json'] = process.argv.slice(2)
const OUT = new URL(`../${SAIDA}`, import.meta.url)
const BRA = 29
const ESP = 65

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any
const read = (p: string) => readFileSync(new URL(p, ORIG), 'utf8').replace(/^\uFEFF/, '')
const jsonl = (p: string): Raw[] => read(p).split('\n').filter(Boolean).map((l) => JSON.parse(l))
const nfc = (s: string) => s.normalize('NFC').trim()
const camel = (k: string) => k[0]!.toLowerCase() + k.slice(1)

// Países: enum best/ac.java:13-236 → (P<idx>, CODIGO, idx, continente, nívelPaís, cores...)
const lang = new Map([...read('res/arquivos/default_lang.xml').matchAll(/<entry key="(\w+)">([^<]*)<\/entry>/g)].map((m) => [m[1]!, m[2]!]))
const paises: Pais[] = [...read('src/best/ac.java').matchAll(/getString\("P(\d+)"\), "(\w+)", (\d+), (-?\d+), (\d+)/g)].map((m) => ({
  id: +m[3]!,
  codigo: m[2]!,
  nome: nfc(lang.get(`P${m[1]}`) ?? m[2]!),
  continente: +m[4]!,
  nivel: +m[5]!,
}))
paises.forEach((p, i) => { if (p.id !== i) throw new Error(`país fora de ordem: ${p.codigo}`) })

// UFs: best/aq.java:555-557 (rX siglas, rY nomes, rZ gentílicos)
const aq = read('src/best/aq.java')
const strArray = (name: string): string[] => {
  const m = aq.match(new RegExp(`${name} = new String\\[\\]\\{([^}]*)\\}`))
  if (!m) throw new Error(`aq.${name} não encontrado`)
  return JSON.parse(`[${m[1]}]`)
}
const [siglas, nomesUf, gentilicos] = [strArray('rX'), strArray('rY'), strArray('rZ')]
const ufs: Uf[] = siglas.map((sigla, i) => ({ sigla, nome: nomesUf[i]!, gentilico: gentilicos[i]! }))

const jogador = (j: Raw): Jogador => ({
  nome: nfc(j.Nome),
  pais: j.Pais,
  idade: j.Idade,
  posicao: j.Posicao,
  lado: j.Lado,
  cr1: j.Cr1,
  cr2: j.Cr2,
  estrela: j.Estrela,
  craque: j.TopMundial,
  potencial: j.Hash,
  titular: j.Status === 1,
})

const timesBrutos: Raw[] = MOD ? readFileSync(`${MOD}/teams.jsonl`, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : jsonl('data/teams.jsonl')
/** Mod: o Brasil de Nivel ≥ 8 (~ Séries A–D e estaduais; o mod tem 830 times BR) e, de cada país, os de maior Nivel até a
 *  quantidade que o original tem nele (o mundo fica do mesmo tamanho). */
const cota = MOD ? jsonl('data/teams.jsonl').filter((t) => t.Valid && t.Vid === 185).reduce((m: Map<number, number>, t) => m.set(t.Pais, (m.get(t.Pais) ?? 0) + 1), new Map()) : new Map()
const ordemNivel = (t: Raw) => timesBrutos.filter((x) => x.Pais === t.Pais && x.Valid && x.Nivel > t.Nivel).length
const doMod = (t: Raw, i: number, todos: Raw[]) =>
  t.Pais === BRA ? t.Nivel >= 8 : ordemNivel(t) + todos.slice(0, i).filter((x) => x.Pais === t.Pais && x.Valid && x.Nivel === t.Nivel).length < (cota.get(t.Pais) ?? 0)
const times: Time[] = timesBrutos
  .filter((t, i, todos) => t.Valid && t.Vid === 185 && t.Pais !== ESP && (!MOD || doMod(t, i, todos))) // U.java:59
  .map((t) => ({
    fileRef: nfc(t.FileRef),
    nome: nfc(t.Nome),
    estadio: nfc(t.Estadio),
    capacidade: t.Capacidade,
    cor1: t.Cor1,
    cor2: t.Cor2,
    corBase: t.CorBase,
    pais: t.Pais,
    uf: t.Pais === BRA ? t.Estado : null,
    nivel: t.Nivel,
    reputacao: t.Reputacao,
    tecnico: nfc(t.Tecnico),
    tecNac: t.TecNac,
    jogadores: t.Jogadores.map(jogador),
    juniores: t.Juniores.map(jogador),
  }))
  .sort((a, b) => a.fileRef.localeCompare(b.fileRef))

const ligas: ConfigLiga[] = jsonl('data/ligas.jsonl')
  .flatMap((l) => l._f.a)
  .filter((c: Raw) => c.Pais === BRA)
  .map((c: Raw) => ({
    divisao: c.Divisao,
    nome: c.Nome2,
    nomeDivisao: c.NomeDivisao,
    nTimes: c.nTimes,
    nGrupos: c.nGrupos,
    nRebaixados: c.nRebaixados,
    rebaixadosDireto: c.RebaixadosDireto,
    doisTurnos: c.DoisTurnos,
    formula: c.Formula,
    desempate: c.Desempate,
    numeroTimesMataMata: c.NumeroTimesMataMata,
    vagasSobemPeloMataMata: c.VagasSobemPeloMataMata,
    playoffRebaixamento: c.PlayoffRebaixamento,
    jogosDentroGrupo: c.JogosDentroGrupo,
    rebaixadoPeloGrupo: c.RebaixadoPeloGrupo,
    classificaPeloGeral: c.ClassificaPeloGeral,
    melhoresTerceiros: c.MelhoresTerceiros,
    duasVoltasMataMata: c.DuasVoltasMataMata,
    duasVoltasMataMataSobe: c.DuasVoltasMataMataSobe,
    duasVoltasPlayoffReb: c.DuasVoltasplayoffReb,
  }))

const estaduais: ConfigEstadual[] = jsonl('data/estaduais.jsonl')
  .flatMap((l) => l._f.a)
  .map((c: Raw) => ({
    uf: c.Id,
    divisao: c.Divisao,
    formula: c.Formula,
    nRebaixados: c.nRebaixados,
    desempate: c.Desempate,
    finaisIdaVolta: c.FinaisIdaVoltaFormatado,
  }))

const { _class, _f, ...rawOpcoes } = jsonl('data/options.jsonl')[0]
void _class
void _f
const opcoes = Object.fromEntries(Object.entries(rawOpcoes).map(([k, v]) => [camel(k), v]))

// Nomes: todo país que aparece em time ou jogador. Arquivos são por código (m_0.java:113-120).
const lines = (p: string) => read(p).split(/\r?\n/).map(nfc).filter(Boolean)
const usados = new Set(times.flatMap((t) => [t.pais, ...t.jogadores.map((j) => j.pais), ...t.juniores.map((j) => j.pais)]))
const nomes: Base['nomes'] = {}
for (const id of [...usados].sort((a, b) => a - b)) {
  const { codigo } = paises[id]!
  const f = (dir: string) => `res/arquivos/${dir}/${codigo}.txt`
  if (!existsSync(new URL(f('names'), ORIG))) continue
  nomes[codigo] = { nomes: lines(f('names')), sobrenomes: lines(f('surnames')) }
}

const base: Base = { paises, ufs, times, ligas, estaduais, opcoes, nomes }
writeFileSync(OUT, JSON.stringify(base) + '\n')
console.log(`${SAIDA}: ${times.length} times, ${paises.length} países, ${Object.keys(nomes).length} listas de nomes`)
