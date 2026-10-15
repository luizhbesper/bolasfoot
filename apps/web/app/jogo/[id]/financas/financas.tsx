'use client'
// Finanças (desenho no Claude Design): indicadores, a linha do caixa na temporada com a projeção de 6 meses (pedido da
// rodada, salários, juros, bilheteria, patrocínio), entradas/saídas por mês, de onde veio e para onde foi, banco e o
// extrato com filtros. Tudo sai do extrato do motor (caixa = saldo inicial + lançamentos); o pedido da rodada só mexe no caixa quando ela resolve.
import { contratosDe, folha, limiteEmprestimo, novoContrato, orcamentoObra, PASSO_EMPRESTIMO, PRAZOS, type Comando, type Contrato, type Financas as FinancasM, type Lancamento, type Mundo, type TimeM } from '@bolasfoot/engine'
import { useState, type ReactNode } from 'react'
import { descrever, Fechado, useComandos, type Comandos } from '../comandos.tsx'
import { dataLonga, dinheiro } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { Carregando, SemClube } from '../hub.tsx'
import s from './financas.module.css'
import { porDia, porMes, projetar, proximaFolha, type Dia } from './fluxo.ts'
import { BarrasMes, LinhaCaixa } from './graficos.tsx'

const RECEITAS: [keyof FinancasM['receitas'], string][] = [
  ['bilheteria', 'Bilheteria'], ['premios', 'Prêmios'], ['vendas', 'Venda de jogadores'], ['patrocinio', 'Patrocínio'], ['emprestimo', 'Empréstimo do banco'],
]
const DESPESAS: [keyof FinancasM['despesas'], string][] = [
  ['salarios', 'Salários'], ['compras', 'Compra de jogadores'], ['obras', 'Obras'], ['juros', 'Juros'], ['comissoes', 'Multa rescisória'], ['amortizacao', 'Devolução ao banco'],
]
const ROTULO = Object.fromEntries([...RECEITAS, ...DESPESAS]) as Record<Lancamento['cat'], string>
const FILTROS: [string, string, (l: Lancamento) => boolean][] = [
  ['tudo', 'Tudo', () => true],
  ['entradas', 'Entradas', (l) => l.valor > 0],
  ['saidas', 'Saídas', (l) => l.valor < 0],
  ['salarios', 'Salários', (l) => l.cat === 'salarios'],
  ['bilheteria', 'Bilheteria', (l) => l.cat === 'bilheteria'],
  ['mercado', 'Mercado', (l) => l.cat === 'compras' || l.cat === 'vendas' || l.cat === 'comissoes'],
  ['banco', 'Banco', (l) => l.cat === 'emprestimo' || l.cat === 'amortizacao' || l.cat === 'juros'],
]
const sinal = (v: number) => (v > 0 ? `+${dinheiro(v)}` : dinheiro(v))
/** "seg, 02/11" */
const dataCurta = (d: number) => dataLonga(d).slice(0, 10).toLowerCase()

/** O que cada pedido tira do caixa se fechar (lance só se ganhar; banco pode pôr dinheiro); null = não mexe no caixa. */
function custo(m: Mundo, t: TimeM, c: Comando): number | null {
  if (c.tipo === 'comprar' || c.tipo === 'lance') return c.valor
  if (c.tipo === 'comprarEmprestado') return m.jogadores[c.jogador]?.valor ?? 0
  if (c.tipo === 'obra') return orcamentoObra(t, c.mais).custo
  if (c.tipo === 'banco') return c.acao === 'pegar' ? -c.valor : contratosDe(m, t).find((x) => x.id === c.contrato)?.saldo ?? 0
  return null
}

export function Financas({ pendentes }: { pendentes: Comando[] }) {
  const { mundo: m, meuTime: t } = useJogo()
  const k = useComandos(pendentes)
  // empréstimo no controle do banco, ainda não confirmado: já entra na projeção
  const [banco, setBanco] = useState(0)
  const [prazo, setPrazo] = useState<number>(12)
  if (!m) return <Carregando />
  if (!t?.financas) return <SemClube />
  const f = t.financas
  const { inicial, dias } = porDia(f)
  const prox = proximaFolha(m, t)
  const proxFolha = { dia: prox.dia, valor: prox.cobra ? folha(m, t) : 0 }
  const pedidos = pendentes.flatMap((c) => {
    const v = custo(m, t, c)
    return v === null ? [] : [{ c, v }]
  })
  const pedido = pedidos.reduce((x, p) => x + p.v, 0)
  // resultado do futebol: empréstimo e devolução ao banco são dinheiro emprestado, não ganho nem gasto
  const entrou = RECEITAS.reduce((x, [c]) => x + (c === 'emprestimo' ? 0 : f.receitas[c] ?? 0), 0)
  const saiu = DESPESAS.reduce((x, [c]) => x + (c === 'amortizacao' ? 0 : f.despesas[c] ?? 0), 0)
  const emDias = prox.dia - m.dia
  const limite = limiteEmprestimo(m, t)
  // pedidos do banco já mandados nesta rodada
  const novos = pendentes.flatMap((c) => (c.tipo === 'banco' && c.acao === 'pegar' ? [{ valor: c.valor, parcelas: c.parcelas }] : []))
  const quitar = pendentes.flatMap((c) => (c.tipo === 'banco' && c.acao === 'quitar' ? [c.contrato] : []))
  const contratos = contratosDe(m, t)
  const divida = contratos.filter((c) => !quitar.includes(c.id)).reduce((x, c) => x + c.saldo, 0) + novos.reduce((x, n) => x + n.valor, 0)
  const maximo = Math.floor(Math.max(0, limite - divida) / PASSO_EMPRESTIMO) * PASSO_EMPRESTIMO
  const valorBanco = Math.min(maximo, banco)
  const proj = projetar(m, t, { pedido: pedido - valorBanco, quitar, novos: valorBanco ? [...novos, { valor: valorBanco, parcelas: prazo }] : novos })
  const base = valorBanco ? projetar(m, t, { pedido, quitar, novos }) : null
  const meses = porMes(dias)
  for (const p of proj.meses) {
    const x = meses.find((y) => y.ano === p.ano && y.mes === p.mes)
    if (x) Object.assign(x, { entrouProj: p.entrouProj, saiuProj: p.saiuProj })
    else meses.push(p)
  }

  return (
    <div className="coluna" style={{ gap: 16 }}>
      <section className={s.kpis} aria-label="Resumo">
        <Kpi rotulo="Caixa agora" valor={dinheiro(f.caixa)} cor={f.caixa < 0 ? 'rosa' : undefined}
          sub={pedido ? `${dinheiro(f.caixa - pedido)} se o pedido da rodada fechar` : 'nada pedido nesta rodada'} />
        <Kpi rotulo={`Próxima folha (${(m.opcoes.salarioMensal ?? true) ? 'mensal' : 'semanal'})`} valor={prox.cobra ? dinheiro(-proxFolha.valor) : 'R$ 0'}
          sub={<>{dataCurta(prox.dia)} · <span style={{ color: 'var(--pessego)', fontWeight: 600 }}>{emDias <= 0 ? 'hoje' : emDias === 1 ? 'amanhã' : `em ${emDias} dias`}</span>{!prox.cobra && ' · sem jogo no mês, não cobra'}</>} />
        <Kpi rotulo="Resultado da temporada" valor={sinal(entrou - saiu)} cor={entrou - saiu < 0 ? 'rosa' : 'menta'}
          sub={`entrou ${dinheiro(entrou)} · saiu ${dinheiro(saiu)}`} />
        <Kpi rotulo="Empréstimo do banco" valor={dinheiro(f.emprestimo)} sub={`de ${dinheiro(limite)} · parcelas ${dinheiro(f.juros)}/mês`} />
      </section>

      <div className={s.topo}>
        <section className={`card ${s.painel}`} aria-label="Caixa na temporada">
          <div className={s.cabeca}>
            <h2>Caixa na temporada</h2>
            <span className={s.nota}>saldo depois de cada movimento · tracejado: os próximos 6 meses</span>
            <span style={{ flex: 1 }} />
            <span className={s.legenda}><i style={{ width: 16, height: 2, background: 'var(--lavanda)' }} />saldo</span>
            <span className={s.legenda}><i style={{ width: 16, borderTop: '2px dashed var(--lavanda)' }} />projeção</span>
            <span className={s.legenda}><i style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--pessego)' }} />dia de folha</span>
          </div>
          <LinhaCaixa inicial={inicial} dias={dias} hoje={m.dia} caixa={f.caixa} proj={proj.pontos} base={base?.pontos} folha={proxFolha.dia} />
        </section>

        <div className="coluna" style={{ gap: 16 }}>
          {pedidos.length > 0 && <Pedido k={k} m={m} pedidos={pedidos} caixa={f.caixa} folha={proxFolha} />}
          <Banco k={k} m={m} t={t} contratos={contratos} quitar={quitar} divida={divida} limite={limite} maximo={maximo} valor={valorBanco} setValor={setBanco} prazo={prazo} setPrazo={setPrazo} />
        </div>
      </div>

      <div className={s.meio}>
        <section className={`card ${s.painel}`} aria-label="Entradas e saídas por mês">
          <div className={s.cabeca}>
            <h2>Entradas e saídas por mês</h2>
            <span style={{ flex: 1 }} />
            <span className={s.legenda}><i style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--menta)' }} />entrou (acima)</span>
            <span className={s.legenda}><i style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--rosa)' }} />saiu (abaixo)</span>
            <span className={s.legenda}><i style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--faint)', opacity: 0.4 }} />projetado</span>
          </div>
          {meses.length ? <BarrasMes meses={meses} /> : <p className="mudo" style={{ margin: 0 }}>Nenhum movimento ainda nesta temporada.</p>}
          <span className={s.nota}>Última linha: saldo do mês.</span>
        </section>
        <section className={`card ${s.painel}`} aria-label="De onde veio, para onde foi" style={{ gap: 16 }}>
          <h2>De onde veio, para onde foi</h2>
          <Ranking titulo="Entradas" itens={RECEITAS.map(([c, r]) => [r, f.receitas[c] ?? 0])} cor="menta" />
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <Ranking titulo="Saídas" itens={DESPESAS.map(([c, r]) => [r, f.despesas[c] ?? 0])} cor="rosa" />
          </div>
          <span className={s.nota}>
            Barra = fatia do total do lado.
            {f.obra && ` Obra no estádio: +${f.obra.setores.reduce((a, b) => a + b, 0).toLocaleString('pt-BR')} lugares, pronta em ${dataCurta(f.obra.fim + 1)} (já paga).`}
          </span>
        </section>
      </div>

      <Extrato inicial={inicial} dias={dias} />
    </div>
  )
}

function Kpi({ rotulo, valor, sub, cor }: { rotulo: string; valor: string; sub: ReactNode; cor?: string }) {
  return (
    <div className={`card ${s.kpi}`}>
      <span className={s.nota}>{rotulo}</span>
      <strong className={s.grande} style={{ color: cor ? `var(--${cor})` : undefined }}>{valor}</strong>
      <span className={s.nota}>{sub}</span>
    </div>
  )
}

function Pedido({ k, m, pedidos, caixa, folha }: {
  k: Comandos; m: Mundo; pedidos: { c: Comando; v: number }[]; caixa: number; folha: { dia: number; valor: number }
}) {
  const total = pedidos.reduce((x, p) => x + p.v, 0)
  return (
    <section className={`card ${s.painel}`} aria-label="Pedido nesta rodada">
      <div className="linha" style={{ gap: 8 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pessego)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        <h2>Pedido nesta rodada</h2>
      </div>
      <p className={s.nota} style={{ margin: 0, fontSize: 13 }}>Sai do caixa só quando a rodada resolver, antes dos jogos. Lance só sai se você ganhar.</p>
      {pedidos.map(({ c, v }, i) => (
        <div key={i} className={s.linhaValor}>
          <span>{descrever(m, c)}</span>
          <span className="linha" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <strong style={{ color: v > 0 ? 'var(--rosa)' : 'var(--menta)', whiteSpace: 'nowrap' }}>{sinal(-v)}</strong>
            {k.aberto && <button className="fantasma" disabled={k.ocupado} onClick={() => void k.tirar(c)} aria-label={`Cancelar: ${descrever(m, c)}`}>✕</button>}
          </span>
        </div>
      ))}
      <div className={s.linhaValor} style={{ borderTop: '1px solid var(--line)', paddingTop: 10, fontSize: 13 }}>
        <span className="mudo">Caixa se fechar</span><strong>{dinheiro(caixa - total)}</strong>
      </div>
      <div className={s.linhaValor} style={{ fontSize: 13 }}>
        <span className="mudo">Depois da folha de {dataCurta(folha.dia).slice(5)}</span><strong>{dinheiro(caixa - total - folha.valor)}</strong>
      </div>
      {k.erro && <p role="alert" style={{ margin: 0, color: 'var(--rosa)' }}>{k.erro}</p>}
    </section>
  )
}

function Banco({ k, m, t, contratos, quitar, divida, limite, maximo, valor, setValor, prazo, setPrazo }: {
  k: Comandos; m: Mundo; t: TimeM; contratos: Contrato[]; quitar: number[]; divida: number; limite: number; maximo: number
  valor: number; setValor: (v: number) => void; prazo: number; setPrazo: (n: number) => void
}) {
  const c = valor ? novoContrato(m, t, valor, prazo, 0, m.dia, divida) : null
  const pct = (x: number) => `${(x * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  return (
    <section className={`card ${s.painel}`} aria-label="Banco">
      <div className="linha" style={{ justifyContent: 'space-between' }}>
        <h2>Banco</h2><span className={s.nota}>deve {dinheiro(divida)} de {dinheiro(limite)}</span>
      </div>
      <input type="range" min={0} max={maximo} step={PASSO_EMPRESTIMO} value={valor} disabled={!k.aberto || maximo === 0}
        onChange={(e) => setValor(Number(e.target.value))} aria-label="Valor do empréstimo" aria-valuetext={dinheiro(valor)} />
      <div className={s.linhaValor} style={{ fontSize: 12 }}><span className="fraco">R$ 0</span><span className="fraco">até {dinheiro(maximo)}</span></div>
      <div className="chips" role="group" aria-label="Parcelas">
        {PRAZOS.map((n) => <button key={n} aria-pressed={prazo === n} onClick={() => setPrazo(n)}>{n}x</button>)}
      </div>
      <div className={s.linhaValor}><span className="mudo">Pegar</span><strong>{dinheiro(valor)}</strong></div>
      {c && <>
        <div className={s.linhaValor}><span className="mudo">Parcela</span><strong>{prazo}x de {dinheiro(c.parcela)}</strong></div>
        <div className={s.linhaValor}><span className="mudo">Juros</span><strong>{pct(c.taxa)} ao mês</strong></div>
        <div className={s.linhaValor}>
          <span className="mudo">Total a pagar</span>
          <strong>{dinheiro(c.parcela * prazo)} <span style={{ color: 'var(--rosa)', fontWeight: 500 }}>(+{dinheiro(c.parcela * prazo - valor)})</span></strong>
        </div>
      </>}
      <span className={s.nota}>Limite: 30% do valor do elenco. Juros de 1% a 10% ao mês: sobem com o tamanho da dívida e com o prazo. Parcelas todo dia 2. No gráfico, o pontilhado claro é a projeção sem este empréstimo.</span>
      <button className={s.botaoBanco} disabled={!k.aberto || k.ocupado || valor === 0}
        onClick={() => void k.mandar({ tipo: 'banco', acao: 'pegar', valor, parcelas: prazo }).then((e) => { if (!e) setValor(0) })}>Pegar {dinheiro(valor)} em {prazo}x</button>
      {contratos.length > 0 && (
        <div className="coluna" style={{ gap: 8 }}>
          <span className="mudo" style={{ fontSize: 13 }}>Em aberto</span>
          {contratos.map((x) => (
            <div key={x.id} className={s.linhaValor} style={{ fontSize: 13 }}>
              <span>{dinheiro(x.valor)} · faltam {x.restantes} de {x.parcelas}x de {dinheiro(x.parcela)} <span className="fraco">({pct(x.taxa)})</span></span>
              <button style={{ height: 28, padding: '0 10px', fontSize: 12 }} disabled={!k.aberto || k.ocupado || quitar.includes(x.id)}
                onClick={() => void k.mandar({ tipo: 'banco', acao: 'quitar', contrato: x.id })}>{quitar.includes(x.id) ? 'Quitação pedida' : `Quitar ${dinheiro(x.saldo)}`}</button>
            </div>
          ))}
        </div>
      )}
      <Fechado k={k} />
    </section>
  )
}

/** Categorias de um lado em ordem, com a fatia do total. */
function Ranking({ titulo, itens, cor }: { titulo: string; itens: [string, number][]; cor: string }) {
  const lista = itens.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const total = lista.reduce((x, [, v]) => x + v, 0)
  return (
    <div className="coluna" style={{ gap: 10 }}>
      <div className={s.linhaValor} style={{ fontSize: 13 }}><span className="mudo">{titulo}</span><strong>{dinheiro(total)}</strong></div>
      {lista.length === 0 && <span className={s.nota}>Nada ainda.</span>}
      {lista.map(([r, v]) => {
        const pct = Math.round((v / total) * 100)
        return (
          <div key={r} className={s.rank}>
            <div className="coluna" style={{ gap: 5, minWidth: 0 }}>
              <span>{r}</span>
              <span className={s.trilho}><span style={{ width: `${pct}%`, background: `var(--${cor})` }} /></span>
            </div>
            <strong style={{ textAlign: 'right' }}>{dinheiro(v)}</strong>
            <span className="mudo" style={{ textAlign: 'right' }}>{pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

const POR_PAGINA = 12

function Extrato({ inicial, dias }: { inicial: number; dias: Dia[] }) {
  const [filtro, setFiltro] = useState('tudo')
  const [todos, setTodos] = useState(false)
  const ok = FILTROS.find((x) => x[0] === filtro)![2]
  const lista = [...dias].reverse().map((d) => ({ ...d, itens: d.itens.filter(ok) })).filter((d) => d.itens.length)
  const visiveis = todos ? lista : lista.slice(0, POR_PAGINA)
  return (
    <section className="card" aria-label="Extrato" style={{ overflow: 'hidden' }}>
      <div className={s.cabecaExtrato}>
        <h2>Extrato</h2>
        <span className={s.nota}>saldo no início da temporada {dinheiro(inicial)}</span>
        <span style={{ flex: 1 }} />
        <div className="chips" role="group" aria-label="Filtrar extrato">
          {FILTROS.map(([kf, r]) => <button key={kf} aria-pressed={filtro === kf} onClick={() => setFiltro(kf)}>{r}</button>)}
        </div>
      </div>
      {visiveis.length === 0 && <p className="mudo" style={{ padding: 20, margin: 0 }}>Nenhum movimento {filtro === 'tudo' ? 'ainda nesta temporada' : 'com esse filtro'}.</p>}
      {visiveis.map((d) => (
        <div key={d.dia} className={s.dia}>
          <div className={s.linhaValor} style={{ fontSize: 12, color: 'var(--faint)' }}><span style={{ fontWeight: 600 }}>{dataLonga(d.dia)}</span><span>saldo {dinheiro(d.saldo)}</span></div>
          {d.itens.map((l, i) => (
            <div key={i} className={s.lanc}>
              <span className={s.quadrado} style={{ background: l.valor < 0 ? 'var(--rosa)' : 'var(--menta)' }} />
              <span>{ROTULO[l.cat] ?? l.cat}{l.desc && <span className="mudo"> · {l.desc}</span>}</span>
              <strong style={{ color: l.valor < 0 ? 'var(--rosa)' : 'var(--menta)' }}>{sinal(l.valor)}</strong>
            </div>
          ))}
        </div>
      ))}
      {!todos && lista.length > POR_PAGINA && (
        <div style={{ padding: '12px 20px' }}><button onClick={() => setTodos(true)}>Ver o resto da temporada ({lista.length - POR_PAGINA} dias)</button></div>
      )}
    </section>
  )
}
