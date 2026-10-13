import type { StatusJogo } from '../../lib/db/schema.ts'

/** Rótulo e cor da etiqueta de cada status do jogo. */
export const STATUS: Record<StatusJogo, [string, string]> = {
  lobby: ['Lobby', ''],
  picking: ['Escolha de times', 'ceu'],
  running: ['Em andamento', 'menta'],
  paused: ['Pausado', 'pessego'],
  finished: ['Encerrado', ''],
}
