// globalSetup do Vitest: banco de teste zerado e migrado uma vez por execução.
import { conectar } from './index.ts'
import { migrar, zerar } from './cli.ts'

export default async function () {
  const url = process.env.DATABASE_URL!
  if (!new URL(url).pathname.endsWith('_test')) throw new Error(`testes só no banco *_test: ${url}`)
  const d = conectar(url)
  await zerar(d)
  await migrar(d)
  await d.$client.end()
}
