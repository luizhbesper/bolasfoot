'use client'
// Valor em R$ milhões com atalhos (+100 mil… +10 mi, Zerar) e o total por extenso: propostas e lances de leilão.
import type { ReactNode } from 'react'
import { dinheiro } from './consultas.ts'

const ATALHOS: [string, number][] = [['+100 mil', 100_000], ['+500 mil', 500_000], ['+1 mi', 1_000_000], ['+10 mi', 10_000_000]]

/** `extras`: atalhos próprios da tela (preço pedido, lance mínimo…), antes do Zerar. */
export function Valor({ valor, mudar, rotulo = 'Valor (R$ milhões)', extras }: { valor: number; mudar: (v: number) => void; rotulo?: string; extras?: ReactNode }) {
  return (
    <>
      <label className="linha" style={{ justifyContent: 'space-between' }}>{rotulo}
        <input type="number" min={0} step={0.1} inputMode="decimal" value={valor ? valor / 1e6 : ''} placeholder="0"
          onChange={(e) => mudar(Math.max(0, Math.round((Number(e.target.value.replace(',', '.')) || 0) * 1e6)))} style={{ width: 140, textAlign: 'right' }} />
      </label>
      <div className="chips" style={{ justifyContent: 'flex-end' }}>
        {ATALHOS.map(([r, v]) => <button key={r} onClick={() => mudar(valor + v)}>{r}</button>)}
        {extras}
        <button onClick={() => mudar(0)} disabled={!valor}>Zerar</button>
      </div>
      <strong style={{ alignSelf: 'flex-end', fontSize: 18 }}>{dinheiro(valor)}</strong>
    </>
  )
}
