// Componentes base sem estado: escudo, bandeira, posição, força, energia, forma, avatar.
import s from './ui.module.css'

const ASSETS = '/assets'
export const POSICOES = ['GOL', 'LAT', 'ZAG', 'MEI', 'ATA'] as const

export function Escudo({ fileRef, tamanho = 24, mini }: { fileRef: string; tamanho?: number; mini?: boolean }) {
  // mini: o PNG pequeno do original, mais nítido abaixo de ~24 px
  return <img className={s.escudo} src={`${ASSETS}/${mini ? 'escudos-mini' : 'escudos'}/${fileRef}.png`} alt="" width={tamanho} height={tamanho} />
}

/** A logo com o nome ao lado. */
export function Marca({ tamanho = 28 }: { tamanho?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: tamanho / 4 }}>
      <img src="/logo.png" alt="" width={tamanho} height={tamanho} />Bolasfoot
    </span>
  )
}

export function Bandeira({ pais, tamanho = 20 }: { pais: number; tamanho?: 20 | 36 }) {
  return <img className={s.bandeira} src={`${ASSETS}/bandeiras/${tamanho}/${pais}.png`} alt="" width={tamanho} height={tamanho} />
}

export function ChipPosicao({ posicao }: { posicao: number }) {
  const p = POSICOES[posicao] ?? 'MEI'
  return <span className={`${s.chip} ${s[p]}`}>{p}</span>
}

export type Tom = 'alto' | 'medio' | 'baixo'

/** Tom da força relativo ao grupo (terços do elenco), não ao número absoluto. */
export function tomForca(valor: number, todos: readonly number[]): Tom {
  const o = [...todos].sort((a, b) => a - b)
  if (valor >= o[Math.floor(o.length * 2 / 3)]!) return 'alto'
  return valor >= o[Math.floor(o.length / 3)]! ? 'medio' : 'baixo'
}

export function Forca({ valor, tom }: { valor: number; tom?: Tom }) {
  return <span className={`${s.forca} ${tom ? s[tom] : ''}`}>{valor}</span>
}

export function Energia({ valor }: { valor: number }) {
  const cor = valor >= 85 ? 'var(--menta)' : valor >= 70 ? 'var(--manteiga)' : 'var(--rosa)'
  return (
    <div className={s.energia} role="meter" aria-valuenow={valor} aria-valuemin={0} aria-valuemax={100} aria-label="Energia">
      <div style={{ width: `${valor}%`, background: cor }} />
    </div>
  )
}

export function Forma({ resultados }: { resultados: readonly ('V' | 'E' | 'D')[] }) {
  return <span className={s.forma}>{resultados.map((r, i) => <span key={i} className={s[r]}>{r}</span>)}</span>
}

export function Avatar({ nome, pronto, semJogo }: { nome: string; pronto?: boolean; semJogo?: boolean }) {
  return (
    <span className={`${s.avatar} ${pronto ? s.pronto : ''} ${semJogo ? s.semJogo : ''}`} title={`${nome}${semJogo ? ' — sem jogo' : pronto ? ' — pronto' : ''}`}>
      {nome.slice(0, 2).toUpperCase()}
    </span>
  )
}
