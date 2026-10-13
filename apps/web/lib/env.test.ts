import { expect, test } from 'vitest'
import { parseEnv } from './env.ts'

const ok = {
  APP_ENV: 'local',
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  SESSION_SECRET: 'troque-isto',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'admin',
  TEST_ENDPOINTS: '1',
}

test('env válida', () => {
  expect(parseEnv(ok)).toMatchObject({ APP_ENV: 'local', TEST_ENDPOINTS: true })
})

test('env inválida', () => {
  expect(() => parseEnv({ ...ok, DATABASE_URL: '' })).toThrow('DATABASE_URL é obrigatória')
  expect(() => parseEnv({ ...ok, APP_ENV: 'dev' })).toThrow('APP_ENV inválida')
  expect(() => parseEnv({ ...ok, APP_ENV: 'prod', SESSION_SECRET: 'x' })).toThrow('TEST_ENDPOINTS')
  expect(() => parseEnv({ ...ok, APP_ENV: 'staging', TEST_ENDPOINTS: '0' })).toThrow('SESSION_SECRET padrão')
})
