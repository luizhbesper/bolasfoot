import { pendentesDe } from '../pendentes.ts'
import { Caixa } from './caixa.tsx'

export default async function PaginaCaixa({ params }: { params: Promise<{ id: string }> }) {
  return <Caixa pendentes={await pendentesDe(params)} />
}
