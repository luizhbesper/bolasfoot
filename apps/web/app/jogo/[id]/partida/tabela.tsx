'use client'
// Classificação da rodada na tela da partida: ao vivo (a de antes da rodada + os placares que o relógio já mostrou) e,
// nos resultados, a de antes e a de depois, com as linhas deslizando da posição velha para a nova.
import { tabelaCom, type Linha, type Mundo } from '@bolasfoot/engine'
import type { CSSProperties } from 'react'
import { Escudo } from '../../../_ui/ui.tsx'
import { Ponto, zonas, type ZonasTabela } from '../tabelas/zonas.tsx'
import s from './partida.module.css'

export interface Placar { casa: number; fora: number; gols: [number, number] }

export interface Classificacao {
  nome: string
  antes: number[]
  depois: number[]
  linhas: Record<number, Linha>
  zonas: ZonasTabela
}

/**
 * `vivo`: o mundo é o de antes da rodada; soma os placares. `depois`: o mundo já é o de depois. A ordem de antes vem do log
 * da rodada (`ordemAntes`); log antigo sem ela: desfaz os placares (empates ficam na ordem de depois). Com grupos, o grupo
 * de `foco` (ou o primeiro com jogo). Null se a fase atual não é de liga.
 */
export function classificacao(m: Mundo, compId: string, placares: Placar[], modo: 'vivo' | 'depois', foco?: number, ordemAntes?: number[][]): Classificacao | null {
  const c = m.competicoes.find((x) => x.id === compId)
  const f = c?.fases.at(-1)
  if (!c || f?.tipo !== 'liga') return null
  const base = tabelaCom(f, [])
  const outra = tabelaCom(f, placares, modo === 'vivo' ? 1 : -1)
  const [antes, depois] = modo === 'vivo' ? [base, outra] : [outra, base]
  const comJogo = new Set(placares.flatMap((p) => [p.casa, p.fora]))
  let g = depois.grupos.findIndex((x) => foco !== undefined && x.includes(foco))
  if (g < 0) g = Math.max(0, depois.grupos.findIndex((x) => x.some((t) => comJogo.has(t))))
  const lista = depois.grupos[g]!
  return {
    nome: depois.grupos.length > 1 ? `${c.nome} · Grupo ${String.fromCharCode(65 + g)}` : c.nome,
    antes: (modo === 'depois' && ordemAntes ? ordemAntes : antes.grupos).find((x) => x.includes(lista[0]!) && x.length === lista.length) ?? lista,
    depois: lista,
    linhas: depois.linhas,
    zonas: zonas(m, c, c.fases.length - 1, lista.length),
  }
}

/** Quantas posições o time subiu (positivo) ou caiu. */
export const variacao = (c: Classificacao, t: number) => c.antes.indexOf(t) - c.depois.indexOf(t)

export function Seta({ v }: { v: number }) {
  if (v === 0) return <span className={s.mesma} aria-label="mesma posição">=</span>
  return v > 0
    ? <span className={s.sobe} aria-label={`subiu ${v}`}>▲{v}</span>
    : <span className={s.desce} aria-label={`caiu ${-v}`}>▼{-v}</span>
}

/** A tabela; com `animar`, cada linha começa na posição de antes e desliza para a de agora. */
export function TabelaRodada({ c, m, eu, destaque, animar }: { c: Classificacao; m: Mundo; eu: number; destaque?: Set<number>; animar?: boolean }) {
  return (
    <div className={`${s.classif} ${animar ? s.animar : ''}`} role="table" aria-label={`Classificação: ${c.nome}`}>
      <div className={s.classifCabeca} role="row">
        <span role="columnheader">#</span><span role="columnheader" /><span role="columnheader">Clube</span>
        <span role="columnheader" className={s.num}>J</span><span role="columnheader" className={s.num}>SG</span><span role="columnheader" className={s.num}>Pts</span>
      </div>
      {c.depois.map((t, i) => {
        const l = c.linhas[t]!
        const v = variacao(c, t)
        const sg = l.gp - l.gc
        return (
          <div key={t} role="row" style={{ '--de': v, '--atraso': `${Math.min(i, 19) * 25}ms` } as CSSProperties}
            className={`${s.classifLinha} ${t === eu ? s.classifEu : destaque?.has(t) ? s.classifAmigo : ''} ${v > 0 ? s.subiu : v < 0 ? s.caiu : ''}`}>
            <span role="cell" className={s.posicao}><Ponto cor={c.zonas.de(i)} />{i + 1}</span>
            <span role="cell"><Seta v={v} /></span>
            <span role="cell" className={s.clubeLinha}><Escudo fileRef={m.times[t]!.fileRef} tamanho={18} mini /><span>{m.times[t]!.nome}</span></span>
            <span role="cell" className={`${s.num} mudo`}>{l.j}</span>
            <span role="cell" className={`${s.num} mudo`}>{sg > 0 ? `+${sg}` : sg}</span>
            <strong role="cell" className={s.num}>{l.pts}</strong>
          </div>
        )
      })}
    </div>
  )
}
