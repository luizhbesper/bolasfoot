'use client'
// Escalação: campo com as camisas do original, banco e reservas. Toque num jogador e depois num lugar (posição do campo,
// vaga do banco, outro jogador para trocar ou "tirar do time"): serve para mouse e celular, sem drag-and-drop.
// Cada mudança é salva sozinha (escalar + tática + batedores) e validada pelo motor no servidor.
import {
  derivar, disponivel, escalarIA, escolherParaSlot, foraDePosicao, FORMACOES, NOMES_FORMACAO, porForca,
  type Comando, type JogadorM, type Mundo, type TimeM,
} from '@bolasfoot/engine'
import { useEffect, useRef, useState } from 'react'
import { Camisa } from '../../../_ui/camisa.tsx'
import { ChipPosicao, Energia, Forca, tomForca } from '../../../_ui/ui.tsx'
import { definirComandosAcao } from '../acoes.ts'
import { alerta, proximoJogo } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { caracteristicas } from '../elenco/elenco.tsx'
import { Carregando, SemClube } from '../hub.tsx'
import s from './escalacao.module.css'

/** Onde cada slot fica no campo (x, y em %; ataque para cima). Lado 1 = esquerdo. Slots: SLOTS do motor. */
const POS: Record<number, [number, number]> = {
  1: [50, 90],
  2: [13, 66], 9: [87, 66], 10: [12, 46], 17: [88, 46],
  3: [37, 74], 5: [63, 74], 4: [50, 76], 6: [33, 73], 7: [50, 76], 8: [67, 73],
  11: [36, 56], 12: [50, 58], 13: [64, 56], 14: [28, 38], 15: [50, 40], 16: [72, 38],
  18: [16, 18], 25: [84, 18], 19: [28, 16], 20: [50, 14], 21: [72, 16], 22: [34, 16], 23: [50, 15], 24: [66, 16],
}
const ESTILOS = ['Equilibrado', 'Ataque total', 'Contra-ataque']
const MARCACOES = ['Leve', 'Pesada', 'Muito pesada']
const JOGADAS = ['Pelo meio', 'Pelas laterais']
const MAX_BANCO = 11
// a formação 0 duplica a 1 no original; não aparece no seletor
const OPCOES_FORMACAO = NOMES_FORMACAO.map((n, i) => ({ i, n })).filter((x) => x.i > 0)

interface Estado {
  formacao: number
  titulares: Record<number, number> // slot → jogador
  banco: number[]
  estilo: number
  marcacao: number
  jogada: number
  falta: number | null
  escanteio: number | null
}

/** O que está valendo: comandos já enviados nesta fase, senão o salvo no time, senão a escalação da IA. */
function inicial(m: Mundo, t: TimeM, pendentes: Comando[], comp: string): Estado {
  const p = <T extends Comando['tipo']>(tipo: T) => pendentes.findLast((c) => c.tipo === tipo) as Extract<Comando, { tipo: T }> | undefined
  const esc = p('escalar'), tat = p('tatica'), bat = p('batedores')
  const formacao = esc?.formacao ?? (t.tatica.formacao || 1)
  const salvo = esc ?? t.escalacao ?? escalarIA(m, t.id, comp, derivar(m.seed, `ui:escalacao:${t.id}`), formacao)
  return {
    formacao,
    titulares: Object.fromEntries(salvo.titulares.map((x) => [x.slot, x.id])),
    banco: [...salvo.banco],
    estilo: tat?.estilo ?? t.tatica.estilo,
    marcacao: tat?.marcacao ?? t.tatica.marcacao,
    jogada: tat?.jogada ?? t.tatica.jogada,
    falta: bat ? bat.falta : t.batedores.falta,
    escanteio: bat ? bat.escanteio : t.batedores.escanteio,
  }
}

export function Escalacao({ pendentes }: { pendentes: Comando[] }) {
  const { mundo: m, meuTime: t, fase } = useJogo()
  if (!m) return <Carregando />
  if (!t) return <SemClube />
  const editavel = fase.status === 'running' && fase.fase === 'planejamento'
  // nova fase = novo snapshot: recomeça do que o servidor tem
  return <Editor key={`${fase.rodada}:${fase.fase}`} m={m} t={t} pendentes={pendentes} editavel={editavel} />
}

function Editor({ m, t, pendentes, editavel }: { m: Mundo; t: TimeM; pendentes: Comando[]; editavel: boolean }) {
  const { jogo } = useJogo()
  const prox = proximoJogo(m, t.id)
  const comp = prox?.compId ?? ''
  const [e, setE] = useState(() => inicial(m, t, pendentes, comp))
  const [sel, setSel] = useState<number | null>(null)
  const [salvo, setSalvo] = useState<'nada' | 'ok' | 'salvando' | string>('nada')
  const mudou = useRef(false)

  // salva sozinho, 600 ms depois da última mudança
  useEffect(() => {
    if (!mudou.current || !editavel) return
    setSalvo('salvando')
    const timer = setTimeout(async () => {
      const slots = FORMACOES[e.formacao]!
      const erro = await definirComandosAcao(jogo, [
        { tipo: 'escalar', formacao: e.formacao, titulares: slots.filter((x) => e.titulares[x] !== undefined).map((slot) => ({ id: e.titulares[slot]!, slot })), banco: e.banco },
        { tipo: 'tatica', estilo: e.estilo, marcacao: e.marcacao, jogada: e.jogada },
        { tipo: 'batedores', falta: e.falta, escanteio: e.escanteio },
      ])
      setSalvo(erro ?? 'ok')
    }, 600)
    return () => clearTimeout(timer)
  }, [e, editavel, jogo])

  const mudar = (f: (x: Estado) => Estado) => {
    if (!editavel) return
    mudou.current = true
    setE(f)
  }

  const jogadores = t.jogadores.map((id) => m.jogadores[id]!)
  const forcas = jogadores.map((j) => j.forca)
  const slots = FORMACOES[e.formacao]!
  const naEscalacao = new Set([...Object.values(e.titulares), ...e.banco])
  const reservas = jogadores.filter((j) => !naEscalacao.has(j.id)).sort((a, b) => a.posicao - b.posicao || porForca(a, b))

  type Lugar = { slot: number } | { banco: number } | null
  const lugar = (x: Estado, id: number): Lugar => {
    const slot = Object.entries(x.titulares).find(([, v]) => v === id)?.[0]
    if (slot !== undefined) return { slot: Number(slot) }
    const i = x.banco.indexOf(id)
    return i >= 0 ? { banco: i } : null
  }
  /** Põe `id` em `alvo`; quem estava lá vai para onde `id` estava (troca). */
  const mover = (id: number, alvo: Lugar) => mudar((x) => {
    const titulares = { ...x.titulares }
    let banco = [...x.banco]
    const de = lugar(x, id)
    const ocupante = alvo === null ? null : 'slot' in alvo ? titulares[alvo.slot] ?? null : banco[alvo.banco] ?? null
    const tirar = (l: Lugar) => {
      if (l && 'slot' in l) delete titulares[l.slot]
      else if (l) banco[l.banco] = -1
    }
    const por = (l: Lugar, j: number) => {
      if (l && 'slot' in l) titulares[l.slot] = j
      else if (l) banco[l.banco] = j
    }
    tirar(de)
    tirar(alvo)
    por(alvo, id)
    if (ocupante !== null && ocupante !== id) por(de, ocupante)
    banco = banco.filter((j) => j >= 0)
    return { ...x, titulares, banco }
  })

  const tocarJogador = (id: number) => {
    if (sel === null) return setSel(id)
    if (sel !== id) mover(sel, lugar(e, id))
    setSel(null)
  }
  const tocarVazio = (alvo: Lugar) => {
    if (sel === null) return
    mover(sel, alvo)
    setSel(null)
  }

  const trocarFormacao = (f: number) => mudar((x) => {
    // reencaixa os mesmos titulares nos slots da formação nova, como a IA escolheria
    const lista = Object.values(x.titulares).map((id) => m.jogadores[id]!).sort(porForca)
    const titulares: Record<number, number> = {}
    const livres: number[] = []
    for (const slot of FORMACOES[f]!) {
      const j = escolherParaSlot(lista, slot)
      if (j) {
        titulares[slot] = j.id
        lista.splice(lista.indexOf(j), 1)
      } else livres.push(slot)
    }
    for (const slot of livres) if (lista.length) titulares[slot] = lista.shift()!.id
    return { ...x, formacao: f, titulares, banco: [...lista.map((j) => j.id), ...x.banco].slice(0, MAX_BANCO) }
  })

  const nomeCurto = (j: JogadorM) => (j.nome.length > 13 ? j.nome.split(' ').at(-1)! : j.nome)
  const fora = slots.filter((x) => {
    const id = e.titulares[x]
    return id !== undefined && foraDePosicao(m.jogadores[id]!.posicao, x)
  }).length
  const total = Object.values(e.titulares).reduce((soma, id) => soma + m.jogadores[id]!.forca, 0)
  const indisponiveis = [...naEscalacao].filter((id) => !disponivel(m.jogadores[id]!, comp, m.dia))

  return (
    <div className={s.tela}>
      <section className={s.campoCol}>
        <div className={s.taticas}>
          <label>Formação
            <select value={e.formacao} disabled={!editavel} onChange={(ev) => trocarFormacao(Number(ev.target.value))}>
              {OPCOES_FORMACAO.map((o) => <option key={o.i} value={o.i}>{o.n}</option>)}
            </select>
          </label>
          <label>Estilo
            <select value={e.estilo} disabled={!editavel} onChange={(ev) => mudar((x) => ({ ...x, estilo: Number(ev.target.value) }))}>
              {ESTILOS.map((n, i) => <option key={i} value={i}>{n}</option>)}
            </select>
          </label>
          <label>Marcação
            <select value={e.marcacao} disabled={!editavel} onChange={(ev) => mudar((x) => ({ ...x, marcacao: Number(ev.target.value) }))}>
              {MARCACOES.map((n, i) => <option key={i} value={i}>{n}</option>)}
            </select>
          </label>
          <label>Jogadas
            <select value={e.jogada} disabled={!editavel} onChange={(ev) => mudar((x) => ({ ...x, jogada: Number(ev.target.value) }))}>
              {JOGADAS.map((n, i) => <option key={i} value={i}>{n}</option>)}
            </select>
          </label>
        </div>

        <div className={s.campo} aria-label="Campo">
          <div className={s.linhas} aria-hidden="true"><div /><div /><div /><div /></div>
          {slots.map((slot) => {
            const id = e.titulares[slot]
            const j = id === undefined ? null : m.jogadores[id]!
            const [x, y] = POS[slot] ?? [50, 50]
            return (
              <button key={slot} className={`${s.slot} ${j && sel === j.id ? s.selecionado : ''}`} style={{ left: `${x}%`, top: `${y}%` }}
                onClick={() => (j ? tocarJogador(j.id) : tocarVazio({ slot }))} disabled={!editavel && !j}
                aria-label={j ? `${j.nome}, força ${j.forca}` : 'Posição vazia'} aria-pressed={j ? sel === j.id : undefined}>
                {j ? (
                  <>
                    <span className={s.camisa}>
                      <Camisa fileRef={t.fileRef} cor1={t.cor1} goleiro={slot === 1} tamanho={46} />
                      <span className={`${s.selo} ${foraDePosicao(j.posicao, slot) ? s.foraPos : ''}`}>{j.forca}</span>
                      {!disponivel(j, comp, m.dia) && <span className={s.ausente} title="Não pode jogar">!</span>}
                    </span>
                    <span className={s.nomeCampo}>{nomeCurto(j)}</span>
                  </>
                ) : <span className={s.vazio}>+</span>}
              </button>
            )
          })}
        </div>
        <p className="mudo" style={{ margin: 0, fontSize: 13 }}>
          {editavel ? (sel === null ? 'Toque num jogador, depois numa posição, numa vaga do banco ou noutro jogador.' : `${m.jogadores[sel]!.nome} selecionado: escolha para onde ele vai.`)
            : 'A escalação só muda no planejamento.'}
          {' '}Força <strong style={{ color: 'var(--text)' }}>{total}</strong>
          {fora > 0 && <> · <span style={{ color: 'var(--pessego)' }}>{fora} fora de posição</span></>}
        </p>
        <Status salvo={salvo} editavel={editavel} indisponiveis={indisponiveis.map((id) => m.jogadores[id]!.nome)} />
      </section>

      <section className={s.listas}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="cabecalho">
            <h2 style={{ flex: 1 }}>Banco <span className="fraco" style={{ fontWeight: 400 }}>{e.banco.length} de {MAX_BANCO}</span></h2>
          </div>
          {e.banco.map((id, i) => (
            <Linha key={id} j={m.jogadores[id]!} t={t} m={m} forcas={forcas} sel={sel === id} onClick={() => tocarJogador(id)} rotulo={`banco ${i + 1}`} />
          ))}
          {editavel && sel !== null && e.banco.length < MAX_BANCO && lugar(e, sel) && !('banco' in lugar(e, sel)!) && (
            <button className={s.alvo} onClick={() => tocarVazio({ banco: e.banco.length })}>Pôr no banco</button>
          )}
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="cabecalho">
            <h2 style={{ flex: 1 }}>Fora do jogo <span className="fraco" style={{ fontWeight: 400 }}>{reservas.length}</span></h2>
          </div>
          {reservas.map((j) => (
            <Linha key={j.id} j={j} t={t} m={m} forcas={forcas} sel={sel === j.id} onClick={() => tocarJogador(j.id)} />
          ))}
          {editavel && sel !== null && lugar(e, sel) !== null && (
            <button className={s.alvo} onClick={() => tocarVazio(null)}>Tirar do time</button>
          )}
        </div>

        <div className="card secao">
          <h2>Batedores</h2>
          <div className={s.taticas}>
            <label>Faltas e pênaltis
              <select value={e.falta ?? ''} disabled={!editavel} onChange={(ev) => mudar((x) => ({ ...x, falta: ev.target.value ? Number(ev.target.value) : null }))}>
                <option value="">Automático</option>
                {jogadores.map((j) => <option key={j.id} value={j.id}>{j.nome}</option>)}
              </select>
            </label>
            <label>Escanteios
              <select value={e.escanteio ?? ''} disabled={!editavel} onChange={(ev) => mudar((x) => ({ ...x, escanteio: ev.target.value ? Number(ev.target.value) : null }))}>
                <option value="">Automático</option>
                {jogadores.map((j) => <option key={j.id} value={j.id}>{j.nome}</option>)}
              </select>
            </label>
          </div>
        </div>
      </section>
    </div>
  )
}

function Linha({ j, t, m, forcas, sel, onClick, rotulo }: {
  j: JogadorM; t: TimeM; m: Mundo; forcas: number[]; sel: boolean; onClick: () => void; rotulo?: string
}) {
  const a = alerta(m, j)
  return (
    <button className={`${s.linha} ${sel ? s.selecionadoLinha : ''}`} onClick={onClick} aria-pressed={sel} aria-label={rotulo ? `${j.nome}, ${rotulo}` : j.nome}>
      <Camisa fileRef={t.fileRef} cor1={t.cor1} goleiro={j.posicao === 0} tamanho={26} />
      <ChipPosicao posicao={j.posicao} />
      <span className={s.nomeLinha}>{j.nome}</span>
      {a && <span className={`etiqueta ${a.cor === 'manteiga' ? '' : a.cor}`}>{a.texto}</span>}
      <span className="mudo" style={{ fontSize: 12 }}>{caracteristicas(j)}</span>
      <Energia valor={j.energia} />
      <Forca valor={j.forca} tom={tomForca(j.forca, forcas)} />
    </button>
  )
}

function Status({ salvo, editavel, indisponiveis }: { salvo: string; editavel: boolean; indisponiveis: string[] }) {
  return (
    <>
      {indisponiveis.length > 0 && (
        <p className={s.aviso}>Não podem jogar o próximo jogo: {indisponiveis.join(', ')}. O motor troca pelo melhor disponível.</p>
      )}
      {editavel && salvo !== 'nada' && (
        <p className="fraco" style={{ margin: 0, fontSize: 12 }} aria-live="polite">
          {salvo === 'ok' ? 'Salvo.' : salvo === 'salvando' ? 'Salvando…' : <span style={{ color: 'var(--rosa)' }}>Não salvou: {salvo}</span>}
        </p>
      )}
    </>
  )
}
