'use client'
// Agenda: os jogos do seu time na temporada, de todas as competições, com o resultado ou o que vem. Filtro por
// competição e duas vistas: lista e calendário do mês.
import { data, diaAbsoluto, diaDaSemana, type Competicao, type Jogo } from '@bolasfoot/engine'
import { useState } from 'react'
import { Escudo } from '../../../_ui/ui.tsx'
import { agendaDoTime, dataLonga, resultadoPara } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { Carregando, SemClube } from '../hub.tsx'
import s from './agenda.module.css'

const COR = { V: 'menta', E: '', D: 'rosa' } as const
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
type Item = { comp: Competicao; jogo: Jogo }

export function Agenda() {
  const { mundo: m, meuTime: t } = useJogo()
  const [filtro, setFiltro] = useState<string | null>(null)
  const [vista, setVista] = useState<'lista' | 'calendario'>('lista')
  const [mes, setMes] = useState<{ ano: number; mes: number } | null>(null)
  if (!m) return <Carregando />
  if (!t) return <SemClube />
  const todos = agendaDoTime(m, t.id)
  const comps = [...new Map(todos.map(({ comp }) => [comp.id, comp])).values()]
  const jogos = todos.filter(({ comp }) => filtro === null || comp.id === filtro)
  const proximo = todos.find(({ jogo }) => !jogo.gols)?.jogo
  const { ano, mes: mm } = data(proximo?.dia ?? m.dia)
  const atual = mes ?? { ano, mes: mm }

  return (
    <div className="coluna">
      <div className="linha" style={{ justifyContent: 'space-between', gap: 12 }}>
        <div className="chips" role="group" aria-label="Competições">
          <button aria-pressed={filtro === null} onClick={() => setFiltro(null)}>Todas <span className="fraco">{todos.length}</span></button>
          {comps.map((c) => (
            <button key={c.id} aria-pressed={filtro === c.id} onClick={() => setFiltro(filtro === c.id ? null : c.id)}>
              {c.nome} <span className="fraco">{todos.filter((x) => x.comp === c).length}</span>
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Vista">
          <button aria-pressed={vista === 'lista'} onClick={() => setVista('lista')}>Lista</button>
          <button aria-pressed={vista === 'calendario'} onClick={() => setVista('calendario')}>Calendário</button>
        </div>
      </div>
      {vista === 'lista'
        ? <Lista jogos={jogos} timeId={t.id} proximo={proximo} />
        : <Calendario jogos={jogos} timeId={t.id} proximo={proximo} hoje={m.dia} {...atual} mudar={(d) => {
          const n = atual.mes - 1 + d
          setMes({ ano: atual.ano + Math.floor(n / 12), mes: ((n % 12) + 12) % 12 + 1 })
        }} />}
    </div>
  )
}

function Lista({ jogos, timeId, proximo }: { jogos: Item[]; timeId: number; proximo?: Jogo }) {
  const { mundo } = useJogo()
  const m = mundo!
  return (
    <div className="card rolagem">
      <table className="tabela" style={{ minWidth: 640 }}>
        <thead><tr><th>Data</th><th>Competição</th><th /><th>Adversário</th><th className="num">Placar</th><th /></tr></thead>
        <tbody>
          {jogos.map(({ comp, jogo }, i) => {
            const casa = jogo.casa === timeId
            const adv = m.times[casa ? jogo.fora : jogo.casa]!
            const r = resultadoPara(jogo, timeId)
            return (
              <tr key={i} className={jogo === proximo ? 'eu' : undefined} style={jogo.gols ? undefined : { color: 'var(--muted)' }}>
                <td style={{ whiteSpace: 'nowrap' }}>{dataLonga(jogo.dia)}</td>
                <td>{comp.nome}</td>
                <td className="fraco">{casa ? 'Casa' : 'Fora'}</td>
                <td><span className="clube"><Escudo fileRef={adv.fileRef} tamanho={18} mini />{adv.nome}</span></td>
                <td className="num" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {jogo.gols ? `${jogo.gols[0]} × ${jogo.gols[1]}${jogo.penaltis !== undefined ? ` (pên.: ${(jogo.penaltis === 0) === casa ? 'venceu' : 'perdeu'})` : ''}` : '—'}
                </td>
                <td className="num">{r ? <span className={`etiqueta ${COR[r]}`}>{r}</span> : jogo === proximo ? <span className="etiqueta ceu">Próximo</span> : null}</td>
              </tr>
            )
          })}
          {jogos.length === 0 && <tr><td colSpan={6} className="mudo">Nenhum jogo nessa competição.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

/** O mês em grade (domingo primeiro); cada dia com jogo mostra o adversário, o mando e o placar. */
function Calendario({ jogos, timeId, proximo, hoje, ano, mes, mudar }: {
  jogos: Item[]; timeId: number; proximo?: Jogo; hoje: number; ano: number; mes: number; mudar: (d: number) => void
}) {
  const { mundo } = useJogo()
  const m = mundo!
  const inicio = diaAbsoluto(ano, mes, 1)
  const fim = mes === 12 ? diaAbsoluto(ano + 1, 1, 1) : diaAbsoluto(ano, mes + 1, 1)
  const vazios = diaDaSemana(inicio) - 1
  const doDia = new Map<number, Item[]>()
  for (const x of jogos) doDia.set(x.jogo.dia, [...(doDia.get(x.jogo.dia) ?? []), x])
  const noMes = jogos.filter(({ jogo }) => jogo.dia >= inicio && jogo.dia < fim).length
  return (
    <section className="card" style={{ overflow: 'hidden' }}>
      <div className="cabecalho">
        <button className="fantasma" onClick={() => mudar(-1)} aria-label="Mês anterior">‹</button>
        <h2 style={{ flex: 1, textAlign: 'center' }}>{MESES[mes - 1]} {ano} <span className="fraco" style={{ fontWeight: 400, fontSize: 13 }}>{noMes} {noMes === 1 ? 'jogo' : 'jogos'}</span></h2>
        <button className="fantasma" onClick={() => mudar(1)} aria-label="Próximo mês">›</button>
      </div>
      <div className={s.grade}>
        {SEMANA.map((d) => <div key={d} className={s.semana}>{d}</div>)}
        {Array.from({ length: vazios }, (_, i) => <div key={`v${i}`} />)}
        {Array.from({ length: fim - inicio }, (_, i) => {
          const dia = inicio + i
          const lista = doDia.get(dia) ?? []
          return (
            <div key={dia} className={`${s.dia} ${dia === hoje ? s.hoje : ''} ${lista.some((x) => x.jogo === proximo) ? s.proximo : ''}`}>
              <span className={s.numero}>{i + 1}</span>
              {lista.map(({ comp, jogo }, k) => {
                const casa = jogo.casa === timeId
                const adv = m.times[casa ? jogo.fora : jogo.casa]!
                const r = resultadoPara(jogo, timeId)
                return (
                  <div key={k} className={s.jogo} title={`${comp.nome} · ${casa ? 'em casa' : 'fora'} contra ${adv.nome}`}>
                    <span className={s.adv}><Escudo fileRef={adv.fileRef} tamanho={20} mini /><span>{adv.nome}</span></span>
                    <span className={s.info}>
                      <span className="fraco">{casa ? 'C' : 'F'} · {comp.nome}</span>
                      {jogo.gols && <span className={`etiqueta ${r ? COR[r] : ''}`}>{casa ? jogo.gols[0] : jogo.gols[1]}–{casa ? jogo.gols[1] : jogo.gols[0]}</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </section>
  )
}
