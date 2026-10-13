'use client'
// Casca do jogo: menu lateral, barra superior (caixa, data, próximo jogo, técnicos prontos, prazo, ação da fase).
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { Icone } from '../../_ui/icones.tsx'
import { Avatar, Escudo } from '../../_ui/ui.tsx'
import { readyAcao } from './acoes.ts'
import s from './casca.module.css'
import { dataLonga, dinheiro, NOME_DIVISAO, proximoJogo } from './consultas.ts'
import { useJogo, useRelogio } from './contexto.tsx'
import { CAIXA, GRUPOS, itemDaRota, type ItemNav } from './nav.ts'

export function Casca({ nomeJogo, usuario, timeInicial, children }: {
  nomeJogo: string; usuario: string; timeInicial: { fileRef: string; nome: string } | null; children: ReactNode
}) {
  const base = `/jogo/${useJogo().jogo}`
  const sufixo = usePathname().slice(base.length).replace(/^\//, '')
  return (
    <div className={s.casca}>
      <Menu base={base} sufixo={sufixo} nomeJogo={nomeJogo} usuario={usuario} timeInicial={timeInicial} />
      <div className={s.principal}>
        <Barra titulo={itemDaRota(sufixo)?.rotulo ?? ''} />
        <main className={s.conteudo}>{children}</main>
      </div>
    </div>
  )
}

function Menu({ base, sufixo, nomeJogo, usuario, timeInicial }: {
  base: string; sufixo: string; nomeJogo: string; usuario: string; timeInicial: { fileRef: string; nome: string } | null
}) {
  const { meuTime, eu, prontos } = useJogo()
  const time = meuTime ?? timeInicial
  const item = (i: ItemNav) => i.rota === null
    ? <span key={i.chave} className={s.item} aria-disabled="true" title="Em breve"><Icone nome={i.chave} /><span>{i.rotulo}</span></span>
    : (
      <Link key={i.chave} href={i.rota ? `${base}/${i.rota}` : base} className={s.item} aria-current={i.rota === sufixo ? 'page' : undefined}>
        <Icone nome={i.chave} /><span>{i.rotulo}</span>
      </Link>
    )
  return (
    <nav className={s.menu} aria-label="Menu do jogo">
      <div className={s.marca}>
        <span>Bolasfoot</span>
        <span className={s.nomeJogo}>{nomeJogo}</span>
      </div>
      {time && (
        <Link href={base} className={s.clube}>
          <Escudo fileRef={time.fileRef} tamanho={36} />
          <span>
            <strong>{time.nome}</strong>
            {meuTime && <span className={s.sub}>{NOME_DIVISAO[meuTime.divisao]}</span>}
          </span>
        </Link>
      )}
      {item(CAIXA)}
      {GRUPOS.map((g) => (
        <div key={g.titulo} className={s.grupo}>
          <div className={s.tituloGrupo}>{g.titulo}</div>
          {g.itens.map(item)}
        </div>
      ))}
      <div className={s.usuario}>
        <Avatar nome={usuario} pronto={prontos.includes(eu.id)} />
        <span>{usuario}</span>
        <Link href="/" aria-label="Seus jogos" title="Seus jogos" className={s.sair}><Icone nome="sair" tamanho={18} /></Link>
      </div>
    </nav>
  )
}

function Barra({ titulo }: { titulo: string }) {
  const { mundo, meuTime, membros, prontos } = useJogo()
  const prox = mundo && meuTime ? proximoJogo(mundo, meuTime.id) : null
  const adv = prox && mundo ? mundo.times[prox.adversario] : null
  const tecnicos = membros.filter((m) => m.teamRef)
  return (
    <header className={s.barra}>
      <h1 className={s.titulo}>{titulo}</h1>
      {meuTime?.financas && (
        <span className={s.dado}><Icone nome="carteira" /><strong>{dinheiro(meuTime.financas.caixa)}</strong></span>
      )}
      {mundo && <span className={s.dado}><Icone nome="agenda" /><span>{dataLonga(mundo.dia)}</span></span>}
      {prox && adv && (
        <span className={s.dado} title={`${prox.comp} · ${dataLonga(prox.dia)}`}>
          Próximo <Escudo fileRef={adv.fileRef} tamanho={20} mini /> <span>{adv.nome} ({prox.casa ? 'C' : 'F'})</span>
        </span>
      )}
      <span className={s.divisor} />
      <div className={s.presenca} aria-label={`Técnicos prontos: ${prontos.length} de ${tecnicos.length}`}>
        {tecnicos.map((m) => <Avatar key={m.id} nome={m.nome} pronto={prontos.includes(m.id)} />)}
        <Relogio />
      </div>
      <AcaoDaFase />
    </header>
  )
}

/** Prazo da fase em pêssego; durante o jogo, o minuto. */
function Relogio() {
  const { fase, msPorMinuto } = useJogo()
  const agora = useRelogio()
  if (fase.status === 'paused') return <span className={s.pilula}>Pausado</span>
  if (agora === null) return null
  if (fase.fase?.startsWith('ao_vivo') && fase.inicio !== null) {
    const min = Math.min(45, Math.max(0, Math.floor((agora - fase.inicio) / msPorMinuto))) + (fase.fase === 'ao_vivo_2t' ? 45 : 0)
    return <span className={`${s.pilula} ${s.vivo}`}>{min}&apos;</span>
  }
  if (fase.prazo === null) return null
  const resta = Math.max(0, Math.ceil((fase.prazo - agora) / 1000))
  return <span className={s.pilula} aria-live="off">{Math.floor(resta / 60)}:{String(resta % 60).padStart(2, '0')}</span>
}

function AcaoDaFase() {
  const { jogo, fase, eu, prontos, meuTime } = useJogo()
  if (fase.status !== 'running') return null
  if (fase.fase === 'planejamento' || fase.fase === 'intervalo') {
    if (eu.tecnicoId === null) return null
    const pronto = prontos.includes(eu.id)
    return (
      <form action={readyAcao}>
        <input type="hidden" name="jogo" value={jogo} />
        <input type="hidden" name="ready" value={pronto ? '0' : '1'} />
        <button className={pronto ? undefined : 'primario'}>
          {pronto ? 'Não estou pronto' : fase.fase === 'intervalo' ? 'Voltar para o 2º tempo' : 'Estou pronto'}
        </button>
      </form>
    )
  }
  if (fase.fase?.startsWith('ao_vivo') && meuTime)
    return <Link href={`/jogo/${jogo}`} className={`${s.cta} primario`}>Ir para a partida <Icone nome="seta" /></Link>
  return null
}
