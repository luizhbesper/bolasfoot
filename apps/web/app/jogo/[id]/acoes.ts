'use server'
import { revalidatePath } from 'next/cache'
import { exigirUsuario } from '../../../lib/auth/sessao.ts'
import { db } from '../../../lib/db/index.ts'
import { escolherTime } from '../../../lib/game/escolha.ts'
import { marcarReady } from '../../../lib/game/rodada.ts'
import { redirect } from 'next/navigation'

export async function readyAcao(f: FormData) {
  const u = await exigirUsuario()
  const jogo = Number(f.get('jogo'))
  await marcarReady(db(), jogo, u.id, f.get('ready') === '1')
  revalidatePath(`/jogo/${jogo}`)
}

export async function escolherAcao(f: FormData) {
  const u = await exigirUsuario()
  const jogo = Number(f.get('jogo'))
  const erro = await escolherTime(db(), jogo, u.id, String(f.get('time')))
  revalidatePath(`/jogo/${jogo}`)
  if (erro) redirect(`/jogo/${jogo}?erro=` + encodeURIComponent(erro))
}
