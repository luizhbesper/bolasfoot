'use client'
// Camisa do original; sem arquivo próprio (365 times), cai na genérica mais próxima da cor1. Goleiro usa a escura.
import { useState } from 'react'
import s from './ui.module.css'

const GENERICAS: [string, number, number, number][] = [
  ['amarelo', 240, 210, 40], ['azul', 20, 80, 200], ['branco', 245, 245, 245],
  ['preto', 20, 20, 20], ['verde', 0, 140, 60], ['vermelho', 210, 20, 20],
]

export function generica(cor: string): string {
  const n = parseInt(cor.replace('#', ''), 16)
  const [r, g, b] = [n >> 16 & 255, n >> 8 & 255, n & 255]
  let melhor = GENERICAS[0]!
  let d = Infinity
  for (const c of GENERICAS) {
    const dc = (c[1] - r) ** 2 + (c[2] - g) ** 2 + (c[3] - b) ** 2
    if (dc < d) [melhor, d] = [c, dc]
  }
  return melhor[0]
}

export function Camisa({ fileRef, cor1, goleiro, tamanho = 40 }: { fileRef: string; cor1: string; goleiro?: boolean; tamanho?: number }) {
  const [falhou, setFalhou] = useState(false)
  const src = goleiro ? '/assets/camisas/genericas/preto.png'
    : falhou ? `/assets/camisas/genericas/${generica(cor1)}.png` : `/assets/camisas/1/${fileRef}.png`
  return <img className={s.camisa} src={src} alt="" width={tamanho} height={tamanho} onError={() => setFalhou(true)} />
}
