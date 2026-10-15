'use client'
// Elenco: tabela densa ordenável, filtro por posição e a ficha do jogador numa gaveta.
import type { Comando, JogadorM, Mundo } from '@bolasfoot/engine'
import { useState } from 'react'
import { Gaveta } from '../../../_ui/gaveta.tsx'
import { Bandeira, ChipPosicao, Energia, Forca, POSICOES, tomForca } from '../../../_ui/ui.tsx'
import { alerta, CARACTERISTICAS, dataLonga, dinheiro, jogadoresDe, NOMES_CARACTERISTICAS } from '../consultas.ts'
import { useComandos } from '../comandos.tsx'
import { useJogo } from '../contexto.tsx'
import { Carregando, SemClube } from '../hub.tsx'
import s from './elenco.module.css'
import { Negociar } from './negociar.tsx'

type Coluna = 'posicao' | 'nome' | 'idade' | 'forca' | 'energia' | 'salario' | 'valor' | 'contratoAte' | 'gols'
const COLUNAS: { chave: Coluna; rotulo: string; num?: boolean }[] = [
  { chave: 'posicao', rotulo: 'Pos' }, { chave: 'nome', rotulo: 'Jogador' }, { chave: 'idade', rotulo: 'Idade', num: true },
  { chave: 'forca', rotulo: 'Força', num: true }, { chave: 'energia', rotulo: 'Energia' }, { chave: 'salario', rotulo: 'Salário', num: true },
  { chave: 'valor', rotulo: 'Valor', num: true }, { chave: 'contratoAte', rotulo: 'Contrato', num: true }, { chave: 'gols', rotulo: 'Gols', num: true },
]
export const lado = (j: JogadorM) => (j.lado === 1 ? 'E' : 'D')
export const caracteristicas = (j: { cr1: number; cr2: number }) => `${CARACTERISTICAS[j.cr1]}/${CARACTERISTICAS[j.cr2]}`

export function Elenco({ paises, pendentes }: { paises: string[]; pendentes: Comando[] }) {
  const { mundo: m, meuTime: t } = useJogo()
  const k = useComandos(pendentes)
  const [ordem, setOrdem] = useState<{ col: Coluna; desc: boolean }>({ col: 'posicao', desc: false })
  const [pos, setPos] = useState<number | null>(null)
  const [aberto, setAberto] = useState<number | null>(null)
  if (!m) return <Carregando />
  if (!t) return <SemClube />

  const todos = jogadoresDe(m, t.jogadores)
  const forcas = todos.map((j) => j.forca)
  const lista = todos.filter((j) => pos === null || j.posicao === pos).sort((a, b) => {
    const va = a[ordem.col], vb = b[ordem.col]
    const c = typeof va === 'string' ? va.localeCompare(vb as string, 'pt-BR') : (va as number) - (vb as number)
    return (ordem.desc ? -c : c) || b.forca - a.forca
  })
  const ordenar = (col: Coluna) => setOrdem((o) => ({ col, desc: o.col === col ? !o.desc : col !== 'nome' && col !== 'posicao' && col !== 'idade' }))
  const sel = aberto === null ? null : m.jogadores[aberto]!
  const cfg = k.pendentes.findLast((c) => c.tipo === 'config' && c.renovarAuto !== undefined) as Extract<Comando, { tipo: 'config' }> | undefined
  const renovarAuto = cfg?.renovarAuto ?? t.config?.renovarAuto ?? m.opcoes.renovarAuto ?? false

  return (
    <>
      <div className={s.filtros} role="group" aria-label="Filtrar por posição">
        <button className={pos === null ? s.ativo : undefined} onClick={() => setPos(null)}>Todos <span className="fraco">{todos.length}</span></button>
        {POSICOES.map((p, i) => (
          <button key={p} className={pos === i ? s.ativo : undefined} onClick={() => setPos(pos === i ? null : i)}>
            {p} <span className="fraco">{todos.filter((j) => j.posicao === i).length}</span>
          </button>
        ))}
        <label className="check" style={{ marginLeft: 'auto' }} title="Com menos de 60 dias de contrato, renova 1 ano no salário que o jogador pedir (uma vez por temporada)">
          <input type="checkbox" checked={renovarAuto} disabled={!k.aberto || k.ocupado}
            onChange={(e) => void k.mandar({ tipo: 'config', renovarAuto: e.target.checked })} />
          Renovar contratos automaticamente
        </label>
      </div>
      <div className="card rolagem">
        <table className="tabela" style={{ minWidth: 860 }}>
          <thead>
            <tr>
              {COLUNAS.map((c) => (
                <th key={c.chave} className={c.num ? 'num' : undefined} aria-sort={ordem.col === c.chave ? (ordem.desc ? 'descending' : 'ascending') : undefined}>
                  <button className="ordenar" onClick={() => ordenar(c.chave)}>
                    {c.rotulo}{ordem.col === c.chave && (ordem.desc ? ' ↓' : ' ↑')}
                  </button>
                </th>
              ))}
              <th>Caract.</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.map((j) => {
              const a = alerta(m, j)
              return (
                <tr key={j.id} className={s.linha} onClick={() => setAberto(j.id)}>
                  <td><ChipPosicao posicao={j.posicao} /></td>
                  <td>
                    <button className={s.nome} onClick={() => setAberto(j.id)}>{j.nome}</button>
                    {j.pais !== 29 && <span className="fraco" style={{ marginLeft: 6, fontSize: 12 }}>{paises[j.pais]}</span>}
                  </td>
                  <td className="num mudo">{j.idade}</td>
                  <td className="num"><Forca valor={j.forca} tom={tomForca(j.forca, forcas)} /></td>
                  <td><Energia valor={j.energia} /></td>
                  <td className="num mudo">{dinheiro(j.salario)}</td>
                  <td className="num">{dinheiro(j.valor)}</td>
                  <td className="num mudo">{new Date(j.contratoAte * 86_400_000).getUTCFullYear()}</td>
                  <td className="num">{j.gols}</td>
                  <td className="mudo">{caracteristicas(j)}</td>
                  <td>{a && <span className={`etiqueta ${a.cor === 'manteiga' ? '' : a.cor}`}>{a.texto}</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Gaveta aberta={sel !== null} titulo={sel?.nome ?? ''} aoFechar={() => setAberto(null)}>
        {sel && <><Ficha m={m} j={sel} pais={paises[sel.pais] ?? ''} forcas={forcas} /><Negociar key={sel.id} m={m} j={sel} k={k} /></>}
      </Gaveta>
    </>
  )
}

export function Ficha({ m, j, pais, forcas }: { m: Mundo; j: JogadorM; pais: string; forcas: number[] }) {
  const a = alerta(m, j)
  return (
    <>
      <div className="linha" style={{ gap: 10 }}>
        <ChipPosicao posicao={j.posicao} />
        <span className="mudo">{j.idade} anos · lado {lado(j) === 'D' ? 'direito' : 'esquerdo'}</span>
      </div>
      <h2 className={s.titulo}>{j.nome}</h2>
      <div className="linha mudo" style={{ gap: 8 }}><Bandeira pais={j.pais} /> {pais}</div>
      {a && <span className={`etiqueta ${a.cor === 'manteiga' ? '' : a.cor}`} style={{ alignSelf: 'flex-start' }}>{a.texto}</span>}
      <div className={s.numeros}>
        <div><span>Força</span><Forca valor={j.forca} tom={tomForca(j.forca, forcas)} /></div>
        <div><span>Energia</span><strong>{j.energia}%</strong></div>
        <div><span>Valor</span><strong>{dinheiro(j.valor)}</strong></div>
        <div><span>Salário</span><strong>{dinheiro(j.salario)}</strong></div>
        <div><span>Contrato até</span><strong>{dataLonga(j.contratoAte).slice(5)}</strong></div>
        <div><span>Carreira</span><strong>{j.gols} gols · {j.jogos} jogos</strong></div>
      </div>
      <div>
        <div className="mudo" style={{ fontSize: 13, marginBottom: 6 }}>Características</div>
        <div className="linha"><span className="etiqueta lavanda">{NOMES_CARACTERISTICAS[j.cr1]}</span><span className="etiqueta lavanda">{NOMES_CARACTERISTICAS[j.cr2]}</span></div>
      </div>
      {j.habilidades && (
        <div className={s.habilidades}>
          {Object.entries(j.habilidades).map(([k, v]) => (
            <div key={k}><span className="mudo">{k}</span><div className={s.trilho}><div style={{ width: `${Math.min(100, v)}%` }} /></div><strong>{v}</strong></div>
          ))}
        </div>
      )}
      {j.estatisticas && Object.keys(j.estatisticas).length > 0 && (
        <div>
          <div className="mudo" style={{ fontSize: 13, marginBottom: 6 }}>Temporada</div>
          <table className="tabela">
            <thead><tr><th>Competição</th><th className="num">J</th><th className="num">G</th><th className="num">A</th><th className="num">CA</th><th className="num">CV</th><th className="num">Nota</th></tr></thead>
            <tbody>
              {Object.entries(j.estatisticas).map(([c, [jogos, g, as, ca, cv, notas]]) => (
                <tr key={c}>
                  <td>{m.competicoes.find((x) => x.id === c)?.nome ?? c}</td>
                  <td className="num">{jogos}</td><td className="num">{g}</td><td className="num">{as}</td>
                  <td className="num mudo">{ca}</td><td className="num mudo">{cv}</td>
                  <td className="num">{jogos ? (notas / jogos).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(j.aVenda || j.emprestado) && <p className="mudo" style={{ margin: 0 }}>{j.aVenda ? `À venda por ${dinheiro(j.preco)}` : 'Emprestado'}</p>}
    </>
  )
}
