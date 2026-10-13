import { base } from '../../../../lib/game/base.ts'
import { Elenco } from './elenco.tsx'

export default function PaginaElenco() {
  return <Elenco paises={base.paises.map((p) => p.nome)} />
}
