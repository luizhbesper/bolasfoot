'use client'
// Treino: foco nas características principais ou secundárias, ou deixar o auxiliar decidir. Só pesa com a opção de
// habilidade individual do jogo.
import type { Comando } from '@bolasfoot/engine'
import { Fechado, Pendentes, useComandos } from '../comandos.tsx'
import { useJogo } from '../contexto.tsx'
import { Carregando, SemClube } from '../hub.tsx'

const OPCOES = [
  { foco: 0 as const, auxiliar: false, titulo: 'Características principais', texto: 'Treino equilibrado: cada jogador evolui no que já é forte.' },
  { foco: 1 as const, auxiliar: false, titulo: 'Características secundárias', texto: 'A habilidade escolhida para cada posição evolui em dobro.' },
  { foco: 0 as const, auxiliar: true, titulo: 'O auxiliar decide', texto: 'A cada quatro semanas o auxiliar sorteia o foco, como a IA.' },
]
const HAB = ['gol', 'velocidade', 'técnica', 'passe', 'desarme', 'armação', 'finalização']

export function Treino({ pendentes }: { pendentes: Comando[] }) {
  const { mundo: m, meuTime: t } = useJogo()
  const k = useComandos(pendentes)
  if (!m) return <Carregando />
  if (!t) return <SemClube />
  const p = pendentes.findLast((c) => c.tipo === 'treino')
  const atual = p?.tipo === 'treino' ? p : t.treino
  if (!m.opcoes.habilidadeIndividual)
    return <div className="card secao"><p className="mudo" style={{ margin: 0 }}>Este jogo foi criado sem habilidade individual: não há treino.</p></div>
  return (
    <div className="grade2">
      <section className="coluna">
        <div className="card secao" role="radiogroup" aria-label="Foco do treino">
          {OPCOES.map((o) => {
            const sel = atual.auxiliar ? o.auxiliar : !o.auxiliar && o.foco === atual.foco
            return (
              <button key={o.titulo} role="radio" aria-checked={sel} disabled={!k.aberto || k.ocupado}
                onClick={() => void k.mandar({ tipo: 'treino', foco: o.foco, auxiliar: o.auxiliar })}
                style={{ height: 'auto', padding: '12px 14px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 4,
                  borderColor: sel ? 'var(--lavanda)' : undefined, background: sel ? 'rgba(195,188,245,.14)' : 'transparent' }}>
                <strong>{o.titulo}</strong><span className="mudo" style={{ fontSize: 13, fontWeight: 400 }}>{o.texto}</span>
              </button>
            )
          })}
          <Fechado k={k} />
        </div>
      </section>
      <aside className="coluna">
        <div className="card secao">
          <h2>Habilidade da vez</h2>
          {['GOL', 'LAT', 'ZAG', 'MEI', 'ATA'].map((pos, i) => (
            <div key={pos} className="linha" style={{ justifyContent: 'space-between' }}><span className="mudo">{pos}</span><span>{HAB[t.treino.habilidade[i] ?? -1] ?? '—'}</span></div>
          ))}
        </div>
        <Pendentes k={k} tipos={['treino']} />
      </aside>
    </div>
  )
}
