'use client'
// Caixa de entrada: o que o original mostrava em modais (propostas de amigos, ofertas de emprego, demissão,
// aposentadoria, mercado, fim de temporada) vira lista com filtros e um detalhe com a ação, quando houver.
import { ANO_INICIAL, type Aviso, type Comando, type Mundo, type TipoAviso } from '@bolasfoot/engine'
import { useEffect, useState } from 'react'
import { SalaDeTrofeus } from '../../../_ui/trofeu.tsx'
import { Escudo } from '../../../_ui/ui.tsx'
import { Fechado, Pendentes, useComandos, type Comandos } from '../comandos.tsx'
import { dataLonga, dinheiro, NOME_DIVISAO } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { Carregando } from '../hub.tsx'
import { marcarLidos, useVisto } from './lidos.ts'

const TIPOS: Record<TipoAviso, { rotulo: string; cor: string }> = {
  proposta: { rotulo: 'Proposta', cor: 'lavanda' },
  emprego: { rotulo: 'Emprego', cor: 'menta' },
  demissao: { rotulo: 'Demissão', cor: 'rosa' },
  aposentadoria: { rotulo: 'Aposentadoria', cor: 'pessego' },
  mercado: { rotulo: 'Mercado', cor: 'ceu' },
  temporada: { rotulo: 'Temporada', cor: '' },
  competicao: { rotulo: 'Competição', cor: 'ceu' },
}

export function Caixa({ pendentes }: { pendentes: Comando[] }) {
  const { mundo: m, eu, jogo } = useJogo()
  const k = useComandos(pendentes)
  const visto = useVisto()
  const [filtro, setFiltro] = useState<TipoAviso | null>(null)
  const [sel, setSel] = useState<number | null>(null)
  // o que estava novo ao abrir continua marcado nesta visita; depois marca tudo como lido
  const [novosAte, setNovosAte] = useState<number | null>(null)
  useEffect(() => {
    if (visto !== null && novosAte === null) setNovosAte(visto)
  }, [visto, novosAte])
  useEffect(() => {
    if (m && novosAte !== null) marcarLidos(jogo, m.dia)
  }, [m, jogo, novosAte])
  if (!m) return <Carregando />

  // avisos de mundos anteriores à U8 não têm tipo
  const meus = m.avisos.map((a, i) => ({ a: a.tipo ? a : { ...a, tipo: 'mercado' as const }, i })).filter(({ a }) => a.tecnico === eu.tecnicoId).reverse()
  const lista = meus.filter(({ a }) => filtro === null || a.tipo === filtro)
  const atual = (meus.find((x) => x.i === sel) ?? lista[0])?.a ?? null
  const corte = novosAte ?? Infinity

  return (
    <div className="coluna">
      <div className="chips" role="group" aria-label="Filtrar avisos">
        <button aria-pressed={filtro === null} onClick={() => setFiltro(null)}>Todos <span className="fraco">{meus.length}</span></button>
        {(Object.keys(TIPOS) as TipoAviso[]).filter((t) => meus.some(({ a }) => a.tipo === t)).map((t) => (
          <button key={t} aria-pressed={filtro === t} onClick={() => setFiltro(filtro === t ? null : t)}>
            {TIPOS[t].rotulo} <span className="fraco">{meus.filter(({ a }) => a.tipo === t).length}</span>
          </button>
        ))}
      </div>
      <div className="grade2" style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(300px, 1fr)' }}>
        <section className="card" style={{ overflow: 'hidden' }}>
          {lista.length === 0 ? <p className="mudo" style={{ margin: 0, padding: 20 }}>Nada por aqui.</p> : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 720, overflowY: 'auto' }}>
              {lista.map(({ a, i }) => (
                <li key={i}>
                  <button onClick={() => setSel(i)} aria-pressed={a === atual}
                    style={{ width: '100%', height: 'auto', padding: '12px 20px', border: 0, borderTop: '1px solid var(--raised)', borderRadius: 0,
                      textAlign: 'left', display: 'flex', gap: 12, alignItems: 'flex-start', fontWeight: 400,
                      background: a === atual ? 'rgba(195,188,245,.10)' : 'transparent' }}>
                    <span style={{ width: 8, height: 8, marginTop: 6, borderRadius: '50%', flex: 'none', background: a.dia > corte ? 'var(--pessego)' : 'transparent' }} />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <span className="linha" style={{ gap: 8 }}>
                        <span className={`etiqueta ${TIPOS[a.tipo].cor}`}>{TIPOS[a.tipo].rotulo}</span>
                        {precisaResposta(m, a, eu.tecnicoId) && <span className="etiqueta pessego">responder</span>}
                        <span className="fraco" style={{ fontSize: 12 }}>{dataLonga(a.dia)}</span>
                      </span>
                      <span style={{ fontWeight: a.dia > corte ? 600 : 400 }}>{a.texto}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="coluna">
          {atual && <Detalhe m={m} a={atual} k={k} tecnico={eu.tecnicoId} />}
          <Pendentes k={k} tipos={['responderProposta', 'aceitarOferta', 'aposentar', 'pedirDemissao']} />
          <Carreira m={m} k={k} tecnico={eu.tecnicoId} />
        </aside>
      </div>
    </div>
  )
}

/** Ainda dá para agir sobre o aviso? */
function precisaResposta(m: Mundo, a: Aviso, tecnico: number | null): boolean {
  if (a.tipo === 'proposta') return m.propostasHumanas.some((p) => p.id === a.ref)
  if (a.tipo === 'emprego') return m.ofertas.some((o) => o.tecnico === tecnico)
  if (a.tipo === 'aposentadoria') return a.ref !== undefined && m.queremParar.includes(a.ref)
  return false
}

function Detalhe({ m, a, k, tecnico }: { m: Mundo; a: Aviso; k: Comandos; tecnico: number | null }) {
  const off = !k.aberto || k.ocupado
  const pedido = (f: (c: Comando) => boolean) => k.pendentes.find(f)
  let acao = null
  if (a.tipo === 'proposta') {
    const p = m.propostasHumanas.find((x) => x.id === a.ref)
    const r = pedido((c) => c.tipo === 'responderProposta' && c.proposta === a.ref)
    if (!p) acao = <p className="fraco" style={{ margin: 0 }}>Já respondida ou expirada.</p>
    else {
      const j = m.jogadores[p.jogador]!
      acao = (
        <>
          <p className="mudo" style={{ margin: 0, fontSize: 13 }}>{j.nome}: valor {dinheiro(j.valor)}, oferta {dinheiro(p.valor)}. Sem resposta até a próxima rodada, cai.</p>
          {r?.tipo === 'responderProposta' ? <span className={`etiqueta ${r.aceitar ? 'menta' : 'rosa'}`}>{r.aceitar ? 'Vai aceitar' : 'Vai recusar'}</span> : (
            <div className="linha">
              <button className="primario" disabled={off} onClick={() => void k.mandar({ tipo: 'responderProposta', proposta: p.id, aceitar: true })}>Aceitar</button>
              <button disabled={off} onClick={() => void k.mandar({ tipo: 'responderProposta', proposta: p.id, aceitar: false })}>Recusar</button>
            </div>
          )}
        </>
      )
    }
  } else if (a.tipo === 'emprego' || a.tipo === 'demissao') {
    const times = m.ofertas.filter((o) => o.tecnico === tecnico).flatMap((o) => o.times)
    const escolhido = pedido((c) => c.tipo === 'aceitarOferta')
    if (times.length) acao = (
      <div className="coluna" style={{ gap: 8 }}>
        {times.map((id) => {
          const t = m.times[id]!
          const vai = escolhido?.tipo === 'aceitarOferta' && escolhido.time === id
          return (
            <div key={id} className="linha">
              <Escudo fileRef={t.fileRef} tamanho={28} />
              <span style={{ flex: 1 }}><strong>{t.nome}</strong> <span className="fraco">{NOME_DIVISAO[t.divisao]}</span></span>
              {vai ? <span className="etiqueta menta">aceita</span>
                : <button disabled={off || !!escolhido} onClick={() => void k.mandar({ tipo: 'aceitarOferta', time: id })}>Aceitar</button>}
            </div>
          )
        })}
        <p className="fraco" style={{ margin: 0, fontSize: 12 }}>Sem aceitar, as propostas caem quando a rodada resolve.</p>
      </div>
    )
    else if (a.tipo === 'emprego') acao = <p className="fraco" style={{ margin: 0 }}>Essas propostas já não valem.</p>
  } else if (a.tipo === 'aposentadoria' && a.ref !== undefined && m.queremParar.includes(a.ref)) {
    const j = m.jogadores[a.ref]!
    const vai = pedido((c) => c.tipo === 'aposentar' && c.jogador === a.ref)
    acao = vai ? <span className="etiqueta pessego">Vai se aposentar</span> : (
      <>
        <p className="mudo" style={{ margin: 0, fontSize: 13 }}>{j.nome} tem {j.idade} anos e força {j.forca}. Sem resposta, ele fica mais uma temporada.</p>
        <button disabled={off} onClick={() => void k.mandar({ tipo: 'aposentar', jogador: j.id })}>Deixar se aposentar</button>
      </>
    )
  }
  return (
    <div className="card secao" style={{ gap: 12 }}>
      <div className="linha" style={{ gap: 8 }}>
        <span className={`etiqueta ${TIPOS[a.tipo].cor}`}>{TIPOS[a.tipo].rotulo}</span>
        <span className="fraco" style={{ fontSize: 12 }}>{dataLonga(a.dia)}</span>
      </div>
      <p style={{ margin: 0, lineHeight: 1.5 }}>{a.texto}</p>
      {a.tipo === 'temporada' && <TitulosDaTemporada m={m} a={a} tecnico={tecnico} />}
      {acao}
      {acao && <Fechado k={k} />}
    </div>
  )
}

/** Os títulos do técnico na temporada do resumo; o ano vem no texto ("Fim da temporada 2026", rodada.ts). */
function TitulosDaTemporada({ m, a, tecnico }: { m: Mundo; a: Aviso; tecnico: number | null }) {
  const ano = Number(/temporada (\d+)/.exec(a.texto)?.[1])
  const titulos = (tecnico === null ? [] : m.tecnicos[tecnico]!.titulos).filter((x) => ANO_INICIAL + x.temporada - 1 === ano)
  return titulos.length > 0 && <SalaDeTrofeus titulos={comNome(m, titulos)} />
}

const comNome = (m: Mundo, titulos: { competicao: string; temporada: number }[]) => titulos.map((x) => ({
  ...x, nome: m.historico.find((h) => h.competicao === x.competicao)?.nome ?? m.competicoes.find((c) => c.id === x.competicao)?.nome ?? x.competicao,
}))

/** Pedir demissão (com confirmação: o clube não volta). */
function Carreira({ m, k, tecnico }: { m: Mundo; k: Comandos; tecnico: number | null }) {
  const [certeza, setCerteza] = useState(false)
  const tc = tecnico === null ? null : m.tecnicos[tecnico]
  if (!tc || tc.time === null) return (
    <div className="card secao"><h2>Sem clube</h2><p className="mudo" style={{ margin: 0, fontSize: 13 }}>As propostas de emprego chegam aqui.</p></div>
  )
  const pedida = k.pendentes.some((c) => c.tipo === 'pedirDemissao')
  return (
    <div className="card secao" style={{ gap: 10 }}>
      <h2>Carreira</h2>
      <p className="mudo" style={{ margin: 0, fontSize: 13 }}>
        {tc.temporadas} temporada{tc.temporadas === 1 ? '' : 's'} no {m.times[tc.time]!.nome} · {tc.jogos} jogos, {tc.vitorias} vitórias · {tc.titulos.length} título{tc.titulos.length === 1 ? '' : 's'}
      </p>
      {tc.titulos.length > 0 && <SalaDeTrofeus titulos={comNome(m, tc.titulos)} />}
      {!pedida && (
        <>
          <label className="check"><input type="checkbox" checked={certeza} onChange={(e) => setCerteza(e.target.checked)} /> Quero sair do clube</label>
          <button className="perigo" disabled={!certeza || !k.aberto || k.ocupado} onClick={() => void k.mandar({ tipo: 'pedirDemissao' })}>Pedir demissão</button>
        </>
      )}
    </div>
  )
}
