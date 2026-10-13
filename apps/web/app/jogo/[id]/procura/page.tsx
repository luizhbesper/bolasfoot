import { base } from '../../../../lib/game/base.ts'
import { pendentesDe } from '../pendentes.ts'
import { Procura } from './procura.tsx'

export default async function PaginaProcura({ params }: { params: Promise<{ id: string }> }) {
  return <Procura pendentes={await pendentesDe(params)} paises={base.paises.map((p) => p.nome)} />
}
