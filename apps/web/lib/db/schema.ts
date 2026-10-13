// Schema do banco (docs/plano.md §2.6). O mundo do jogo fica inteiro serializado em `snapshots`; o resto é relacional.
import { sql } from 'drizzle-orm'
import {
  boolean, customType, integer, jsonb, pgTable, primaryKey, serial, smallint, text, timestamp, unique,
} from 'drizzle-orm/pg-core'

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' })
const quando = (nome: string) => timestamp(nome, { withTimezone: true })
const criadoEm = () => quando('created_at').notNull().defaultNow()
const doJogo = () => integer('game_id').notNull().references(() => games.id, { onDelete: 'cascade' })

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: criadoEm(),
})

export const sessions = pgTable('sessions', {
  /** sha256 do token do cookie: o banco nunca guarda o token em si */
  tokenHash: text('token_hash').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: quando('expires_at').notNull(),
})

export type ModoJogo = 'live' | 'daily'
export type StatusJogo = 'lobby' | 'picking' | 'running' | 'paused' | 'finished'

/** Configuração fixada na criação do jogo (§3.5). */
export interface ConfigJogo {
  habilidadeIndividual: boolean
  salarioMensal: boolean
  /** fileRef dos times que ninguém pode escolher */
  proibidos: string[]
  /** divisões BR permitidas (1–4; 0 = fora das séries); vazio = todas */
  divisoes: number[]
}

export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  adminId: integer('admin_id').notNull().references(() => users.id),
  mode: text('mode').$type<ModoJogo>().notNull().default('live'),
  config: jsonb('config').$type<ConfigJogo>().notNull(),
  /** secreta: só sai do servidor como seed de rodada revelada */
  gameSeed: text('game_seed').notNull(),
  status: text('status').$type<StatusJogo>().notNull().default('lobby'),
  /** rodada corrente (0 = antes do mundo existir) */
  round: integer('round').notNull().default(0),
  /** prazo da fase corrente (escolha de times ou fase da rodada); null = sem prazo */
  deadline: quando('deadline'),
  createdAt: criadoEm(),
})

export const gameSettings = pgTable('game_settings', {
  gameId: integer('game_id').primaryKey().references(() => games.id, { onDelete: 'cascade' }),
  planningTimeoutS: integer('planning_timeout_s').notNull().default(180),
  halftimeTimeoutS: integer('halftime_timeout_s').notNull().default(30),
  resultsPauseS: integer('results_pause_s').notNull().default(15),
  msPerMinute: integer('ms_per_minute').notNull().default(400),
  dailyResolveAt: text('daily_resolve_at').notNull().default('23:00'),
  timezone: text('timezone').notNull().default('America/Sao_Paulo'),
  autoReadyOnTimeout: boolean('auto_ready_on_timeout').notNull().default(true),
})

export const invites = pgTable('invites', {
  code: text('code').primaryKey(),
  gameId: doJogo(),
  createdBy: integer('created_by').notNull().references(() => users.id),
  maxUses: integer('max_uses').notNull().default(1),
  uses: integer('uses').notNull().default(0),
  expiresAt: quando('expires_at'),
  revoked: boolean('revoked').notNull().default(false),
  createdAt: criadoEm(),
})

export const gameMembers = pgTable('game_members', {
  id: serial('id').primaryKey(),
  gameId: doJogo(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** fileRef do time escolhido */
  teamRef: text('team_ref'),
  /** id do técnico humano no mundo, depois que o mundo nasce */
  tecnicoId: integer('tecnico_id'),
  ready: boolean('ready').notNull().default(false),
  joinedAt: criadoEm(),
}, (t) => [unique().on(t.gameId, t.userId), unique().on(t.gameId, t.teamRef)])

export type FaseRodada = 'planejamento' | 'ao_vivo_1t' | 'intervalo' | 'ao_vivo_2t' | 'resultados'

export const rounds = pgTable('rounds', {
  gameId: doJogo(),
  n: integer('n').notNull(),
  phase: text('phase').$type<FaseRodada>().notNull().default('planejamento'),
  seedHash: text('seed_hash').notNull(),
  /** revelada depois que os comandos travam */
  seed: text('seed'),
  /** relógio do servidor no início do tempo ao vivo corrente */
  startedAt: quando('started_at'),
}, (t) => [primaryKey({ columns: [t.gameId, t.n] })])

/** etapa 0 = planejamento, 1 = intervalo */
const etapa = () => smallint('etapa').notNull().default(0)

export const commands = pgTable('commands', {
  gameId: doJogo(),
  n: integer('n').notNull(),
  etapa: etapa(),
  memberId: integer('member_id').notNull().references(() => gameMembers.id, { onDelete: 'cascade' }),
  list: jsonb('list').notNull().default(sql`'[]'::jsonb`),
}, (t) => [primaryKey({ columns: [t.gameId, t.n, t.etapa, t.memberId] })])

/** Mundo serializado (JSON + gzip) na entrada da rodada n (etapa 0) ou no intervalo dela (etapa 1). */
export const snapshots = pgTable('snapshots', {
  gameId: doJogo(),
  n: integer('n').notNull(),
  etapa: etapa(),
  data: bytea('data').notNull(),
}, (t) => [primaryKey({ columns: [t.gameId, t.n, t.etapa] })])

export const roundLogs = pgTable('round_logs', {
  gameId: doJogo(),
  n: integer('n').notNull(),
  etapa: etapa(),
  data: jsonb('data').notNull(),
}, (t) => [primaryKey({ columns: [t.gameId, t.n, t.etapa] })])
