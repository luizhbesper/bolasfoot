'use client'
// Visão geral do clube: próximo jogo, avisos do elenco, confiança, tabela e o que os amigos fizeram na última rodada.
import { folha } from '@bolasfoot/engine'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { ResumoRodada } from '../../../lib/game/rodada.ts'
import { Erro } from '../../_ui/pagina.tsx'
import { SalaDeTrofeus } from '../../_ui/trofeu.tsx'
import { ChipPosicao, Energia, Escudo, Forca, Forma, fundoEstadio } from '../../_ui/ui.tsx'
import { alerta, dataLonga, dinheiro, etapaDoJogo, forma, jogadoresDe, proximoJogo, tabelaDoTime } from './consultas.ts'
import { useJogo } from './contexto.tsx'
import s from './hub.module.css'
import { Legenda, Ponto, zonas } from './tabelas/zonas.tsx'

export function Carregando() {
  return <p className="mudo">Carregando o mundo…</p>
}

export function SemClube() {
  return (
    <div className="card secao">
      <h2>Você está sem clube</h2>
      <p className="mudo" style={{ margin: 0 }}>As propostas de emprego chegam pela <Link href={`/jogo/${useJogo().jogo}/caixa`}>caixa de entrada</Link>.</p>
    </div>
  )
}

export function Hub({ ultima, erro }: { ultima: { n: number; resumo: ResumoRodada } | null; erro?: string }) {
  const { jogo, mundo: m, meuTime: t, membros } = useJogo()
  if (!m) return <Carregando />
  if (!t) return <SemClube />
  const base = `/jogo/${jogo}`
  const prox = proximoJogo(m, t.id)
  const adv = prox ? m.times[prox.adversario]! : null
  const mandante = prox ? (prox.casa ? t : adv!) : null
  const tecnico = m.tecnicos[t.tecnico]!
  const tabela = prox ? tabelaDoTime(m, prox.compId, t.id) : null
  const compTabela = prox && m.competicoes.find((c) => c.id === prox.compId)
  const z = tabela && compTabela ? zonas(m, compTabela, compTabela.fases.length - 1, tabela.linhas.length) : null
  const elenco = jogadoresDe(m, t.jogadores).sort((a, b) => a.posicao - b.posicao || b.forca - a.forca)
  // técnico humano de cada time, para o feed
  const humanos = new Map(membros.filter((x) => x.teamRef).map((x) => [m.times.find((tt) => tt.fileRef === x.teamRef)?.id, x.nome]))

  return (
    <div className={s.grade}>
      <section className={s.principal}>
        <Erro texto={erro} />
        {ultima?.resumo.virou && (
          <div className="card secao" style={{ flexDirection: 'row', alignItems: 'center', borderColor: 'rgba(238,221,156,.35)' }}>
            <span className="etiqueta lavanda">Nova temporada</span>
            <span style={{ flex: 1 }}>A temporada virou: campeões, acessos e rebaixamentos já valem.</span>
            <Link href={`${base}/caixa`}>Ver o resumo</Link>
          </div>
        )}
        {prox && adv ? (
          <div className={`card ${s.proximo}`} style={{ '--estadio': fundoEstadio(mandante!.id) } as CSSProperties}>
            <div className="linha mudo" style={{ fontSize: 13 }}>
              <span className="etiqueta ceu">Próximo jogo</span>
              <strong style={{ color: 'var(--text)' }}>{[prox.comp, etapaDoJogo(m, prox.compId, mandante!.id, prox.casa ? adv.id : t.id, prox.dia)].filter(Boolean).join(', ')}</strong>
              · {dataLonga(prox.dia)} · {mandante!.estadio.nome}
            </div>
            <div className={s.confronto}>
              <Lado time={t} forma={forma(m, t.id)} />
              <span className={s.x}>×</span>
              <Lado time={adv} forma={forma(m, adv.id)} direita />
            </div>
            <div className="linha">
              <Link href={`${base}/escalacao`} className={s.botao}>Escalar time</Link>
              <Link href={`${base}/elenco`} className={s.link}>Ver elenco</Link>
              <span className="mudo" style={{ marginLeft: 'auto', fontSize: 13 }}>{prox.casa ? 'Em casa' : 'Fora de casa'}</span>
            </div>
          </div>
        ) : (
          <div className="card secao"><p className="mudo" style={{ margin: 0 }}>Sem jogos marcados por enquanto.</p></div>
        )}

        <div className={`card ${s.elenco}`}>
          <div className="cabecalho">
            <h2 style={{ flex: 1 }}>Elenco <span className="fraco" style={{ fontWeight: 400 }}>{t.jogadores.length} jogadores</span></h2>
            <Link href={`${base}/elenco`}>Ver todos</Link>
          </div>
          <div className={s.rolagem}>
            <table className="tabela">
              <thead><tr><th>Pos</th><th>Nome</th><th className="num">Idade</th><th className="num">Força</th><th>Energia</th><th /></tr></thead>
              <tbody>
                {elenco.map((j) => {
                  const a = alerta(m, j)
                  return (
                    <tr key={j.id}>
                      <td style={{ width: 50 }}><ChipPosicao posicao={j.posicao} /></td>
                      <td>{j.nome}</td>
                      <td className="num mudo">{j.idade}</td>
                      <td className="num"><Forca valor={j.forca} /></td>
                      <td style={{ width: 90 }}><Energia valor={j.energia} /></td>
                      <td className="num">{a && <span className={`etiqueta ${a.cor === 'manteiga' ? '' : a.cor}`}>{a.texto}</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <aside className={s.lado}>
        <div className="card secao">
          <h2>Confiança</h2>
          <Barra rotulo="Diretoria" valor={tecnico.diretoria} />
          <Barra rotulo="Torcida" valor={tecnico.torcida} />
          <div className={s.numeros}>
            {t.financas && <div><span>Caixa</span><strong>{dinheiro(t.financas.caixa)}</strong></div>}
            <div><span>Folha</span><strong>{dinheiro(folha(m, t))}</strong></div>
          </div>
        </div>

        <div className="card secao">
          <h2>Sala de troféus</h2>
          <SalaDeTrofeus titulos={m.historico.filter((h) => h.campeao === t.id)} />
        </div>

        {tabela && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="secao" style={{ paddingBottom: 6 }}><h2>{tabela.nome}</h2>{z && z.legenda.length > 0 && <Legenda z={z} />}</div>
            <table className="tabela">
              <thead><tr><th>#</th><th>Clube</th><th className="num">J</th><th className="num">Pts</th></tr></thead>
              <tbody>
                {tabela.linhas.map((l) => (
                  <tr key={l.time} className={l.time === t.id ? 'eu' : undefined}>
                    <td><span className="linha fraco" style={{ gap: 6, flexWrap: 'nowrap' }}><Ponto cor={z?.de(l.pos - 1) ?? null} />{l.pos}</span></td>
                    <td><span className="linha" style={{ gap: 8, flexWrap: 'nowrap' }}><Escudo fileRef={m.times[l.time]!.fileRef} tamanho={18} mini />{m.times[l.time]!.nome}</span></td>
                    <td className="num mudo">{l.linha.j}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{l.linha.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ultima && (
          <div className="card secao">
            <h2>Na liga dos amigos <span className="fraco" style={{ fontWeight: 400 }}>rodada {ultima.n}</span></h2>
            {ultima.resumo.partidas.filter((p) => humanos.has(p.times[0]) || humanos.has(p.times[1])).map((p, i) => (
              <div key={i} className={s.feed}>
                <Escudo fileRef={m.times[p.times[0]!]!.fileRef} tamanho={22} mini />
                <span>
                  <strong>{p.nomes[0]} {p.placar[0]} × {p.placar[1]} {p.nomes[1]}</strong>
                  <span className="mudo"> · {[humanos.get(p.times[0]), humanos.get(p.times[1])].filter(Boolean).join(' × ')}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  )
}

function Lado({ time, forma: f, direita }: { time: { fileRef: string; nome: string }; forma: ('V' | 'E' | 'D')[]; direita?: boolean }) {
  return (
    <div className={`${s.time} ${direita ? s.direita : ''}`}>
      <Escudo fileRef={time.fileRef} tamanho={64} />
      <div>
        <div className={s.nome}>{time.nome}</div>
        {f.length > 0 && <Forma resultados={f} />}
      </div>
    </div>
  )
}

function Barra({ rotulo, valor }: { rotulo: string; valor: number }) {
  const cor = valor >= 60 ? 'var(--menta)' : valor >= 30 ? 'var(--manteiga)' : 'var(--rosa)'
  return (
    <div className={s.barra}>
      <div><span className="mudo">{rotulo}</span><strong>{valor}%</strong></div>
      <div className={s.trilho}><div style={{ width: `${valor}%`, background: cor }} /></div>
    </div>
  )
}
