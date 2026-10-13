// Ações do painel do admin (docs/plano.md §3.2, §3.5), sem request: testáveis contra o banco.
import { and, eq } from 'drizzle-orm'
import { randomBytes, randomInt } from 'node:crypto'
import type { Db } from '../db/index.ts'
import { gameMembers, games, gameSettings, invites, type ConfigJogo, type ModoJogo } from '../db/schema.ts'

/** Cria o jogo com as configurações padrão; o admin já entra como membro. */
export async function criarJogo(d: Db, adminId: number, nome: string, mode: ModoJogo, config: ConfigJogo): Promise<number> {
  return d.transaction(async (tx) => {
    const [g] = await tx.insert(games).values({ name: nome.trim() || 'Jogo', adminId, mode, config, gameSeed: randomBytes(16).toString('hex') }).returning()
    await tx.insert(gameSettings).values({ gameId: g!.id })
    await tx.insert(gameMembers).values({ gameId: g!.id, userId: adminId })
    return g!.id
  })
}

// sem 0/O, 1/I: o código é digitado
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const sortear = (n: number) => Array.from({ length: n }, () => ALFABETO[randomInt(ALFABETO.length)]).join('')

/** Código `XXXX-XX`. */
export async function gerarConvite(d: Db, gameId: number, criadoPor: number, maxUses: number, validadeHoras: number | null): Promise<string> {
  const code = `${sortear(4)}-${sortear(2)}`
  const expiresAt = validadeHoras ? new Date(Date.now() + validadeHoras * 3600_000) : null
  await d.insert(invites).values({ code, gameId, createdBy: criadoPor, maxUses: Math.max(1, maxUses), expiresAt })
  return code
}

export const revogarConvite = (d: Db, code: string) => d.update(invites).set({ revoked: true }).where(eq(invites.code, code))

export type Settings = Omit<typeof gameSettings.$inferInsert, 'gameId'>

/** Valida e grava; devolve o erro, se houver. Vale a partir da próxima fase. */
export async function editarSettings(d: Db, gameId: number, s: Required<Settings>): Promise<string | null> {
  const ints = [s.planningTimeoutS, s.halftimeTimeoutS, s.resultsPauseS, s.msPerMinute]
  if (!ints.every((n) => Number.isInteger(n) && n > 0)) return 'prazos e velocidade devem ser inteiros positivos'
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.dailyResolveAt)) return 'horário no formato HH:MM'
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: s.timezone })
  } catch {
    return 'fuso inválido'
  }
  await d.update(gameSettings).set(s).where(eq(gameSettings.gameId, gameId))
  return null
}

export const expulsar = (d: Db, gameId: number, memberId: number) =>
  d.delete(gameMembers).where(and(eq(gameMembers.gameId, gameId), eq(gameMembers.id, memberId)))

export const apagarJogo = (d: Db, gameId: number) => d.delete(games).where(eq(games.id, gameId))
