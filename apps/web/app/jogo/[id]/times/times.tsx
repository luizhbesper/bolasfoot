'use client'
// Times e técnicos: o elenco de qualquer time (com a ficha do jogador), o ranking dos técnicos e as trocas de técnico.
import { BRA, folha, type Mundo, type TimeM } from '@bolasfoot/engine'
import { useState } from 'react'
import { Gaveta } from '../../../_ui/gaveta.tsx'
import { ChipPosicao, Escudo, Forca, tomForca } from '../../../_ui/ui.tsx'
import { dataLonga, dinheiro, jogadoresDe, NOME_DIVISAO } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { Ficha } from '../elenco/elenco.tsx'
import { Carregando } from '../hub.tsx'

type Aba = 'times' | 'tecnicos' | 'trocas'
const FILTROS = [
  { rotulo: 'Série A', ok: (t: TimeM) => t.divisao === 1 },
  { rotulo: 'Série B', ok: (t: TimeM) => t.divisao === 2 },
  { rotulo: 'Série C', ok: (t: TimeM) => t.divisao === 3 },
  { rotulo: 'Fora das séries', ok: (t: TimeM) => t.divisao === 0 && t.pais === BRA },
  ...([[1, 'América do Sul'], [0, 'Europa'], [2, 'África'], [3, 'Ásia'], [4, 'Concacaf'], [5, 'Oceania']] as const)
    .map(([k, rotulo]) => ({ rotulo, ok: (t: TimeM) => t.pais !== BRA && t.continente === k })),
]
const MOTIVO: Record<number, string> = { [-1]: 'proposta', 0: 'pediu demissão', 1: 'caixa negativo', 2: 'pressão da torcida', 3: 'resultados' }

export function Times({ paises }: { paises: string[] }) {
  const { mundo: m, meuTime } = useJogo()
  const [aba, setAba] = useState<Aba>('times')
  if (!m) return <Carregando />
  return (
    <div className="coluna">
      <div className="chips" role="tablist" aria-label="Seções">
        {([['times', 'Times'], ['tecnicos', 'Técnicos'], ['trocas', 'Trocas de técnico']] as const).map(([k, r]) => (
          <button key={k} role="tab" aria-selected={aba === k} aria-pressed={aba === k} onClick={() => setAba(k)}>{r}</button>
        ))}
      </div>
      {aba === 'times' ? <ListaTimes m={m} inicial={meuTime} paises={paises} /> : aba === 'tecnicos' ? <Tecnicos m={m} /> : <Trocas m={m} />}
    </div>
  )
}

function ListaTimes({ m, inicial, paises }: { m: Mundo; inicial: TimeM | null; paises: string[] }) {
  const [filtro, setFiltro] = useState(inicial ? Math.max(0, FILTROS.findIndex((f) => f.ok(inicial))) : 0)
  const [busca, setBusca] = useState('')
  const [selId, setSelId] = useState(inicial?.id ?? null)
  const [aberto, setAberto] = useState<number | null>(null)
  const q = busca.trim().toLowerCase()
  const lista = m.times.filter((t) => (q ? t.nome.toLowerCase().includes(q) : FILTROS[filtro]!.ok(t))).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, 80)
  const t = selId === null ? lista[0] : m.times[selId]
  const elenco = t ? jogadoresDe(m, t.jogadores).sort((a, b) => a.posicao - b.posicao || b.forca - a.forca) : []
  const forcas = elenco.map((j) => j.forca)
  const tecnico = t ? m.tecnicos[t.tecnico] : undefined
  const sel = aberto === null ? null : m.jogadores[aberto]!

  return (
    <div className="grade2" style={{ gridTemplateColumns: 'minmax(240px, 1fr) minmax(0, 2.4fr)' }}>
      <aside className="card" style={{ overflow: 'hidden' }}>
        <div className="secao" style={{ gap: 10 }}>
          <input type="search" placeholder="Buscar time" aria-label="Buscar time" value={busca} onChange={(e) => setBusca(e.target.value)} />
          {!q && (
            <select aria-label="Grupo de times" value={filtro} onChange={(e) => setFiltro(Number(e.target.value))}>
              {FILTROS.map((f, i) => <option key={i} value={i}>{f.rotulo}</option>)}
            </select>
          )}
        </div>
        <div style={{ maxHeight: 640, overflowY: 'auto' }}>
          <table className="tabela">
            <tbody>
              {lista.map((x) => (
                <tr key={x.id} className={x === t ? 'eu' : undefined} style={{ cursor: 'pointer' }} onClick={() => setSelId(x.id)}>
                  <td><button className="fantasma clube" style={{ height: 'auto', padding: 0, border: 0, color: 'var(--text)' }} onClick={() => setSelId(x.id)}>
                    <Escudo fileRef={x.fileRef} tamanho={18} mini />{x.nome}</button></td>
                  <td className="num">{x.humano && <span className="etiqueta lavanda">humano</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </aside>

      {t && (
        <section className="card" style={{ overflow: 'hidden' }}>
          <div className="secao">
            <div className="linha" style={{ gap: 16 }}>
              <Escudo fileRef={t.fileRef} tamanho={56} />
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 20 }}>{t.nome}</h2>
                <div className="mudo" style={{ fontSize: 13 }}>
                  {t.pais === BRA ? NOME_DIVISAO[t.divisao] : paises[t.pais]} · {t.estadio.nome} · técnico {tecnico?.nome ?? '—'}{tecnico?.humano && ' (humano)'}
                </div>
              </div>
              <div className="mudo" style={{ fontSize: 13, textAlign: 'right' }}>
                <div>Elenco <strong style={{ color: 'var(--text)' }}>{dinheiro(elenco.reduce((s, j) => s + j.valor, 0))}</strong></div>
                <div>Folha <strong style={{ color: 'var(--text)' }}>{dinheiro(folha(m, t))}</strong></div>
              </div>
            </div>
          </div>
          <div className="rolagem">
            <table className="tabela" style={{ minWidth: 560 }}>
              <thead><tr><th>Pos</th><th>Jogador</th><th className="num">Idade</th><th className="num">Força</th><th className="num">Valor</th><th className="num">Gols</th><th /></tr></thead>
              <tbody>
                {elenco.map((j) => {
                  const temporada = Object.values(j.estatisticas ?? {}).reduce((s, e) => s + e[1], 0)
                  return (
                    <tr key={j.id} style={{ cursor: 'pointer' }} onClick={() => setAberto(j.id)}>
                      <td><ChipPosicao posicao={j.posicao} /></td>
                      <td>{j.nome}{j.pais !== BRA && <span className="fraco" style={{ marginLeft: 6, fontSize: 12 }}>{paises[j.pais]}</span>}</td>
                      <td className="num mudo">{j.idade}</td>
                      <td className="num"><Forca valor={j.forca} tom={tomForca(j.forca, forcas)} /></td>
                      <td className="num">{dinheiro(j.valor)}</td>
                      <td className="num">{temporada || <span className="fraco">0</span>}</td>
                      <td className="num">{j.aVenda && <span className="etiqueta ceu">à venda</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <Gaveta aberta={sel !== null} titulo={sel?.nome ?? ''} aoFechar={() => setAberto(null)}>
        {sel && <Ficha m={m} j={sel} pais={paises[sel.pais] ?? ''} forcas={forcas} />}
      </Gaveta>
    </div>
  )
}

function Tecnicos({ m }: { m: Mundo }) {
  const lista = m.tecnicos.filter((c) => c.time !== null || c.humano)
    .sort((a, b) => b.pontos - a.pontos || b.vitorias - a.vitorias || a.jogos - b.jogos).slice(0, 100)
  return (
    <div className="card rolagem">
      <table className="tabela" style={{ minWidth: 640 }}>
        <thead><tr><th>#</th><th>Técnico</th><th>Time</th><th className="num">Pontos</th><th className="num">J</th><th className="num">V</th><th className="num">E</th><th className="num">D</th><th className="num">Títulos</th></tr></thead>
        <tbody>
          {lista.map((c, i) => (
            <tr key={c.id} className={c.humano ? 'eu' : undefined}>
              <td className="fraco">{i + 1}</td>
              <td>{c.nome}{c.humano && <span className="etiqueta lavanda" style={{ marginLeft: 8 }}>humano</span>}</td>
              <td>{c.time === null ? <span className="fraco">sem clube</span> : <span className="clube"><Escudo fileRef={m.times[c.time]!.fileRef} tamanho={18} mini />{m.times[c.time]!.nome}</span>}</td>
              <td className="num" style={{ fontWeight: 700 }}>{c.pontos}</td>
              <td className="num mudo">{c.jogos}</td><td className="num mudo">{c.vitorias}</td>
              <td className="num mudo">{c.jogos - c.vitorias - c.derrotas}</td><td className="num mudo">{c.derrotas}</td>
              <td className="num">{c.titulos.length || <span className="fraco">0</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Trocas({ m }: { m: Mundo }) {
  const lista = [...m.trocasDeTecnico].sort((a, b) => b.dia - a.dia).slice(0, 100)
  if (!lista.length) return <div className="card secao"><p className="mudo" style={{ margin: 0 }}>Nenhum técnico trocou de clube ainda.</p></div>
  return (
    <div className="card rolagem">
      <table className="tabela" style={{ minWidth: 640 }}>
        <thead><tr><th>Data</th><th>Time</th><th>Saiu</th><th>Entrou</th><th>Motivo</th></tr></thead>
        <tbody>
          {lista.map((x, i) => (
            <tr key={i}>
              <td className="mudo" style={{ whiteSpace: 'nowrap' }}>{dataLonga(x.dia)}</td>
              <td><span className="clube"><Escudo fileRef={m.times[x.time]!.fileRef} tamanho={18} mini />{m.times[x.time]!.nome}</span></td>
              <td>{x.saiu === null ? <span className="fraco">—</span> : m.tecnicos[x.saiu]?.nome}</td>
              <td>{m.tecnicos[x.entrou]?.nome}</td>
              <td className="mudo">{MOTIVO[x.motivo] ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
