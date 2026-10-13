// pnpm sim [--n 10000] [--seed x] [--divisao 1] [--habilidade] [--ref packages/engine/src/ref-original.json]
// pnpm sim --temporadas 10 [--mundos 5] [--saida x.json]: temporadas completas (gate da Fase 2), uma linha por temporada.
// Simula N partidas só da IA e imprime as métricas (lado a lado com o original, se houver referência).
// --oraculo <jsonl> --saida <json>: converte a saída do tools/Oracle.java em referência (usado por tools/oracle.sh).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { metricas, resumo, simularLote, simularTemporadas, type Metricas } from './src/estatisticas.ts'

const { values } = parseArgs({
  options: {
    n: { type: 'string', default: '10000' },
    seed: { type: 'string', default: 'sim' },
    divisao: { type: 'string', default: '1' },
    habilidade: { type: 'boolean', default: false },
    ref: { type: 'string', default: new URL('./src/ref-original.json', import.meta.url).pathname },
    oraculo: { type: 'string' },
    saida: { type: 'string' },
    temporadas: { type: 'string' },
    mundos: { type: 'string', default: '1' },
  },
})

if (values.temporadas) {
  const todos = []
  for (let k = 0; k < +values.mundos; k++) {
    const seed = `${values.seed}-${k + 1}`
    const t0 = performance.now()
    const r = simularTemporadas(+values.temporadas, seed)
    console.log(`mundo ${seed}: ${r.length} temporadas em ${Math.round(performance.now() - t0)} ms`)
    for (const x of r)
      console.log(`  T${x.temporada} A:${x.campeoes.A} CB:${x.campeoes.CB} ρ=${x.spearmanA} gols=${x.golsJogo} top11=${x.forcaTop11.join('/')} piloto ${x.piloto.time ?? 'desempregado'} ${x.piloto.posicao ?? '-'}º caixa ${(x.piloto.caixa / 1e6).toFixed(1)}M${x.piloto.demissoes ? ' (demitido)' : ''}`)
    todos.push({ seed, temporadas: r })
  }
  if (values.saida) writeFileSync(values.saida, JSON.stringify(todos))
  process.exit(0)
}

if (values.oraculo) {
  const jogos = readFileSync(values.oraculo, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const ref = { fonte: 'tools/oracle.sh (Brasfoot 22-23 original)', metricas: metricas(jogos) }
  writeFileSync(values.saida!, JSON.stringify(ref, null, 2) + '\n')
  console.log(ref)
  process.exit(0)
}

const t0 = performance.now()
const m = metricas(simularLote(+values.n, values.seed, +values.divisao, { habilidadeIndividual: values.habilidade }).map(resumo))
const ms = Math.round(performance.now() - t0)
const ref: Metricas | null = existsSync(values.ref) ? JSON.parse(readFileSync(values.ref, 'utf8')).metricas : null

const plano = (o: object, pre = ''): [string, number][] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? plano(v, `${pre}${k}.`) : [[pre + k, v as number]]))
const r = new Map(ref ? plano(ref) : [])
console.log(`${values.n} partidas (divisão ${values.divisao}, seed "${values.seed}") em ${ms} ms\n`)
console.log(`${'métrica'.padEnd(22)}${'motor'.padStart(10)}${ref ? 'original'.padStart(10) + 'dif'.padStart(9) : ''}`)
for (const [k, v] of plano(m)) {
  const o = r.get(k)
  const dif = o ? `${(((v - o) / o) * 100).toFixed(1)}%` : ''
  console.log(`${k.padEnd(22)}${String(v).padStart(10)}${o !== undefined ? String(o).padStart(10) + dif.padStart(9) : ''}`)
}
