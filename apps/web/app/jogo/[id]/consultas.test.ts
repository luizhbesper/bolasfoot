import type { Mundo } from '@bolasfoot/engine'
import { expect, test } from 'vitest'
import { confronto, textoConfronto } from './consultas.ts'

test('a volta mostra a ida e o agregado do ponto de vista do mandante da volta', () => {
  // confrontos 1×2 e 3×4; ida no dia 10, volta no 17 com o mando trocado
  const jogos = [
    { dia: 10, casa: 1, fora: 2, gols: [2, 1] as [number, number] },
    { dia: 10, casa: 3, fora: 4, gols: [0, 0] as [number, number] },
    { dia: 17, casa: 2, fora: 1 },
    { dia: 17, casa: 4, fora: 3, gols: [1, 3] as [number, number] },
  ]
  const m = { competicoes: [{ id: 'c', fases: [{ tipo: 'mata', rodadas: [{ idaVolta: true, confrontos: [[1, 2], [3, 4]], jogos }] }] }] } as unknown as Mundo
  expect(confronto(m, 'c', 1, 2, 10)).toBeNull() // ida
  expect(confronto(m, 'c', 2, 1, 17)).toEqual({ ida: jogos[0], agregado: [1, 2] }) // volta não jogada
  expect(confronto(m, 'c', 2, 1, 17, [2, 0])!.agregado).toEqual([3, 2]) // placar ao vivo
  expect(textoConfronto(confronto(m, 'c', 4, 3, 17))).toBe('Ida 0×0 · Agregado 1×3')
})
