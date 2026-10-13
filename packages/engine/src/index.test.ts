import { expect, test } from 'vitest'
import { ENGINE_VERSION } from './index.ts'

test('engine carrega', () => {
  expect(ENGINE_VERSION).toBe(0)
})
