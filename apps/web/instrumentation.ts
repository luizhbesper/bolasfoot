import { env } from './lib/env.ts'

// Roda uma vez na subida do servidor: app não sobe com env inválida; o canal entre processos e o agendador começam.
export async function register() {
  env()
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  await (await import('./lib/game/canal.ts')).iniciarCanal()
  ;(await import('./lib/game/agendador.ts')).iniciarAgendador()
}
