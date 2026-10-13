import { pendentesDe } from '../pendentes.ts'
import { Juniores } from './juniores.tsx'

export default async function PaginaJuniores({ params }: { params: Promise<{ id: string }> }) {
  return <Juniores pendentes={await pendentesDe(params)} />
}
