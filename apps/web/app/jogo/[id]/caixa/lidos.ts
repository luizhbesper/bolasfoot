'use client'
// Avisos não lidos: o último dia que a caixa foi aberta fica no navegador (por jogo). ponytail: por aparelho; no banco
// se um dia precisar valer entre aparelhos.
import { useEffect, useState } from 'react'
import { useJogo } from '../contexto.tsx'

const chave = (jogo: number) => `caixa-vista:${jogo}`
const EVENTO = 'caixa-vista'

function ler(jogo: number): number {
  try {
    return Number(localStorage.getItem(chave(jogo)) ?? -1)
  } catch {
    return -1
  }
}

export function marcarLidos(jogo: number, dia: number) {
  try {
    if (ler(jogo) >= dia) return
    localStorage.setItem(chave(jogo), String(dia))
    window.dispatchEvent(new Event(EVENTO))
  } catch {
    // sem storage: tudo segue "novo"
  }
}

/** Dia até o qual a caixa já foi vista (-1 = nunca; null no servidor). */
export function useVisto(): number | null {
  const { jogo } = useJogo()
  const [visto, setVisto] = useState<number | null>(null)
  useEffect(() => {
    const ler1 = () => setVisto(ler(jogo))
    ler1()
    window.addEventListener(EVENTO, ler1)
    return () => window.removeEventListener(EVENTO, ler1)
  }, [jogo])
  return visto
}

export function useNaoLidos(): number {
  const { mundo, eu } = useJogo()
  const visto = useVisto()
  if (!mundo || visto === null || eu.tecnicoId === null) return 0
  return mundo.avisos.filter((a) => a.tecnico === eu.tecnicoId && a.dia > visto).length
}
