'use client'
// Escuta o SSE do jogo: mostra o prazo e o minuto ao vivo no relógio do servidor e recarrega a tela a cada mudança.
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

interface Fase { fase: string | null; prazo: number | null; inicio: number | null }

export function AoVivo({ jogo, msPorMinuto, inicial }: { jogo: number; msPorMinuto: number; inicial: Fase }) {
  const router = useRouter()
  const [fase, setFase] = useState(inicial)
  const [agora, setAgora] = useState(() => Date.now())
  const offset = useRef(0)

  useEffect(() => {
    const es = new EventSource(`/api/games/${jogo}/eventos`)
    let primeira = true
    es.onmessage = (m) => {
      const e = JSON.parse(m.data)
      if (e.tipo === 'ola') offset.current = e.serverNow - Date.now()
      if (e.tipo === 'fase') setFase(e)
      // a primeira leva é o estado que a página já tem
      if (e.tipo !== 'ola' && !primeira) router.refresh()
      if (e.tipo === 'ready') primeira = false
    }
    const t = setInterval(() => setAgora(Date.now()), 250)
    return () => {
      es.close()
      clearInterval(t)
    }
  }, [jogo, router])

  const servidor = agora + offset.current
  const resta = fase.prazo === null ? null : Math.max(0, Math.ceil((fase.prazo - servidor) / 1000))
  const minuto = fase.inicio !== null && fase.fase?.startsWith('ao_vivo') ? Math.floor((servidor - fase.inicio) / msPorMinuto) : null
  return (
    <p aria-live="polite">
      fase: <strong>{fase.fase ?? '—'}</strong>
      {resta !== null && <> · prazo: {resta}s</>}
      {minuto !== null && <> · minuto {Math.min(minuto, 45) + (fase.fase === 'ao_vivo_2t' ? 45 : 0)}&apos;</>}
    </p>
  )
}
