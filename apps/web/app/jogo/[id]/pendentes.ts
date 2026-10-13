// Os comandos que o usuário já mandou nesta fase, para as páginas de gestão e mercado.
import { exigirUsuario } from '../../../lib/auth/sessao.ts'
import { db } from '../../../lib/db/index.ts'
import { comandosPendentes } from '../../../lib/game/rodada.ts'

export async function pendentesDe(params: Promise<{ id: string }>) {
  const u = await exigirUsuario()
  return comandosPendentes(db(), Number((await params).id), u.id)
}
