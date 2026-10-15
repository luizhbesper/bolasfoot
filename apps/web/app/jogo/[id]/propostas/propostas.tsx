'use client'
// Minhas propostas: as que amigos fizeram pelos seus jogadores (responder até a próxima rodada), as suas esperando
// resposta, o histórico de todas (feitas e recebidas, com o porquê) e os outros pedidos da última rodada.
import type { Comando, RegistroProposta, ResultadoComando } from '@bolasfoot/engine'
import { useState } from 'react'
import { ChipPosicao } from '../../../_ui/ui.tsx'
import { descrever, Fechado, Pendentes, useComandos } from '../comandos.tsx'
import { dataLonga, dinheiro } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { Carregando, SemClube } from '../hub.tsx'

const MERCADO: Comando['tipo'][] = ['comprar', 'lance', 'pedirEmprestado', 'responderProposta', 'anunciar', 'retirarDaLista',
  'paraEmprestimo', 'encerrarEmprestimo', 'comprarEmprestado', 'renovar']
// estes já aparecem no histórico
const NO_HISTORICO: Comando['tipo'][] = ['comprar', 'responderProposta']

const STATUS: Record<RegistroProposta['status'], [string, string]> = {
  aceita: ['Aceita', 'menta'], recusada: ['Recusada', 'rosa'], contraproposta: ['Contraproposta', 'pessego'], expirada: ['Expirada', ''],
}
type Filtro = 'todas' | 'feitas' | 'recebidas' | RegistroProposta['status']
const FILTROS: [Filtro, string][] = [['todas', 'Todas'], ['feitas', 'Feitas'], ['recebidas', 'Recebidas'], ['aceita', 'Aceitas'], ['recusada', 'Recusadas'],
  ['contraproposta', 'Contrapropostas'], ['expirada', 'Expiradas']]

export function Propostas({ pendentes, ultima }: { pendentes: Comando[]; ultima: { n: number; resultados: ResultadoComando[] } | null }) {
  const { mundo: m, meuTime: t, eu } = useJogo()
  const k = useComandos(pendentes)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  if (!m) return <Carregando />
  if (!t) return <SemClube />
  const recebidas = m.propostasHumanas.filter((p) => t.jogadores.includes(p.jogador))
  const enviadas = m.propostasHumanas.filter((p) => p.comprador === t.id)
  const respondida = (id: number) => pendentes.find((c) => c.tipo === 'responderProposta' && c.proposta === id)
  const meus = (ultima?.resultados ?? []).filter((r) => r.tecnico === eu.tecnicoId && MERCADO.includes(r.comando.tipo) && !NO_HISTORICO.includes(r.comando.tipo))
  const historico = (m.historicoPropostas ?? []).filter((h) => h.comprador === t.id || h.vendedor === t.id)
  const visiveis = historico.filter((h) => filtro === 'todas' || (filtro === 'feitas' ? h.comprador === t.id : filtro === 'recebidas' ? h.vendedor === t.id : h.status === filtro)).reverse()
  // contraproposta ainda aceitável: a última sua por esse jogador, que continua no mesmo clube
  const aceitavel = (h: RegistroProposta) => h.status === 'contraproposta' && h.comprador === t.id && m.jogadores[h.jogador]!.time === h.vendedor &&
    historico.findLast((x) => x.jogador === h.jogador && x.comprador === t.id) === h
  const nome = (time: number) => (time < 0 ? '—' : m.times[time]?.nome ?? '?')

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
          <div className="cabecalho"><h2>Histórico <span className="fraco" style={{ fontWeight: 400 }}>{historico.length}</span></h2></div>
          <div className="chips" style={{ padding: '0 20px 12px' }}>
            {FILTROS.map(([f, r]) => <button key={f} aria-pressed={filtro === f} onClick={() => setFiltro(f)}>{r}</button>)}
          </div>
          {visiveis.length === 0 ? <p className="mudo" style={{ margin: 0, padding: '0 20px 20px' }}>Nenhuma proposta.</p> : (
            <div className="rolagem">
              <table className="tabela">
                <thead><tr><th>Data</th><th>Jogador</th><th>De → Para</th><th className="num">Valor</th><th>Resultado</th></tr></thead>
                <tbody>
                  {visiveis.map((h, i) => {
                    const j = m.jogadores[h.jogador]!
                    const [rotulo, cor] = STATUS[h.status]
                    return (
                      <tr key={i}>
                        <td className="mudo" style={{ whiteSpace: 'nowrap' }}>{dataLonga(h.dia)}</td>
                        <td><span className="clube"><ChipPosicao posicao={j.posicao} />{j.nome}</span></td>
                        <td className="mudo">{nome(h.vendedor)} → {nome(h.comprador)} <span className="fraco">{h.comprador === t.id ? '(feita)' : '(recebida)'}</span></td>
                        <td className="num">{dinheiro(h.valor)}</td>
                        <td>
                          <span className={`etiqueta ${cor}`}>{rotulo}</span>
                          {h.motivo && <span className="mudo" style={{ marginLeft: 6, fontSize: 13 }}>{h.motivo}</span>}
                          {h.contra && <span className="mudo" style={{ marginLeft: 6, fontSize: 13 }}>
                            pede {dinheiro(h.contra.valor)}{h.contra.salario ? `, salário ${dinheiro(h.contra.salario)}` : ''}</span>}
                          {aceitavel(h) && <> <button disabled={!k.aberto || k.ocupado}
                            onClick={() => void k.mandar({ tipo: 'comprar', jogador: h.jogador, valor: h.contra!.valor, aceitarContraproposta: true })}>Aceitar</button></>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="cabecalho"><h2>Outros pedidos na última rodada {ultima && <span className="fraco" style={{ fontWeight: 400 }}>· {ultima.n}</span>}</h2></div>
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
