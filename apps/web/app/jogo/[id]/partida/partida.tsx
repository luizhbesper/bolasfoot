'use client'
// Partida: todos os jogos do dia no relógio do servidor (o log da rodada inteiro já está no cliente; a tela só mostra o
// que o relógio alcançou), o seu jogo em destaque, os dos amigos, sons, o painel do intervalo e os resultados.
import { escolherParaSlot, type Comando, type Mundo, type Partida as PartidaM } from '@bolasfoot/engine'
import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { ResumoRodada } from '../../../../lib/game/rodada.ts'
import { Icone } from '../../../_ui/icones.tsx'
import { ChipPosicao, Escudo, fundoEstadio } from '../../../_ui/ui.tsx'
import { enviarComandosAcao } from '../acoes.ts'
import { BotaoPronto, Prontos, Relogio } from '../casca.tsx'
import { useJogo, useRelogio, type EstadoFase } from '../contexto.tsx'
import { confronto, dataLonga, dinheiro, etapaDoJogo, textoConfronto } from '../consultas.ts'
import { caracteristicas } from '../elenco/elenco.tsx'
import { ESTILOS, JOGADAS, MARCACOES } from '../escalacao/escalacao.tsx'
import s from './partida.module.css'
import { classificacao, Seta, TabelaRodada, variacao, type Classificacao } from './tabela.tsx'

type PartidaLog = ResumoRodada['partidas'][number]
type EventoLog = PartidaLog['eventos'][number]
interface Log { n: number; etapa: number; resumo: ResumoRodada }

/** Até onde a tela mostra: tempo e minuto decorrido nele (Infinity = o tempo inteiro). */
interface Ponto { tempo: 1 | 2; min: number }

function pontoAtual(fase: EstadoFase, log: Log, agora: number | null, msPorMinuto: number): Ponto {
  if (log.n !== fase.rodada) return { tempo: 2, min: Infinity }
  // sem relógio (render do servidor) não mostra nada do tempo em curso, para não vazar o placar
  const decorrido = agora === null || fase.inicio === null ? 0 : Math.max(0, (agora - fase.inicio) / msPorMinuto)
  if (fase.fase === 'ao_vivo_1t') return { tempo: 1, min: decorrido }
  if (fase.fase === 'intervalo') return { tempo: 1, min: Infinity }
  if (fase.fase === 'ao_vivo_2t') return { tempo: 2, min: decorrido }
  return { tempo: 2, min: Infinity }
}

const visivel = (e: Pick<EventoLog, 'tempo' | 'minuto'>, p: Ponto) => e.tempo < p.tempo || (e.tempo === p.tempo && e.minuto < p.min)

/** "17'", "45+2'", "90+1'": o minuto em curso do tempo (eventos usam o minuto 0-based do motor). */
function rotuloMinuto(tempo: 1 | 2, minuto: number): string {
  const m = Math.floor(minuto) + 1
  const base = tempo === 2 ? 45 : 0
  return m > 45 ? `${base + 45}+${m - 45}'` : `${base + m}'`
}

function situacao(p: PartidaLog, pt: Ponto): { texto: string; fim: boolean; acabou: boolean } {
  const dur = 45 + p.acrescimos[pt.tempo - 1]!
  if (pt.min < dur) return { texto: rotuloMinuto(pt.tempo, pt.min), fim: false, acabou: false }
  return pt.tempo === 1 ? { texto: 'Intervalo', fim: true, acabou: false } : { texto: 'Fim', fim: true, acabou: true }
}

function placar(p: PartidaLog, pt: Ponto): [number, number] {
  const g: [number, number] = [0, 0]
  for (const e of p.eventos) if (e.tipo === 1 && visivel(e, pt)) g[e.lado]++
  return g
}

const GOL = ['', '', ' contra', ' de pênalti', ' de falta', ' olímpico']

// --- sons -------------------------------------------------------------------------------------------------------

function somDe(e: EventoLog, eu: 0 | 1): string | null {
  if (e.tipo === 1) return e.lado === eu ? 'gol1' : 'goladv'
  return e.tipo === 3 || e.tipo === 4 ? 'expulsao' : e.tipo === 5 ? 'contusao' : e.tipo === 7 ? 'penalty' : null
}

/** Toca o som do que acabou de aparecer (o último, se vieram vários); nada do que já estava na tela ao abrir. */
function useSons(sons: string[], pronto: boolean, ligado: boolean) {
  const vistos = useRef<number | null>(null)
  useEffect(() => {
    if (!pronto) return
    if (vistos.current !== null && sons.length > vistos.current && ligado)
      new Audio(`/assets/sons/${sons.at(-1)}.wav`).play().catch(() => {}) // sem gesto do usuário o navegador recusa
    vistos.current = sons.length
  }, [sons, pronto, ligado])
}

function useSomLigado(): [boolean, (v: boolean) => void] {
  const [ligado, setLigado] = useState(true)
  useEffect(() => {
    try {
      setLigado(localStorage.getItem('som') !== '0')
    } catch {
      // sem storage: fica ligado
    }
  }, [])
  return [ligado, (v) => {
    setLigado(v)
    try {
      localStorage.setItem('som', v ? '1' : '0')
    } catch {
      // idem
    }
  }]
}

// --- tela -------------------------------------------------------------------------------------------------------

export function Partida({ log, pendentes }: { log: Log | null; pendentes: Comando[] }) {
  const { jogo, fase, msPorMinuto, mundo: m, meuTime, membros, eu } = useJogo()
  const agora = useRelogio(500)
  const [somLigado, setSom] = useSomLigado()
  const pt = log ? pontoAtual(fase, log, agora, msPorMinuto) : { tempo: 2 as const, min: Infinity }
  const partidas = log?.resumo.partidas ?? []
  const minha = meuTime ? partidas.find((p) => p.times.includes(meuTime.id)) : undefined
  const ladoMeu = minha && meuTime ? (minha.times[0] === meuTime.id ? 0 : 1) : 0

  const sons: string[] = []
  if (minha) {
    for (const e of minha.eventos) if (visivel(e, pt)) { const x = somDe(e, ladoMeu); if (x) sons.push(x) }
    const st = situacao(minha, pt)
    if (st.fim) sons.push(st.acabou ? 'fimjogo' : 'intervalo')
  }
  useSons(sons, agora !== null, somLigado)

  const aoVivo = log?.n === fase.rodada && (fase.fase === 'ao_vivo_1t' || fase.fase === 'ao_vivo_2t')
  const noIntervalo = log?.n === fase.rodada && fase.fase === 'intervalo'
  const resultados = log?.n === fase.rodada && fase.fase === 'resultados'
  // a fase chega pelo SSE antes do log novo (refresh do servidor): sem isso aparecia "Encerrada" com o relógio correndo
  const atrasado = fase.fase !== null && fase.fase !== 'planejamento' && (log?.n ?? 0) < fase.rodada
  const titulo = atrasado ? 'Carregando…' : !log ? 'Partida' : fase.aguardando ? 'Aguardando todos online' : fase.status === 'paused' ? 'Pausado'
    : aoVivo ? `Ao vivo, ${fase.fase === 'ao_vivo_1t' ? '1º' : '2º'} tempo` : noIntervalo ? 'Intervalo' : 'Encerrada'

  const humanos = new Map(membros.filter((x) => x.teamRef).map((x) => [m?.times.find((t) => t.fileRef === x.teamRef)?.id, x.nome]))
  const amigos = partidas.filter((p) => p !== minha && p.times.some((t) => humanos.has(t)))

  // classificação: ao vivo o mundo é o de antes da rodada; nos resultados (e no planejamento seguinte), o de depois
  const depoisDaRodada = resultados || (fase.fase === 'planejamento' && log?.n === fase.rodada - 1)
  const modo = aoVivo || noIntervalo ? 'vivo' : depoisDaRodada ? 'depois' : null
  const tabela = (comp: string) => m && modo
    ? classificacao(m, comp, partidas.filter((p) => p.comp === comp).map((p) => ({ casa: p.times[0]!, fora: p.times[1]!, gols: placar(p, pt) })), modo, meuTime?.id, log?.resumo.antes?.[comp])
    : null

  return (
    <div className={s.tela}>
      <header className={s.topo}>
        <Link href={`/jogo/${jogo}`} className={s.voltar}><Icone nome="voltar" />Clube</Link>
        <span className={s.titulo}>{log?.resumo.dias[0] !== undefined ? dataLonga(log.resumo.dias[0]) : 'Partida'}</span>
        <span className={`etiqueta ${aoVivo ? 'menta' : noIntervalo ? 'pessego' : ''}`}>{aoVivo && <span className={s.ponto} />}{titulo}</span>
        <span style={{ flex: 1 }} />
        {noIntervalo || resultados ? <Prontos /> : !aoVivo && !atrasado && <Relogio />}
        {noIntervalo && eu.tecnicoId !== null && <BotaoPronto />}
        {resultados && eu.tecnicoId !== null ? <BotaoPronto depois={`/jogo/${jogo}`} />
          : !aoVivo && !noIntervalo && !atrasado && <Link href={`/jogo/${jogo}`} className={`${s.cta} primario`}>Continuar <Icone nome="seta" /></Link>}
        <button className={s.som} onClick={() => setSom(!somLigado)} aria-pressed={somLigado} aria-label={somLigado ? 'Desligar som' : 'Ligar som'}
          title={somLigado ? 'Som ligado' : 'Som desligado'}>
          <Icone nome={somLigado ? 'som' : 'mudo'} />
        </button>
      </header>

      {!log || partidas.length === 0 ? (
        <p className="mudo" style={{ padding: 24 }}>Nenhuma partida jogada ainda.</p>
      ) : (
        <>
          {minha && <Placar p={minha} pt={pt} m={m} dias={log.resumo.dias} />}
          <div className={s.grade}>
            <section className={s.principal}>
              {amigos.length > 0 && (
                <div className={s.amigos}>
                  {amigos.map((p, i) => <Amigo key={i} p={p} pt={pt} m={m} quem={p.times.map((t) => humanos.get(t)).filter(Boolean).join(' e ')} />)}
                </div>
              )}
              {resultados && m && <Resumo m={m} partidas={partidas} minha={minha} amigos={amigos} humanos={humanos} eu={meuTime?.id ?? -1} tabela={tabela} />}
              {noIntervalo && m && meuTime ? <PainelIntervalo key={log.n} m={m} timeId={meuTime.id} pendentes={pendentes} />
                : minha ? <Lances p={minha} pt={pt} /> : <p className="mudo">Seu time não joga nesta rodada.</p>}
            </section>
            <OutrosJogos partidas={partidas} minha={minha} amigos={amigos} pt={pt} m={m} tabela={tabela} vivo={modo === 'vivo'} eu={meuTime?.id ?? -1} />
          </div>
        </>
      )}
    </div>
  )
}

/** Posição do minuto na linha do jogo (0–1): cada tempo ocupa metade, acréscimos incluídos. */
function naLinha(p: PartidaLog, tempo: 1 | 2, minuto: number): number {
  const dur = 45 + p.acrescimos[tempo - 1]!
  return (tempo - 1) / 2 + Math.min(minuto, dur) / dur / 2
}

/** O placar em faixa: as cores dos clubes vêm das laterais, e embaixo a linha do jogo com gols e expulsões no minuto. */
function Placar({ p, pt, m, dias }: { p: PartidaLog; pt: Ponto; m: Mundo | null; dias: number[] }) {
  const g = placar(p, pt)
  const st = situacao(p, pt)
  const marcos = p.eventos.filter((e) => (e.tipo === 1 || e.tipo === 3 || e.tipo === 4) && visivel(e, pt))
  const agora = pt.min === Infinity ? (pt.tempo === 1 ? 0.5 : 1) : naLinha(p, pt.tempo, pt.min)
  const t = (i: 0 | 1) => m?.times[p.times[i]!]
  const n = st.fim ? p.numeros : null
  // o que é o jogo: "Paulista, 7ª rodada · Itaquerão"
  const etapa = m ? dias.map((d) => etapaDoJogo(m, p.comp, p.times[0]!, p.times[1]!, d)).find(Boolean) : ''
  const sede = p.sede ? m?.times[p.sede.time] : null
  const agregado = m ? textoConfronto(dias.map((d) => confronto(m, p.comp, p.times[0]!, p.times[1]!, d, g)).find(Boolean) ?? null) : ''
  const sobre = [[p.compNome, etapa].filter(Boolean).join(', '), agregado, p.sede && `Final em ${p.sede.cidade}`, (sede ?? t(0))?.estadio.nome,
    p.publico && `${p.publico.toLocaleString('pt-BR')} pagantes`].filter(Boolean).join(' · ')
  return (
    <section className={s.placar} style={{ '--c0': t(0)?.cor1 ?? 'transparent', '--c1': t(1)?.cor1 ?? 'transparent', '--estadio': fundoEstadio(p.times[0]!) } as CSSProperties}>
      <div className={s.sobre}>{sobre}</div>
      <div className={s.confronto}>
        <div className={s.clube}>
          {m && <Escudo fileRef={t(0)!.fileRef} tamanho={72} />}
          <span>{p.nomes[0]}</span>
        </div>
        <div className={s.centro}>
          <div className={s.gols}>{g[0]}<span>–</span>{g[1]}</div>
          <div className={s.minuto}>{st.texto}{st.acabou && p.penaltis ? `, pênaltis ${p.penaltis.placar[0]}–${p.penaltis.placar[1]}` : ''}</div>
        </div>
        <div className={`${s.clube} ${s.fora}`}>
          {m && <Escudo fileRef={t(1)!.fileRef} tamanho={72} />}
          <span>{p.nomes[1]}</span>
        </div>
      </div>
      <div className={s.linhaJogo} aria-hidden="true">
        <div className={s.corrido} style={{ width: `${agora * 100}%` }} />
        <div className={s.meioTempo} />
        {marcos.map((e, i) => (
          <span key={i} className={`${s.marco} ${e.tipo === 1 ? s.menta : s.rosa} ${e.lado === 0 ? s.acima : s.abaixo}`}
            style={{ left: `${naLinha(p, e.tempo, e.minuto) * 100}%` }} title={`${rotuloMinuto(e.tempo, e.minuto)} ${e.nome ?? ''}`}>
            {e.tipo === 1 ? 'G' : 'V'}
          </span>
        ))}
      </div>
      {n && (
        <dl className={s.numeros}>
          {([['Posse', 'posse', '%'], ['Finalizações', 'chutes', ''], ['No gol', 'noAlvo', ''], ['Desarmes', 'desarmes', ''], ['Erros de passe', 'passesErrados', '']] as const)
            .map(([rotulo, k, suf]) => {
              const a = n[0]![k], b = n[1]![k]
              return (
                <div key={k}>
                  <dt>{rotulo}</dt>
                  <dd><strong>{a}{suf}</strong><span className={s.barra}><span style={{ width: `${a + b ? (a / (a + b)) * 100 : 50}%` }} /></span><strong>{b}{suf}</strong></dd>
                </div>
              )
            })}
        </dl>
      )}
    </section>
  )
}

/** Texto curto do lance: o lado já diz de que time é. */
function lance(e: EventoLog): { ic: string; cor: string; quem: string; extra?: string } | null {
  const quem = e.nome ?? '?'
  switch (e.tipo) {
    case 1: return { ic: 'G', cor: 'menta', quem, extra: [GOL[e.subtipo ?? 1]?.trim(), e.nome2 && `assist. ${e.nome2}`].filter(Boolean).join(', ') || undefined }
    case 2: return { ic: 'A', cor: 'manteiga', quem, extra: 'amarelo' }
    case 3: return { ic: 'V', cor: 'rosa', quem, extra: '2º amarelo, expulso' }
    case 4: return { ic: 'V', cor: 'rosa', quem, extra: 'expulso' }
    case 5: return { ic: '+', cor: 'rosa', quem, extra: e.dias ? `lesão, ${e.dias} dias` : 'lesão' }
    case 6: return { ic: '⇄', cor: 'ceu', quem: e.nome2 ?? '?', extra: `no lugar de ${quem}` }
    case 7: return { ic: 'P', cor: 'pessego', quem, extra: e.nome2 ? `pênalti perdido, ${e.nome2} defendeu` : 'pênalti perdido' }
    default: return null
  }
}

/** Lance a lance numa linha do tempo: mandante à esquerda, visitante à direita, o mais recente em cima. */
function Lances({ p, pt }: { p: PartidaLog; pt: Ponto }) {
  const lista = p.eventos.filter((e) => visivel(e, pt)).map((e) => ({ e, l: lance(e) })).filter((x) => x.l).reverse()
  return (
    <div className={`card ${s.lances}`}>
      <h2>Lance a lance</h2>
      {lista.length === 0 ? <p className="mudo" style={{ margin: 0 }}>Nada ainda. A bola está rolando.</p> : (
        <ol>
          {lista.map(({ e, l }, i) => (
            <li key={i} className={`${e.lado === 0 ? s.casa : s.visita} ${e.tipo === 1 ? s.gol : ''}`}>
              <span className={s.texto}>
                <span className={`${s.ic} ${s[l!.cor]}`}>{l!.ic}</span>
                <span><strong>{l!.quem}</strong>{l!.extra && <span className="fraco"> {l!.extra}</span>}</span>
              </span>
              <span className={s.min}>{rotuloMinuto(e.tempo, e.minuto)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Amigo({ p, pt, m, quem }: { p: PartidaLog; pt: Ponto; m: Mundo | null; quem: string }) {
  const g = placar(p, pt)
  return (
    <div className={`card ${s.amigo}`}>
      <span className={s.quem}>{quem}</span>
      {m && <Escudo fileRef={m.times[p.times[0]!]!.fileRef} tamanho={22} mini />}
      <span className={s.nome}>{p.nomes[0]}</span>
      <strong className={s.placarPequeno}>{g[0]}–{g[1]}</strong>
      <span className={s.nome}>{p.nomes[1]}</span>
      {m && <Escudo fileRef={m.times[p.times[1]!]!.fileRef} tamanho={22} mini />}
      <span className={s.quando}>{situacao(p, pt).texto}</span>
    </div>
  )
}

/** Os outros jogos do dia por competição: a sua primeiro, depois as dos amigos, depois o resto. */
function OutrosJogos({ partidas, minha, amigos, pt, m, tabela, vivo, eu }: {
  partidas: PartidaLog[]; minha?: PartidaLog; amigos: PartidaLog[]; pt: Ponto; m: Mundo | null
  tabela: (comp: string) => Classificacao | null; vivo: boolean; eu: number
}) {
  const peso = (c: string) => (c === minha?.comp ? 0 : amigos.some((a) => a.comp === c) ? 1 : 2)
  const comps = [...new Map(partidas.map((p) => [p.comp, p.compNome]))].sort((a, b) => peso(a[0]) - peso(b[0]))
  const [comp, setComp] = useState<string | null>(null)
  const [verTabela, setVerTabela] = useState(false)
  const atual = comps.some(([c]) => c === comp) ? comp! : comps[0]?.[0]
  const c = atual && m ? tabela(atual) : null
  return (
    <aside className={`card ${s.outros}`}>
      <div className={s.chips} role="tablist" aria-label="Competições">
        {comps.map(([c, nome]) => (
          <button key={c} role="tab" aria-selected={c === atual} className={c === atual ? s.chipSel : undefined} onClick={() => setComp(c)}>{nome}</button>
        ))}
      </div>
      {c && (
        <div className={s.modo} role="group" aria-label="Mostrar">
          <button aria-pressed={!verTabela} onClick={() => setVerTabela(false)}>Jogos</button>
          <button aria-pressed={verTabela} onClick={() => setVerTabela(true)}>{vivo ? 'Tabela em tempo real' : 'Tabela'}</button>
        </div>
      )}
      <div className={s.rolagem}>
        {c && verTabela && m ? <TabelaRodada c={c} m={m} eu={eu} />
          : partidas.filter((p) => p.comp === atual).map((p, i) => <LinhaJogo key={i} p={p} pt={pt} m={m} minha={p === minha} />)}
      </div>
    </aside>
  )
}

function LinhaJogo({ p, pt, m, minha }: { p: PartidaLog; pt: Ponto; m: Mundo | null; minha: boolean }) {
  const g = placar(p, pt)
  const st = situacao(p, pt)
  // o último lance que importa (gol ou expulsão), como na tela do original
  const ultimo = p.eventos.filter((e) => (e.tipo === 1 || e.tipo === 3 || e.tipo === 4) && visivel(e, pt)).at(-1)
  return (
    <div className={`${s.jogo} ${minha ? s.meu : ''}`}>
      <span className={s.mandante}>{p.nomes[0]}{m && <Escudo fileRef={m.times[p.times[0]!]!.fileRef} tamanho={18} mini />}</span>
      <span className={s.placarJogo}>{g[0]}–{g[1]}{st.acabou && p.penaltis ? <small> ({p.penaltis.placar[0]}–{p.penaltis.placar[1]})</small> : null}</span>
      <span className={s.visitante}>{m && <Escudo fileRef={m.times[p.times[1]!]!.fileRef} tamanho={18} mini />}{p.nomes[1]}</span>
      {ultimo && (
        <span className={`${s.ultimo} ${ultimo.lado === 0 ? s.mandante : s.visitante}`}>
          {ultimo.tipo === 1 ? '' : 'expulso: '}{ultimo.nome ?? p.nomes[ultimo.lado]} {rotuloMinuto(ultimo.tempo, ultimo.minuto)}
        </span>
      )}
    </div>
  )
}

// --- fim da rodada -------------------------------------------------------------------------------------------------

/** Resumo dos resultados: a tabela da sua liga mudando de posição e os jogos que importam (o seu, os dos amigos e os dos
 * adversários diretos, até duas posições acima ou abaixo). */
function Resumo({ m, partidas, minha, amigos, humanos, eu, tabela }: {
  m: Mundo; partidas: PartidaLog[]; minha?: PartidaLog; amigos: PartidaLog[]; humanos: Map<number | undefined, string>; eu: number
  tabela: (comp: string) => Classificacao | null
}) {
  // a liga do seu jogo; num dia de copa, a primeira liga com jogo de um amigo
  const comp = [minha, ...amigos].map((p) => p?.comp).find((x) => x && tabela(x))
  const c = comp ? tabela(comp) : null
  const amigosIds = new Set([...humanos.keys()].filter((t): t is number => t !== undefined && t !== eu))
  const i = c ? c.depois.indexOf(eu) : -1
  const rivais = c && i >= 0 ? c.depois.slice(Math.max(0, i - 2), i + 3).filter((t) => t !== eu && !amigosIds.has(t)) : []
  const jogoDe = (t: number) => partidas.find((p) => p.times.includes(t))
  const pos = (t: number) => `${c!.depois.indexOf(t) + 1}º ${m.times[t]!.nome}`
  // um jogo só quando dois adversários diretos se enfrentaram
  const jogosRivais = [...new Set(rivais.map(jogoDe).filter((p) => p && p !== minha))] as PartidaLog[]
  const semJogo = rivais.filter((t) => !jogoDe(t))
  const linha = (p: PartidaLog, quem: string, foco: number) => (
    <div key={`${quem}${p.times.join()}`} className={s.importante}>
      {quem && <span className={s.quem}>{quem}</span>}
      <span className="clube" style={{ justifyContent: 'flex-end', minWidth: 0 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nomes[0]}</span><Escudo fileRef={m.times[p.times[0]!]!.fileRef} tamanho={18} mini /></span>
      <strong className={s.placarJogo}>{p.placar[0]}–{p.placar[1]}</strong>
      <span className="clube" style={{ minWidth: 0 }}><Escudo fileRef={m.times[p.times[1]!]!.fileRef} tamanho={18} mini /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nomes[1]}</span></span>
      <span className={s.num}>{c && c.depois.includes(foco) ? <Seta v={variacao(c, foco)} /> : null}</span>
    </div>
  )
  return (
    <section className={`card ${s.resumo}`} aria-label="Fim da rodada">
      <div className="cabecalho"><h2>Fim da rodada</h2>{c && <span className="mudo" style={{ fontSize: 13 }}>{c.nome}</span>}</div>
      <div className={c ? s.resumoGrade : undefined}>
        {c && <TabelaRodada c={c} m={m} eu={eu} destaque={amigosIds} animar />}
        <div className={s.importantes}>
          {minha && <div className="coluna" style={{ gap: 8 }}><h3>Seu jogo</h3>{linha(minha, '', eu)}
            {minha.publico && <span className="mudo" style={{ fontSize: 13 }}>Público {minha.publico.toLocaleString('pt-BR')}{minha.times[0] === eu && minha.renda ? ` · renda ${dinheiro(minha.renda)}` : ''}</span>}</div>}
          {amigos.length > 0 && (
            <div className="coluna" style={{ gap: 8 }}><h3>Amigos</h3>
              {amigos.map((p) => {
                const t = p.times.find((x) => amigosIds.has(x))!
                return linha(p, humanos.get(t) ?? '', t)
              })}
            </div>
          )}
          {rivais.length > 0 && (
            <div className="coluna" style={{ gap: 8 }}><h3>Adversários diretos</h3>
              {jogosRivais.map((p) => {
                const deles = p.times.filter((t) => rivais.includes(t))
                return linha(p, deles.map(pos).join(' e '), deles[0]!)
              })}
              {semJogo.map((t) => <span key={t} className="mudo" style={{ fontSize: 13 }}>{pos(t)} não jogou</span>)}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// --- intervalo ----------------------------------------------------------------------------------------------------

type Sub = { sai: number; entra: number }

/** Substituições e tática do intervalo. Toque em quem sai e depois em quem entra; cada mudança é enviada inteira. */
function PainelIntervalo({ m, timeId, pendentes }: { m: Mundo; timeId: number; pendentes: Comando[] }) {
  const { jogo } = useJogo()
  const achado = m.emJogo?.partidas.map((x) => x.partida).find((p) => p.lados.some((l) => l.time === timeId))
  const l = achado ? (achado.lados[0].time === timeId ? 0 : 1) : 0
  const [subs, setSubs] = useState<Sub[]>(() => pendentes.flatMap((c) => (c.tipo === 'substituir' ? [{ sai: c.sai, entra: c.entra }] : [])))
  const [tatica, setTatica] = useState(() => {
    const t = pendentes.findLast((c) => c.tipo === 'mudarTatica')
    const atual = achado?.lados[l].tatica
    return { estilo: t?.tipo === 'mudarTatica' ? t.estilo ?? atual?.estilo ?? 0 : atual?.estilo ?? 0,
      marcacao: t?.tipo === 'mudarTatica' ? t.marcacao ?? atual?.marcacao ?? 0 : atual?.marcacao ?? 0,
      jogada: t?.tipo === 'mudarTatica' ? t.jogada ?? atual?.jogada ?? 0 : atual?.jogada ?? 0 }
  })
  const [sel, setSel] = useState<number | null>(null)
  const [estado, setEstado] = useState<string>('')

  if (!achado) return <div className="card secao"><p className="mudo" style={{ margin: 0 }}>Carregando o intervalo…</p></div>
  const p: PartidaM = achado
  const lado = p.lados[l]
  const restam = lado.subs - subs.length
  // lesionados do 1º tempo ainda não trocados, com a sugestão do motor (o melhor do banco para a posição dele)
  const livres = lado.banco.filter((id) => !subs.some((x) => x.entra === id)).map((id) => p.jogadores[id]!).sort((a, b) => b.forca - a.forca)
  const lesionados = lado.emCampo.map((id) => p.jogadores[id]!).filter((j) => j.lesao > 0 && !subs.some((x) => x.sai === j.id))
    .map((j) => ({ j, sug: escolherParaSlot(livres, j.slot) }))

  async function salvar(novasSubs: Sub[], novaTatica: typeof tatica) {
    setSubs(novasSubs)
    setTatica(novaTatica)
    setEstado('Salvando…')
    const erro = await enviarComandosAcao(jogo, [
      ...novasSubs.map((x): Comando => ({ tipo: 'substituir', sai: x.sai, entra: x.entra })),
      { tipo: 'mudarTatica', ...novaTatica },
    ])
    setEstado(erro ?? 'Salvo')
  }

  function tocar(id: number, emCampo: boolean) {
    if (subs.some((x) => x.sai === id || x.entra === id)) return
    if (emCampo) return setSel(sel === id ? null : id)
    if (sel === null || restam <= 0) return
    setSel(null)
    void salvar([...subs, { sai: sel, entra: id }], tatica)
  }

  const linha = (id: number, emCampo: boolean) => {
    const j = p.jogadores[id]!
    const usado = subs.some((x) => x.sai === id || x.entra === id)
    return (
      <li key={id}>
        <button className={`${s.jogador} ${sel === id ? s.sel : ''}`} disabled={usado || (!emCampo && (sel === null || restam <= 0))}
          onClick={() => tocar(id, emCampo)} aria-pressed={sel === id}>
          <ChipPosicao posicao={j.posicao} />
          <span className={s.nomeJog}>{j.nome}</span>
          {emCampo && j.lesao > 0 && <span className="etiqueta rosa">lesionado</span>}
          <span className="fraco" title="Características">{caracteristicas(j)}</span>
          <span className="fraco">F {j.forca}</span>
          <span className={j.energia < 70 ? s.cansado : 'mudo'}>E {j.energia}</span>
        </button>
      </li>
    )
  }

  return (
    <div className={`card ${s.intervalo}`}>
      <div className="linha">
        <h2 style={{ flex: 1, fontSize: 16 }}>Intervalo</h2>
        <span className="mudo" style={{ fontSize: 13 }}>{restam} substituiç{restam === 1 ? 'ão' : 'ões'} restante{restam === 1 ? '' : 's'}</span>
        {estado && <span className={estado === 'Salvo' || estado === 'Salvando…' ? 'fraco' : s.erro} style={{ fontSize: 13 }}>{estado}</span>}
      </div>
      <p className="mudo" style={{ margin: 0, fontSize: 13 }}>Toque em quem sai e depois em quem entra. No 2º tempo não tem pausa: quem se machucar sai na hora para o melhor do banco na posição.</p>
      {lesionados.map(({ j, sug }) => (
        <div key={j.id} className={s.lesao}>
          <span><strong>{j.nome}</strong> se machucou ({j.lesao} dias) e segue em campo até você trocar.</span>
          {sug && restam > 0 && <button className="primario" onClick={() => void salvar([...subs, { sai: j.id, entra: sug.id }], tatica)}>Trocar por {sug.nome}</button>}
        </div>
      ))}
      <div className={s.listas}>
        <div><h3>Em campo</h3><ul>{lado.emCampo.map((id) => linha(id, true))}</ul></div>
        <div><h3>Banco</h3><ul>{lado.banco.map((id) => linha(id, false))}</ul></div>
      </div>
      {subs.length > 0 && (
        <ul className={s.subs}>
          {subs.map((x, i) => (
            <li key={i}>
              <span><span className={s.sai}>↓ {p.jogadores[x.sai]!.nome}</span> <span className={s.entra}>↑ {p.jogadores[x.entra]!.nome}</span></span>
              <button className="fantasma" onClick={() => void salvar(subs.filter((_, k) => k !== i), tatica)}>Desfazer</button>
            </li>
          ))}
        </ul>
      )}
      <div className={s.taticas}>
        {([['Estilo de jogo', 'estilo', ESTILOS], ['Marcação', 'marcacao', MARCACOES], ['Concentrar ataques', 'jogada', JOGADAS]] as const).map(([rotulo, k, ops]) => (
          <label key={k}>{rotulo}
            <select value={tatica[k]} onChange={(ev) => void salvar(subs, { ...tatica, [k]: Number(ev.target.value) })}>
              {ops.map((n, i) => <option key={i} value={i}>{n}</option>)}
            </select>
          </label>
        ))}
      </div>
    </div>
  )
}
