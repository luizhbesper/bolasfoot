import { base } from '../../../../lib/game/base.ts'
import { Times } from './times.tsx'

export default function PaginaTimes() {
  return <Times paises={base.paises.map((p) => p.nome)} />
}
