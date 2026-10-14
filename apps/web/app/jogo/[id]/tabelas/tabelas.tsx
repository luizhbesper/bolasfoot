'use client'
// Tabelas: classificação (liga e grupos, de FaseLiga.linhas) ou chaves do mata-mata, artilharia e a próxima rodada.
import { zonasDaTabela, type Competicao, type FaseLiga, type FaseMataMata, type Jogo, type Mundo } from '@bolasfoot/engine'
import { useState } from 'react'
import { Escudo, Forma } from '../../../_ui/ui.tsx'
import { artilharia, dataLonga, grupoCompeticao, GRUPOS_COMPETICAO, jogosDaComp, NOME_RODADA, nomeFase, nomeRodada, participa, proximoJogo, resultadoPara, type Resultado } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { Carregando } from '../hub.tsx'
import { Legenda, Ponto, zonas } from './zonas.tsx'

const VAZIA = { pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }

export function Tabelas() {
  const { mundo: m, meuTime } = useJogo()
  const [escolhida, setEscolhida] = useState<string | null>(null)
  const [faseSel, setFaseSel] = useState<number | null>(null)
  if (!m) return <Carregando />
  const minhas = meuTime ? m.competicoes.filter((c) => participa(c, meuTime.id)) : []
  const series = m.competicoes.filter((c) => c.id.startsWith('BR-') && !minhas.includes(c))
  const atalhos = [...minhas, ...series]
  const padrao = (meuTime && proximoJogo(m, meuTime.id)?.compId) ?? atalhos[0]?.id
  const c = m.competicoes.find((x) => x.id === (escolhida ?? padrao)) ?? m.competicoes[0]!
  const nFase = faseSel !== null && faseSel < c.fases.length ? faseSel : c.fases.length - 1
  const f = c.fases[nFase]
  const eu = meuTime?.id ?? -1
  const trocar = (id: string) => {
    setEscolhida(id)
    setFaseSel(null)
  }

  return (
    <div className="coluna">
      <div className="chips" role="group" aria-label="Competições">
        {atalhos.map((x) => <button key={x.id} aria-pressed={x === c} onClick={() => trocar(x.id)}>{x.nome}</button>)}
        <select aria-label="Outras competições" value="" onChange={(e) => e.target.value && trocar(e.target.value)}>
          <option value="">Outras competições…</option>
          {GRUPOS_COMPETICAO.map((g) => {
            const lista = m.competicoes.filter((x) => !atalhos.includes(x) && grupoCompeticao(x) === g)
            return lista.length > 0 && <optgroup key={g} label={g}>{lista.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</optgroup>
          })}
        </select>
      </div>

      <div className="grade2">
        <section className="coluna">
          {c.fases.length > 1 && (
            <div className="chips" role="group" aria-label="Fases">
              {c.fases.map((_, i) => <button key={i} aria-pressed={i === nFase} onClick={() => setFaseSel(i)}>{nomeFase(c, i)}</button>)}
            </div>
          )}
          {!f ? <div className="card secao"><p className="mudo" style={{ margin: 0 }}>Ainda não começou.</p></div>
            : f.tipo === 'liga' ? <Liga m={m} c={c} f={f} nFase={nFase} eu={eu} />
            : <MataMata m={m} f={f} eu={eu} sobem={zonasDaTabela(m, c.id, nFase).sobem} />}
          {c.campeao !== null && (
            <div className="card secao">
              <div className="linha"><span className="etiqueta lavanda">Campeão</span><Escudo fileRef={m.times[c.campeao]!.fileRef} tamanho={28} /><strong>{m.times[c.campeao]!.nome}</strong>
                {c.vice !== null && <span className="mudo">· vice {m.times[c.vice]!.nome}</span>}</div>
            </div>
          )}
        </section>
        <aside className="coluna">
          <Artilharia m={m} c={c} eu={eu} />
          <ProximaRodada m={m} c={c} eu={eu} />
        </aside>
      </div>
    </div>
  )
}

function Liga({ m, c, f, nFase, eu }: { m: Mundo; c: Competicao; f: FaseLiga; nFase: number; eu: number }) {
  const grupos = f.grupos.length ? f.grupos : [f.times]
  const rodada = Math.max(0, ...Object.values(f.linhas).map((l) => l.j))
  // forma na fase: os resultados de cada time nos jogos desta fase, em ordem
  const forma = new Map<number, Resultado[]>()
  for (const j of [...f.jogos].sort((a, b) => a.dia - b.dia))
    for (const t of [j.casa, j.fora]) {
      const r = resultadoPara(j, t)
      if (r) forma.set(t, [...(forma.get(t) ?? []), r])
    }
  return (
    <>
      {grupos.map((g, gi) => {
        const z = zonas(m, c, nFase, g.length)
        return (
          <div key={gi} className="card" style={{ overflow: 'hidden' }}>
            <div className="cabecalho" style={{ flexWrap: 'wrap' }}>
              <h2>{grupos.length > 1 ? `Grupo ${String.fromCharCode(65 + gi)}` : c.nome} {gi === 0 && rodada > 0 && <span className="fraco" style={{ fontWeight: 400 }}>· {rodada}ª rodada</span>}</h2>
              <Legenda z={z} />
            </div>
            <div className="rolagem">
              <table className="tabela" style={{ minWidth: 620 }}>
                <thead>
                  <tr><th>#</th><th>Clube</th><th className="num">Pts</th><th className="num">J</th><th className="num">V</th><th className="num">E</th><th className="num">D</th>
                    <th className="num">GP</th><th className="num">GC</th><th className="num">SG</th><th>Últimos</th></tr>
                </thead>
                <tbody>
                  {g.map((t, i) => {
                    const l = f.linhas[t] ?? VAZIA
                    const sg = l.gp - l.gc
                    return (
                      <tr key={t} className={t === eu ? 'eu' : undefined}>
                        <td><span className="linha" style={{ gap: 6, flexWrap: 'nowrap' }}><Ponto cor={z.de(i)} /><span className="mudo">{i + 1}</span></span></td>
                        <td><span className="clube"><Escudo fileRef={m.times[t]!.fileRef} tamanho={18} mini />{m.times[t]!.nome}<Humano m={m} t={t} /></span></td>
                        <td className="num" style={{ fontWeight: 700 }}>{l.pts}</td>
                        <td className="num mudo">{l.j}</td><td className="num mudo">{l.v}</td><td className="num mudo">{l.e}</td><td className="num mudo">{l.d}</td>
                        <td className="num mudo">{l.gp}</td><td className="num mudo">{l.gc}</td>
                        <td className="num">{sg > 0 ? `+${sg}` : sg}</td>
                        <td><Forma resultados={(forma.get(t) ?? []).slice(-5)} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </>
  )
}

function MataMata({ m, f, eu, sobem }: { m: Mundo; f: FaseMataMata; eu: number; sobem: number }) {
  if (!f.rodadas.length) return <div className="card secao"><p className="mudo" style={{ margin: 0 }}>Chaves ainda não sorteadas.</p></div>
  return (
    <>
      {[...f.rodadas].reverse().map((r, ri) => {
        const n = r.confrontos.length
        return (
          <div key={ri} className="card" style={{ overflow: 'hidden' }}>
            <div className="cabecalho"><h2>{f.nomes || r.terceiro ? nomeRodada(f, f.rodadas.length - 1 - ri) : NOME_RODADA[n] ?? `${f.rodadas.length - ri}ª fase`}</h2><span className="linha fraco" style={{ gap: 8, fontSize: 12 }}>{n === sobem && <span className="etiqueta menta">Vencedores sobem</span>}{r.idaVolta ? 'ida e volta' : 'jogo único'}</span></div>
            <div className="rolagem">
              <table className="tabela" style={{ minWidth: 480 }}>
                <tbody>
                  {r.confrontos.map(([a, b], i) => {
                    const ida = r.jogos[i], volta = r.idaVolta ? r.jogos[i + n] : undefined
                    const venceu = r.vencedores.find((v) => v === a || v === b)
                    return (
                      <tr key={i} className={a === eu || b === eu ? 'eu' : undefined}>
                        <td style={{ textAlign: 'right' }}><Lado m={m} t={a} venceu={venceu} /></td>
                        <td className="num" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {placar(ida)}{volta && <span className="mudo"> · {placar(volta, true)}</span>}
                        </td>
                        <td><Lado m={m} t={b} venceu={venceu} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </>
  )
}

/** Placar do ponto de vista do confronto [a, b]; a volta tem o mando trocado. */
function placar(j: Jogo | undefined, invertido = false): string {
  if (!j?.gols) return j ? dataLonga(j.dia).slice(5, 10) : '×'
  const [x, y] = invertido ? [j.gols[1], j.gols[0]] : j.gols
  return `${x} × ${y}${j.penaltis !== undefined ? ' (pên.)' : ''}`
}

function Lado({ m, t, venceu }: { m: Mundo; t: number; venceu: number | undefined }) {
  const ganhou = venceu === t
  return <span className="clube" style={{ fontWeight: ganhou ? 700 : 400, opacity: venceu !== undefined && !ganhou ? 0.55 : 1 }}>
    <Escudo fileRef={m.times[t]!.fileRef} tamanho={18} mini />{m.times[t]!.nome}<Humano m={m} t={t} />
  </span>
}

/** Selo com o nome do técnico humano (do mundo, não do membro: vale depois de troca de clube). */
function Humano({ m, t }: { m: Mundo; t: number }) {
  const time = m.times[t]!
  return time.humano ? <span className="etiqueta lavanda">{m.tecnicos[time.tecnico]?.nome}</span> : null
}

function Artilharia({ m, c, eu }: { m: Mundo; c: Competicao; eu: number }) {
  const lista = artilharia(m, c.id)
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="cabecalho"><h2>Artilharia</h2></div>
      {lista.length === 0 ? <p className="mudo" style={{ margin: 0, padding: '0 20px 20px' }}>Nenhum gol ainda.</p> : (
        <table className="tabela">
          <tbody>
            {lista.map(({ j, gols, jogos }, i) => (
              <tr key={j.id} className={j.time === eu ? 'eu' : undefined}>
                <td className="fraco" style={{ width: 36 }}>{i + 1}</td>
                <td><div style={{ fontWeight: 500 }}>{j.nome}</div><div className="fraco" style={{ fontSize: 12 }}>{m.times[j.time]?.nome ?? '—'} · {jogos} j</div></td>
                <td className="num" style={{ fontWeight: 700 }}>{gols}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function ProximaRodada({ m, c, eu }: { m: Mundo; c: Competicao; eu: number }) {
  const pendentes = jogosDaComp(c).map((x) => x.jogo).filter((j) => !j.gols)
  if (!pendentes.length) return null
  const dia = Math.min(...pendentes.map((j) => j.dia))
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="cabecalho"><h2>Próximos jogos</h2><span className="fraco" style={{ fontSize: 12 }}>{dataLonga(dia)}</span></div>
      <table className="tabela">
        <tbody>
          {pendentes.filter((j) => j.dia === dia).map((j, i) => (
            <tr key={i} className={j.casa === eu || j.fora === eu ? 'eu' : undefined}>
              <td style={{ textAlign: 'right' }}>{m.times[j.casa]!.nome}</td>
              <td className="fraco" style={{ textAlign: 'center', width: 20 }}>×</td>
              <td>{m.times[j.fora]!.nome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
