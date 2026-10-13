'use client'
// Minhas propostas: as que amigos fizeram pelos seus jogadores (responder até a próxima rodada), as suas esperando
// resposta, os pedidos desta rodada e o que aconteceu com os da última (com a contraproposta, quando houver).
import type { Comando, ResultadoComando } from '@bolasfoot/engine'
import { ChipPosicao } from '../../../_ui/ui.tsx'
import { descrever, Fechado, Pendentes, useComandos } from '../comandos.tsx'
import { dinheiro } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { Carregando, SemClube } from '../hub.tsx'

const MERCADO: Comando['tipo'][] = ['comprar', 'lance', 'pedirEmprestado', 'responderProposta', 'anunciar', 'retirarDaLista', 'venderAgora',
  'paraEmprestimo', 'encerrarEmprestimo', 'comprarEmprestado', 'renovar']

export function Propostas({ pendentes, ultima }: { pendentes: Comando[]; ultima: { n: number; resultados: ResultadoComando[] } | null }) {
  const { mundo: m, meuTime: t, eu } = useJogo()
  const k = useComandos(pendentes)
  if (!m) return <Carregando />
  if (!t) return <SemClube />
  const recebidas = m.propostasHumanas.filter((p) => t.jogadores.includes(p.jogador))
  const enviadas = m.propostasHumanas.filter((p) => p.comprador === t.id)
  const respondida = (id: number) => pendentes.find((c) => c.tipo === 'responderProposta' && c.proposta === id)
  const meus = (ultima?.resultados ?? []).filter((r) => r.tecnico === eu.tecnicoId && MERCADO.includes(r.comando.tipo))

  return (
    <div className="grade2">
      <section className="coluna">
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="cabecalho"><h2>Recebidas</h2></div>
          {recebidas.length === 0 ? <p className="mudo" style={{ margin: 0, padding: '0 20px 20px' }}>Nenhum amigo fez proposta pelos seus jogadores.</p> : (
            <table className="tabela">
              <tbody>
                {recebidas.map((p) => {
                  const j = m.jogadores[p.jogador]!
                  const r = respondida(p.id)
                  return (
                    <tr key={p.id}>
                      <td><span className="clube"><ChipPosicao posicao={j.posicao} />{j.nome}</span></td>
                      <td className="mudo">{m.times[p.comprador]!.nome} oferece <strong style={{ color: 'var(--text)' }}>{dinheiro(p.valor)}</strong> <span className="fraco">(valor {dinheiro(j.valor)})</span></td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        {r ? <span className={`etiqueta ${r.tipo === 'responderProposta' && r.aceitar ? 'menta' : 'rosa'}`}>{r.tipo === 'responderProposta' && r.aceitar ? 'vai aceitar' : 'vai recusar'}</span> : <>
                          <button className="primario" disabled={!k.aberto || k.ocupado} onClick={() => void k.mandar({ tipo: 'responderProposta', proposta: p.id, aceitar: true })}>Aceitar</button>{' '}
                          <button disabled={!k.aberto || k.ocupado} onClick={() => void k.mandar({ tipo: 'responderProposta', proposta: p.id, aceitar: false })}>Recusar</button>
                        </>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {recebidas.length > 0 && <p className="fraco" style={{ margin: 0, padding: '8px 20px 16px', fontSize: 12 }}>Sem resposta até a próxima rodada, a proposta cai.</p>}
        </div>

        {enviadas.length > 0 && (
          <div className="card secao" style={{ gap: 8 }}>
            <h2>Esperando um amigo</h2>
            {enviadas.map((p) => (
              <div key={p.id} className="mudo">{dinheiro(p.valor)} por <strong style={{ color: 'var(--text)' }}>{m.jogadores[p.jogador]!.nome}</strong> ({m.times[m.jogadores[p.jogador]!.time]?.nome})</div>
            ))}
          </div>
        )}

        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="cabecalho"><h2>Na última rodada {ultima && <span className="fraco" style={{ fontWeight: 400 }}>· {ultima.n}</span>}</h2></div>
          {meus.length === 0 ? <p className="mudo" style={{ margin: 0, padding: '0 20px 20px' }}>Nenhum pedido de mercado.</p> : (
            <table className="tabela">
              <tbody>
                {meus.map((r, i) => {
                  const c = r.comando
                  const contra = r.proposta?.tipo === 'contraproposta' ? r.proposta : null
                  return (
                    <tr key={i}>
                      <td>{descrever(m, c)}</td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        {contra ? <>
                          <span className="etiqueta pessego">pede {contra.valor ? dinheiro(contra.valor) : ''}{contra.salario ? ` salário ${dinheiro(contra.salario)}` : ''}</span>{' '}
                          {c.tipo === 'comprar' && <button disabled={!k.aberto || k.ocupado} onClick={() => void k.mandar({ tipo: 'comprar', jogador: c.jogador, valor: contra.valor, aceitarContraproposta: true })}>Aceitar</button>}
                          {c.tipo === 'renovar' && <button disabled={!k.aberto || k.ocupado} onClick={() => void k.mandar({ ...c, salario: contra.salario, aceitarContraproposta: true })}>Aceitar</button>}
                        </> : r.erro ? <span className="etiqueta rosa">{r.erro}</span> : <span className="etiqueta menta">{r.proposta?.tipo === 'fechada' ? `fechado por ${dinheiro(r.proposta.valor)}` : 'feito'}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
      <aside className="coluna">
        <Pendentes k={k} tipos={MERCADO} />
        <Fechado k={k} />
      </aside>
    </div>
  )
}
