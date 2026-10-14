'use client'
// Procurar jogadores: filtros em chips, tabela e a ficha com a proposta (prévia do que a IA faria com a oferta).
import { aceitaIr, BRA, precoVendaIA, type Comando, type JogadorM, type Mundo, type TimeM } from '@bolasfoot/engine'
import { useState } from 'react'
import { Gaveta } from '../../../_ui/gaveta.tsx'
import { ChipPosicao, Escudo, Forca, POSICOES } from '../../../_ui/ui.tsx'
import { Fechado, Pendentes, useComandos, type Comandos } from '../comandos.tsx'
import { dinheiro, jogadoresDe } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { Ficha } from '../elenco/elenco.tsx'
import { Carregando, SemClube } from '../hub.tsx'

const PRECOS = [0, 500_000, 1_000_000, 3_000_000, 10_000_000]
const ATALHOS: [string, number][] = [['+100 mil', 100_000], ['+500 mil', 500_000], ['+1 mi', 1_000_000], ['+10 mi', 10_000_000]]

export function Procura({ pendentes, paises }: { pendentes: Comando[]; paises: string[] }) {
  const { mundo: m, meuTime: t } = useJogo()
  const k = useComandos(pendentes)
  const [busca, setBusca] = useState('')
  const [pos, setPos] = useState<number | null>(null)
  const [forcaMin, setForcaMin] = useState(0)
  const [idadeMax, setIdadeMax] = useState(40)
  const [precoMax, setPrecoMax] = useState(0)
  const [soVenda, setSoVenda] = useState(false)
  const [soEmprestimo, setSoEmprestimo] = useState(false)
  const [aberto, setAberto] = useState<number | null>(null)
  if (!m) return <Carregando />
  if (!t) return <SemClube />

  const q = busca.trim().toLowerCase()
  const lista = m.jogadores.filter((j) => j.time >= 0 && j.time !== t.id && !j.juvenil &&
    (pos === null || j.posicao === pos) && j.forca >= forcaMin && j.idade <= idadeMax &&
    (!precoMax || (j.aVenda ? j.preco : j.valor) <= precoMax) && (!soVenda || j.aVenda) && (!soEmprestimo || j.paraEmprestimo) &&
    (!q || j.nome.toLowerCase().includes(q))).sort((a, b) => b.forca - a.forca || a.valor - b.valor).slice(0, 100)
  const sel = aberto === null ? null : m.jogadores[aberto]!

  return (
    <div className="coluna">
      <div className="card secao" style={{ gap: 12 }}>
        <div className="chips">
          <input type="search" placeholder="Nome do jogador" aria-label="Nome do jogador" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ height: 34, minWidth: 200 }} />
          <button aria-pressed={pos === null} onClick={() => setPos(null)}>Todas</button>
          {POSICOES.map((p, i) => <button key={p} aria-pressed={pos === i} onClick={() => setPos(pos === i ? null : i)}>{p}</button>)}
        </div>
        <div className="chips">
          <label className="linha mudo" style={{ gap: 6, fontSize: 13 }}>Força ≥ <input type="number" min={0} max={100} value={forcaMin} onChange={(e) => setForcaMin(Number(e.target.value) || 0)} style={{ width: 70, height: 34 }} /></label>
          <label className="linha mudo" style={{ gap: 6, fontSize: 13 }}>Idade ≤ <input type="number" min={15} max={45} value={idadeMax} onChange={(e) => setIdadeMax(Number(e.target.value) || 45)} style={{ width: 70, height: 34 }} /></label>
          <select aria-label="Preço máximo" value={precoMax} onChange={(e) => setPrecoMax(Number(e.target.value))}>
            {PRECOS.map((p) => <option key={p} value={p}>{p ? `até ${dinheiro(p)}` : 'Qualquer preço'}</option>)}
          </select>
          <button aria-pressed={soVenda} onClick={() => setSoVenda(!soVenda)}>À venda</button>
          <button aria-pressed={soEmprestimo} onClick={() => setSoEmprestimo(!soEmprestimo)}>Para empréstimo</button>
        </div>
      </div>

      <Pendentes k={k} tipos={['comprar', 'pedirEmprestado']} />
      <div className="card rolagem">
        <table className="tabela" style={{ minWidth: 760 }}>
          <thead><tr><th>Pos</th><th>Jogador</th><th className="num">Idade</th><th className="num">Força</th><th>Time</th><th className="num">Valor</th><th /></tr></thead>
          <tbody>
            {lista.map((j) => {
              const dono = m.times[j.time]!
              return (
                <tr key={j.id} style={{ cursor: 'pointer' }} onClick={() => setAberto(j.id)}>
                  <td><ChipPosicao posicao={j.posicao} /></td>
                  <td><button className="fantasma" style={{ height: 'auto', padding: 0, border: 0, color: 'var(--text)' }} onClick={() => setAberto(j.id)}>{j.nome}</button>
                    {j.pais !== BRA && <span className="fraco" style={{ marginLeft: 6, fontSize: 12 }}>{paises[j.pais]}</span>}</td>
                  <td className="num mudo">{j.idade}</td>
                  <td className="num"><Forca valor={j.forca} /></td>
                  <td><span className="clube"><Escudo fileRef={dono.fileRef} tamanho={18} mini />{dono.nome}</span></td>
                  <td className="num">{dinheiro(j.valor)}</td>
                  <td className="num">
                    {j.aVenda && <span className="etiqueta ceu">à venda {dinheiro(j.preco)}</span>}
                    {j.paraEmprestimo && <span className="etiqueta menta" style={{ marginLeft: 4 }}>empréstimo</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {lista.length === 0 && <p className="mudo" style={{ padding: 20, margin: 0 }}>Ninguém com esses filtros.</p>}
      </div>

      <Gaveta aberta={sel !== null} titulo={sel?.nome ?? ''} aoFechar={() => setAberto(null)}>
        {sel && (
          <>
            <Ficha m={m} j={sel} pais={paises[sel.pais] ?? ''} forcas={jogadoresDe(m, m.times[sel.time]!.jogadores).map((x) => x.forca)} />
            <Proposta key={sel.id} m={m} j={sel} t={t} k={k} />
          </>
        )}
      </Gaveta>
    </div>
  )
}

/** O que a IA faria com a oferta (mesmas regras do `proporCompra`, sem sorteio). */
function previa(m: Mundo, j: JogadorM, t: TimeM, oferta: number): { texto: string; cor: string } {
  const caixa = t.financas?.caixa ?? 0
  if (oferta > caixa) return { texto: 'Mais do que você tem em caixa.', cor: 'rosa' }
  const quer = aceitaIr(m, j, t)
  if (quer === 1) return { texto: 'Ele não quer jogar no seu time.', cor: 'rosa' }
  if (j.aVenda && oferta >= j.preco) return { texto: `Fecha pelo preço pedido (${dinheiro(j.preco)}).`, cor: 'menta' }
  const pedido = precoVendaIA(m, j)
  const salario = quer === 2 ? ' O jogador vai pedir o salário dobrado.' : ''
  if (oferta >= pedido) return quer === 0 ? { texto: 'O clube aceita.', cor: 'menta' } : { texto: `O clube aceita.${salario}`, cor: 'pessego' }
  if (caixa >= pedido) return { texto: `O clube deve pedir ${dinheiro(pedido)}.${salario}`, cor: 'pessego' }
  return { texto: `O clube quer ${dinheiro(pedido)}, mais do que seu caixa.`, cor: 'rosa' }
}

export function Proposta({ m, j, t, k }: { m: Mundo; j: JogadorM; t: TimeM; k: Comandos }) {
  const dono = m.times[j.time]!
  // começa do zero: o valor é decisão sua (o preço pedido fica num atalho)
  const [valor, setValor] = useState(0)
  const [aceitar, setAceitar] = useState(false)
  const amigo = dono.humano ? m.tecnicos[dono.tecnico]?.nome : null
  const p = amigo ? null : previa(m, j, t, valor)
  // uma por jogador: mandar de novo substitui a pendente
  const pendente = k.pendentes.find((c): c is Extract<Comando, { tipo: 'comprar' | 'pedirEmprestado' }> =>
    (c.tipo === 'comprar' || c.tipo === 'pedirEmprestado') && c.jogador === j.id)
  return (
    <div className="card secao" style={{ gap: 10, background: 'var(--bg)' }}>
      <h2>Proposta</h2>
      {amigo
        ? <p className="mudo" style={{ margin: 0, fontSize: 13 }}>{dono.nome} é do <strong>{amigo}</strong>: a proposta vai para a caixa dele, que responde na próxima rodada.</p>
        : <p className="fraco" style={{ margin: 0, fontSize: 12 }}>Se um amigo propuser pelo mesmo jogador nesta rodada, leva a maior oferta.</p>}
      <label className="linha" style={{ justifyContent: 'space-between' }}>Valor (R$ milhões)
        <input type="number" min={0} step={0.1} inputMode="decimal" value={valor ? valor / 1e6 : ''} placeholder="0"
          onChange={(e) => setValor(Math.max(0, Math.round((Number(e.target.value.replace(',', '.')) || 0) * 1e6)))} style={{ width: 140, textAlign: 'right' }} />
      </label>
      <div className="chips" style={{ justifyContent: 'flex-end' }}>
        {ATALHOS.map(([r, v]) => <button key={r} onClick={() => setValor((x) => x + v)}>{r}</button>)}
        {j.aVenda && <button onClick={() => setValor(j.preco)}>Pedido {dinheiro(j.preco)}</button>}
        <button onClick={() => setValor(0)} disabled={!valor}>Zerar</button>
      </div>
      <strong style={{ alignSelf: 'flex-end', fontSize: 18 }}>{dinheiro(valor)}</strong>
      {p && <span className={`etiqueta ${p.cor}`} style={{ alignSelf: 'flex-start', whiteSpace: 'normal' }}>{p.texto}</span>}
      {!amigo && <label className="check"><input type="checkbox" checked={aceitar} onChange={(e) => setAceitar(e.target.checked)} /> Aceitar a contraproposta, se houver</label>}
      {pendente && (
        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <span className="etiqueta lavanda">{pendente.tipo === 'comprar' ? `Proposta enviada: ${dinheiro(pendente.valor)}` : 'Pedido de empréstimo enviado'}</span>
          <button disabled={!k.aberto || k.ocupado} onClick={() => void k.tirar(pendente)}>Cancelar</button>
        </div>
      )}
      <div className="linha">
        <button className="primario" disabled={!k.aberto || k.ocupado || valor <= 0}
          onClick={() => void k.mandar({ tipo: 'comprar', jogador: j.id, valor, ...(aceitar ? { aceitarContraproposta: true } : {}) })}>{pendente ? 'Atualizar proposta' : 'Fazer proposta'}</button>
        {j.paraEmprestimo && <button disabled={!k.aberto || k.ocupado} onClick={() => void k.mandar({ tipo: 'pedirEmprestado', jogador: j.id })}>Pedir emprestado</button>}
      </div>
      {k.erro && <p role="alert" style={{ margin: 0, color: 'var(--rosa)' }}>{k.erro}</p>}
      <Fechado k={k} />
    </div>
  )
}
