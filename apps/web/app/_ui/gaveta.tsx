'use client'
// Painel lateral (drawer) sobre a tela; fecha no X, no Esc ou clicando fora. Usa <dialog> nativo (foco e Esc de graça).
import { useEffect, useRef, type ReactNode } from 'react'
import s from './gaveta.module.css'

export function Gaveta({ aberta, titulo, aoFechar, children }: { aberta: boolean; titulo: string; aoFechar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (aberta && !d?.open) d?.showModal()
    if (!aberta && d?.open) d.close()
  }, [aberta])
  return (
    <dialog ref={ref} className={s.gaveta} aria-label={titulo} onClose={aoFechar} onClick={(e) => e.target === ref.current && aoFechar()}>
      <div className={s.corpo}>
        <button className={s.fechar} onClick={aoFechar} aria-label="Fechar">×</button>
        {aberta && children}
      </div>
    </dialog>
  )
}
