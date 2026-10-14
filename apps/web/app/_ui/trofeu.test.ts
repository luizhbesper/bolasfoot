import { expect, test } from 'vitest'
import { trofeu } from './trofeu.tsx'

test('troféu por competição, com os genéricos do original', () => {
  expect(trofeu('BR-1')).toBe('tr_nacional_BRA_d1')
  expect(trofeu('EST-SP-1')).toBe('tr_estadual_SP_d1')
  expect(trofeu('EST-RS-1')).toBe('tr_estadual_RS_d1') // _D1 no arquivo do original
  expect(trofeu('EST-AC-1')).toBe('tr_estadual_AC')
  expect(trofeu('EST-AC-2')).toBe('tr_estadualgenerico')
  expect(trofeu('REG-1')).toBe('tr_nacionalgenerico') // não há tr_sulminas
  expect(trofeu('REG-2')).toBe('tr_copanordeste')
  expect(trofeu('CB')).toBe('tr_copa_BRA')
  expect(trofeu('SUP-BRA')).toBe('tr_supercopa_BRA')
  expect(trofeu('RECOPA')).toBe('tr_recopasulamaericana')
})
