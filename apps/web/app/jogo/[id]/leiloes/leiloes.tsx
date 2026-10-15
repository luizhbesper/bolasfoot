'use client'
// Leilões: sobras da IA abertas depois das rodadas. Os lances são públicos e chegam na hora (SSE); o maior leva quando a
// rodada resolve, mas quem cobre o lance de outro clube dá a ele mais uma rodada para responder (até 2).
import { MAX_PRORROGACOES, type Comando, type Leilao, type Mundo } from '@bolasfoot/engine'
import { useState } from 'react'
import { ChipPosicao, Escudo, Forca } from '../../../_ui/ui.tsx'
import { Fechado, Pendentes, useComandos, type Comandos } from '../comandos.tsx'
import { dinheiro } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { Carregando, SemClube } from '../hub.tsx'
import { Valor } from '../valor.tsx'

type LanceRodada = { jogador: number; valor: number; tecnico: number }

export function Leiloes({ pendentes, daRodada }: { pendentes: Comando[]; daRodada: LanceRodada[] }) {
  const { mundo: m, meuTime: t } = useJogo()
  const k = useComandos(pendentes)
  if (!m) return <Carregando />
  if (!t) return <SemClube />
  return (
    <div className="grade2">
      <section className="coluna">
        {m.leiloes.length === 0 ? (
          <div className="card secao"><p className="mudo" style={{ margin: 0 }}>Nenhum leilão aberto. Eles abrem depois das rodadas de liga e estaduais.</p></div>
        ) : m.leiloes.map((l) => <Lote key={l.jogador} m={m} l={l} k={k} meuTime={t.id} daRodada={daRodada.filter((x) => x.jogador === l.jogador)} />)}
        <p className="fraco" style={{ margin: 0, fontSize: 12 }}>
          O maior lance leva quando a rodada resolve. Abaixo de 2,5× o mínimo, o clube às vezes prefere a oferta de um time da IA.
          Cobrir o lance de outro clube adia o fechamento em uma rodada (no máximo {MAX_PRORROGACOES}).
        </p>
      </section>
      <aside className="coluna">
        <Pendentes k={k} tipos={['lance']} titulo="Seus lances" />
        <Fechado k={k} />
      </aside>
    </div>
  )
}

function Lote({ m, l, k, meuTime, daRodada }: { m: Mundo; l: Leilao; k: Comandos; meuTime: number; daRodada: LanceRodada[] }) {
  const j = m.jogadores[l.jogador]!
  // lances que já valem (rodadas anteriores) + os desta rodada, que substituem o do mesmo clube
  const novos = daRodada.map((x) => ({ time: m.tecnicos[x.tecnico]!.time!, valor: x.valor, novo: true }))
  const lances = [...l.lances.filter((x) => !novos.some((n) => n.time === x.time)).map((x) => ({ ...x, novo: false })), ...novos]
    .sort((a, b) => b.valor - a.valor)
  const maior = lances[0]?.valor ?? 0
  const meu = lances.find((x) => x.time === meuTime)
  const [valor, setValor] = useState(meu?.valor ?? l.minimo)
  const v = m.times[l.vendedor]!
  const prorrogado = l.prorrogacoes ?? 0
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
        <span>valor {dinheiro(j.valor)}</span>
        <span>lance mínimo <strong style={{ color: 'var(--text)' }}>{dinheiro(l.minimo)}</strong></span>
        {prorrogado > 0 && <span className="etiqueta pessego">prorrogado {prorrogado}×</span>}
      </div>

      {lances.length > 0 && (
        <ol aria-label="Lances" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {lances.map((x, i) => (
            <li key={x.time} className="linha" style={{ gap: 8, fontSize: 13, fontWeight: i === 0 ? 600 : 400 }}>
              <Escudo fileRef={m.times[x.time]!.fileRef} tamanho={18} mini />
              <span style={{ flex: 1 }}>{m.times[x.time]!.nome}{x.time === meuTime && <span className="fraco"> (você)</span>}</span>
              {i === 0 && <span className="etiqueta menta">maior</span>}
              {x.novo && <span className="fraco" style={{ fontSize: 12 }}>nesta rodada</span>}
              <span>{dinheiro(x.valor)}</span>
            </li>
          ))}
        </ol>
      )}

      <Valor valor={valor} mudar={setValor} rotulo="Seu lance (R$ milhões)" extras={<>
        <button onClick={() => setValor(l.minimo)}>Mínimo</button>
        {maior > 0 && meu?.valor !== maior && <button onClick={() => setValor(maior + 100_000)}>Cobrir +100 mil</button>}
      </>} />
      <div className="linha">
        {valor > 0 && valor < l.minimo && <span className="fraco" style={{ fontSize: 12 }}>abaixo do mínimo</span>}
        <button className="primario" style={{ marginLeft: 'auto' }} disabled={!k.aberto || k.ocupado || valor < l.minimo}
          onClick={() => void k.mandar({ tipo: 'lance', jogador: j.id, valor })}>{meu ? 'Trocar lance' : 'Dar lance'}</button>
      </div>
    </div>
  )
}
