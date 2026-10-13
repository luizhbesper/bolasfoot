'use server'
import { revalidatePath } from 'next/cache'
import { exigirUsuario } from '../../../lib/auth/sessao.ts'
import { db } from '../../../lib/db/index.ts'
import { escolherTime } from '../../../lib/game/escolha.ts'
import { definirComandos, enviarComandos, marcarReady, transicionar } from '../../../lib/game/rodada.ts'
import type { Comando } from '@bolasfoot/engine'
import { redirect } from 'next/navigation'
import { after } from 'next/server'

export async function readyAcao(f: FormData) {
  const u = await exigirUsuario()
  const jogo = Number(f.get('jogo'))
  const ready = f.get('ready') === '1'
  await marcarReady(db(), jogo, u.id, ready, false)
  // o motor roda depois da resposta: o botão volta na hora e o SSE leva a fase nova a todos
  if (ready) after(() => transicionar(db(), jogo))
}

export async function escolherAcao(f: FormData) {
  const u = await exigirUsuario()
  const jogo = Number(f.get('jogo'))
  const erro = await escolherTime(db(), jogo, u.id, String(f.get('time')))
  revalidatePath(`/jogo/${jogo}`)
  if (erro) redirect(`/jogo/${jogo}?erro=` + encodeURIComponent(erro))
}

/** Soma comandos aos já guardados na fase (escalação, tática… substituem os anteriores). Devolve o erro, se houver. */
export async function definirComandosAcao(jogo: number, novos: Comando[]): Promise<string | null> {
  const u = await exigirUsuario()
  const r = await definirComandos(db(), jogo, u.id, novos)
  return 'erro' in r ? r.erro : r.erros.find((e) => e !== null) ?? null
}

/** Troca a lista inteira de comandos da fase (o intervalo manda substituições + tática de uma vez). */
export async function enviarComandosAcao(jogo: number, lista: Comando[]): Promise<string | null> {
  const u = await exigirUsuario()
  const r = await enviarComandos(db(), jogo, u.id, lista)
  return 'erro' in r ? r.erro : r.erros.find((e) => e !== null) ?? null
}
