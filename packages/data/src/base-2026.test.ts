// Base 2026 (docs/fase7.md): times do mod de julho/26; invariantes, não contagens fixas.
import { expect, test } from 'vitest'
import type { Base } from './types.ts'
import b2022 from '../base.json' with { type: 'json' }
import b2026 from '../base-2026.json' with { type: 'json' }

const base = b2026 as Base
const BRA = 29

test('mesmos países, UFs, nomes e configs da 2022 (os índices estão fixos no motor)', () => {
  const velha = b2022 as Base
  expect(base.paises).toEqual(velha.paises)
  expect(base.ufs).toEqual(velha.ufs)
  expect(base.ligas).toEqual(velha.ligas)
  expect(base.estaduais).toEqual(velha.estaduais)
})

test('times e jogadores', () => {
  expect(new Set(base.times.map((t) => t.fileRef)).size).toBe(base.times.length)
  expect(base.times.filter((t) => t.pais === BRA).length).toBeGreaterThanOrEqual(136) // Séries A–D
  for (const t of base.times) {
    expect(t.jogadores.length, t.fileRef).toBeGreaterThanOrEqual(11)
    expect(t.jogadores.filter((j) => j.posicao === 0).length, t.fileRef).toBeGreaterThanOrEqual(1)
    expect(t.nivel).toBeGreaterThanOrEqual(1)
    expect(t.nivel).toBeLessThanOrEqual(25) // o motor aceita até 25 (mundo.ts, NIVEL_REMAP)
    expect(t.reputacao).toBeGreaterThanOrEqual(0)
    expect(t.reputacao).toBeLessThanOrEqual(5)
    if (t.pais === BRA) expect(base.ufs[t.uf!], t.fileRef).toBeDefined()
    else expect(t.uf).toBeNull()
    expect(base.nomes[base.paises[t.pais]!.codigo], t.fileRef).toBeDefined()
    const importado = t.pais === BRA // o motor corrige idades estranhas de estrangeiros (mundo.ts:402)
    for (const j of t.jogadores) {
      expect(base.paises[j.pais], `${t.fileRef} ${j.nome}`).toBeDefined()
      if (importado) expect(j.idade, `${t.fileRef} ${j.nome}`).toBeGreaterThanOrEqual(15)
      if (importado) expect(j.idade, `${t.fileRef} ${j.nome}`).toBeLessThanOrEqual(45)
      expect(j.potencial).toBeGreaterThanOrEqual(0)
      expect(j.potencial).toBeLessThanOrEqual(10)
    }
  }
})
