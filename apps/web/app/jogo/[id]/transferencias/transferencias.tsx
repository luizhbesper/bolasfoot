'use client'
// Transferências: as mais recentes primeiro; filtro pelos times dos amigos e busca por jogador ou time.
import { useState } from 'react'
import { ChipPosicao, Escudo } from '../../../_ui/ui.tsx'
import { dataLonga, dinheiro } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { Carregando } from '../hub.tsx'

export function Transferencias() {
  const { mundo: m } = useJogo()
  const [amigos, setAmigos] = useState(false)
  const [busca, setBusca] = useState('')
  if (!m) return <Carregando />
  const q = busca.trim().toLowerCase()
  const humano = (t: number) => m.times[t]?.humano ?? false
  const nome = (t: number) => m.times[t]?.nome ?? '—'
  const lista = m.transferencias.filter((x) => (!amigos || humano(x.de) || humano(x.para)) &&
    (!q || [m.jogadores[x.jogador]!.nome, nome(x.de), nome(x.para)].some((s) => s.toLowerCase().includes(q))))
    .slice(-200).reverse()
  const time = (t: number) => m.times[t]
    ? <span className="clube" style={{ fontWeight: humano(t) ? 600 : 400 }}><Escudo fileRef={m.times[t]!.fileRef} tamanho={18} mini />{m.times[t]!.nome}</span>
    : <span className="fraco">—</span>

  return (
    <div className="coluna">
      <div className="chips">
        <input type="search" placeholder="Buscar jogador ou time" aria-label="Buscar jogador ou time" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ height: 34, minWidth: 240 }} />
        <button aria-pressed={amigos} onClick={() => setAmigos(!amigos)}>Só times dos amigos</button>
      </div>
      {lista.length === 0 ? <div className="card secao"><p className="mudo" style={{ margin: 0 }}>Nenhuma transferência.</p></div> : (
        <div className="card rolagem">
          <table className="tabela" style={{ minWidth: 720 }}>
            <thead><tr><th>Data</th><th>Jogador</th><th>De</th><th>Para</th><th className="num">Valor</th></tr></thead>
            <tbody>
              {lista.map((x, i) => {
                const j = m.jogadores[x.jogador]!
                return (
                  <tr key={i}>
                    <td className="mudo" style={{ whiteSpace: 'nowrap' }}>{dataLonga(x.dia)}</td>
                    <td><span className="clube"><ChipPosicao posicao={j.posicao} />{j.nome}</span></td>
                    <td>{time(x.de)}</td>
                    <td>{time(x.para)}</td>
                    <td className="num">{x.valor ? dinheiro(x.valor) : <span className="fraco">livre</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
