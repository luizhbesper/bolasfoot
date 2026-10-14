'use client'
// Casca do jogo: menu lateral, barra superior (caixa, data, próximo jogo, técnicos prontos, prazo, ação da fase).
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, type ReactNode } from 'react'
import { Icone } from '../../_ui/icones.tsx'
import { Avatar, Escudo, Marca } from '../../_ui/ui.tsx'
import { pausaAcao, readyAcao } from './acoes.ts'
import s from './casca.module.css'
import { dataLonga, dinheiro, NOME_DIVISAO, proximoJogo } from './consultas.ts'
import { useJogo, useRelogio } from './contexto.tsx'
import { useNaoLidos } from './caixa/lidos.ts'
import { CAIXA, GRUPOS, itemDaRota, type ItemNav } from './nav.ts'

export function Casca({ nomeJogo, usuario, timeInicial, children }: {
  nomeJogo: string; usuario: string; timeInicial: { fileRef: string; nome: string } | null; children: ReactNode
}) {
  const { jogo, fase, meuTime } = useJogo()
  const base = `/jogo/${jogo}`
  const sufixo = usePathname().slice(base.length).replace(/^\//, '')
  // o apito inicial leva quem está em campo para a partida (só na virada da fase, não ao abrir a página)
  const router = useRouter()
  const antes = useRef(fase.fase)
  useEffect(() => {
    if (fase.fase === 'ao_vivo_1t' && antes.current !== 'ao_vivo_1t' && meuTime && sufixo !== 'partida') router.push(`${base}/partida`)
    antes.current = fase.fase
  }, [fase.fase, meuTime, sufixo, base, router])
  // a partida é tela cheia
  if (sufixo === 'partida') return <>{children}</>
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
  const { meuTime, eu, prontos, mundo } = useJogo()
  const naoLidos = useNaoLidos()
  // sem habilidade individual o treino não muda nada: some do menu
  const visivel = (i: ItemNav) => i.chave !== 'treino' || mundo?.opcoes.habilidadeIndividual !== false
  const time = meuTime ?? timeInicial
  const item = (i: ItemNav) => i.rota === null
    ? <span key={i.chave} className={s.item} aria-disabled="true" title="Em breve"><Icone nome={i.chave} /><span>{i.rotulo}</span></span>
    : (
      <Link key={i.chave} href={i.rota ? `${base}/${i.rota}` : base} className={s.item} aria-current={i.rota === sufixo ? 'page' : undefined}>
        <Icone nome={i.chave} /><span>{i.rotulo}</span>
        {i.chave === 'caixa' && naoLidos > 0 && <span className={s.contador} aria-label={`${naoLidos} não lidos`}>{naoLidos}</span>}
      </Link>
    )
  return (
    <nav className={s.menu} aria-label="Menu do jogo">
      <div className={s.marca}>
        <Marca />
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
          {g.itens.filter(visivel).map(item)}
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
  const { mundo, meuTime } = useJogo()
  const prox = mundo && meuTime ? proximoJogo(mundo, meuTime.id) : null
  const adv = prox && mundo ? mundo.times[prox.adversario] : null
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
      <Prontos />
      <BotaoPausa />
      <AcaoDaFase />
    </header>
  )
}

/** Quem já está pronto (um avatar por técnico com jogo; quem não joga, esmaecido) e o prazo da fase. */
export function Prontos() {
  const { membros, prontos, joga } = useJogo()
  const tecnicos = membros.filter((m) => m.tecnicoId !== null)
  const jogam = tecnicos.filter((m) => joga(m.tecnicoId))
  return (
    <div className={s.presenca} aria-label={`Técnicos prontos: ${jogam.filter((m) => prontos.includes(m.id)).length} de ${jogam.length}`}>
      {tecnicos.map((m) => <Avatar key={m.id} nome={m.nome} pronto={prontos.includes(m.id)} semJogo={!joga(m.tecnicoId)} />)}
      <Relogio />
    </div>
  )
}

/** Prazo da fase em pêssego; durante o jogo, o minuto. */
export function Relogio() {
  const { fase, msPorMinuto, membros } = useJogo()
  const agora = useRelogio()
  if (fase.aguardando) {
    const quem = membros.filter((m) => fase.offline.includes(m.id)).map((m) => m.nome).join(', ')
    return <span className={s.pilula} title="A liga só anda com todos online">Aguardando {quem || 'todos'}</span>
  }
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

/** Pronto / não pronto da fase (planejamento e intervalo); quem não joga não precisa. */
export function BotaoPronto() {
  const { jogo, fase, eu, prontos, joga } = useJogo()
  if (!joga(eu.tecnicoId)) return <span className="fraco">Sem jogo nesta rodada</span>
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

/** Só o admin: congela tudo (prazo e partida) e retoma de onde parou. */
function BotaoPausa() {
  const { jogo, fase, eu } = useJogo()
  if (!eu.admin || (fase.status !== 'running' && fase.status !== 'paused')) return null
  const pausado = fase.status === 'paused'
  return (
    <form action={pausaAcao}>
      <input type="hidden" name="jogo" value={jogo} />
      <input type="hidden" name="pausar" value={pausado ? '0' : '1'} />
      <button className="fantasma">{pausado ? 'Retomar' : 'Pausar'}</button>
    </form>
  )
}

function AcaoDaFase() {
  const { jogo, fase, eu, joga } = useJogo()
  if (fase.status !== 'running') return null
  if (fase.fase === 'planejamento') return eu.tecnicoId === null ? null : <BotaoPronto />
  const ir = (texto: string) => <Link href={`/jogo/${jogo}/partida`} className={`${s.cta} primario`}>{texto} <Icone nome="seta" /></Link>
  if (fase.fase === 'intervalo') return joga(eu.tecnicoId) ? ir('Voltar ao intervalo') : <BotaoPronto />
  if (fase.fase?.startsWith('ao_vivo')) return ir('Ir para a partida')
  if (fase.fase === 'resultados') return ir('Ver resultados')
  return null
}
