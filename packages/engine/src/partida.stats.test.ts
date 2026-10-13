// Gate da Fase 1: o motor bate estatisticamente com o original (referência gerada por tools/oracle.sh).
import { expect, test } from 'vitest'
import { metricas, resumo, simularLote, type Metricas } from './estatisticas.ts'
import ref from './ref-original.json' with { type: 'json' }

const original = ref.metricas as Metricas
const motor = metricas(simularLote(10_000, 'gate').map(resumo))

// tolerâncias ≈ 3 erros-padrão da diferença entre 10k (motor) e 20k (original) partidas
const relativa: [keyof Metricas, number][] = [
  ['golsJogo', 0.03], ['chutesJogo', 0.02], ['conversao', 0.03], ['noAlvo', 0.015], ['amarelosJogo', 0.04],
  ['expulsoesJogo', 0.12], ['lesoesJogo', 0.14], ['subsJogo', 0.02], ['assistPorGol', 0.03],
]
const absoluta: [keyof Metricas, number][] = [['casa', 0.02], ['empate', 0.018], ['fora', 0.02]]
const tipos: [keyof Metricas['tiposGol'], number][] = [['normal', 0.008], ['penalti', 0.006], ['falta', 0.005], ['contra', 0.003], ['olimpico', 0.002]]

test.each(relativa)('%s dentro de ±%s do original (relativo)', (k, tol) => {
  expect(Math.abs((motor[k] as number) / (original[k] as number) - 1)).toBeLessThan(tol)
})
test.each(absoluta)('%s dentro de ±%s do original', (k, tol) => {
  expect(Math.abs((motor[k] as number) - (original[k] as number))).toBeLessThan(tol)
})
test.each(tipos)('gols do tipo %s dentro de ±%s do original', (k, tol) => {
  expect(Math.abs(motor.tiposGol[k] - original.tiposGol[k])).toBeLessThan(tol)
})
