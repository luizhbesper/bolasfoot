import { base } from '../../../../lib/game/base.ts'
import { pendentesDe } from '../pendentes.ts'
import { Elenco } from './elenco.tsx'

export default async function PaginaElenco({ params }: { params: Promise<{ id: string }> }) {
  return <Elenco paises={base.paises.map((p) => p.nome)} pendentes={await pendentesDe(params)} />
}
