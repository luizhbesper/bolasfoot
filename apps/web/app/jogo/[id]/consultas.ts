// Leituras do mundo e formatos usados pelas telas (só cliente/servidor web; o motor não formata).
import type { Competicao, FaseMataMata, JogadorM, Jogo, Linha, Mundo } from '@bolasfoot/engine'

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

export const NOME_RODADA: Record<number, string> = { 1: 'Final', 2: 'Semifinal', 4: 'Quartas de final', 8: 'Oitavas de final' }

/** Competição internacional (tem confederação): fases com nome próprio, sem "2ª fase". */
const internacional = (c: Competicao) => c.confederacao !== undefined

/** Nome de uma fase: "Fase de grupos", "Preliminar Fase 1", "Mata-mata"; nas nacionais, "2ª fase". */
export function nomeFase(c: Competicao, fi: number): string {
  const f = c.fases[fi]
  if (!f || !internacional(c)) return `${fi + 1}ª fase`
  if (f.tipo === 'liga') return 'Fase de grupos'
  return f.rodadasMax !== undefined ? f.nomes?.[0] ?? `${fi + 1}ª fase` : fi > 0 ? 'Mata-mata' : f.nomes?.[0] ?? 'Mata-mata'
}

/** Nome de uma rodada de mata-mata: o da fase (preliminares), senão pelo nº de confrontos. */
export function nomeRodada(f: FaseMataMata, ri: number): string {
  const r = f.rodadas[ri]!
  return f.nomes?.[ri] ?? NOME_RODADA[r.terceiro ? 1 : r.confrontos.length] ?? `${ri + 1}ª fase`
}

/** Grupo da competição nos seletores: Brasil, América do Sul, Mundial, outras confederações. */
export function grupoCompeticao(c: Pick<Competicao, 'confederacao'>): string {
  const conf = c.confederacao
  return conf === undefined || conf === 29 ? 'Brasil' : conf === 1 ? 'América do Sul' : conf === 7 ? 'Mundial' : 'Outras confederações'
}
export const GRUPOS_COMPETICAO = ['Brasil', 'América do Sul', 'Mundial', 'Outras confederações']

/**
 * O que é o jogo dentro da competição: "7ª rodada", "Grupo B, 3ª rodada", "2ª fase, 4ª rodada",
 * "Oitavas de final, ida". Vazio se não achar o jogo (casa × fora no dia).
 */
export function etapaDoJogo(m: Mundo, compId: string, casa: number, fora: number, dia: number): string {
  const c = m.competicoes.find((x) => x.id === compId)
  if (!c) return ''
  for (const [fi, f] of c.fases.entries()) {
    const prefixo = c.fases.length > 1 && !internacional(c) ? [`${fi + 1}ª fase`] : []
    if (f.tipo === 'liga') {
      if (!f.jogos.some((j) => j.dia === dia && j.casa === casa && j.fora === fora)) continue
      // a rodada do time: quantos jogos ele tem nessa fase até esse dia
      const n = f.jogos.filter((j) => j.dia <= dia && (j.casa === casa || j.fora === casa)).length
      const g = f.grupos.findIndex((x) => x.includes(casa))
      return [...prefixo, ...(f.grupos.length > 1 && g >= 0 ? [`Grupo ${String.fromCharCode(65 + g)}`] : []), `${n}ª rodada`].join(', ')
    }
    for (const [ri, r] of f.rodadas.entries()) {
      const k = r.jogos.findIndex((j) => j.dia === dia && j.casa === casa && j.fora === fora)
      if (k < 0) continue
      const nome = r.terceiro && k % r.confrontos.length === 1 ? 'Decisão do 3º lugar' : internacional(c) ? nomeRodada(f, ri) : NOME_RODADA[r.confrontos.length] ?? `${ri + 1}ª fase`
      return [nome, ...(r.idaVolta ? [k < r.confrontos.length ? 'ida' : 'volta'] : [])].join(', ')
    }
  }
  return ''
}

export interface ProximoJogo { dia: number; compId: string; comp: string; casa: boolean; adversario: number }

/** O próximo jogo ainda não disputado do time, em qualquer competição. */
export function proximoJogo(m: Mundo, time: number): ProximoJogo | null {
  let melhor: ProximoJogo | null = null
  for (const c of m.competicoes)
    for (const f of c.fases)
      for (const j of f.tipo === 'liga' ? f.jogos : f.rodadas.flatMap((r) => r.jogos))
        if (!j.gols && (j.casa === time || j.fora === time) && (!melhor || j.dia < melhor.dia))
          melhor = { dia: j.dia, compId: c.id, comp: c.nome, casa: j.casa === time, adversario: j.casa === time ? j.fora : j.casa }
  return melhor
}

export const NOME_DIVISAO = ['Fora das séries', 'Série A', 'Série B', 'Série C']

export type Resultado = 'V' | 'E' | 'D'

/** Os últimos `n` resultados do time (mais antigo primeiro), em todas as competições. */
export function forma(m: Mundo, time: number, n = 5): Resultado[] {
  const jogos: { dia: number; r: Resultado }[] = []
  for (const c of m.competicoes)
    for (const f of c.fases)
      for (const j of f.tipo === 'liga' ? f.jogos : f.rodadas.flatMap((r) => r.jogos)) {
        if (!j.gols || (j.casa !== time && j.fora !== time)) continue
        const [meus, deles] = j.casa === time ? j.gols : [j.gols[1], j.gols[0]]
        jogos.push({ dia: j.dia, r: meus > deles ? 'V' : meus < deles ? 'D' : 'E' })
      }
  return jogos.sort((a, b) => a.dia - b.dia).slice(-n).map((x) => x.r)
}

/** A tabela (ou o grupo) do time na fase atual de uma competição; null se a fase for mata-mata. */
export function tabelaDoTime(m: Mundo, compId: string, time: number): { nome: string; linhas: { time: number; pos: number; linha: Linha }[] } | null {
  const c = m.competicoes.find((x) => x.id === compId)
  const f = c?.fases.at(-1)
  if (!c || f?.tipo !== 'liga') return null
  const grupo = f.grupos.find((g) => g.includes(time)) ?? f.times
  return { nome: c.nome, linhas: grupo.map((t, i) => ({ time: t, pos: i + 1, linha: f.linhas[t] ?? { pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 } })) }
}

export const jogadoresDe = (m: Mundo, ids: number[]): JogadorM[] => ids.map((id) => m.jogadores[id]!)

/** Por que o jogador pode não jogar (ou merece atenção); null = tudo certo. */
export function alerta(m: Mundo, j: JogadorM): { texto: string; cor: 'rosa' | 'pessego' | 'manteiga' } | null {
  if (j.lesaoAte > m.dia) return { texto: `Lesionado (${j.lesaoAte - m.dia} d)`, cor: 'rosa' }
  if (Object.values(j.suspensoes).some((s) => s.jogos >= 1 || s.amarelos >= 3)) return { texto: 'Suspenso', cor: 'rosa' }
  if (j.energia < 70) return { texto: `Energia ${j.energia}%`, cor: 'pessego' }
  // mesmo corte da renovação no motor (mercado.ts:555)
  if (j.contratoAte - m.dia < 60) return { texto: j.contratoAte <= m.dia ? 'Contrato vencido' : `Contrato: ${j.contratoAte - m.dia} d`, cor: 'manteiga' }
  return null
}

export const CARACTERISTICAS = ['Col', 'DPe', 'Ref', 'SGo', 'Arm', 'Cab', 'Cru', 'Des', 'Dri', 'Fin', 'Mar', 'Pas', 'Res', 'Vel']
export const NOMES_CARACTERISTICAS = ['Colocação', 'Defesa de pênalti', 'Reflexo', 'Saída do gol', 'Armação', 'Cabeceio', 'Cruzamento',
  'Desarme', 'Drible', 'Finalização', 'Marcação', 'Passe', 'Resistência', 'Velocidade']

export const NOME_DIVISAO_CURTO = ['Fora', 'A', 'B', 'C']

/** Todos os jogos de uma competição (liga e mata-mata), com a fase. */
export function jogosDaComp(c: Competicao): { fase: number; jogo: Jogo }[] {
  return c.fases.flatMap((f, fase) => (f.tipo === 'liga' ? f.jogos : f.rodadas.flatMap((r) => r.jogos)).map((jogo) => ({ fase, jogo })))
}

export const participa = (c: Competicao, time: number) =>
  c.fases.some((f) => (f.tipo === 'liga' ? f.times.includes(time) : f.rodadas.some((r) => r.confrontos.some((x) => x.includes(time)))))

/** Os jogos do time na temporada, em ordem de data. */
export function agendaDoTime(m: Mundo, time: number): { comp: Competicao; jogo: Jogo }[] {
  return m.competicoes.flatMap((comp) => jogosDaComp(comp).filter(({ jogo }) => jogo.casa === time || jogo.fora === time).map(({ jogo }) => ({ comp, jogo })))
    .sort((a, b) => a.jogo.dia - b.jogo.dia)
}

/** Os que mais fizeram gols na competição nesta temporada (desempate: menos jogos). */
export function artilharia(m: Mundo, compId: string, n = 10): { j: JogadorM; gols: number; jogos: number }[] {
  const lista: { j: JogadorM; gols: number; jogos: number }[] = []
  for (const j of m.jogadores) {
    const e = j.estatisticas?.[compId]
    if (e && e[1] > 0) lista.push({ j, gols: e[1], jogos: e[0] })
  }
  return lista.sort((a, b) => b.gols - a.gols || a.jogos - b.jogos).slice(0, n)
}

/** Resultado do jogo visto pelo time: V/E/D (pênaltis contam como no original: empate). */
export function resultadoPara(j: Jogo, time: number): Resultado | null {
  if (!j.gols) return null
  const [a, b] = j.casa === time ? j.gols : [j.gols[1], j.gols[0]]
  return a > b ? 'V' : a < b ? 'D' : 'E'
}
