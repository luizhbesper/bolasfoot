'use client'
// Na ficha de um jogador seu: lista de transferências, venda imediata, empréstimo, renovação e aposentadoria.
import type { JogadorM, Mundo } from '@bolasfoot/engine'
import { useState } from 'react'
import { descrever, Fechado, type Comandos } from '../comandos.tsx'
import { dinheiro } from '../consultas.ts'
import { Valor } from '../valor.tsx'

const DURACOES = ['6 meses', '1 ano', '2 anos', '3 anos']

export function Negociar({ m, j, k }: { m: Mundo; j: JogadorM; k: Comandos }) {
  // começa do zero: o valor e o preço pedido ficam em atalhos
  const [preco, setPreco] = useState(0)
  const [salario, setSalario] = useState(Math.round(j.salario * 1.1))
  const [duracao, setDuracao] = useState<0 | 1 | 2 | 3>(1)
  const pedidos = k.pendentes.filter((c) => 'jogador' in c && c.jogador === j.id)
  const emprestimo = m.emprestimos.find((e) => e.jogador === j.id)
  const off = !k.aberto || k.ocupado
  const num = (v: string) => Math.max(0, Math.trunc(Number(v) || 0))

  return (
    <div className="card secao" style={{ gap: 12, background: 'var(--bg)' }}>
      <h2>Negociar</h2>
      {pedidos.map((c, i) => (
        <div key={i} className="linha" style={{ justifyContent: 'space-between', fontSize: 13 }}>
          <span className="etiqueta lavanda" style={{ whiteSpace: 'normal' }}>{descrever(m, c)}</span>
          <button className="fantasma" disabled={off} onClick={() => void k.tirar(c)}>Desfazer</button>
        </div>
      ))}
      {k.erro && <p role="alert" style={{ margin: 0, color: 'var(--rosa)' }}>{k.erro}</p>}

      {emprestimo ? (
        <div className="linha">
          <span className="mudo" style={{ flex: 1, fontSize: 13 }}>Emprestado pelo {m.times[emprestimo.origem]?.nome}.</span>
          <button disabled={off} onClick={() => void k.mandar({ tipo: 'comprarEmprestado', jogador: j.id })}>Comprar por {dinheiro(j.valor)}</button>
          <button className="fantasma" disabled={off} onClick={() => void k.mandar({ tipo: 'encerrarEmprestimo', jogador: j.id })}>Devolver</button>
        </div>
      ) : (
        <>
          <Valor valor={preco} mudar={setPreco} rotulo="Preço (R$ milhões)" extras={<>
            <button onClick={() => setPreco(j.valor)}>Valor {dinheiro(j.valor)}</button>
            {j.aVenda && <button onClick={() => setPreco(j.preco)}>Pedido {dinheiro(j.preco)}</button>}
          </>} />
          <div className="linha">
            {j.aVenda
              ? <button disabled={off} onClick={() => void k.mandar({ tipo: 'retirarDaLista', jogador: j.id })}>Tirar da lista ({dinheiro(j.preco)})</button>
              : <button disabled={off || !preco} onClick={() => void k.mandar({ tipo: 'anunciar', jogador: j.id, preco })}>Pôr na lista</button>}
            <button disabled={off || !preco} onClick={() => void k.mandar({ tipo: 'venderAgora', jogador: j.id, preco })}>Vender agora</button>
          </div>
          <p className="fraco" style={{ margin: 0, fontSize: 12 }}>
            Na lista, a IA pode comprar depois de cada rodada pagando até 10–15% acima do valor ({dinheiro(j.valor)}). Vender agora aceita até 15% de desconto.
          </p>
          <label className="check">
            <input type="checkbox" checked={j.paraEmprestimo} disabled={off} onChange={(e) => void k.mandar({ tipo: 'paraEmprestimo', jogador: j.id, sim: e.target.checked })} />
            Disponível para empréstimo
          </label>
        </>
      )}

      <div style={{ borderTop: '1px solid var(--raised)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="mudo" style={{ fontSize: 13 }}>Renovar contrato · salário atual {dinheiro(j.salario)} · teto {dinheiro(Math.round(j.valor * 0.25))}</span>
        {j.renovadoEm === m.temporada ? <span className="fraco" style={{ fontSize: 13 }}>Já renovou nesta temporada: a próxima negociação abre na temporada que vem.</span> : <div className="linha">
          <input type="number" min={1} step={1000} aria-label="Salário proposto" value={salario} onChange={(e) => setSalario(num(e.target.value))} style={{ width: 130, textAlign: 'right' }} />
          <select aria-label="Duração" value={duracao} onChange={(e) => setDuracao(Number(e.target.value) as 0 | 1 | 2 | 3)}>
            {DURACOES.map((d, i) => <option key={i} value={i}>+{d}</option>)}
          </select>
          <button disabled={off || salario <= 0} onClick={() => void k.mandar({ tipo: 'renovar', jogador: j.id, salario, duracao })}>Propor</button>
        </div>}
      </div>

      {m.queremParar.includes(j.id) && (
        <div className="linha">
          <span className="mudo" style={{ flex: 1, fontSize: 13 }}>Quer se aposentar.</span>
          <button className="perigo" disabled={off} onClick={() => void k.mandar({ tipo: 'aposentar', jogador: j.id })}>Deixar se aposentar</button>
        </div>
      )}
      <Fechado k={k} />
    </div>
  )
}
