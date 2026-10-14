import { base } from '../../../../lib/game/base.ts'
import { pendentesDe } from '../pendentes.ts'
import { Times } from './times.tsx'

export default async function PaginaTimes({ params }: { params: Promise<{ id: string }> }) {
  return <Times pendentes={await pendentesDe(params)} paises={base.paises.map((p) => p.nome)} />
}
