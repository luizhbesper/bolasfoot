import { env } from './lib/env.ts'

// Roda uma vez na subida do servidor: app não sobe com env inválida; o agendador de prazos começa.
export async function register() {
  env()
  if (process.env.NEXT_RUNTIME === 'nodejs') (await import('./lib/game/agendador.ts')).iniciarAgendador()
}
