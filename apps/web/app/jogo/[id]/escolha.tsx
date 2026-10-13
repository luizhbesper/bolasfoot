'use client'
// Lobby e escolha de times (plano §3.5): busca no cliente sobre o catálogo já filtrado pelo admin; os times dos
// outros técnicos chegam pelo SSE (o layout re-renderiza e o contexto traz os membros novos).
import Link from 'next/link'
import { useDeferredValue, useState } from 'react'
import type { TimeEscolha } from '../../../lib/game/escolha.ts'
import { Erro } from '../../_ui/pagina.tsx'
import { Avatar, Escudo } from '../../_ui/ui.tsx'
import { escolherAcao, readyAcao } from './acoes.ts'
import { Relogio } from './casca.tsx'
import { useJogo } from './contexto.tsx'
import s from './escolha.module.css'

const DIVISAO = (d: number) => d ? `Série ${'ABC'[d - 1]}` : 'Fora das séries'
const MAX = 40

export function Escolha({ nomeJogo, regra, times, erro }: { nomeJogo: string; regra: string; times: TimeEscolha[]; erro?: string }) {
  const { jogo, fase, membros, eu, prontos } = useJogo()
  const [q, setQ] = useState('')
  const [uf, setUf] = useState('')
  const [div, setDiv] = useState('')
  const busca = useDeferredValue(q.trim().toLowerCase())
  const escolhendo = fase.status === 'picking'
  const dono = new Map(membros.filter((m) => m.teamRef).map((m) => [m.teamRef!, m]))
  const meu = membros.find((m) => m.id === eu.id)?.teamRef ?? null
  const meuTime = times.find((t) => t.fileRef === meu)
  const pronto = prontos.includes(eu.id)
  const ufs = [...new Set(times.map((t) => t.uf))].sort()
  const divisoes = [...new Set(times.map((t) => t.divisao))].sort()
  const achados = times.filter((t) =>
    (!busca || t.nome.toLowerCase().includes(busca)) && (!uf || t.uf === uf) && (!div || t.divisao === Number(div)))

  return (
    <div className={s.tela}>
      <header className={s.topo}>
        <Link href="/" className={s.marca}>Bolasfoot</Link>
        <span className="fraco">/</span>
        <span>{nomeJogo}</span>
        <span className={`etiqueta ${escolhendo ? 'ceu' : ''}`}>{escolhendo ? 'Escolha de times' : 'Lobby'}</span>
        <span style={{ marginLeft: 'auto' }}>{escolhendo && <Relogio />}</span>
      </header>

      <div className={s.corpo}>
        <section className={s.principal}>
          <div>
            <h1 className={s.titulo}>{escolhendo ? 'Escolha seu time' : 'Esperando o início'}</h1>
            <p className="mudo" style={{ margin: '6px 0 0' }}>
              {escolhendo ? `${regra} Times pegos pelos amigos aparecem na hora.`
                : `O admin abre a escolha de times quando todos tiverem entrado. ${regra}`}
            </p>
          </div>
          <Erro texto={erro} />
          {escolhendo && (
            <>
              <div className={s.filtros}>
                <input className={s.busca} type="search" placeholder="Buscar time" aria-label="Buscar time" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
                <select aria-label="Estado" value={uf} onChange={(e) => setUf(e.target.value)}>
                  <option value="">Todos os estados</option>{ufs.map((u) => <option key={u}>{u}</option>)}
                </select>
                <select aria-label="Divisão" value={div} onChange={(e) => setDiv(e.target.value)}>
                  <option value="">Todas as divisões</option>{divisoes.map((d) => <option key={d} value={d}>{DIVISAO(d)}</option>)}
                </select>
              </div>
              <div className={s.grade}>
                {achados.slice(0, MAX).map((t) => {
                  const m = dono.get(t.fileRef)
                  const minha = t.fileRef === meu
                  const ocupado = !!m && !minha
                  return (
                    <form key={t.fileRef} action={escolherAcao}>
                      <input type="hidden" name="jogo" value={jogo} />
                      <input type="hidden" name="time" value={t.fileRef} />
                      <button className={`${s.time} ${minha ? s.minha : ''} ${ocupado ? s.ocupado : ''}`} disabled={ocupado || minha} aria-pressed={minha}>
                        <Escudo fileRef={t.fileRef} tamanho={52} />
                        <strong>{t.nome}</strong>
                        <span className="mudo">{t.uf} · {DIVISAO(t.divisao)}</span>
                        <span className={`etiqueta ${minha ? s.sua : ocupado ? '' : 'menta'}`}>{minha ? 'Sua escolha' : ocupado ? `de ${m!.nome}` : 'Livre'}</span>
                      </button>
                    </form>
                  )
                })}
              </div>
              {achados.length > MAX && <p className="mudo">… e mais {achados.length - MAX}. Refine a busca.</p>}
              {achados.length === 0 && <p className="mudo">Nenhum time com esses filtros.</p>}
            </>
          )}
        </section>

        <aside className={s.lado}>
          <section className="card" style={{ overflow: 'hidden' }}>
            <div className="secao" style={{ paddingBottom: 10 }}>
              <h2>Técnicos {escolhendo && <span className="fraco" style={{ fontWeight: 400 }}>{prontos.length} de {membros.length} prontos</span>}</h2>
            </div>
            {membros.map((m) => {
              const t = m.teamRef ? times.find((x) => x.fileRef === m.teamRef) : undefined
              const ok = prontos.includes(m.id)
              return (
                <div key={m.id} className={s.membro}>
                  <Avatar nome={m.nome} pronto={ok} />
                  <span className={s.quem}>
                    <strong>{m.nome}{m.id === eu.id && ' (você)'}</strong>
                    <span className="mudo">{t?.nome ?? (escolhendo ? 'Escolhendo…' : 'No lobby')}</span>
                  </span>
                  {escolhendo && <span className={ok ? 'etiqueta menta' : 'etiqueta pessego'}>{ok ? 'Pronto' : t ? 'Falta confirmar' : 'Escolhendo'}</span>}
                </div>
              )
            })}
          </section>
          {escolhendo && meuTime && (
            <section className="card secao">
              <div className="linha">
                <Escudo fileRef={meuTime.fileRef} tamanho={40} />
                <span><strong>{meuTime.nome}</strong><br /><span className="mudo">{meuTime.uf} · {DIVISAO(meuTime.divisao)}</span></span>
              </div>
              <form action={readyAcao}>
                <input type="hidden" name="jogo" value={jogo} />
                <input type="hidden" name="ready" value={pronto ? '0' : '1'} />
                <button className={pronto ? undefined : 'primario'} style={{ width: '100%' }}>{pronto ? 'Não estou pronto' : 'Confirmar e ficar pronto'}</button>
              </form>
              <span className="fraco" style={{ fontSize: 12 }}>Todos prontos (ou o prazo acabar) e o mundo nasce.</span>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
