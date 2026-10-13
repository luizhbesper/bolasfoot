'use server'
import { revalidatePath } from 'next/cache'
import { exigirUsuario } from '../../../lib/auth/sessao.ts'
import { db } from '../../../lib/db/index.ts'
import { marcarReady } from '../../../lib/game/rodada.ts'

export async function readyAcao(f: FormData) {
  const u = await exigirUsuario()
  const jogo = Number(f.get('jogo'))
  await marcarReady(db(), jogo, u.id, f.get('ready') === '1')
  revalidatePath(`/jogo/${jogo}`)
}
