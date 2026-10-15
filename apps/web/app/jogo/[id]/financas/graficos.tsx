// Gráficos da tela de Finanças em SVG puro: a linha do caixa na temporada (com a projeção) e as entradas/saídas por mês.
// Receita/despesa nunca só pela cor (menta e rosa se confundem no daltonismo): também posição, sinal e rótulo.
'use client'
import { data, type Lancamento } from '@bolasfoot/engine'
import { useEffect, useRef, useState } from 'react'
import { dinheiro } from '../consultas.ts'
import { MESES, type Dia, type Mes } from './fluxo.ts'

const ROTULO_CURTO: Partial<Record<Lancamento['cat'], string>> = {
  bilheteria: 'Bilheteria', premios: 'Prêmio', vendas: 'Venda', patrocinio: 'Patrocínio', emprestimo: 'Empréstimo',
  compras: 'Compra', obras: 'Obra', comissoes: 'Multa', amortizacao: 'Banco', juros: 'Juros',
}
const sinal = (v: number) => (v > 0 ? `+${dinheiro(v)}` : dinheiro(v))

/** Passo "redondo" do eixo (1, 2 ou 5 × 10^n) para ~4 linhas. */
function passo(faixa: number): number {
  const bruto = Math.max(faixa, 1) / 4
  const p = 10 ** Math.floor(Math.log10(bruto))
  return [1, 2, 5, 10].map((k) => k * p).find((x) => x >= bruto)!
}

/** Largura real do container: o SVG desenha em pixels de verdade (texto legível no celular, sem esticar no desktop). */
function useLargura(inicial: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(inicial)
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e!.contentRect.width))))
    ro.observe(ref.current!)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

const H = 260, L = 64, R = 14, T = 30, B = 226

/** `proj`: saldo projetado ([dia, saldo] a cada mudança, de hoje em diante); `folha`: dia da próxima folha. */
export function LinhaCaixa({ inicial, dias, hoje, caixa, proj: pontos, base: pontosBase, folha }: {
  inicial: number; dias: Dia[]; hoje: number; caixa: number; proj: [number, number][]; base?: [number, number][]; folha: number
}) {
  const [ref, W] = useLargura(820)
  const ini = Math.min(dias[0]?.dia ?? hoje, hoje)
  const fim = Math.max(pontos.at(-1)![0], hoje + 7)
  // degraus: o saldo muda no dia do movimento
  const pts: [number, number][] = [[ini, inicial]]
  for (const d of dias) pts.push([d.dia, pts.at(-1)![1]], [d.dia, d.saldo])
  pts.push([hoje, caixa])
  // degraus também na projeção; o pedido de hoje aparece meio dia depois
  const proj: [number, number][] = [[hoje, caixa]]
  const degraus = (ps: [number, number][]) => {
    const r: [number, number][] = [[hoje, caixa]]
    for (const [d, v] of ps.slice(1)) r.push([d === hoje ? hoje + 0.5 : d, r.at(-1)![1]], [d === hoje ? hoje + 0.5 : d, v])
    return r
  }
  proj.push(...degraus(pontos).slice(1))
  // projeção sem a operação do banco ainda não confirmada, para comparar
  const base = pontosBase ? degraus(pontosBase) : null
  const vals = [...pts, ...proj, ...(base ?? [])].map((p) => p[1])
  const st = passo(Math.max(...vals) - Math.min(...vals))
  const v0 = Math.floor(Math.min(...vals) / st) * st
  const v1 = Math.max(Math.ceil(Math.max(...vals) / st) * st, v0 + st)
  const X = (d: number) => L + ((d - ini) / Math.max(1, fim - ini)) * (W - L - R)
  const Y = (v: number) => B - ((v - v0) / Math.max(1, v1 - v0)) * (B - T)
  const linha = (p: [number, number][]) => p.map(([d, v]) => `${X(d).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  const grade = Array.from({ length: Math.round((v1 - v0) / st) + 1 }, (_, i) => v0 + i * st)
  // começo de cada mês no eixo (no celular, um sim um não se apertar)
  const meses: { x: number; rotulo: string }[] = []
  for (let d = ini; d <= fim; d++) if ((data(d).dia === 1 || d === ini) && (meses.length === 0 || X(d) - meses.at(-1)!.x > 34)) meses.push({ x: X(d), rotulo: MESES[data(d).mes - 1]! })
  const folhas = dias.filter((d) => d.itens.some((l) => l.cat === 'salarios')).map((d) => d.dia)
  // os maiores movimentos (fora salário, que já tem marcador), sem rótulos encavalados
  const marcos: { x: number; y: number; l: Lancamento }[] = []
  for (const { d, l } of dias.flatMap((d) => d.itens.filter((l) => l.cat !== 'salarios').map((l) => ({ d, l }))).sort((a, b) => Math.abs(b.l.valor) - Math.abs(a.l.valor))) {
    if (marcos.length >= Math.max(2, Math.floor(W / 160)) || Math.abs(l.valor) < st / 4) break
    const x = X(d.dia)
    if (marcos.some((k) => Math.abs(k.x - x) < 70)) continue
    marcos.push({ x, y: Y(d.saldo), l })
  }
  const minimo = Math.min(...pts.map((p) => p[1]))
  return (
    <div ref={ref} style={{ overflow: 'hidden' }}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" style={{ display: 'block' }}
      aria-label={`Caixa na temporada: começou em ${dinheiro(inicial)}, está em ${dinheiro(caixa)}, mínimo de ${dinheiro(minimo)}; em 6 meses, projetado ${dinheiro(pontos.at(-1)![1])}`}>
      {grade.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--line)" />
          <text x={L - 8} y={Y(v) + 4} textAnchor="end" fill="var(--faint)" fontSize="11">{dinheiro(v)}</text>
        </g>
      ))}
      {meses.map((x, i) => <text key={i} x={x.x} y={252} textAnchor="start" fill="var(--faint)" fontSize="11">{x.rotulo}</text>)}
      <path d={`M${X(ini)},${B} L${linha(pts).replaceAll(' ', ' L')} L${X(hoje)},${B} Z`} fill="var(--lavanda)" fillOpacity="0.1" />
      <polyline points={linha(pts)} fill="none" stroke="var(--lavanda)" strokeWidth="2" strokeLinejoin="round" />
      {base && <polyline points={linha(base)} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="2 4" opacity="0.7" />}
      <polyline points={linha(proj)} fill="none" stroke="var(--lavanda)" strokeWidth="2" strokeDasharray="5 5" />
      {[[proj, 'var(--lavanda)', -8], ...(base ? [[base, 'var(--muted)', 16]] : [])].map(([p, cor, dy]) => {
        const ps = p as [number, number][], fimV = ps.at(-1)![1]
        // ritmo depois de hoje (sem o salto do pedido), por mês: é a inclinação que os juros mudam
        const ini0 = ps.filter(([d]) => d <= hoje + 0.5).at(-1)![1]
        const mes = ((fimV - ini0) / Math.max(1, fim - hoje)) * 30
        return <text key={String(cor)} x={W - R} y={Y(fimV) + (dy as number)} textAnchor="end" fill={cor as string} fontSize="11" fontWeight="600">{dinheiro(fimV)} · {sinal(Math.round(mes))}/mês</text>
      })}
      {[...folhas, folha].map((d) => <rect key={d} x={X(d) - 4} y={B - 4} width="8" height="8" rx="2" fill="var(--pessego)" stroke="var(--surface)" strokeWidth="2" />)}
      <line x1={X(hoje)} x2={X(hoje)} y1={T - 8} y2={B} stroke="var(--faint)" strokeDasharray="2 3" />
      <text x={X(hoje)} y={T - 14} textAnchor="middle" fill="var(--muted)" fontSize="11" fontWeight="600">hoje</text>
      {marcos.map(({ x, y, l }, i) => {
        const cima = l.valor > 0
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="4.5" fill="var(--text)" stroke="var(--surface)" strokeWidth="2" />
            <text x={x} y={cima ? y - 22 : y + 18} textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="600">{ROTULO_CURTO[l.cat] ?? l.cat}</text>
            <text x={x} y={cima ? y - 9 : y + 31} textAnchor="middle" fill="var(--muted)" fontSize="11">{sinal(l.valor)}</text>
          </g>
        )
      })}
      <circle cx={X(hoje)} cy={Y(caixa)} r="5" fill="var(--lavanda)" stroke="var(--surface)" strokeWidth="2" />
    </svg>
    </div>
  )
}

/** Barras divergentes: entrou acima da linha, saiu abaixo; o projetado empilha mais claro; embaixo, o mês e o saldo dele. */
export function BarrasMes({ meses }: { meses: Mes[] }) {
  const [ref, w] = useLargura(640)
  const ultimos = meses.slice(-12).map((x) => ({ ...x, ent: x.entrou + (x.entrouProj ?? 0), sai: x.saiu + (x.saiuProj ?? 0) }))
  const maior = Math.max(1, ...ultimos.flatMap((x) => [x.ent, x.sai]))
  const zero = 128, alto = 96, larg = Math.min(56, (w - 40) / Math.max(1, ultimos.length))
  const valores = larg >= 40 // estreito: os valores ficam na lista ao lado e no aria-label
  const k = alto / maior
  const curto = (v: number) => dinheiro(v).replace('R$ ', '')
  return (
    <div ref={ref} style={{ overflow: 'hidden' }}>
    <svg width={w} height={268} viewBox={`0 0 ${w} 268`} role="img" style={{ display: 'block' }}
      aria-label={`Entradas e saídas por mês (com o projetado): ${ultimos.map((x) => `${MESES[x.mes - 1]} entra ${dinheiro(x.ent)}, sai ${dinheiro(x.sai)}`).join('; ')}`}>
      <line x1={16} x2={w - 8} y1={zero} y2={zero} stroke="var(--faint)" />
      {ultimos.map((x, i) => {
        const cx = 24 + larg * i + larg / 2, bw = larg * 0.6, net = x.ent - x.sai
        return (
          <g key={`${x.ano}-${x.mes}`}>
            {x.ent > 0 && <rect x={cx - bw / 2} y={zero - x.ent * k - 1} width={bw} height={x.ent * k} rx="4" fill="var(--menta)" fillOpacity="0.35" />}
            {x.entrou > 0 && <rect x={cx - bw / 2} y={zero - x.entrou * k - 1} width={bw} height={x.entrou * k} rx="4" fill="var(--menta)" />}
            {x.sai > 0 && <rect x={cx - bw / 2} y={zero + 1} width={bw} height={x.sai * k} rx="4" fill="var(--rosa)" fillOpacity="0.35" />}
            {x.saiu > 0 && <rect x={cx - bw / 2} y={zero + 1} width={bw} height={x.saiu * k} rx="4" fill="var(--rosa)" />}
            {valores && x.ent > 0 && <text x={cx} y={zero - x.ent * k - 6} textAnchor="middle" fill="var(--muted)" fontSize="10">{curto(x.ent)}</text>}
            {valores && x.sai > 0 && <text x={cx} y={zero + x.sai * k + 14} textAnchor="middle" fill="var(--muted)" fontSize="10">{curto(x.sai)}</text>}
            <text x={cx} y={246} textAnchor="middle" fill="var(--faint)" fontSize="11">{MESES[x.mes - 1]}</text>
            {valores && <text x={cx} y={262} textAnchor="middle" fill={net >= 0 ? 'var(--menta)' : 'var(--rosa)'} fontSize="11" fontWeight="600">{net >= 0 ? '+' : '−'}{curto(Math.abs(net))}</text>}
          </g>
        )
      })}
    </svg>
    </div>
  )
}
