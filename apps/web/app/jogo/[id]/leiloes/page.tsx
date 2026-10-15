import { db } from '../../../../lib/db/index.ts'
import { lancesDaRodada } from '../../../../lib/game/rodada.ts'
import { pendentesDe } from '../pendentes.ts'
import { Leiloes } from './leiloes.tsx'

export default async function PaginaLeiloes({ params }: { params: Promise<{ id: string }> }) {
  return <Leiloes pendentes={await pendentesDe(params)} daRodada={await lancesDaRodada(db(), Number((await params).id))} />
}
