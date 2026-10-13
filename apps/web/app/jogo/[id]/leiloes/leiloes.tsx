'use client'
// Leilões: sobras da IA abertas na última rodada; o lance vale até a próxima (a IA cobre lances baixos às vezes).
import type { Comando, Leilao, Mundo } from '@bolasfoot/engine'
import { useState } from 'react'
import { ChipPosicao, Escudo, Forca } from '../../../_ui/ui.tsx'
import { Fechado, Pendentes, useComandos, type Comandos } from '../comandos.tsx'
import { dinheiro } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { Carregando, SemClube } from '../hub.tsx'

export function Leiloes({ pendentes }: { pendentes: Comando[] }) {
  const { mundo: m, meuTime: t } = useJogo()
  const k = useComandos(pendentes)
  if (!m) return <Carregando />
  if (!t) return <SemClube />
  return (
    <div className="grade2">
      <section className="coluna">
        {m.leiloes.length === 0 ? (
          <div className="card secao"><p className="mudo" style={{ margin: 0 }}>Nenhum leilão aberto. Eles abrem depois das rodadas de liga e estaduais.</p></div>
        ) : m.leiloes.map((l) => <Lote key={l.jogador} m={m} l={l} k={k} meu={pendentes.find((c) => c.tipo === 'lance' && c.jogador === l.jogador)} />)}
        <p className="fraco" style={{ margin: 0, fontSize: 12 }}>
          O maior lance leva. Abaixo de 2,5× o mínimo, o clube às vezes prefere a oferta de um time da IA.
        </p>
      </section>
      <aside className="coluna">
        <Pendentes k={k} tipos={['lance']} titulo="Seus lances" />
        <Fechado k={k} />
      </aside>
    </div>
  )
}

function Lote({ m, l, k, meu }: { m: Mundo; l: Leilao; k: Comandos; meu: Comando | undefined }) {
  const j = m.jogadores[l.jogador]!
  const [valor, setValor] = useState(meu?.tipo === 'lance' ? meu.valor : l.minimo)
  const v = m.times[l.vendedor]!
  return (
    <div className="card secao" style={{ gap: 10 }}>
      <div className="linha">
        <ChipPosicao posicao={j.posicao} />
        <strong style={{ flex: 1 }}>{j.nome}</strong>
        <span className="mudo">{j.idade} anos</span>
        <Forca valor={j.forca} />
      </div>
      <div className="linha mudo" style={{ fontSize: 13 }}>
        <span className="clube"><Escudo fileRef={v.fileRef} tamanho={18} mini />{v.nome}</span>
        <span>· valor {dinheiro(j.valor)} · lance mínimo <strong style={{ color: 'var(--text)' }}>{dinheiro(l.minimo)}</strong></span>
      </div>
      <div className="linha">
        <input type="number" min={l.minimo} step={10_000} aria-label={`Lance por ${j.nome}`} value={valor} style={{ width: 160, textAlign: 'right' }}
          onChange={(e) => setValor(Math.max(0, Math.trunc(Number(e.target.value) || 0)))} />
        <button className="primario" disabled={!k.aberto || k.ocupado || valor < l.minimo}
          onClick={() => void k.mandar({ tipo: 'lance', jogador: j.id, valor })}>{meu ? 'Trocar lance' : 'Dar lance'}</button>
        {meu && <span className="etiqueta lavanda">seu lance: {meu.tipo === 'lance' && dinheiro(meu.valor)}</span>}
      </div>
    </div>
  )
}
