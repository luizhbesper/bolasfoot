'use client'
// Procurar jogadores: filtros numa lateral (folha no celular), tabela ordenável e a ficha com a proposta (prévia do que a IA faria com a oferta).
import { aceitaIr, BRA, precoVendaIA, type Comando, type JogadorM, type Mundo, type TimeM } from '@bolasfoot/engine'
import { useMemo, useState } from 'react'
import { Gaveta } from '../../../_ui/gaveta.tsx'
import { ChipPosicao, Energia, Escudo, Forca, POSICOES } from '../../../_ui/ui.tsx'
import { Fechado, Pendentes, useComandos, type Comandos } from '../comandos.tsx'
import { dinheiro, jogadoresDe, NOMES_CARACTERISTICAS } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { caracteristicas, Ficha } from '../elenco/elenco.tsx'
import { Carregando, SemClube } from '../hub.tsx'
import { Valor } from '../valor.tsx'
import s from './procura.module.css'

const POR_PAGINA = 50

/** Faixas numéricas: cada uma vira "mín – máx" na lateral, na unidade mostrada (`escala`). */
const FAIXAS = [
  { chave: 'idade', rotulo: 'Idade', min: 'Idade mínima', max: 'Idade máxima', de: (j: JogadorM) => j.idade, escala: 1 },
  { chave: 'forca', rotulo: 'Força', min: 'Força mínima', max: 'Força máxima', de: (j: JogadorM) => j.forca, escala: 1 },
  { chave: 'energia', rotulo: 'Energia', min: 'Energia mínima', max: 'Energia máxima', de: (j: JogadorM) => j.energia, escala: 1 },
  // à venda vale o preço pedido; fora da lista, o valor de mercado
  { chave: 'preco', rotulo: 'Preço (R$ mi)', min: 'Preço mínimo', max: 'Preço máximo', de: (j: JogadorM) => (j.aVenda ? j.preco : j.valor), escala: 1e6 },
  { chave: 'salario', rotulo: 'Salário (R$ mil)', min: 'Salário mínimo', max: 'Salário máximo', de: (j: JogadorM) => j.salario, escala: 1e3 },
] as const
type Faixa = (typeof FAIXAS)[number]['chave']
type Limites = Partial<Record<Faixa, { min?: number; max?: number }>>

interface Filtros { nome: string; time: string; pais: number; pos: number[]; cars: number[]; soVenda: boolean; soEmprestimo: boolean; faixas: Limites }
const VAZIO: Filtros = { nome: '', time: '', pais: -1, pos: [], cars: [], soVenda: false, soEmprestimo: false, faixas: {} }

type Coluna = 'posicao' | 'nome' | 'idade' | 'forca' | 'energia' | 'time' | 'salario' | 'valor'
const COLUNAS: { chave: Coluna; rotulo: string; num?: boolean }[] = [
  { chave: 'posicao', rotulo: 'Pos' }, { chave: 'nome', rotulo: 'Jogador' }, { chave: 'idade', rotulo: 'Idade', num: true },
  { chave: 'forca', rotulo: 'Força', num: true }, { chave: 'energia', rotulo: 'Energia' }, { chave: 'time', rotulo: 'Time' },
  { chave: 'salario', rotulo: 'Salário', num: true }, { chave: 'valor', rotulo: 'Valor', num: true },
]

const alternar = (xs: number[], x: number) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x])
/** Todas as faixas de uma vez; limite vazio não filtra. */
export const dentro = (j: JogadorM, faixas: Limites) => FAIXAS.every(({ chave, de, escala }) => {
  const l = faixas[chave], v = de(j) / escala
  return !l || ((l.min === undefined || v >= l.min) && (l.max === undefined || v <= l.max))
})
/** Quantos filtros estão ligados (selo do botão "Filtros" e o "Limpar filtros"). */
const ativos = (f: Filtros) => [f.nome.trim(), f.time.trim(), f.pais >= 0, f.pos.length, f.cars.length, f.soVenda, f.soEmprestimo]
  .filter(Boolean).length + Object.values(f.faixas).filter((l) => l.min !== undefined || l.max !== undefined).length

export function Procura({ pendentes, paises }: { pendentes: Comando[]; paises: string[] }) {
  const { mundo: m, meuTime: t } = useJogo()
  const k = useComandos(pendentes)
  const [f, setF] = useState<Filtros>(VAZIO)
  const [pagina, setPagina] = useState(0)
  const [painel, setPainel] = useState(false)
  const [aberto, setAberto] = useState<number | null>(null)
  const [ordem, setOrdem] = useState<{ col: Coluna; desc: boolean }>({ col: 'forca', desc: true })
  // qualquer filtro novo volta para a 1ª página
  const mudar = (p: Partial<Filtros>) => { setF((x) => ({ ...x, ...p })); setPagina(0) }
  const limpar = () => mudar(VAZIO)
  const limite = (chave: Faixa, lado: 'min' | 'max', texto: string) => {
    const n = texto.trim() === '' ? NaN : Number(texto.replace(',', '.'))
    mudar({ faixas: { ...f.faixas, [chave]: { ...f.faixas[chave], [lado]: Number.isFinite(n) ? n : undefined } } })
  }
  // países e times de quem está no mercado (os outros nunca aparecem)
  const opcoes = useMemo(() => {
    const ps = new Set<number>(), ts = new Set<string>()
    if (m && t) for (const j of m.jogadores) if (j.time >= 0 && j.time !== t.id && !j.juvenil) { ps.add(j.pais); ts.add(m.times[j.time]!.nome) }
    return {
      paises: [...ps].sort((a, b) => (paises[a] ?? '').localeCompare(paises[b] ?? '', 'pt-BR')),
      times: [...ts].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    }
  }, [m, t, paises])
  if (!m) return <Carregando />
  if (!t) return <SemClube />

  const q = f.nome.trim().toLowerCase(), qt = f.time.trim().toLowerCase()
  const lista = m.jogadores.filter((j) => j.time >= 0 && j.time !== t.id && !j.juvenil &&
    (!f.pos.length || f.pos.includes(j.posicao)) && f.cars.every((c) => j.cr1 === c || j.cr2 === c) &&
    (f.pais < 0 || j.pais === f.pais) && (!f.soVenda || j.aVenda) && (!f.soEmprestimo || j.paraEmprestimo) && dentro(j, f.faixas) &&
    (!q || j.nome.toLowerCase().includes(q)) && (!qt || m.times[j.time]!.nome.toLowerCase().includes(qt))).sort((a, b) => {
    const va = ordem.col === 'time' ? m.times[a.time]!.nome : a[ordem.col], vb = ordem.col === 'time' ? m.times[b.time]!.nome : b[ordem.col]
    const c = typeof va === 'string' ? va.localeCompare(vb as string, 'pt-BR') : (va as number) - (vb as number)
    return (ordem.desc ? -c : c) || b.forca - a.forca || a.valor - b.valor
  })
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
  const pag = Math.min(pagina, paginas - 1)
  const visiveis = lista.slice(pag * POR_PAGINA, (pag + 1) * POR_PAGINA)
  // texto e idade começam crescentes; o resto (força, energia, dinheiro) do maior para o menor
  const ordenar = (col: Coluna) => { setOrdem((o) => ({ col, desc: o.col === col ? !o.desc : !['posicao', 'nome', 'time', 'idade'].includes(col) })); setPagina(0) }
  const sel = aberto === null ? null : m.jogadores[aberto]!
  const n = ativos(f)
  const total = `${lista.length.toLocaleString('pt-BR')} ${lista.length === 1 ? 'jogador' : 'jogadores'}`

  return (
    <div className={s.tela}>
      <aside className={`card ${s.painel} ${painel ? s.aberto : ''}`} aria-label="Filtros" onKeyDown={(e) => e.key === 'Escape' && setPainel(false)}>
        <div className={s.topo}>
          <h2>Filtros</h2>
          <button className="fantasma" disabled={!n} onClick={limpar}>Limpar filtros</button>
        </div>
        <input type="search" placeholder="Nome do jogador" aria-label="Nome do jogador" value={f.nome} onChange={(e) => mudar({ nome: e.target.value })} />

        <div className={s.grupo} role="group" aria-label="Posição">
          <span className={s.rotulo}>Posição</span>
          <div className="chips">
            {POSICOES.map((p, i) => <button key={p} aria-pressed={f.pos.includes(i)} onClick={() => mudar({ pos: alternar(f.pos, i) })}>{p}</button>)}
          </div>
        </div>

        <div className={s.grupo} role="group" aria-label="Mercado">
          <span className={s.rotulo}>Mercado</span>
          <div className="chips">
            <button aria-pressed={f.soVenda} onClick={() => mudar({ soVenda: !f.soVenda })}>À venda</button>
            <button aria-pressed={f.soEmprestimo} onClick={() => mudar({ soEmprestimo: !f.soEmprestimo })}>Para empréstimo</button>
          </div>
        </div>

        <div className={s.grupo}>
          {FAIXAS.map((x) => {
            const l = f.faixas[x.chave]
            const decimal = x.escala === 1e6
            const campo = (lado: 'min' | 'max') => (
              <input type="number" inputMode={decimal ? 'decimal' : 'numeric'} min={0} step={decimal ? 0.1 : 1}
                placeholder={lado === 'min' ? 'mín' : 'máx'} aria-label={x[lado]} value={l?.[lado] ?? ''} onChange={(e) => limite(x.chave, lado, e.target.value)} />
            )
            return (
              <div key={x.chave} className={`${s.faixa} ${l?.min !== undefined || l?.max !== undefined ? s.ligada : ''}`} role="group" aria-label={x.rotulo}>
                <span className={s.rotulo}>{x.rotulo}</span>
                {campo('min')}
                <span className="fraco" aria-hidden>–</span>
                {campo('max')}
              </div>
            )
          })}
          <p className={s.nota}>Preço: o pedido de quem está à venda; dos outros, o valor de mercado.</p>
        </div>

        <label className={s.grupo}>
          <span className={s.rotulo}>Time</span>
          <input type="search" list="procura-times" placeholder="Qualquer time" value={f.time} onChange={(e) => mudar({ time: e.target.value })} />
          <datalist id="procura-times">{opcoes.times.map((x) => <option key={x} value={x} />)}</datalist>
        </label>

        <label className={s.grupo}>
          <span className={s.rotulo}>País</span>
          <select value={f.pais} onChange={(e) => mudar({ pais: Number(e.target.value) })}>
            <option value={-1}>Qualquer país</option>
            {opcoes.paises.map((p) => <option key={p} value={p}>{paises[p]}</option>)}
          </select>
        </label>

        <div className={s.grupo} role="group" aria-label="Características">
          <span className={s.rotulo}>Características <span className="fraco">· todas as marcadas</span></span>
          <div className="chips">
            {NOMES_CARACTERISTICAS.map((c, i) => <button key={c} aria-pressed={f.cars.includes(i)} onClick={() => mudar({ cars: alternar(f.cars, i) })}>{c}</button>)}
          </div>
        </div>

        <button className={`primario ${s.ver}`} onClick={() => setPainel(false)}>Ver {total}</button>
      </aside>
      {painel && <div className={s.veu} onClick={() => setPainel(false)} aria-hidden />}

      <div className="coluna">
        <div className={s.resumo}>
          <p className={s.total} aria-live="polite">{total}</p>
          {n > 0 && <button className={`fantasma ${s.soCelular}`} onClick={limpar}>Limpar filtros</button>}
          <button className={s.abrir} onClick={() => setPainel(true)} aria-expanded={painel}>Filtros{n > 0 && <span className={s.selo}>{n}</span>}</button>
        </div>

        <Pendentes k={k} tipos={['comprar', 'pedirEmprestado']} />
        <div className="card rolagem">
          <table className="tabela" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                {COLUNAS.map((c) => (
                  <th key={c.chave} className={c.num ? 'num' : undefined} aria-sort={ordem.col === c.chave ? (ordem.desc ? 'descending' : 'ascending') : undefined}>
                    <button className="ordenar" onClick={() => ordenar(c.chave)}>{c.rotulo}{ordem.col === c.chave && (ordem.desc ? ' ↓' : ' ↑')}</button>
                  </th>
                ))}
                <th>Caract.</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visiveis.map((j) => {
                const dono = m.times[j.time]!
                return (
                  <tr key={j.id} className={s.linha} onClick={() => setAberto(j.id)}>
                    <td><ChipPosicao posicao={j.posicao} /></td>
                    <td><button className={s.nome} onClick={() => setAberto(j.id)}>{j.nome}</button>
                      {j.pais !== BRA && <span className="fraco" style={{ marginLeft: 6, fontSize: 12 }}>{paises[j.pais]}</span>}</td>
                    <td className="num mudo">{j.idade}</td>
                    <td className="num"><Forca valor={j.forca} /></td>
                    <td><Energia valor={j.energia} /></td>
                    <td><span className="clube"><Escudo fileRef={dono.fileRef} tamanho={18} mini />{dono.nome}</span></td>
                    <td className="num mudo">{dinheiro(j.salario)}</td>
                    <td className="num">{dinheiro(j.valor)}</td>
                    <td className="mudo">{caracteristicas(j)}</td>
                    <td className="num">
                      {j.aVenda && <span className="etiqueta ceu">à venda {dinheiro(j.preco)}</span>}
                      {j.paraEmprestimo && <span className="etiqueta menta" style={{ marginLeft: 4 }}>empréstimo</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {lista.length === 0 && (
            <div className="linha" style={{ padding: 20 }}>
              <span className="mudo">Ninguém com esses filtros. Afrouxe uma faixa ou comece de novo.</span>
              <button onClick={limpar}>Limpar filtros</button>
            </div>
          )}
        </div>
        {lista.length > POR_PAGINA && (
          <div className="linha" style={{ justifyContent: 'flex-end' }}>
            <span className="mudo" style={{ fontSize: 13 }}>{pag * POR_PAGINA + 1}–{pag * POR_PAGINA + visiveis.length} de {lista.length}</span>
            <button disabled={pag === 0} onClick={() => setPagina(pag - 1)}>Anterior</button>
            <button disabled={pag >= paginas - 1} onClick={() => setPagina(pag + 1)}>Próxima</button>
          </div>
        )}
      </div>

      <Gaveta aberta={sel !== null} titulo={sel?.nome ?? ''} aoFechar={() => setAberto(null)}>
        {sel && (
          <>
            <Ficha m={m} j={sel} pais={paises[sel.pais] ?? ''} forcas={jogadoresDe(m, m.times[sel.time]!.jogadores).map((x) => x.forca)} />
            <Proposta key={sel.id} m={m} j={sel} t={t} k={k} />
          </>
        )}
      </Gaveta>
    </div>
  )
}

/** O que a IA faria com a oferta (mesmas regras do `proporCompra`, sem sorteio). */
function previa(m: Mundo, j: JogadorM, t: TimeM, oferta: number): { texto: string; cor: string } {
  const caixa = t.financas?.caixa ?? 0
  if (oferta > caixa) return { texto: 'Mais do que você tem em caixa.', cor: 'rosa' }
  const quer = aceitaIr(m, j, t)
  if (quer === 1) return { texto: 'Ele não quer jogar no seu time.', cor: 'rosa' }
  if (j.aVenda && oferta >= j.preco) return { texto: `Fecha pelo preço pedido (${dinheiro(j.preco)}).`, cor: 'menta' }
  const pedido = precoVendaIA(m, j)
  const salario = quer === 2 ? ' O jogador vai pedir o salário dobrado.' : ''
  if (oferta >= pedido) return quer === 0 ? { texto: 'O clube aceita.', cor: 'menta' } : { texto: `O clube aceita.${salario}`, cor: 'pessego' }
  if (caixa >= pedido) return { texto: `O clube deve pedir ${dinheiro(pedido)}.${salario}`, cor: 'pessego' }
  return { texto: `O clube quer ${dinheiro(pedido)}, mais do que seu caixa.`, cor: 'rosa' }
}

export function Proposta({ m, j, t, k }: { m: Mundo; j: JogadorM; t: TimeM; k: Comandos }) {
  const dono = m.times[j.time]!
  // começa do zero: o valor é decisão sua (o preço pedido fica num atalho)
  const [valor, setValor] = useState(0)
  const [aceitar, setAceitar] = useState(false)
  const amigo = dono.humano ? m.tecnicos[dono.tecnico]?.nome : null
  const p = amigo ? null : previa(m, j, t, valor)
  // uma por jogador: mandar de novo substitui a pendente
  const pendente = k.pendentes.find((c): c is Extract<Comando, { tipo: 'comprar' | 'pedirEmprestado' }> =>
    (c.tipo === 'comprar' || c.tipo === 'pedirEmprestado') && c.jogador === j.id)
  return (
    <div className="card secao" style={{ gap: 10, background: 'var(--bg)' }}>
      <h2>Proposta</h2>
      {amigo
        ? <p className="mudo" style={{ margin: 0, fontSize: 13 }}>{dono.nome} é do <strong>{amigo}</strong>: a proposta vai para a caixa dele, que responde na próxima rodada.</p>
        : <p className="fraco" style={{ margin: 0, fontSize: 12 }}>Se um amigo propuser pelo mesmo jogador nesta rodada, leva a maior oferta.</p>}
      <Valor valor={valor} mudar={setValor} extras={<>
        <button onClick={() => setValor(j.valor)}>Valor {dinheiro(j.valor)}</button>
        {j.aVenda && <button onClick={() => setValor(j.preco)}>Pedido {dinheiro(j.preco)}</button>}
      </>} />
      {p && <span className={`etiqueta ${p.cor}`} style={{ alignSelf: 'flex-start', whiteSpace: 'normal' }}>{p.texto}</span>}
      {!amigo && <label className="check"><input type="checkbox" checked={aceitar} onChange={(e) => setAceitar(e.target.checked)} /> Aceitar a contraproposta, se houver</label>}
      {pendente && (
        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <span className="etiqueta lavanda">{pendente.tipo === 'comprar' ? `Proposta enviada: ${dinheiro(pendente.valor)}` : 'Pedido de empréstimo enviado'}</span>
          <button disabled={!k.aberto || k.ocupado} onClick={() => void k.tirar(pendente)}>Cancelar</button>
        </div>
      )}
      <div className="linha">
        <button className="primario" disabled={!k.aberto || k.ocupado || valor <= 0}
          onClick={() => void k.mandar({ tipo: 'comprar', jogador: j.id, valor, ...(aceitar ? { aceitarContraproposta: true } : {}) })}>{pendente ? 'Atualizar proposta' : 'Fazer proposta'}</button>
        {j.paraEmprestimo && <button disabled={!k.aberto || k.ocupado} onClick={() => void k.mandar({ tipo: 'pedirEmprestado', jogador: j.id })}>Pedir emprestado</button>}
      </div>
      {k.erro && <p role="alert" style={{ margin: 0, color: 'var(--rosa)' }}>{k.erro}</p>}
      <Fechado k={k} />
    </div>
  )
}
