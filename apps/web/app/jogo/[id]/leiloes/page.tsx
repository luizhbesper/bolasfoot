import { pendentesDe } from '../pendentes.ts'
import { Leiloes } from './leiloes.tsx'

export default async function PaginaLeiloes({ params }: { params: Promise<{ id: string }> }) {
  return <Leiloes pendentes={await pendentesDe(params)} />
}
