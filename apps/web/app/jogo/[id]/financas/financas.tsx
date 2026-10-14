'use client'
// Finanças: caixa, próxima folha, empréstimo e o extrato da temporada lançamento a lançamento (caixa = saldo inicial +
// lançamentos). O que está pedido nesta rodada (compras, obra, banco) só mexe no caixa quando a rodada resolve.
import {
  data, diaDePagamento, domingo, folha, jogaNoMes, limiteEmprestimo, orcamentoObra, PARCELA_EMPRESTIMO,
  type Comando, type Financas as FinancasM, type Lancamento, type Mundo, type TimeM,
} from '@bolasfoot/engine'
import { Fechado, Pendentes, useComandos } from '../comandos.tsx'
import { dataLonga, dinheiro } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { Carregando, SemClube } from '../hub.tsx'

const RECEITAS: [keyof FinancasM['receitas'], string][] = [
  ['bilheteria', 'Bilheteria'], ['premios', 'Prêmios'], ['vendas', 'Venda de jogadores'], ['patrocinio', 'Patrocínio'], ['emprestimo', 'Empréstimo do banco'],
]
const DESPESAS: [keyof FinancasM['despesas'], string][] = [
  ['salarios', 'Salários'], ['compras', 'Compra de jogadores'], ['obras', 'Obras'], ['juros', 'Juros'], ['comissoes', 'Multa rescisória'], ['amortizacao', 'Devolução ao banco'],
]
const ROTULO = Object.fromEntries([...RECEITAS, ...DESPESAS]) as Record<Lancamento['cat'], string>

/** Próximo dia de salário ainda não processado e se ele cobra (no mensal, só em mês com jogo). */
function proximaFolha(m: Mundo, t: TimeM): { dia: number; cobra: boolean } {
  const mensal = m.opcoes.salarioMensal ?? true
  let dia = m.diaEventos + 1
  while (!(mensal ? diaDePagamento(dia) : domingo(dia))) dia++
  const { ano, mes } = data(dia)
  return { dia, cobra: !mensal || jogaNoMes(m, t.id, ano, mes) }
}

/** Quanto sai do caixa se tudo o que está pedido nesta rodada fechar. */
function comprometido(m: Mundo, t: TimeM, pendentes: Comando[]): number {
  return pendentes.reduce((s, c) => {
    if (c.tipo === 'comprar' || c.tipo === 'lance') return s + c.valor
    if (c.tipo === 'comprarEmprestado') return s + (m.jogadores[c.jogador]?.valor ?? 0)
    if (c.tipo === 'obra') return s + orcamentoObra(t, c.mais).custo
    if (c.tipo === 'banco') return s + (c.acao === 'pagar' ? PARCELA_EMPRESTIMO : -PARCELA_EMPRESTIMO)
    return s
  }, 0)
}

export function Financas({ pendentes }: { pendentes: Comando[] }) {
  const { mundo: m, meuTime: t } = useJogo()
  const k = useComandos(pendentes)
  if (!m) return <Carregando />
  if (!t?.financas) return <SemClube />
  const f = t.financas
  const limite = limiteEmprestimo(t)
  const pedidos = pendentes.filter((c) => c.tipo === 'banco').reduce((s, c) => s + (c.tipo === 'banco' && c.acao === 'pegar' ? 1 : -1), 0)
  const mensal = m.opcoes.salarioMensal ?? true
  const prox = proximaFolha(m, t)
  const pedido = comprometido(m, t, pendentes)
  const rec = RECEITAS.reduce((s, [c]) => s + (f.receitas[c] ?? 0), 0)
  const desp = DESPESAS.reduce((s, [c]) => s + (f.despesas[c] ?? 0), 0)

  return (
    <div className="coluna">
      <div className="card secao">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          <Numero rotulo="Caixa" valor={dinheiro(f.caixa)} cor={f.caixa < 0 ? 'rosa' : undefined}
            sub={pedido > 0 ? `${dinheiro(f.caixa - pedido)} se o pedido fechar` : undefined} />
          <Numero rotulo={`Próxima folha (${mensal ? 'mensal' : 'semanal'})`} valor={prox.cobra ? dinheiro(folha(m, t)) : 'R$ 0'}
            sub={`${dataLonga(prox.dia)}${prox.cobra ? '' : ': sem jogo no mês, não cobra'}`} />
          <Numero rotulo="Empréstimo" valor={dinheiro(f.emprestimo)} sub={`limite ${dinheiro(limite)} · juros ${dinheiro(f.juros)}/mês`} />
          {f.obra && <Numero rotulo="Obra no estádio" valor={`${f.obra.setores.reduce((a, b) => a + b, 0).toLocaleString('pt-BR')} lugares`} sub={`pronta em ${dataLonga(f.obra.fim + 1)} (já paga)`} />}
        </div>
      </div>

      <div className="grade2">
        <Movimentos f={f} />
        <aside className="coluna">
          {pedido !== 0 && (
            <div className="card secao" style={{ gap: 8 }}>
              <h2>Pedido nesta rodada</h2>
              <p className="mudo" style={{ margin: 0, fontSize: 13 }}>
                Compras, lances, obra e banco só mexem no caixa quando a rodada resolve, antes dos jogos. Se tudo fechar:{' '}
                <strong style={{ color: pedido > 0 ? 'var(--rosa)' : 'var(--menta)' }}>{dinheiro(-pedido)}</strong>.
              </p>
              <Pendentes k={k} tipos={['comprar', 'lance', 'comprarEmprestado', 'obra', 'banco']} />
            </div>
          )}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="cabecalho"><h2>Resumo da temporada</h2><strong style={{ color: rec - desp < 0 ? 'var(--rosa)' : 'var(--menta)' }}>{dinheiro(rec - desp)}</strong></div>
            <Resumo titulo="Entradas" itens={RECEITAS.map(([c, r]) => [r, f.receitas[c] ?? 0])} total={rec} cor="menta" />
            <Resumo titulo="Saídas" itens={DESPESAS.map(([c, r]) => [r, f.despesas[c] ?? 0])} total={desp} cor="rosa" />
          </div>
          <div className="card secao">
            <h2>Banco</h2>
            <p className="mudo" style={{ margin: 0, fontSize: 13 }}>
              Parcelas de {dinheiro(PARCELA_EMPRESTIMO)}. Juros de 3% do saldo todo dia 2.
            </p>
            <div className="linha">
              <button disabled={!k.aberto || k.ocupado || f.emprestimo + (pedidos + 1) * PARCELA_EMPRESTIMO > limite}
                onClick={() => void k.mandar({ tipo: 'banco', acao: 'pegar' })}>Pegar {dinheiro(PARCELA_EMPRESTIMO)}</button>
              <button disabled={!k.aberto || k.ocupado || f.emprestimo + (pedidos - 1) * PARCELA_EMPRESTIMO < 0}
                onClick={() => void k.mandar({ tipo: 'banco', acao: 'pagar' })}>Devolver {dinheiro(PARCELA_EMPRESTIMO)}</button>
            </div>
            <Fechado k={k} />
          </div>
        </aside>
      </div>
    </div>
  )
}

/** Extrato por dia, do mais recente ao mais antigo, com o saldo ao fim de cada dia. */
function Movimentos({ f }: { f: FinancasM }) {
  const lista = [...(f.lancamentos ?? [])].sort((a, b) => a.dia - b.dia) // sort estável: a ordem do dia fica
  let saldo = f.caixa - lista.reduce((s, l) => s + l.valor, 0)
  const inicial = saldo
  const dias: { dia: number; itens: Lancamento[]; saldo: number }[] = []
  for (const l of lista) {
    saldo += l.valor
    const d = dias.at(-1)
    if (d?.dia === l.dia) {
      d.itens.push(l)
      d.saldo = saldo
    } else dias.push({ dia: l.dia, itens: [l], saldo })
  }
  return (
    <section className="card" style={{ overflow: 'hidden' }}>
      <div className="cabecalho"><h2>Extrato</h2><span className="fraco" style={{ fontSize: 13 }}>saldo no início da temporada {dinheiro(inicial)}</span></div>
      {dias.length === 0 && <p className="mudo" style={{ padding: '0 20px 20px', margin: 0 }}>Nenhum movimento ainda nesta temporada.</p>}
      <div className="secao" style={{ gap: 14 }}>
        {dias.reverse().map((d) => (
          <div key={d.dia} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className="linha" style={{ justifyContent: 'space-between', fontSize: 12 }}>
              <span className="fraco">{dataLonga(d.dia)}</span><span className="fraco">saldo {dinheiro(d.saldo)}</span>
            </div>
            {d.itens.map((l, i) => (
              <div key={i} className="linha" style={{ justifyContent: 'space-between', fontSize: 14 }}>
                <span>{ROTULO[l.cat] ?? l.cat}{l.desc && <span className="mudo"> · {l.desc}</span>}</span>
                <strong style={{ color: l.valor < 0 ? 'var(--rosa)' : 'var(--menta)' }}>{l.valor > 0 ? '+' : ''}{dinheiro(l.valor)}</strong>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
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

function Resumo({ titulo, itens, total, cor }: { titulo: string; itens: [string, number][]; total: number; cor: string }) {
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
