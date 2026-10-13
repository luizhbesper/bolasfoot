import { pendentesDe } from '../pendentes.ts'
import { Estadio } from './estadio.tsx'

export default async function PaginaEstadio({ params }: { params: Promise<{ id: string }> }) {
  return <Estadio pendentes={await pendentesDe(params)} />
}
