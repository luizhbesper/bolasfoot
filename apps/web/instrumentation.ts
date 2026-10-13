import { env } from './lib/env.ts'

// Roda uma vez na subida do servidor: app não sobe com env inválida.
export function register() {
  env()
}
