'use server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { entrar, resgatarConvite } from '../lib/auth/conta.ts'
import { tentar } from '../lib/auth/limite.ts'
import { criarSessao, encerrarSessao, usuarioAtual } from '../lib/auth/sessao.ts'
import { db } from '../lib/db/index.ts'

const campo = (f: FormData, k: string) => String(f.get(k) ?? '')
const ip = async () => (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'

export async function entrarAcao(f: FormData) {
  if (!tentar(await ip())) redirect('/entrar?erro=' + encodeURIComponent('muitas tentativas; espere alguns minutos'))
  const id = await entrar(db(), campo(f, 'usuario'), campo(f, 'senha'))
  if (!id) redirect('/entrar?erro=' + encodeURIComponent('usuário ou senha não conferem'))
  await criarSessao(id)
  redirect('/')
}

export async function conviteAcao(f: FormData) {
  const logado = await usuarioAtual()
  if (!logado && !tentar(await ip())) redirect('/convite?erro=' + encodeURIComponent('muitas tentativas; espere alguns minutos'))
  const r = await resgatarConvite(db(), campo(f, 'codigo'), logado ? { userId: logado.id } : { usuario: campo(f, 'usuario'), senha: campo(f, 'senha') })
  if ('erro' in r) redirect('/convite?erro=' + encodeURIComponent(r.erro))
  if (!logado) await criarSessao(r.userId)
  redirect(`/jogo/${r.gameId}`)
}

export async function sairAcao() {
  await encerrarSessao()
  redirect('/entrar')
}
