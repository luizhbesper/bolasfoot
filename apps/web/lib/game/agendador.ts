// A cada segundo: pausa/retoma pela presença e chama `transicionar` nos jogos com prazo vencido. Um por processo (§2.2).
import { and, inArray, lte } from 'drizzle-orm'
import { db } from '../db/index.ts'
import { games } from '../db/schema.ts'
import { transicionar, vigiarPresenca } from './rodada.ts'

export async function vencerPrazos() {
  const vencidos = await db().select({ id: games.id }).from(games)
    .where(and(inArray(games.status, ['running', 'picking']), lte(games.deadline, new Date())))
  for (const { id } of vencidos) await transicionar(db(), id)
}

export function iniciarAgendador() {
  const g = globalThis as { __agendador?: ReturnType<typeof setInterval> }
  if (g.__agendador) return
  let ocupado = false
  g.__agendador = setInterval(async () => {
    if (ocupado) return
    ocupado = true
    try {
      await vigiarPresenca(db())
      await vencerPrazos()
    } catch (e) {
      console.error('agendador:', e)
    } finally {
      ocupado = false
    }
  }, 1000)
}
