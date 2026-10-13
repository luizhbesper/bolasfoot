'use client'
// Finanças: caixa, folha, empréstimo (pegar/devolver em parcelas de 500 mil) e o extrato da temporada.
import { folha, limiteEmprestimo, PARCELA_EMPRESTIMO, type Comando, type Financas as FinancasM } from '@bolasfoot/engine'
import { Fechado, Pendentes, useComandos } from '../comandos.tsx'
import { dinheiro } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { Carregando, SemClube } from '../hub.tsx'

const RECEITAS: [keyof FinancasM['receitas'], string][] = [['bilheteria', 'Bilheteria'], ['premios', 'Prêmios'], ['vendas', 'Venda de jogadores'], ['patrocinio', 'Patrocínio'], ['multas', 'Multas recebidas']]
const DESPESAS: [keyof FinancasM['despesas'], string][] = [['salarios', 'Salários'], ['compras', 'Compra de jogadores'], ['obras', 'Obras'], ['juros', 'Juros'], ['comissoes', 'Comissões'], ['outras', 'Outras']]

export function Financas({ pendentes }: { pendentes: Comando[] }) {
  const { mundo: m, meuTime: t } = useJogo()
  const k = useComandos(pendentes)
  if (!m) return <Carregando />
  if (!t?.financas) return <SemClube />
  const f = t.financas
  const limite = limiteEmprestimo(t)
  const pedidos = pendentes.filter((c) => c.tipo === 'banco').reduce((s, c) => s + (c.tipo === 'banco' && c.acao === 'pegar' ? 1 : -1), 0)
  const rec = RECEITAS.reduce((s, [c]) => s + f.receitas[c], 0)
  const desp = DESPESAS.reduce((s, [c]) => s + f.despesas[c], 0)

  return (
    <div className="grade2">
      <section className="coluna">
        <div className="card secao">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <Numero rotulo="Caixa" valor={dinheiro(f.caixa)} cor={f.caixa < 0 ? 'rosa' : undefined} />
            <Numero rotulo="Folha mensal" valor={dinheiro(folha(m, t))} />
            <Numero rotulo="Empréstimo" valor={dinheiro(f.emprestimo)} sub={`limite ${dinheiro(limite)}`} />
            <Numero rotulo="Juros por mês" valor={dinheiro(f.juros)} sub="3% do saldo" />
          </div>
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="cabecalho"><h2>Extrato da temporada</h2><strong style={{ color: rec - desp < 0 ? 'var(--rosa)' : 'var(--menta)' }}>{dinheiro(rec - desp)}</strong></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 0 }}>
            <Extrato titulo="Receitas" itens={RECEITAS.map(([c, r]) => [r, f.receitas[c]])} total={rec} cor="menta" />
            <Extrato titulo="Despesas" itens={DESPESAS.map(([c, r]) => [r, f.despesas[c]])} total={desp} cor="rosa" />
          </div>
        </div>
      </section>
      <aside className="coluna">
        <div className="card secao">
          <h2>Banco</h2>
          <p className="mudo" style={{ margin: 0, fontSize: 13 }}>
            Parcelas de {dinheiro(PARCELA_EMPRESTIMO)}. Juros de 3% do saldo todo dia de pagamento.
          </p>
          <div className="linha">
            <button disabled={!k.aberto || k.ocupado || f.emprestimo + (pedidos + 1) * PARCELA_EMPRESTIMO > limite}
              onClick={() => void k.mandar({ tipo: 'banco', acao: 'pegar' })}>Pegar {dinheiro(PARCELA_EMPRESTIMO)}</button>
            <button disabled={!k.aberto || k.ocupado || f.emprestimo + (pedidos - 1) * PARCELA_EMPRESTIMO < 0}
              onClick={() => void k.mandar({ tipo: 'banco', acao: 'pagar' })}>Devolver {dinheiro(PARCELA_EMPRESTIMO)}</button>
          </div>
          <Fechado k={k} />
        </div>
        <Pendentes k={k} tipos={['banco']} />
      </aside>
    </div>
  )
}

function Numero({ rotulo, valor, sub, cor }: { rotulo: string; valor: string; sub?: string; cor?: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span className="fraco" style={{ fontSize: 12 }}>{rotulo}</span>
      <strong style={{ fontSize: 18, color: cor ? `var(--${cor})` : undefined }}>{valor}</strong>
      {sub && <span className="fraco" style={{ fontSize: 12 }}>{sub}</span>}
    </div>
  )
}

function Extrato({ titulo, itens, total, cor }: { titulo: string; itens: [string, number][]; total: number; cor: string }) {
  const maior = Math.max(1, ...itens.map((x) => x[1]))
  return (
    <div className="secao" style={{ gap: 10 }}>
      <div className="linha" style={{ justifyContent: 'space-between' }}><span className="mudo">{titulo}</span><strong>{dinheiro(total)}</strong></div>
      {itens.map(([r, v]) => (
        <div key={r} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <div className="linha" style={{ justifyContent: 'space-between' }}><span>{r}</span><span className={v ? undefined : 'fraco'}>{dinheiro(v)}</span></div>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--line)' }}><div style={{ height: 4, borderRadius: 2, width: `${(v / maior) * 100}%`, background: `var(--${cor})` }} /></div>
        </div>
      ))}
    </div>
  )
}
