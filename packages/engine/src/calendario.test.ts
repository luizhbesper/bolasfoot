import { describe, expect, it } from 'vitest'
import ref2022 from './ref-calendario-2022.json' with { type: 'json' }
import ref2026 from './ref-calendario-2026.json' with { type: 'json' }
import { ANO_INICIAL, criarCalendario, data, datas, diaAbsoluto, diaDaSemana, formatarData, TIPO } from './calendario.ts'

// Gabarito: datas impressas pelo a.u() do original (tools/calendario.sh <ano>)
const ROTULO: Record<string, number> = {
  'Amistoso Clube': TIPO.amistosoClube, 'Amistoso Seleção': TIPO.amistosoSelecao, Estadual: TIPO.estadual, Regional: TIPO.regional,
  SuperCopa: TIPO.supercopa, Nacional: TIPO.liga, Int1: TIPO.continental1, Copa: TIPO.copa, Selecoes: TIPO.selecoes, INT2: TIPO.continental2,
  Recopa: TIPO.recopa, INT3: TIPO.conference, Mundial: TIPO.mundial, Elimin: TIPO.eliminatorias, Finalissima: TIPO.finalissima, 'Liga Nacoes': TIPO.ligaNacoes,
}

describe('calendário', () => {
  it('datas absolutas', () => {
    expect(diaAbsoluto(1970, 1, 1)).toBe(0)
    expect(diaAbsoluto(2026, 10, 13)).toBe(20739)
    expect(data(20739)).toEqual({ ano: 2026, mes: 10, dia: 13 })
    expect(diaDaSemana(diaAbsoluto(2026, 10, 13))).toBe(3) // terça
    expect(formatarData(diaAbsoluto(2024, 2, 29))).toBe('29/02/2024')
    for (let n = -1000; n < 30000; n += 37) expect(diaAbsoluto(data(n).ano, data(n).mes, data(n).dia)).toBe(n)
  })

  for (const [ano, ref] of [[2022, ref2022], [ANO_INICIAL, ref2026]] as const)
    it(`bate com o original em ${ano}`, () => {
      const c = criarCalendario(ano)
      expect(Object.keys(ref).sort()).toEqual(Object.keys(ROTULO).sort())
      for (const [rotulo, esperado] of Object.entries(ref)) expect(datas(c, ROTULO[rotulo]!).map(formatarData), rotulo).toEqual(esperado)
    })

  it('Série A: 38 rodadas cabem nas 54 datas de liga', () => {
    const c = criarCalendario(ANO_INICIAL)
    expect(c.tipos).toHaveLength(365)
    expect(datas(c, TIPO.liga)).toHaveLength(54)
  })
})
