'use client'
// Escalação: campo com as camisas do original, banco e reservas. Arraste um jogador (Pointer Events: mouse e toque,
// já que o drag-and-drop nativo do HTML não existe no celular) para uma posição do campo, o banco, outro jogador (troca)
// ou "fora do jogo". Clicar (ou Enter) num jogador abre a ficha.
// Cada mudança é salva sozinha (escalar + tática + batedores) e validada pelo motor no servidor.
import {
  derivar, disponivel, escalarIA, escolherParaSlot, foraDePosicao, FORMACOES, NOMES_FORMACAO, porForca,
  type Comando, type JogadorM, type Mundo, type TimeM,
} from '@bolasfoot/engine'
import { useEffect, useRef, useState, type HTMLAttributes, type PointerEvent as ReactPointerEvent } from 'react'
import { Camisa } from '../../../_ui/camisa.tsx'
import { Gaveta } from '../../../_ui/gaveta.tsx'
import { ChipPosicao, corEnergia, Energia, Forca, POSICOES, tomForca } from '../../../_ui/ui.tsx'
import { definirComandosAcao } from '../acoes.ts'
import { useComandos } from '../comandos.tsx'
import { alerta, proximoJogo } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { caracteristicas, Ficha } from '../elenco/elenco.tsx'
import { Negociar } from '../elenco/negociar.tsx'
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
export const ESTILOS = ['Equilibrado', 'Ataque total', 'Contra-ataque']
export const MARCACOES = ['Leve', 'Pesada', 'Muito pesada']
export const JOGADAS = ['Pelo meio', 'Pelas laterais']
const MAX_BANCO = 11
type Coluna = 'posicao' | 'nome' | 'energia' | 'forca'
const COLUNAS: [Coluna, string][] = [['posicao', 'Pos'], ['nome', 'Nome'], ['energia', 'Energia'], ['forca', 'Força']]
type Arraste = HTMLAttributes<HTMLElement> & { 'data-arrastavel'?: string }
type Ordem = { col: Coluna; desc: boolean }
const ordenarPor = (o: Ordem) => (a: JogadorM, b: JogadorM) => {
  const c = o.col === 'nome' ? a.nome.localeCompare(b.nome, 'pt-BR') : a[o.col] - b[o.col]
  return (o.desc ? -c : c) || porForca(a, b)
}
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
  // a escalação salva não é limpa quando um jogador é vendido ou sai do clube
  const meu = (id: number) => t.jogadores.includes(id)
  return {
    formacao,
    titulares: Object.fromEntries(salvo.titulares.filter((x) => meu(x.id)).map((x) => [x.slot, x.id])),
    banco: salvo.banco.filter(meu),
    estilo: tat?.estilo ?? t.tatica.estilo,
    marcacao: tat?.marcacao ?? t.tatica.marcacao,
    jogada: tat?.jogada ?? t.tatica.jogada,
    falta: bat ? bat.falta : t.batedores.falta,
    escanteio: bat ? bat.escanteio : t.batedores.escanteio,
  }
}

export function Escalacao({ pendentes, paises }: { pendentes: Comando[]; paises: string[] }) {
  const { mundo: m, meuTime: t, fase } = useJogo()
  if (!m) return <Carregando />
  if (!t) return <SemClube />
  // pausado também: só o relógio para
  const editavel = (fase.status === 'running' || fase.status === 'paused') && fase.fase === 'planejamento'
  // nova fase = novo snapshot: recomeça do que o servidor tem
  return <Editor key={`${fase.rodada}:${fase.fase}`} m={m} t={t} pendentes={pendentes} editavel={editavel} paises={paises} />
}

function Editor({ m, t, pendentes, editavel, paises }: { m: Mundo; t: TimeM; pendentes: Comando[]; editavel: boolean; paises: string[] }) {
  const { jogo } = useJogo()
  const prox = proximoJogo(m, t.id)
  const comp = prox?.compId ?? ''
  const [e, setE] = useState(() => inicial(m, t, pendentes, comp))
  const [ficha, setFicha] = useState<number | null>(null)
  const k = useComandos(pendentes)
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
  // a mesma ordem vale para o banco e para fora do jogo; no banco é só exibição (a ordem real não muda)
  const [ordem, setOrdem] = useState<Ordem>({ col: 'posicao', desc: false })
  const ordenar = (col: Coluna) => setOrdem((o) => ({ col, desc: o.col === col ? !o.desc : col !== 'posicao' && col !== 'nome' }))
  const reservas = jogadores.filter((j) => !naEscalacao.has(j.id)).sort(ordenarPor(ordem))
  const bancoOrdenado = e.banco.map((id) => m.jogadores[id]!).sort(ordenarPor(ordem))

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

  /** `a` vai para onde `b` está. Se `b` está fora do time, é ele quem entra no lugar de `a` (substituição). */
  const trocar = (a: number, b: number) => {
    const la = lugar(e, a), lb = lugar(e, b)
    if (lb === null && la !== null) mover(b, la)
    else mover(a, lb)
  }
  /** O que acontece ao soltar `a` no alvo `chave` (o `data-alvo` debaixo do ponteiro). */
  const soltar = (chave: string, a: number) => {
    if (chave === 'banco') {
      if (!('banco' in (lugar(e, a) ?? {})) && e.banco.length < MAX_BANCO) mover(a, { banco: e.banco.length })
    } else if (chave === 'fora') {
      if (lugar(e, a) !== null) mover(a, null)
    } else if (chave.startsWith('s')) mover(a, { slot: Number(chave.slice(1)) })
    else if (Number(chave.slice(1)) !== a) trocar(a, Number(chave.slice(1)))
  }

  // arrastar com Pointer Events (mouse e toque): um fantasma segue o ponteiro e o alvo debaixo dele fica marcado
  const [arrastando, setArrastando] = useState<{ id: number; x: number; y: number } | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const arrastou = useRef(false) // o click que vem depois de um arraste não abre a ficha
  const alvoEm = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-alvo]')?.dataset.alvo ?? null
  const arrastavel = (id: number): Arraste => !editavel ? {} : {
    'data-arrastavel': '',
    onDragStart: (ev) => ev.preventDefault(), // nada de arraste nativo da imagem da camisa
    onPointerDown: (ev: ReactPointerEvent) => {
      if (ev.button !== 0) return
      const x0 = ev.clientX, y0 = ev.clientY
      let ativo = false
      const mexer = (p: PointerEvent) => {
        if (!ativo && Math.hypot(p.clientX - x0, p.clientY - y0) < 6) return // pouco movimento ainda é clique
        ativo = true
        // no celular o campo e o banco não cabem juntos: perto da borda, a página rola
        // ponytail: só rola enquanto o dedo mexe; um loop com requestAnimationFrame se parado na borda fizer falta
        if (p.clientY < 48) window.scrollBy(0, -16)
        else if (p.clientY > window.innerHeight - 48) window.scrollBy(0, 16)
        setArrastando({ id, x: p.clientX, y: p.clientY })
        setSobre(alvoEm(p.clientX, p.clientY))
      }
      const fim = (p: PointerEvent) => {
        window.removeEventListener('pointermove', mexer)
        window.removeEventListener('pointerup', fim)
        window.removeEventListener('pointercancel', fim)
        if (ativo) {
          arrastou.current = true
          setTimeout(() => { arrastou.current = false })
          const chave = p.type === 'pointerup' ? alvoEm(p.clientX, p.clientY) : null
          if (chave) soltar(chave, id)
        }
        setArrastando(null)
        setSobre(null)
      }
      window.addEventListener('pointermove', mexer)
      window.addEventListener('pointerup', fim)
      window.addEventListener('pointercancel', fim)
    },
  }
  const abrirFicha = (id: number) => {
    if (!arrastou.current) setFicha(id)
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
          <AutoSub t={t} pendentes={pendentes} editavel={editavel} />
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
              <button key={slot} className={`${s.slot} ${sobre === (j ? `j${j.id}` : `s${slot}`) ? s.sobre : ''}`}
                style={{ left: `${x}%`, top: `${y}%` }} data-alvo={j ? `j${j.id}` : `s${slot}`} {...(j ? arrastavel(j.id) : {})}
                onClick={j ? () => abrirFicha(j.id) : undefined} disabled={!j}
                aria-label={j ? `${j.nome}, força ${j.forca}, energia ${j.energia}` : 'Posição vazia'}>
                {j ? (
                  <>
                    <span className={s.camisa}>
                      <Camisa fileRef={t.fileRef} cor1={t.cor1} goleiro={slot === 1} tamanho={46} />
                      <span className={`${s.selo} ${foraDePosicao(j.posicao, slot) ? s.foraPos : ''}`}>{j.forca}</span>
                      <span className={s.energiaSelo} style={{ color: corEnergia(j.energia) }} title="Energia">{j.energia}</span>
                      {!disponivel(j, comp, m.dia) && <span className={s.ausente} title="Não pode jogar">!</span>}
                    </span>
                    <span className={s.nomeCampo}>{nomeCurto(j)}
                      <span className={`${s.posCampo} ${foraDePosicao(j.posicao, slot) ? s.posFora : ''}`}>{POSICOES[j.posicao]}</span></span>
                  </>
                ) : <span className={s.vazio}>+</span>}
              </button>
            )
          })}
        </div>
        <p className="mudo" style={{ margin: 0, fontSize: 13 }}>
          {!editavel && 'Travada enquanto a rodada roda: as trocas do jogo são no intervalo, na tela da partida. Abre de novo no planejamento. '}
          Força <strong style={{ color: 'var(--text)' }}>{total}</strong>
          {fora > 0 && <> · <span style={{ color: 'var(--pessego)' }}>{fora} fora de posição</span></>}
        </p>
        <Status salvo={salvo} editavel={editavel} indisponiveis={indisponiveis.map((id) => m.jogadores[id]!.nome)} />
      </section>

      <section className={s.listas}>
        <div className={`card ${s.lista} ${sobre === 'banco' ? s.sobreLista : ''}`} data-alvo="banco">
          <div className="cabecalho">
            <h2 style={{ flex: 1 }}>Banco <span className="fraco" style={{ fontWeight: 400 }}>{e.banco.length} de {MAX_BANCO}</span></h2>
            <Ordenacao ordem={ordem} ordenar={ordenar} />
          </div>
          {bancoOrdenado.map((j) => (
            <Linha key={j.id} j={j} t={t} m={m} forcas={forcas} onClick={() => abrirFicha(j.id)} rotulo={`banco ${e.banco.indexOf(j.id) + 1}`}
              arraste={arrastavel(j.id)} sobre={sobre === `j${j.id}`} />
          ))}
        </div>

        <div className={`card ${s.lista} ${sobre === 'fora' ? s.sobreLista : ''}`} data-alvo="fora">
          <div className="cabecalho">
            <h2 style={{ flex: 1 }}>Fora do jogo <span className="fraco" style={{ fontWeight: 400 }}>{reservas.length}</span></h2>
            <Ordenacao ordem={ordem} ordenar={ordenar} />
          </div>
          {reservas.map((j) => (
            <Linha key={j.id} j={j} t={t} m={m} forcas={forcas} onClick={() => abrirFicha(j.id)} arraste={arrastavel(j.id)} sobre={sobre === `j${j.id}`} />
          ))}
        </div>

        <Gaveta aberta={ficha !== null} titulo={ficha === null ? '' : m.jogadores[ficha]!.nome} aoFechar={() => setFicha(null)}>
          {ficha !== null && <>
            <Ficha m={m} j={m.jogadores[ficha]!} pais={paises[m.jogadores[ficha]!.pais] ?? ''} forcas={forcas} />
            <Negociar key={ficha} m={m} j={m.jogadores[ficha]!} k={k} />
          </>}
        </Gaveta>
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

      {arrastando && (
        <div className={s.fantasma} style={{ left: arrastando.x, top: arrastando.y }} aria-hidden="true">
          <Camisa fileRef={t.fileRef} cor1={t.cor1} goleiro={m.jogadores[arrastando.id]!.posicao === 0} tamanho={46} />
          <span className={s.nomeCampo}>{nomeCurto(m.jogadores[arrastando.id]!)}</span>
        </div>
      )}
    </div>
  )
}

function Linha({ j, t, m, forcas, onClick, rotulo, arraste, sobre }: {
  j: JogadorM; t: TimeM; m: Mundo; forcas: number[]; onClick: () => void; rotulo?: string
  arraste: Arraste; sobre: boolean
}) {
  const a = alerta(m, j)
  return (
    <button className={`${s.linha} ${sobre ? s.sobre : ''}`} onClick={onClick} {...arraste} data-alvo={`j${j.id}`} aria-label={rotulo ? `${j.nome}, ${rotulo}` : j.nome}>
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

/** Energia mínima em campo: abaixo dela, o motor troca sozinho pelo melhor do banco para a posição. */
function AutoSub({ t, pendentes, editavel }: { t: TimeM; pendentes: Comando[]; editavel: boolean }) {
  const { jogo } = useJogo()
  const pendente = pendentes.findLast((c) => c.tipo === 'config' && c.energiaMin !== undefined) as Extract<Comando, { tipo: 'config' }> | undefined
  const [v, setV] = useState(pendente?.energiaMin ?? t.config?.energiaMin ?? 0)
  return (
    <label title="Durante a partida, quem cair abaixo dessa energia sai para o melhor reserva da posição">Trocar cansados
      <select value={v} disabled={!editavel} onChange={(ev) => {
        const energiaMin = Number(ev.target.value)
        setV(energiaMin)
        void definirComandosAcao(jogo, [{ tipo: 'config', energiaMin }])
      }}>
        <option value={0}>Não</option>
        {[40, 50, 60, 70, 80].map((x) => <option key={x} value={x}>abaixo de {x}%</option>)}
      </select>
    </label>
  )
}

function Ordenacao({ ordem, ordenar }: { ordem: Ordem; ordenar: (c: Coluna) => void }) {
  return (
    <div className={s.ordenacao} role="group" aria-label="Ordenar">
      {COLUNAS.map(([c, rotulo]) => (
        <button key={c} className="ordenar" aria-pressed={ordem.col === c} onClick={() => ordenar(c)}>
          {rotulo}{ordem.col === c && (ordem.desc ? ' ↓' : ' ↑')}
        </button>
      ))}
    </div>
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
