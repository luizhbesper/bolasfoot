'use client'
// Estádio: lugares por setor, obra (orçamento ao vivo, paga à vista quando a rodada resolve) e preço dos ingressos.
import { orcamentoObra, precoPadrao, tetoEstadio, type Comando } from '@bolasfoot/engine'
import { useState } from 'react'
import { Fechado, Pendentes, useComandos } from '../comandos.tsx'
import { dataLonga, dinheiro } from '../consultas.ts'
import { useJogo } from '../contexto.tsx'
import { Carregando, SemClube } from '../hub.tsx'

const SETORES = ['Geral', 'Arquibancada', 'Cadeira', 'Camarote']
type Quatro = [number, number, number, number]

export function Estadio({ pendentes }: { pendentes: Comando[] }) {
  const { mundo: m, meuTime: t } = useJogo()
  const k = useComandos(pendentes)
  const [mais, setMais] = useState<Quatro>([0, 0, 0, 0])
  const ingresso = pendentes.findLast((c) => c.tipo === 'ingresso')
  const atual = ingresso?.tipo === 'ingresso' ? ingresso.precos : t && !t.estadio.precoAuto ? t.estadio.precos : null
  const [precos, setPrecos] = useState<Quatro | null>(atual ? [...atual] : null)
  if (!m) return <Carregando />
  if (!t?.financas) return <SemClube />
  const f = t.financas
  const teto = tetoEstadio(m.temporada)
  const orc = orcamentoObra(t, mais)
  const padrao = precoPadrao(1, t) as Quatro
  const total = t.estadio.setores.reduce((s, n) => s + n, 0)
  const obraPedida = pendentes.some((c) => c.tipo === 'obra')
  const obras = f.obras ?? []
  const bloqueada = !f.obra && obras.some((o) => o.temporada === m.temporada)
  const invalida = mais.every((n) => n === 0) || mais.some((n, i) => n < 0 || t.estadio.setores[i]! + n > teto[i]!) || orc.custo > f.caixa

  return (
    <div className="grade2">
      <section className="coluna">
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="cabecalho"><h2>{t.estadio.nome}</h2><span className="mudo">{total.toLocaleString('pt-BR')} lugares</span></div>
          <div className="rolagem">
            <table className="tabela" style={{ minWidth: 520 }}>
              <thead><tr><th>Setor</th><th className="num">Lugares</th><th className="num">Teto</th><th className="num">Ampliar</th></tr></thead>
              <tbody>
                {SETORES.map((nome, i) => (
                  <tr key={nome}>
                    <td>{nome}</td>
                    <td className="num">{t.estadio.setores[i]!.toLocaleString('pt-BR')}{f.obra && f.obra.setores[i]! > 0 && <span className="etiqueta pessego" style={{ marginLeft: 8 }}>+{f.obra.setores[i]!.toLocaleString('pt-BR')}</span>}</td>
                    <td className="num mudo">{teto[i]!.toLocaleString('pt-BR')}</td>
                    <td className="num">
                      <input type="number" min={0} step={100} max={teto[i]! - t.estadio.setores[i]!} aria-label={`Ampliar ${nome}`} value={mais[i]} style={{ width: 110, textAlign: 'right' }}
                        disabled={!k.aberto || !!f.obra || obraPedida || bloqueada}
                        onChange={(e) => setMais((x) => x.map((v, j) => (j === i ? Math.max(0, Math.trunc(Number(e.target.value) || 0)) : v)) as Quatro)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="secao" style={{ paddingTop: 12 }}>
            {f.obra ? (
              <p className="mudo" style={{ margin: 0 }}>Obra em andamento até {dataLonga(f.obra.fim)}.</p>
            ) : bloqueada ? (
              <p className="mudo" style={{ margin: 0 }}>Uma reforma por temporada: a próxima pode começar na temporada que vem.</p>
            ) : (
              <div className="linha">
                <span>Custo <strong>{dinheiro(orc.custo)}</strong> · {orc.dias} dias</span>
                <span className="fraco" style={{ fontSize: 13 }}>caixa {dinheiro(f.caixa)}</span>
                <button className="primario" style={{ marginLeft: 'auto' }} disabled={!k.aberto || k.ocupado || invalida || obraPedida}
                  onClick={() => void k.mandar({ tipo: 'obra', mais }).then((e) => !e && setMais([0, 0, 0, 0]))}>Começar obra</button>
              </div>
            )}
            <Fechado k={k} />
          </div>
        </div>
        {obras.length > 0 && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="cabecalho"><h2>Reformas</h2></div>
            <div className="rolagem">
              <table className="tabela" style={{ minWidth: 520 }}>
                <thead><tr><th>Início</th><th>Entrega</th><th className="num">Lugares</th><th className="num">Custo</th></tr></thead>
                <tbody>
                  {obras.toReversed().map((o) => (
                    <tr key={o.dia}>
                      <td>{dataLonga(o.dia)}</td>
                      <td>{o.fim >= m.dia ? <span className="etiqueta pessego">{dataLonga(o.fim)}</span> : dataLonga(o.fim)}</td>
                      <td className="num" title={SETORES.map((n, i) => `${n}: +${o.setores[i]}`).join(', ')}>+{o.setores.reduce((a, b) => a + b, 0).toLocaleString('pt-BR')}</td>
                      <td className="num">{dinheiro(o.custo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <aside className="coluna">
        <div className="card secao">
          <h2>Ingressos</h2>
          <label className="check">
            <input type="checkbox" checked={precos === null} disabled={!k.aberto} onChange={(e) => setPrecos(e.target.checked ? null : [...padrao])} />
            Preço automático
          </label>
          {SETORES.map((nome, i) => (
            <label key={nome} className="linha" style={{ justifyContent: 'space-between' }}>
              <span>{nome} <span className="fraco" style={{ fontSize: 12 }}>(padrão R$ {padrao[i]})</span></span>
              <input type="number" min={0} style={{ width: 100, textAlign: 'right' }} disabled={!k.aberto || precos === null}
                value={precos?.[i] ?? padrao[i]} onChange={(e) => setPrecos((p) => p && (p.map((v, j) => (j === i ? Math.max(0, Math.trunc(Number(e.target.value) || 0)) : v)) as Quatro))} />
            </label>
          ))}
          <p className="fraco" style={{ margin: 0, fontSize: 12 }}>Cada real abaixo do padrão traz ~3% a mais de público no setor; acima, afasta.</p>
          <button disabled={!k.aberto || k.ocupado} onClick={() => void k.mandar({ tipo: 'ingresso', precos })}>Salvar preços</button>
        </div>
        <Pendentes k={k} tipos={['obra', 'ingresso']} />
      </aside>
    </div>
  )
}
