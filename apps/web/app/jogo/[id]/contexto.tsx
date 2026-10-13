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
  eu: { id: number; tecnicoId: number | null }
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

/** Agora no relógio do servidor, atualizado a cada `ms`; null no render do servidor (evita divergir na hidratação). */
export function useRelogio(ms = 250): number | null {
  const { offset } = useJogo()
  const [agora, setAgora] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setAgora(Date.now())
    tick()
    const t = setInterval(tick, ms)
    return () => clearInterval(t)
  }, [ms])
  return agora === null ? null : agora + offset
}

export function JogoProvider({ children, ...p }: {
  children: ReactNode; jogo: number; msPorMinuto: number; eu: Jogo['eu']; membros: Membro[]; fase: EstadoFase; prontos: number[]
}) {
  const router = useRouter()
  const [fase, setFase] = useState(p.fase)
  const [prontos, setProntos] = useState(p.prontos)
  const [mundo, setMundo] = useState<Mundo | null>(null)
  const [offset, setOffset] = useState(0)
  const versao = useRef<string | null>(null)

  useEffect(() => {
    const es = new EventSource(`/api/games/${p.jogo}/eventos`)
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as EventoJogo | { tipo: 'ola'; serverNow: number }
      if (e.tipo === 'ola') return setOffset(e.serverNow - Date.now())
      if (e.tipo === 'fase') setFase(e)
      if (e.tipo === 'ready') setProntos(e.prontos)
      // as telas ainda vêm do servidor: a fase pode ter mudado entre renderizar e conectar (ou na reconexão)
      router.refresh()
    }
    return () => es.close()
  }, [p.jogo, router])

  const temMundo = fase.status !== 'lobby' && fase.status !== 'picking'
  useEffect(() => {
    if (!temMundo) return
    let vivo = true
    fetch(`/api/games/${p.jogo}/snapshot`).then(async (r) => {
      const v = r.headers.get('X-Rodada')
      if (!r.ok || !vivo || v === versao.current) return
      const m = (await r.json()) as Mundo
      if (!vivo) return
      versao.current = v
      setMundo(m)
    })
    return () => {
      vivo = false
    }
  }, [p.jogo, temMundo, fase.rodada, fase.fase])

  const meuTime = mundo && p.eu.tecnicoId !== null ? mundo.times.find((t) => t.tecnico === p.eu.tecnicoId) ?? null : null
  return (
    <Ctx.Provider value={{ jogo: p.jogo, msPorMinuto: p.msPorMinuto, eu: p.eu, membros: p.membros, fase, prontos, mundo, meuTime, offset }}>
      {children}
    </Ctx.Provider>
  )
}
