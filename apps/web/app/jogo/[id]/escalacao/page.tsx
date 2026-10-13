import { exigirUsuario } from '../../../../lib/auth/sessao.ts'
import { db } from '../../../../lib/db/index.ts'
import { comandosPendentes } from '../../../../lib/game/rodada.ts'
import { Escalacao } from './escalacao.tsx'

export default async function PaginaEscalacao({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigirUsuario()
  return <Escalacao pendentes={await comandosPendentes(db(), Number((await params).id), u.id)} />
}
