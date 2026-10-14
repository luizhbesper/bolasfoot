'use client'
// Estado do jogo no cliente: um SSE só por aba (fase, prontos, relógio do servidor) e o mundo baixado do snapshot,
// rebaixado quando a fase muda. As telas leem tudo por useJogo(); o relógio fica em useRelogio() para não
// re-renderizar a árvore inteira a cada tick.
import type { Mundo, TimeM } from '@bolasfoot/engine'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { EventoJogo } from '../../../lib/game/canal.ts'

export type EstadoFase = Extract<EventoJogo, { tipo: 'fase' }>
export interface Membro { id: number; nome: string; teamRef: string | null }

interface Jogo {
  jogo: number
  msPorMinuto: number
  eu: { id: number; tecnicoId: number | null; admin?: boolean }
  membros: Membro[]
  fase: EstadoFase
  prontos: number[]
  /** null até o primeiro snapshot chegar (ou antes do mundo existir) */
  mundo: Mundo | null
  /** time do técnico logado no mundo (null se desempregado ou sem mundo) */
  meuTime: TimeM | null
  /** relógio do servidor menos o local, em ms */
  offset: number
}

const Ctx = createContext<Jogo | null>(null)

export function useJogo(): Jogo {
  const c = useContext(Ctx)
  if (!c) throw new Error('useJogo fora do <JogoProvider>')
  return c
}

/** Agora no relógio do servidor, atualizado a cada `ms`; null no render do servidor (evita divergir na hidratação).
 * Pausado, congela no instante da pausa. */
export function useRelogio(ms = 250): number | null {
  const { offset, fase } = useJogo()
  const [agora, setAgora] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setAgora(Date.now())
    tick()
    const t = setInterval(tick, ms)
    return () => clearInterval(t)
  }, [ms])
  return agora === null ? null : fase.status === 'paused' && fase.pausa !== null ? fase.pausa : agora + offset
}

export function JogoProvider({ children, ...p }: {
  children: ReactNode; jogo: number; msPorMinuto: number; eu: Jogo['eu']; membros: Membro[]; fase: EstadoFase; prontos: number[]
}) {
  const router = useRouter()
  const [fase, setFase] = useState(p.fase)
  const [prontos, setProntos] = useState(p.prontos)
  const [mundo, setMundo] = useState<Mundo | null>(null)
  const [offset, setOffset] = useState<number | null>(null)
  const versao = useRef<string | null>(null)

  useEffect(() => {
    const es = new EventSource(`/api/games/${p.jogo}/eventos`)
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as EventoJogo | { tipo: 'ola'; serverNow: number }
      // o atraso da entrega só diminui a amostra (o motor rodando segura o SSE): fica a maior, a mais próxima da real
      if (e.tipo === 'ola') return setOffset((o) => Math.max(o ?? -Infinity, e.serverNow - Date.now()))
      if (e.tipo === 'ready') return setProntos(e.prontos)
      if (e.tipo === 'fase') setFase(e)
      // as telas ainda vêm do servidor: a fase pode ter mudado entre renderizar e conectar (ou na reconexão). Um refresh
      // por rajada: a virada manda fase + prontos juntos e refreshes sobrepostos travavam a tela em "Rendering…".
      clearTimeout(adiado)
      adiado = setTimeout(() => router.refresh(), 150)
    }
    let adiado: ReturnType<typeof setTimeout> | undefined
    return () => {
      clearTimeout(adiado)
      es.close()
    }
  }, [p.jogo, router])

  const temMundo = fase.status !== 'lobby' && fase.status !== 'picking'
  useEffect(() => {
    if (!temMundo) return
    // corpo não lido segura a conexão: com o SSE aberto, 5 snapshots esquecidos esgotam as 6 conexões HTTP/1.1 do
    // navegador e toda navegação fica na fila ("Rendering…" para sempre). Por isso aborta ao sair e cancela o que sobra.
    const ctl = new AbortController()
    fetch(`/api/games/${p.jogo}/snapshot`, { signal: ctl.signal }).then(async (r) => {
      const v = r.headers.get('X-Rodada')
      if (!r.ok || v === versao.current) return void r.body?.cancel()
      const m = (await r.json()) as Mundo
      versao.current = v
      setMundo(m)
    }).catch(() => {}) // abortado
    return () => ctl.abort()
  }, [p.jogo, temMundo, fase.rodada, fase.fase])

  const meuTime = mundo && p.eu.tecnicoId !== null ? mundo.times.find((t) => t.tecnico === p.eu.tecnicoId) ?? null : null
  return (
    <Ctx.Provider value={{ jogo: p.jogo, msPorMinuto: p.msPorMinuto, eu: p.eu, membros: p.membros, fase, prontos, mundo, meuTime, offset: offset ?? 0 }}>
      {children}
    </Ctx.Provider>
  )
}
