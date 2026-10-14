import { defineConfig } from 'vitest/config'

// Integração roda contra o banco de teste do mesmo Postgres (docker/init.sql cria o bolasfoot_test).
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url))
} catch {
  // CI: vars vêm do ambiente
}
const url = new URL(process.env.DATABASE_URL ?? 'postgres://bolasfoot:bolasfoot@localhost:5434/bolasfoot')
url.pathname = '/bolasfoot_test'
process.env.DATABASE_URL = url.href // globalSetup e workers herdam

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } }, // o tsconfig do Next deixa o JSX em preserve
  test: {
    globalSetup: './lib/db/teste-setup.ts',
    fileParallelism: false, // um banco só para todos os arquivos
  },
})
