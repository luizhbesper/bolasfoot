import { pendentesDe } from '../pendentes.ts'
import { Financas } from './financas.tsx'

export default async function PaginaFinancas({ params }: { params: Promise<{ id: string }> }) {
  return <Financas pendentes={await pendentesDe(params)} />
}
