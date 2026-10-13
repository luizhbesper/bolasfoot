import type { NextConfig } from 'next'

// .env fica na raiz do monorepo; em staging/prod as vars vêm do Railway e o arquivo não existe.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url))
} catch {
  // sem .env: tudo bem, vars vêm do ambiente
}

const config: NextConfig = {
  transpilePackages: ['@bolasfoot/engine'],
}

export default config
