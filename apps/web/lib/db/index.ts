import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../env.ts'
import * as schema from './schema.ts'

export const conectar = (url: string) => drizzle(postgres(url, { max: 10, onnotice: () => {} }), { schema })
export type Db = ReturnType<typeof conectar>

let cached: Db | undefined
/** Conexão do app (um pool por processo). */
export const db = (): Db => (cached ??= conectar(env().DATABASE_URL))
