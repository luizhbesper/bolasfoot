'use client'
// História: campeões, vices e artilheiros de cada competição por temporada, e o hall da fama.
import { ANO_INICIAL } from '@bolasfoot/engine'
import { useState } from 'react'
import { Escudo } from '../../../_ui/ui.tsx'
import { grupoCompeticao, GRUPOS_COMPETICAO } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { Carregando } from '../hub.tsx'

export function Historia() {
  const { mundo: m, meuTime } = useJogo()
  const [comp, setComp] = useState<string>('BR-1')
  if (!m) return <Carregando />
  const comps = [...new Map(m.historico.map((h) => [h.competicao, h.nome]))]
  const linhas = m.historico.filter((h) => h.competicao === comp).sort((a, b) => b.temporada - a.temporada)
  const eu = meuTime?.id
  const time = (id: number | null) => id === null ? <span className="fraco">—</span>
    : <span className="clube" style={{ fontWeight: id === eu ? 700 : 400 }}><Escudo fileRef={m.times[id]!.fileRef} tamanho={18} mini />{m.times[id]!.nome}</span>

  return (
    <div className="grade2">
      <section className="card" style={{ overflow: 'hidden' }}>
        <div className="cabecalho">
          <h2>Campeões</h2>
          {comps.length > 0 && (
            <select aria-label="Competição" value={comp} onChange={(e) => setComp(e.target.value)} style={{ height: 34 }}>
              {GRUPOS_COMPETICAO.map((g) => {
                const lista = comps.filter(([id]) => grupoCompeticao(m.competicoes.find((c) => c.id === id) ?? { confederacao: undefined }) === g)
                return lista.length > 0 && <optgroup key={g} label={g}>{lista.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</optgroup>
              })}
            </select>
          )}
        </div>
        {linhas.length === 0 ? (
          <p className="mudo" style={{ margin: 0, padding: '0 20px 20px' }}>A primeira temporada ainda não acabou.</p>
        ) : (
          <div className="rolagem">
            <table className="tabela" style={{ minWidth: 560 }}>
              <thead><tr><th>Ano</th><th>Campeão</th><th>Vice</th><th>Artilheiro</th></tr></thead>
              <tbody>
                {linhas.map((h) => (
                  <tr key={h.temporada}>
                    <td className="mudo">{ANO_INICIAL + h.temporada - 1}</td>
                    <td>{time(h.campeao)}</td>
                    <td>{time(h.vice)}</td>
                    <td>{h.artilheiro ? <>{h.artilheiro.nome} <span className="fraco">({m.times[h.artilheiro.time]?.nome ?? '—'}, {h.artilheiro.gols})</span></> : <span className="fraco">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <aside className="card" style={{ overflow: 'hidden' }}>
        <div className="cabecalho"><h2>Hall da fama</h2></div>
        {m.hallDaFama.length === 0 ? <p className="mudo" style={{ margin: 0, padding: '0 20px 20px' }}>Ninguém se aposentou ainda.</p> : (
          <table className="tabela">
            <thead><tr><th>Jogador</th><th className="num">Gols</th><th className="num">Jogos</th></tr></thead>
            <tbody>
              {[...m.hallDaFama].sort((a, b) => b.gols - a.gols).slice(0, 30).map((x, i) => (
                <tr key={i}><td>{x.nome} <span className="fraco">· {ANO_INICIAL + x.temporada - 1}</span></td><td className="num" style={{ fontWeight: 700 }}>{x.gols}</td><td className="num mudo">{x.jogos}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </aside>
    </div>
  )
}
