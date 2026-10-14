// Zonas da classificação (cor de cada posição e legenda), a partir de zonasDaTabela do motor.
import { zonasDaTabela, type Competicao, type Mundo } from '@bolasfoot/engine'

export type CorZona = 'menta' | 'ceu' | 'rosa'
export interface ZonasTabela { legenda: [CorZona, string][]; de: (i: number) => CorZona | null }

/** Zona de cada posição de um grupo de `tamanho` times: acesso/Libertadores/classifica (menta), Sul-Americana (céu), queda (rosa). */
export function zonas(m: Mundo, c: Competicao, faseIdx: number, tamanho: number): ZonasTabela {
  const f = c.fases[faseIdx]
  const z = zonasDaTabela(m, c.id, faseIdx)
  const topo = z.sobem || z.libertadores || (f?.tipo === 'liga' ? f.avancam : 0)
  const legenda: [CorZona, string][] = []
  if (topo) legenda.push(['menta', z.sobem ? 'Acesso' : z.libertadores ? 'Libertadores' : 'Classifica'])
  if (z.sulAmericana) legenda.push(['ceu', 'Sul-Americana'])
  if (z.caem) legenda.push(['rosa', 'Rebaixamento'])
  return {
    legenda,
    de: (i) => (i < topo ? 'menta' : i < topo + z.sulAmericana ? 'ceu' : i >= tamanho - z.caem ? 'rosa' : null),
  }
}

export function Ponto({ cor }: { cor: string | null }) {
  return <span style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: cor ? `var(--${cor})` : 'transparent' }} />
}

export function Legenda({ z }: { z: ZonasTabela }) {
  return (
    <span className="linha mudo" style={{ gap: 12, fontSize: 12 }}>
      {z.legenda.map(([cor, txt]) => <span key={txt} className="linha" style={{ gap: 6, flexWrap: 'nowrap' }}><Ponto cor={cor} />{txt}</span>)}
    </span>
  )
}
