// pnpm db:migrate | db:seed | db:reset. Roda direto no Node (sem o bundler do Next).
import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { fileURLToPath } from 'node:url'
import { normalizarUsuario } from '../auth/conta.ts'
import { hashSenha } from '../auth/senha.ts'
import { env, type Env } from '../env.ts'
import { conectar, type Db } from './index.ts'
import { users } from './schema.ts'

export const migrar = (d: Db) => migrate(d, { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) })

/** Cria (ou atualiza a senha d)o admin do .env. Idempotente. */
export async function semear(d: Db, e: Pick<Env, 'ADMIN_USERNAME' | 'ADMIN_PASSWORD'>) {
  const passwordHash = await hashSenha(e.ADMIN_PASSWORD)
  await d.insert(users).values({ username: normalizarUsuario(e.ADMIN_USERNAME), passwordHash, isAdmin: true })
    .onConflictDoUpdate({ target: users.username, set: { passwordHash, isAdmin: true } })
}

/** Apaga tudo (só local) e recria. */
export async function zerar(d: Db) {
  await d.execute(sql`DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public`)
}

if (import.meta.main) {
  try {
    process.loadEnvFile(new URL('../../../../.env', import.meta.url))
  } catch {
    // sem .env: vars vêm do ambiente
  }
  const e = env()
  const d = conectar(e.DATABASE_URL)
  const cmd = process.argv[2]
  if (cmd === 'reset') {
    if (e.APP_ENV !== 'local') throw new Error('db:reset só com APP_ENV=local')
    await zerar(d)
  }
  if (cmd === 'migrate' || cmd === 'reset') await migrar(d)
  if (cmd === 'seed' || cmd === 'reset') await semear(d, e)
  if (!['migrate', 'seed', 'reset'].includes(cmd ?? '')) throw new Error('uso: cli.ts migrate | seed | reset')
  await d.$client.end()
  console.log(`db:${cmd} ok`)
}
