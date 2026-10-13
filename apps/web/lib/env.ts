// Env vars validadas na subida do app (instrumentation.ts). Ver docs/plano.md §2.7.
const APP_ENVS = ['local', 'staging', 'prod'] as const
export type AppEnv = (typeof APP_ENVS)[number]

export interface Env {
  APP_ENV: AppEnv
  DATABASE_URL: string
  SESSION_SECRET: string
  ADMIN_USERNAME: string
  ADMIN_PASSWORD: string
  TEST_ENDPOINTS: boolean
}

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const errors: string[] = []
  const req = (k: string) => {
    const v = raw[k]?.trim()
    if (!v) errors.push(`${k} é obrigatória`)
    return v ?? ''
  }

  const appEnv = req('APP_ENV') as AppEnv
  if (appEnv && !APP_ENVS.includes(appEnv)) errors.push(`APP_ENV inválida: ${appEnv} (use ${APP_ENVS.join(' | ')})`)
  const env: Env = {
    APP_ENV: appEnv,
    DATABASE_URL: req('DATABASE_URL'),
    SESSION_SECRET: req('SESSION_SECRET'),
    ADMIN_USERNAME: req('ADMIN_USERNAME'),
    ADMIN_PASSWORD: req('ADMIN_PASSWORD'),
    TEST_ENDPOINTS: raw.TEST_ENDPOINTS?.trim() === '1',
  }
  if (env.DATABASE_URL && !/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) errors.push('DATABASE_URL deve ser postgres://')
  if (appEnv === 'prod' && env.TEST_ENDPOINTS) errors.push('TEST_ENDPOINTS não pode estar ligado em prod')
  if (appEnv !== 'local' && env.SESSION_SECRET === 'troque-isto') errors.push('SESSION_SECRET padrão só em local')

  if (errors.length) throw new Error(`Env inválida:\n- ${errors.join('\n- ')}`)
  return env
}

let cached: Env | undefined
export const env = (): Env => (cached ??= parseEnv(process.env))
