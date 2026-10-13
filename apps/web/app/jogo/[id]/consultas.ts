// Leituras do mundo e formatos usados pelas telas (só cliente/servidor web; o motor não formata).
import type { Mundo } from '@bolasfoot/engine'

const DIA_MS = 86_400_000
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** `Mundo.dia` (dias desde 1970) → "Dom, 18/01/2026". */
export function dataLonga(dia: number): string {
  const d = new Date(dia * DIA_MS)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${SEMANA[d.getUTCDay()]}, ${dd}/${mm}/${d.getUTCFullYear()}`
}

/** 18_400_000 → "R$ 18,4 mi"; 66_400 → "R$ 66 mil". */
export function dinheiro(v: number): string {
  const sinal = v < 0 ? '−' : ''
  const a = Math.abs(v)
  const fmt = (n: number, casas: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: casas })
  if (a >= 1e6) return `${sinal}R$ ${fmt(a / 1e6, a >= 1e8 ? 0 : 1)} mi`
  if (a >= 1e3) return `${sinal}R$ ${fmt(a / 1e3, 0)} mil`
  return `${sinal}R$ ${fmt(a, 0)}`
}

export interface ProximoJogo { dia: number; comp: string; casa: boolean; adversario: number }

/** O próximo jogo ainda não disputado do time, em qualquer competição. */
export function proximoJogo(m: Mundo, time: number): ProximoJogo | null {
  let melhor: ProximoJogo | null = null
  for (const c of m.competicoes)
    for (const f of c.fases)
      for (const j of f.tipo === 'liga' ? f.jogos : f.rodadas.flatMap((r) => r.jogos))
        if (!j.gols && (j.casa === time || j.fora === time) && (!melhor || j.dia < melhor.dia))
          melhor = { dia: j.dia, comp: c.nome, casa: j.casa === time, adversario: j.casa === time ? j.fora : j.casa }
  return melhor
}

export const NOME_DIVISAO = ['Fora das séries', 'Série A', 'Série B', 'Série C']
