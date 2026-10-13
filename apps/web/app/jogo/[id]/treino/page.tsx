import { pendentesDe } from '../pendentes.ts'
import { Treino } from './treino.tsx'

export default async function PaginaTreino({ params }: { params: Promise<{ id: string }> }) {
  return <Treino pendentes={await pendentesDe(params)} />
}
