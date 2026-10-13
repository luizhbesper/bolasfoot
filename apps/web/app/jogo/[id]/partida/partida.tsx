'use client'
// Partida: todos os jogos do dia no relógio do servidor (o log da rodada inteiro já está no cliente; a tela só mostra o
// que o relógio alcançou), o seu jogo em destaque, os dos amigos, sons, o painel do intervalo e os resultados.
import type { Comando, Mundo, Partida as PartidaM } from '@bolasfoot/engine'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { ResumoRodada } from '../../../../lib/game/rodada.ts'
import { Icone } from '../../../_ui/icones.tsx'
import { ChipPosicao, Escudo } from '../../../_ui/ui.tsx'
import { enviarComandosAcao } from '../acoes.ts'
import { BotaoPronto, Relogio } from '../casca.tsx'
import { useJogo, useRelogio, type EstadoFase } from '../contexto.tsx'
import { ESTILOS, JOGADAS, MARCACOES } from '../escalacao/escalacao.tsx'
import s from './partida.module.css'

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

/** Ícone (letra), cor e texto do evento; null = não aparece sozinho (a assistência vai junto do gol). */
function descrever(e: EventoLog, nomes: string[]): { ic: string; cor: string; txt: string } | null {
  const time = nomes[e.lado]
  const quem = e.nome ?? '?'
  switch (e.tipo) {
    case 1: return { ic: 'G', cor: 'menta', txt: `Gol${GOL[e.subtipo ?? 1]} do ${time} — ${quem}${e.nome2 ? `, assistência de ${e.nome2}` : ''}` }
    case 2: return { ic: 'A', cor: 'manteiga', txt: `Amarelo — ${quem} (${time})` }
    case 3: return { ic: 'V', cor: 'rosa', txt: `2º amarelo, expulso — ${quem} (${time})` }
    case 4: return { ic: 'V', cor: 'rosa', txt: `Vermelho — ${quem} (${time})` }
    case 5: return { ic: '+', cor: 'rosa', txt: `Lesão — ${quem} (${time})${e.dias ? `, ${e.dias} dias` : ''}` }
    case 6: return { ic: '⇄', cor: 'ceu', txt: `${time}: sai ${quem}, entra ${e.nome2 ?? '?'}` }
    case 7: return { ic: 'P', cor: 'pessego', txt: `Pênalti perdido — ${quem} (${time})${e.nome2 ? `, ${e.nome2} defendeu` : ''}` }
    default: return null
  }
}

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
  // a fase chega pelo SSE antes do log novo (refresh do servidor): sem isso aparecia "Encerrada" com o relógio correndo
  const atrasado = fase.fase !== null && fase.fase !== 'planejamento' && (log?.n ?? 0) < fase.rodada
  const titulo = atrasado ? 'Carregando…' : !log ? 'Partida' : fase.status === 'paused' ? 'Pausado'
    : aoVivo ? `AO VIVO · ${fase.fase === 'ao_vivo_1t' ? '1º' : '2º'} tempo` : noIntervalo ? 'Intervalo' : 'Encerrada'
  const maiorAcr = Math.max(0, ...partidas.map((p) => p.acrescimos[pt.tempo - 1]!))
  const progresso = aoVivo ? Math.min(1, pt.min / (45 + maiorAcr)) : 1

  const humanos = new Map(membros.filter((x) => x.teamRef).map((x) => [m?.times.find((t) => t.fileRef === x.teamRef)?.id, x.nome]))
  const amigos = partidas.filter((p) => p !== minha && p.times.some((t) => humanos.has(t)))
  // a competição do seu jogo primeiro, depois as dos amigos, depois o resto na ordem do motor
  const peso = (p: PartidaLog) => (p.comp === minha?.comp ? 0 : amigos.some((a) => a.comp === p.comp) ? 1 : 2)
  const grupos = new Map<string, PartidaLog[]>()
  for (const p of [...partidas].sort((a, b) => peso(a) - peso(b))) grupos.set(p.compNome, [...(grupos.get(p.compNome) ?? []), p])

  return (
    <div className={s.tela}>
      <header className={s.topo}>
        <Link href={`/jogo/${jogo}`} className={s.voltar}><Icone nome="voltar" />Clube</Link>
        <span className={s.titulo}>{log ? `Rodada ${log.n}` : 'Partida'}</span>
        <span className={`etiqueta ${aoVivo ? 'menta' : noIntervalo ? 'pessego' : ''}`}>{aoVivo && <span className={s.ponto} />}{titulo}</span>
        <div className={s.progresso}>
          <div className={s.trilho}><div style={{ width: `${progresso * 100}%` }} /></div>
          {aoVivo && <strong>{rotuloMinuto(pt.tempo, Math.min(pt.min, 44 + maiorAcr))}</strong>}
        </div>
        {!aoVivo && !atrasado && <Relogio />}
        {noIntervalo && eu.tecnicoId !== null && <BotaoPronto />}
        {!aoVivo && !noIntervalo && !atrasado && <Link href={`/jogo/${jogo}`} className={`${s.cta} primario`}>Continuar <Icone nome="seta" /></Link>}
        <button className={s.som} onClick={() => setSom(!somLigado)} aria-pressed={somLigado} aria-label={somLigado ? 'Desligar som' : 'Ligar som'}
          title={somLigado ? 'Som ligado' : 'Som desligado'}>
          <Icone nome={somLigado ? 'som' : 'mudo'} />
        </button>
      </header>

      {!log || partidas.length === 0 ? (
        <p className="mudo" style={{ padding: 24 }}>Nenhuma partida jogada ainda.</p>
      ) : (
        <div className={s.grade}>
          <section className={s.principal}>
            {minha && <Destaque p={minha} pt={pt} m={m} esconderLances={noIntervalo} />}
            {noIntervalo && m && meuTime && <PainelIntervalo key={log.n} m={m} timeId={meuTime.id} pendentes={pendentes} />}
            {amigos.length > 0 && (
              <div className={s.amigos}>
                {amigos.map((p, i) => <Amigo key={i} p={p} pt={pt} m={m} quem={p.times.map((t) => humanos.get(t)).filter(Boolean).join(' × ')} />)}
              </div>
            )}
          </section>
          <aside className={`card ${s.todos}`}>
            <div className="cabecalho"><h2>Todos os jogos</h2><span className="fraco" style={{ fontSize: 12 }}>{partidas.length} partidas</span></div>
            <div className={s.rolagem}>
              {[...grupos].map(([nome, ps]) => (
                <div key={nome}>
                  <div className={s.comp}>{nome}</div>
                  {ps.map((p, i) => <LinhaJogo key={i} p={p} pt={pt} m={m} minha={p === minha} />)}
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

/** Nome do time na faixa cor1/cor2 do original (a identidade do Brasfoot na tela de jogos). */
function Faixa({ m, id, nome }: { m: Mundo | null; id: number; nome: string }) {
  const t = m?.times[id]
  return <span className={s.faixa} style={t ? { background: t.cor1, color: t.cor2 } : undefined}>{nome}</span>
}

function Destaque({ p, pt, m, esconderLances }: { p: PartidaLog; pt: Ponto; m: Mundo | null; esconderLances: boolean }) {
  const g = placar(p, pt)
  const st = situacao(p, pt)
  const eventos = p.eventos.filter((e) => visivel(e, pt)).map((e) => ({ e, d: descrever(e, p.nomes) })).filter((x) => x.d)
  // os números são do tempo inteiro: só aparecem quando ele acaba
  const n = st.fim ? p.numeros : null
  return (
    <div className={`card ${s.destaque}`}>
      <div className={s.cabeca}>{p.compNome} · <strong>{st.texto}</strong></div>
      <div className={s.placarGrande}>
        <div className={s.lado}><Faixa m={m} id={p.times[0]!} nome={p.nomes[0]!} />{m && <Escudo fileRef={m.times[p.times[0]!]!.fileRef} tamanho={44} />}</div>
        <div className={s.gols}>{g[0]} <span>×</span> {g[1]}</div>
        <div className={s.lado}>{m && <Escudo fileRef={m.times[p.times[1]!]!.fileRef} tamanho={44} />}<Faixa m={m} id={p.times[1]!} nome={p.nomes[1]!} /></div>
      </div>
      {st.acabou && p.penaltis && <div className={s.cabeca}>Pênaltis: {p.penaltis.placar[0]} × {p.penaltis.placar[1]}</div>}
      {n && (
        <div className={s.numeros}>
          {([['Posse de bola', 'posse', '%'], ['Finalizações', 'chutes', ''], ['No gol', 'noAlvo', ''], ['Desarmes', 'desarmes', ''], ['Erros de passe', 'passesErrados', '']] as const)
            .map(([rotulo, k, suf]) => {
              const a = n[0]![k], b = n[1]![k]
              return (
                <div key={k} className={s.numero}>
                  <strong>{a}{suf}</strong>
                  <div><span>{rotulo}</span><div className={s.trilho}><div style={{ width: `${a + b ? (a / (a + b)) * 100 : 50}%` }} /></div></div>
                  <strong>{b}{suf}</strong>
                </div>
              )
            })}
        </div>
      )}
      {eventos.length > 0 && !esconderLances && (
        <ol className={s.eventos}>
          {eventos.map(({ e, d }, i) => (
            <li key={i}>
              <span className={s.min}>{rotuloMinuto(e.tempo, e.minuto)}</span>
              <span className={`${s.ic} ${s[d!.cor]}`}>{d!.ic}</span>
              <span>{d!.txt}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Amigo({ p, pt, m, quem }: { p: PartidaLog; pt: Ponto; m: Mundo | null; quem: string }) {
  const g = placar(p, pt)
  const ultimo = p.eventos.filter((e) => e.tipo === 1 && visivel(e, pt)).at(-1)
  return (
    <div className={`card ${s.amigo}`}>
      <div className="mudo" style={{ fontSize: 13 }}>{quem} · {p.compNome} · {situacao(p, pt).texto}</div>
      <div className={s.linhaAmigo}>
        {m && <Escudo fileRef={m.times[p.times[0]!]!.fileRef} tamanho={28} />}
        <span style={{ flex: 1 }}>{p.nomes[0]}</span>
        <strong className={s.placarMedio}>{g[0]} × {g[1]}</strong>
        <span style={{ flex: 1, textAlign: 'right' }}>{p.nomes[1]}</span>
        {m && <Escudo fileRef={m.times[p.times[1]!]!.fileRef} tamanho={28} />}
      </div>
      <div className="fraco" style={{ fontSize: 12 }}>{ultimo ? `Último gol: ${rotuloMinuto(ultimo.tempo, ultimo.minuto)} ${ultimo.nome ?? p.nomes[ultimo.lado]}` : 'Sem gols'}</div>
    </div>
  )
}

function LinhaJogo({ p, pt, m, minha }: { p: PartidaLog; pt: Ponto; m: Mundo | null; minha: boolean }) {
  const g = placar(p, pt)
  const st = situacao(p, pt)
  // o último lance que importa (gol ou expulsão), como na tela do original
  const ultimo = p.eventos.filter((e) => (e.tipo === 1 || e.tipo === 3 || e.tipo === 4) && visivel(e, pt)).at(-1)
  return (
    <div className={`${s.jogo} ${minha ? s.meu : ''}`}>
      <Faixa m={m} id={p.times[0]!} nome={p.nomes[0]!} />
      <span className={s.placarJogo}>{g[0]} × {g[1]}{st.acabou && p.penaltis ? <small> ({p.penaltis.placar[0]}–{p.penaltis.placar[1]})</small> : null}</span>
      <Faixa m={m} id={p.times[1]!} nome={p.nomes[1]!} />
      <span className={s.ultimo}>
        {ultimo && <><span className={`${s.ic} ${ultimo.tipo === 1 ? s.menta : s.rosa}`}>{ultimo.tipo === 1 ? 'G' : 'V'}</span>{ultimo.nome ?? p.nomes[ultimo.lado]} {rotuloMinuto(ultimo.tempo, ultimo.minuto)}</>}
      </span>
    </div>
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
      <p className="mudo" style={{ margin: 0, fontSize: 13 }}>Toque em quem sai e depois em quem entra.</p>
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
