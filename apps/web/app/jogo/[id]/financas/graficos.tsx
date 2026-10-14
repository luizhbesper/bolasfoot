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

export function LinhaCaixa({ inicial, dias, hoje, caixa, pedido, folha }: {
  inicial: number; dias: Dia[]; hoje: number; caixa: number; pedido: number; folha: { dia: number; valor: number }
}) {
  const [ref, W] = useLargura(820)
  const ini = Math.min(dias[0]?.dia ?? hoje, hoje)
  const fim = Math.max(folha.dia + 3, hoje + 7)
  // degraus: o saldo muda no dia do movimento
  const pts: [number, number][] = [[ini, inicial]]
  for (const d of dias) pts.push([d.dia, pts.at(-1)![1]], [d.dia, d.saldo])
  pts.push([hoje, caixa])
  const posPedido = caixa - pedido
  const proj: [number, number][] = [[hoje, caixa], [hoje + 0.5, posPedido], [folha.dia, posPedido], [folha.dia, posPedido - folha.valor], [fim, posPedido - folha.valor]]
  const vals = [...pts, ...proj].map((p) => p[1])
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
      aria-label={`Caixa na temporada: começou em ${dinheiro(inicial)}, está em ${dinheiro(caixa)}, mínimo de ${dinheiro(minimo)}; depois do pedido e da próxima folha, ${dinheiro(posPedido - folha.valor)}`}>
      {grade.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--line)" />
          <text x={L - 8} y={Y(v) + 4} textAnchor="end" fill="var(--faint)" fontSize="11">{dinheiro(v)}</text>
        </g>
      ))}
      {meses.map((x, i) => <text key={i} x={x.x} y={252} textAnchor="start" fill="var(--faint)" fontSize="11">{x.rotulo}</text>)}
      <path d={`M${X(ini)},${B} L${linha(pts).replaceAll(' ', ' L')} L${X(hoje)},${B} Z`} fill="var(--lavanda)" fillOpacity="0.1" />
      <polyline points={linha(pts)} fill="none" stroke="var(--lavanda)" strokeWidth="2" strokeLinejoin="round" />
      <polyline points={linha(proj)} fill="none" stroke="var(--lavanda)" strokeWidth="2" strokeDasharray="5 5" />
      {[...folhas, folha.dia].map((d) => <rect key={d} x={X(d) - 4} y={B - 4} width="8" height="8" rx="2" fill="var(--pessego)" stroke="var(--surface)" strokeWidth="2" />)}
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

/** Barras divergentes: entrou acima da linha, saiu abaixo; embaixo, o mês e o saldo dele. */
export function BarrasMes({ meses }: { meses: Mes[] }) {
  const [ref, w] = useLargura(640)
  const ultimos = meses.slice(-12)
  const maior = Math.max(1, ...ultimos.flatMap((x) => [x.entrou, x.saiu]))
  const zero = 128, alto = 96, larg = Math.min(56, (w - 40) / Math.max(1, ultimos.length))
  const valores = larg >= 40 // estreito: os valores ficam na lista ao lado e no aria-label
  const k = alto / maior
  const curto = (v: number) => dinheiro(v).replace('R$ ', '')
  return (
    <div ref={ref} style={{ overflow: 'hidden' }}>
    <svg width={w} height={268} viewBox={`0 0 ${w} 268`} role="img" style={{ display: 'block' }}
      aria-label={`Entradas e saídas por mês: ${ultimos.map((x) => `${MESES[x.mes - 1]} entrou ${dinheiro(x.entrou)}, saiu ${dinheiro(x.saiu)}`).join('; ')}`}>
      <line x1={16} x2={w - 8} y1={zero} y2={zero} stroke="var(--faint)" />
      {ultimos.map((x, i) => {
        const cx = 24 + larg * i + larg / 2, bw = larg * 0.6, net = x.entrou - x.saiu
        return (
          <g key={`${x.ano}-${x.mes}`}>
            {x.entrou > 0 && <rect x={cx - bw / 2} y={zero - x.entrou * k - 1} width={bw} height={x.entrou * k} rx="4" fill="var(--menta)" />}
            {x.saiu > 0 && <rect x={cx - bw / 2} y={zero + 1} width={bw} height={x.saiu * k} rx="4" fill="var(--rosa)" />}
            {valores && x.entrou > 0 && <text x={cx} y={zero - x.entrou * k - 6} textAnchor="middle" fill="var(--muted)" fontSize="10">{curto(x.entrou)}</text>}
            {valores && x.saiu > 0 && <text x={cx} y={zero + x.saiu * k + 14} textAnchor="middle" fill="var(--muted)" fontSize="10">{curto(x.saiu)}</text>}
            <text x={cx} y={246} textAnchor="middle" fill="var(--faint)" fontSize="11">{MESES[x.mes - 1]}</text>
            {valores && <text x={cx} y={262} textAnchor="middle" fill={net >= 0 ? 'var(--menta)' : 'var(--rosa)'} fontSize="11" fontWeight="600">{net >= 0 ? '+' : '−'}{curto(Math.abs(net))}</text>}
          </g>
        )
      })}
    </svg>
    </div>
  )
}
