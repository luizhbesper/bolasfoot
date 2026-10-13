'use client'
// Juniores: progresso e potencial que o olheiro estima; promover ao elenco ou dispensar.
import type { Comando } from '@bolasfoot/engine'
import { ChipPosicao } from '../../../_ui/ui.tsx'
import { Fechado, Pendentes, useComandos } from '../comandos.tsx'
import { jogadoresDe } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { Carregando, SemClube } from '../hub.tsx'

export function Juniores({ pendentes }: { pendentes: Comando[] }) {
  const { mundo: m, meuTime: t } = useJogo()
  const k = useComandos(pendentes)
  if (!m) return <Carregando />
  if (!t) return <SemClube />
  const pedido = new Set(pendentes.flatMap((c) => (c.tipo === 'promoverJunior' || c.tipo === 'dispensarJunior' ? [c.jogador] : [])))
  const lista = jogadoresDe(m, t.juniores).sort((a, b) => b.potencialEstimado - a.potencialEstimado || b.progresso - a.progresso)
  return (
    <div className="grade2">
      <section className="card rolagem">
        <div className="cabecalho"><h2>Juniores <span className="fraco" style={{ fontWeight: 400 }}>{lista.length} de 20</span></h2><span className="mudo" style={{ fontSize: 13 }}>Elenco {t.jogadores.length} de 35</span></div>
        {lista.length === 0 ? <p className="mudo" style={{ margin: 0, padding: '0 20px 20px' }}>Nenhum junior no clube.</p> : (
          <table className="tabela" style={{ minWidth: 620 }}>
            <thead><tr><th>Pos</th><th>Jogador</th><th className="num">Idade</th><th className="num">Potencial</th><th>Progresso</th><th /></tr></thead>
            <tbody>
              {lista.map((j) => (
                <tr key={j.id}>
                  <td><ChipPosicao posicao={j.posicao} /></td>
                  <td>{j.nome}{j.estrela && <span className="etiqueta manteiga" style={{ marginLeft: 8, color: 'var(--manteiga)' }}>promessa</span>}</td>
                  <td className="num mudo">{j.idade}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{j.potencialEstimado}</td>
                  <td style={{ minWidth: 120 }}>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--line)' }}><div style={{ height: 6, borderRadius: 3, width: `${Math.min(100, j.progresso)}%`, background: 'var(--menta)' }} /></div>
                  </td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>
                    {pedido.has(j.id) ? <span className="fraco">pedido</span> : <>
                      <button disabled={!k.aberto || k.ocupado} onClick={() => void k.mandar({ tipo: 'promoverJunior', jogador: j.id })}>Promover</button>{' '}
                      <button className="fantasma" disabled={!k.aberto || k.ocupado} onClick={() => void k.mandar({ tipo: 'dispensarJunior', jogador: j.id })}>Dispensar</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <aside className="coluna">
        <div className="card secao">
          <p className="mudo" style={{ margin: 0, fontSize: 13 }}>Promovido, a força vem do potencial mais uma parte do progresso: esperar o progresso subir rende um jogador melhor. Os juniores sobem com a evolução semanal.</p>
          <Fechado k={k} />
        </div>
        <Pendentes k={k} tipos={['promoverJunior', 'dispensarJunior']} />
      </aside>
    </div>
  )
}
