'use client'
// Agenda: os jogos do seu time na temporada, de todas as competições, com o resultado ou o que vem.
import { Escudo } from '../../../_ui/ui.tsx'
import { agendaDoTime, dataLonga, resultadoPara } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { Carregando, SemClube } from '../hub.tsx'

const COR = { V: 'menta', E: '', D: 'rosa' } as const

export function Agenda() {
  const { mundo: m, meuTime: t } = useJogo()
  if (!m) return <Carregando />
  if (!t) return <SemClube />
  const jogos = agendaDoTime(m, t.id)
  const proximo = jogos.find(({ jogo }) => !jogo.gols)
  return (
    <div className="card rolagem">
      <table className="tabela" style={{ minWidth: 640 }}>
        <thead><tr><th>Data</th><th>Competição</th><th /><th>Adversário</th><th className="num">Placar</th><th /></tr></thead>
        <tbody>
          {jogos.map(({ comp, jogo }, i) => {
            const casa = jogo.casa === t.id
            const adv = m.times[casa ? jogo.fora : jogo.casa]!
            const r = resultadoPara(jogo, t.id)
            return (
              <tr key={i} className={jogo === proximo?.jogo ? 'eu' : undefined} style={jogo.gols ? undefined : { color: 'var(--muted)' }}>
                <td style={{ whiteSpace: 'nowrap' }}>{dataLonga(jogo.dia)}</td>
                <td>{comp.nome}</td>
                <td className="fraco">{casa ? 'Casa' : 'Fora'}</td>
                <td><span className="clube"><Escudo fileRef={adv.fileRef} tamanho={18} mini />{adv.nome}</span></td>
                <td className="num" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {jogo.gols ? `${jogo.gols[0]} × ${jogo.gols[1]}${jogo.penaltis !== undefined ? ` (pên.: ${(jogo.penaltis === 0) === casa ? 'venceu' : 'perdeu'})` : ''}` : '—'}
                </td>
                <td className="num">{r ? <span className={`etiqueta ${COR[r]}`}>{r}</span> : jogo === proximo?.jogo ? <span className="etiqueta ceu">Próximo</span> : null}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
