'use client'
// Comandos da rodada nas telas de gestão e mercado: tudo vale quando a rodada resolve, então cada tela mostra o que já
// está pedido (com desfazer) e manda o novo pelo servidor, que valida com o motor.
import type { Comando, Mundo } from '@bolasfoot/engine'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { definirComandosAcao, enviarComandosAcao } from './acoes.ts'
import { dinheiro } from './consultas.ts'
import { useJogo } from './contexto.tsx'

export function useComandos(pendentes: Comando[]) {
  const { jogo, fase } = useJogo()
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const aberto = (fase.status === 'running' || fase.status === 'paused') && fase.fase === 'planejamento'
  async function rodar(f: () => Promise<string | null>) {
    setOcupado(true)
    const e = await f()
    setErro(e)
    setOcupado(false)
    router.refresh()
    return e
  }
  return {
    aberto, erro, ocupado, pendentes,
    /** soma o comando aos da rodada (escalação, tática, treino, ingresso substituem o anterior) */
    mandar: (c: Comando) => rodar(() => definirComandosAcao(jogo, [c])),
    tirar: (c: Comando) => rodar(() => enviarComandosAcao(jogo, pendentes.filter((x) => x !== c))),
  }
}
export type Comandos = ReturnType<typeof useComandos>

/** O comando em uma frase, para a lista de pendentes. */
export function descrever(m: Mundo, c: Comando): string {
  const nome = (id: number) => m.jogadores[id]?.nome ?? '?'
  switch (c.tipo) {
    case 'banco': return c.acao === 'pegar' ? 'Pegar R$ 500 mil emprestados' : 'Devolver R$ 500 mil do empréstimo'
    case 'obra': return `Ampliar o estádio: ${c.mais.map((n) => n.toLocaleString('pt-BR')).join(' / ')} lugares`
    case 'ingresso': return c.precos ? `Ingressos: ${c.precos.map((p) => `R$ ${p}`).join(' / ')}` : 'Ingressos no preço automático'
    case 'treino': return `Treino: ${c.auxiliar ? 'o auxiliar decide' : c.foco === 0 ? 'características principais' : 'características secundárias'}`
    case 'comprar': return `Proposta de ${dinheiro(c.valor)} por ${nome(c.jogador)}${c.aceitarContraproposta ? ' (aceita a contraproposta)' : ''}`
    case 'lance': return `Lance de ${dinheiro(c.valor)} por ${nome(c.jogador)}`
    case 'pedirEmprestado': return `Pedir ${nome(c.jogador)} emprestado`
    case 'responderProposta': return `${c.aceitar ? 'Aceitar' : 'Recusar'} a proposta #${c.proposta}`
    case 'anunciar': return `Colocar ${nome(c.jogador)} à venda por ${dinheiro(c.preco)}`
    case 'retirarDaLista': return `Tirar ${nome(c.jogador)} da venda`
    case 'paraEmprestimo': return `${c.sim ? 'Disponibilizar' : 'Não disponibilizar'} ${nome(c.jogador)} para empréstimo`
    case 'encerrarEmprestimo': return `Encerrar o empréstimo de ${nome(c.jogador)}`
    case 'comprarEmprestado': return `Comprar ${nome(c.jogador)} (emprestado)`
    case 'promoverJunior': return `Promover ${nome(c.jogador)} ao elenco`
    case 'dispensarJunior': return `Dispensar ${nome(c.jogador)}`
    case 'renovar': return `Renovar com ${nome(c.jogador)}: ${dinheiro(c.salario)}, ${['6 meses', '1 ano', '2 anos', '3 anos'][c.duracao]}`
    case 'aposentar': return `Aposentar ${nome(c.jogador)}`
    case 'config': return [c.energiaMin !== undefined && (c.energiaMin ? `Trocar cansados abaixo de ${c.energiaMin}%` : 'Não trocar cansados'),
      c.renovarAuto !== undefined && `Renovação automática ${c.renovarAuto ? 'ligada' : 'desligada'}`].filter(Boolean).join(' · ')
    default: return c.tipo
  }
}

/** Os pedidos desta rodada (dos tipos dados), com desfazer, e o último erro. */
export function Pendentes({ k, tipos, titulo = 'Pedidos para esta rodada' }: { k: Comandos; tipos: Comando['tipo'][]; titulo?: string }) {
  const { mundo: m } = useJogo()
  const lista = k.pendentes.filter((c) => tipos.includes(c.tipo))
  if (!m || (!lista.length && !k.erro)) return null
  return (
    <div className="card secao" style={{ gap: 10 }}>
      <h2>{titulo}</h2>
      {k.erro && <p role="alert" style={{ margin: 0, color: 'var(--rosa)' }}>{k.erro}</p>}
      {lista.map((c, i) => (
        <div key={i} className="linha" style={{ justifyContent: 'space-between' }}>
          <span>{descrever(m, c)}</span>
          {k.aberto && <button className="fantasma" disabled={k.ocupado} onClick={() => void k.tirar(c)}>Desfazer</button>}
        </div>
      ))}
      {lista.length > 0 && <p className="fraco" style={{ margin: 0, fontSize: 12 }}>Vale quando a rodada for resolvida.</p>}
    </div>
  )
}

/** Aviso quando a fase não aceita pedidos (partida, intervalo, resultados). */
export function Fechado({ k }: { k: Comandos }) {
  return k.aberto ? null : <p className="mudo" style={{ margin: 0 }}>Pedidos só no planejamento da rodada.</p>
}
