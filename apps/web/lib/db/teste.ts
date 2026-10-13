// Ajudantes dos testes de integração.
import { sql } from 'drizzle-orm'
import { db } from './index.ts'

/** Esvazia todas as tabelas. */
export const limpar = () =>
  db().execute(sql`TRUNCATE users, sessions, games, game_settings, invites, game_members, rounds, commands, snapshots, round_logs RESTART IDENTITY CASCADE`)
